// Background script to handle extension commands
const DEBUG = false;
if (DEBUG) console.log("Smart Bookmark Extension background script loaded");

// 内存管理器
const memoryManager = {
  messageHandlers: new Map(),
  tabStates: new Map(),
  cleanupInterval: null,

  init() {
    // 设置定期清理
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // 每5分钟清理一次

    // 监听标签页关闭事件
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.cleanupTab(tabId);
    });
  },

  cleanup() {
    // 清理过期的缓存数据
    const now = Date.now();
    for (const [key, value] of this.tabStates.entries()) {
      if (now - value.lastAccess > 10 * 60 * 1000) { // 10分钟未访问
        this.tabStates.delete(key);
      }
    }

    // 清理空的messageHandlers
    for (const [key, handlers] of this.messageHandlers.entries()) {
      if (handlers && handlers.length === 0) {
        this.messageHandlers.delete(key);
      }
    }

    console.log("Background memory cleaned up");
  },

  cleanupTab(tabId) {
    this.tabStates.delete(tabId);
    this.messageHandlers.delete(tabId);
    console.log(`Cleaned up tab ${tabId}`);
  },

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.messageHandlers.clear();
    this.tabStates.clear();
  }
};

// 初始化内存管理器
memoryManager.init();

// 存储已加载内容脚本的标签页
const loadedTabs = new Set();

// 监听标签页关闭，清理记录
chrome.tabs.onRemoved.addListener((tabId) => {
  loadedTabs.delete(tabId);
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (DEBUG) console.log("Message received in background script:", request);

  // 记录内容脚本已加载
  if (sender.tab && request.action === "contentScriptLoaded") {
    console.log(`Content script loaded in tab ${sender.tab.id}:`, request.url);
    loadedTabs.add(sender.tab.id);
    sendResponse({ status: "acknowledged" });
    return;
  }

  if (request.action === "getBookmarks") {
    // 获取书签树
    chrome.bookmarks.getTree((bookmarkTree) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting bookmark tree:", chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      // 从书签树中提取文件夹
      const folders = [];

      function traverse(node) {
        if (!node) return;

        // 如果节点没有url属性，则认为是文件夹
        if (!node.url) {
          // 计算文件夹中的书签数量和子文件夹数量
          let bookmarkCount = 0;
          let subFolderCount = 0;
          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              if (child && child.url) {
                bookmarkCount++;
              } else if (child && !child.url) {
                subFolderCount++;
              }
            }
          }

          // 跳过没有标题的根节点
          if (node.id !== '0' || node.title) {
            folders.push({
              id: node.id,
              title: node.title || '未命名文件夹',
              children: node.children || [],
              bookmarkCount: bookmarkCount,
              subFolderCount: subFolderCount,
              parentId: node.parentId
            });
          }
        }

        // 递归遍历子节点
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            traverse(child);
          }
        }
      }

      try {
        traverse(bookmarkTree[0]);
        console.log(`Extracted ${folders.length} folders`);
        sendResponse({ folders: folders });
      } catch (error) {
        console.error("Error traversing bookmark tree:", error);
        sendResponse({ error: error.message });
      }
    });

    return true; // 保持消息通道开放，以便异步发送响应
  }

  if (request.action === "createBookmark") {
    // 创建书签
    chrome.bookmarks.create({
      parentId: request.folderId,
      title: request.title,
      url: request.url
    }, (bookmark) => {
      if (chrome.runtime.lastError) {
        console.error("Error creating bookmark:", chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        console.log("Bookmark created successfully:", bookmark);
        sendResponse({ bookmark: bookmark });
      }
    });

    return true; // 保持消息通道开放，以便异步发送响应
  }

  if (request.action === "deleteBookmark") {
    // 删除书签
    chrome.bookmarks.remove(request.bookmarkId, () => {
      if (chrome.runtime.lastError) {
        console.error("Error deleting bookmark:", chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        console.log("Bookmark deleted successfully:", request.bookmarkId);
        sendResponse({ success: true });
      }
    });

    return true; // 保持消息通道开放，以便异步发送响应
  }

  if (request.action === "searchBookmarks") {
    // 搜索书签
    chrome.bookmarks.search(request.query, (results) => {
      if (chrome.runtime.lastError) {
        console.error("Error searching bookmarks:", chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      // 根据请求类型决定返回文件夹还是书签
      if (request.type === "folders") {
        // 过滤出文件夹（没有url属性的节点）
        const folders = [];
        for (const result of results) {
          if (!result.url) {
            folders.push(result);
          }
        }

        console.log(`Found ${folders.length} folders matching query: ${request.query}`);
        sendResponse({ folders: folders });
      } else if (request.type === "bookmarks") {
        // 过滤出书签（有url属性的节点）
        const bookmarks = [];
        for (const result of results) {
          if (result.url) {
            bookmarks.push(result);
          }
        }

        console.log(`Found ${bookmarks.length} bookmarks matching query: ${request.query}`);
        sendResponse({ bookmarks: bookmarks });
      } else {
        // 默认返回文件夹（保持向后兼容）
        const folders = [];
        for (const result of results) {
          if (!result.url) {
            folders.push(result);
          }
        }

        console.log(`Found ${folders.length} folders matching query: ${request.query}`);
        sendResponse({ folders: folders });
      }
    });

    return true; // 保持消息通道开放，以便异步发送响应
  }

  if (request.action === "getAllBookmarks") {
    // 获取所有书签
    chrome.bookmarks.getTree((bookmarkTree) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting bookmark tree:", chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      // 从书签树中提取书签
      const bookmarks = [];

      function traverse(node) {
        if (!node) return;

        // 如果节点有url属性，则认为是书签
        if (node.url) {
          bookmarks.push({
            id: node.id,
            title: node.title || '未命名书签',
            url: node.url,
            parentId: node.parentId
          });
        }

        // 递归遍历子节点
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            traverse(child);
          }
        }
      }

      try {
        traverse(bookmarkTree[0]);
        console.log(`Extracted ${bookmarks.length} bookmarks`);
        sendResponse({ bookmarks: bookmarks });
      } catch (error) {
        console.error("Error traversing bookmark tree:", error);
        sendResponse({ error: error.message });
      }
    });

    return true; // 保持消息通道开放，以便异步发送响应
  }

  // 处理来自fallback页面的消息
  if (request.action === "openNewTab") {
    chrome.tabs.create({
      url: request.url || 'https://www.bing.com',
      active: true
    }, function (tab) {
      if (chrome.runtime.lastError) {
        console.error("Error creating new tab:", chrome.runtime.lastError);
        sendResponse({ status: "error", message: chrome.runtime.lastError.message });
      } else {
        console.log("New tab created successfully:", tab.id);
        sendResponse({ status: "success", tabId: tab.id });
      }
    });
    return true; // 保持消息通道开放
  }

  if (request.action === "closeCurrentTab") {
    // 获取当前标签页ID
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id, function () {
        if (chrome.runtime.lastError) {
          console.error("Error closing tab:", chrome.runtime.lastError);
          sendResponse({ status: "error", message: chrome.runtime.lastError.message });
        } else {
          console.log("Tab closed successfully");
          sendResponse({ status: "success" });
        }
      });
    } else {
      sendResponse({ status: "error", message: "Could not identify current tab" });
    }
    return true; // 保持消息通道开放
  }
});

// 监听书签变化事件，并广播到前台页面，提示刷新缓存与数据
const PERSISTENT_CACHE_KEY = 'smart_bookmark_cache';

function invalidatePersistentCache() {
  try {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove([PERSISTENT_CACHE_KEY]);
    }
  } catch (e) {
    // 忽略缓存清理失败
  }
}

function broadcastBookmarksChanged(reason, payload) {
  try {
    invalidatePersistentCache();
    var message = { action: 'bookmarksChanged', reason: reason, payload: payload };
    var targetedTabs = new Set();

    // 优先向已知加载了 content script 的标签页广播（O(k) 而非 O(n)）
    if (loadedTabs.size > 0) {
      for (const tabId of loadedTabs) {
        targetedTabs.add(tabId);
        try {
          chrome.tabs.sendMessage(tabId, message)
            .catch(() => { loadedTabs.delete(tabId); });
        } catch (e) {
          loadedTabs.delete(tabId);
        }
      }
    }

    // 再扫描当前标签页：向未覆盖到的可用标签页兜底广播，避免 loadedTabs 部分失真导致漏发
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (!tab || typeof tab.id !== 'number') continue;
        if (targetedTabs.has(tab.id)) continue;
        if (isRestrictedUrl(tab.url)) continue;

        try {
          chrome.tabs.sendMessage(tab.id, message)
            .then(() => { loadedTabs.add(tab.id); })
            .catch(() => { });
        } catch (e) { }
      }
    });
  } catch (e) {
    console.warn('Failed to broadcast bookmarksChanged:', e);
  }
}

if (chrome.bookmarks && chrome.bookmarks.onCreated) {
  chrome.bookmarks.onCreated.addListener((id, node) => broadcastBookmarksChanged('created', { id, node }));
  chrome.bookmarks.onRemoved.addListener((id, removeInfo) => broadcastBookmarksChanged('removed', { id, removeInfo }));
  chrome.bookmarks.onChanged.addListener((id, changeInfo) => broadcastBookmarksChanged('changed', { id, changeInfo }));
  chrome.bookmarks.onMoved.addListener((id, moveInfo) => broadcastBookmarksChanged('moved', { id, moveInfo }));
  if (chrome.bookmarks.onImportBegan) chrome.bookmarks.onImportBegan.addListener(() => broadcastBookmarksChanged('importBegan'));
  if (chrome.bookmarks.onImportEnded) chrome.bookmarks.onImportEnded.addListener(() => broadcastBookmarksChanged('importEnded'));
}

/**
 * 向内容脚本发送消息，带重试机制
 */
function sendMessageToContentScript(tabId, message, maxRetries = 3) {
  let retryCount = 0;

  // 首先检查标签页是否可以注入脚本
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to get tab info:", chrome.runtime.lastError);
      return;
    }

    // 检查URL是否允许内容脚本
    if (isRestrictedUrl(tab.url)) {
      console.warn("Cannot inject content script into restricted URL:", tab.url);
      showNotificationFallback();
      return;
    }

    // 检查内容脚本是否已加载
    if (!loadedTabs.has(tabId)) {
      console.log("Content script not loaded in tab", tabId, "- injecting first");
      injectContentScript(tabId, message);
      return;
    }

    attemptSend();
  });

  function attemptSend() {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`Attempt ${retryCount + 1} failed:`, chrome.runtime.lastError.message);

        // 如果连接失败，可能是内容脚本被卸载了
        if (chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
          console.log("Content script appears to be unloaded, removing from loaded tabs");
          loadedTabs.delete(tabId);
        }

        if (retryCount < maxRetries) {
          retryCount++;
          // 使用递增延迟策略：第一次500ms，第二次1000ms，第三次1500ms
          const delay = retryCount * 500;
          console.log(`Retrying in ${delay}ms... (${retryCount}/${maxRetries})`);
          setTimeout(attemptSend, delay);
        } else {
          console.error("All retry attempts failed. Content script may not be loaded.");
          // 尝试重新注入内容脚本
          injectContentScript(tabId, message);
        }
      } else {
        console.log("Message sent successfully:", response);
      }
    });
  }
}

/**
 * 检查URL是否为受限制的URL
 */
function isRestrictedUrl(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return true;
  }

  const restrictedProtocols = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'about:',
    'edge://',
    'opera://',
    'file://'
  ];

  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

/**
 * 显示备用通知
 */
function showNotificationFallback() {
  console.log("Showing notification fallback");

  // 直接打开新标签页，避免通知图标问题
  chrome.tabs.create({
    url: chrome.runtime.getURL('fallback.html'),
    active: true
  }).then(() => {
    console.log("Fallback page opened successfully");
  }).catch((error) => {
    console.error("Could not open fallback page:", error);

    // 如果连fallback页面也打不开，尝试简单的通知
    trySimpleNotification();
  });
}

/**
 * 尝试创建简单通知（作为最后的备用方案）
 */
function trySimpleNotification() {
  if (chrome.notifications) {
    // 创建一个base64编码的简单图标作为备用
    const simpleIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    chrome.notifications.create({
      type: 'basic',
      iconUrl: simpleIcon,
      title: '智能书签扩展',
      message: '当前页面不支持书签管理器。请在普通网页中使用此功能。'
    }, function (notificationId) {
      if (chrome.runtime.lastError) {
        console.error('Simple notification also failed:', chrome.runtime.lastError.message);
        console.log('Notification system appears to be unavailable. User will need to manually navigate to a regular webpage.');
      } else {
        console.log('Simple notification created successfully:', notificationId);
      }
    });
  } else {
    console.log('Notifications API not available');
  }
}

/**
 * 尝试重新注入内容脚本
 */
function injectContentScript(tabId, originalMessage) {
  console.log("Attempting to inject content script into tab", tabId);

  // 首先检查标签页是否还存在
  chrome.tabs.get(tabId, async (tab) => {
    if (chrome.runtime.lastError) {
      console.error("Tab no longer exists:", chrome.runtime.lastError);
      return;
    }

    console.log("Tab info:", tab.url, tab.status);

    if (isRestrictedUrl(tab.url)) {
      console.warn("Cannot inject into restricted URL:", tab.url);
      showNotificationFallback();
      return;
    }

    // 等待页面加载完成
    if (tab.status !== 'complete') {
      console.log("Tab not ready, waiting for load completion");
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          console.log("Tab loaded, now injecting content script");
          performInjection();
        }
      });
    } else {
      performInjection();
    }

    function performInjection() {
      // 先尝试简单的ping测试
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
        if (!chrome.runtime.lastError) {
          console.log("Content script already loaded, sending original message");
          loadedTabs.add(tabId);
          if (originalMessage) {
            sendMessageToContentScript(tabId, originalMessage, 1);
          }
          return;
        }

        console.log("Content script not loaded, injecting scripts");

        // 尝试注入脚本
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: [
            'src/utils/constants.js',
            'src/utils/helpers.js',
            'src/utils/bookmark-api.js',
            'src/utils/sorting-algorithm.js',
            'src/utils/pin-manager.js',
            'src/utils/query-history.js',
            'src/utils/search-engine.js',
            'src/components/virtual-scroller.js',
            'src/components/ui-manager.js',
            'src/components/theme-manager.js',
            'src/components/keyboard-manager.js',
            'src/components/language-manager.js',
            'src/modal/modal-manager-core.js',
            'src/modal/modal-manager-data.js',
            'src/modal/modal-manager-search.js',
            'src/modal/modal-manager-render.js',
            'src/modal/modal-manager-navigation.js',
            'src/modal/modal-manager-export.js',
            'src/content-script.js'
          ]
        }).then(() => {
          console.log("Content script files injected successfully");

          // 同时注入CSS
          return chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ['src/styles/modal.css']
          });
        }).then(() => {
          console.log("CSS injected successfully");

          // 记录脚本已加载
          loadedTabs.add(tabId);

          // 等待脚本初始化后发送原始消息
          setTimeout(() => {
            console.log("Waiting period complete, sending original message");
            if (originalMessage) {
              sendMessageToContentScript(tabId, originalMessage, 1);
            }
          }, 2000);
        }).catch((error) => {
          console.error("Failed to inject content script or CSS:", error);
          console.error("Error details:", error.message);
          showNotificationFallback();
        });
      });
    }
  });
}

// 监听插件图标点击事件
chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked for tab:", tab.id, tab.url);

  // 向内容脚本发送消息以打开书签Modal
  sendMessageToContentScript(tab.id, {
    action: "openBookmarkModal",
    pageInfo: {
      title: tab.title,
      url: tab.url
    }
  });
});
