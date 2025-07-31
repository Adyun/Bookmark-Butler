// Background script to handle extension commands
console.log("Smart Bookmark Extension background script loaded");

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in background script:", request);

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
          // 计算文件夹中的书签数量
          let bookmarkCount = 0;
          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              if (child && child.url) {
                bookmarkCount++;
              }
            }
          }

          // 跳过没有标题的根节点
          if (node.id !== '0' || node.title) {
            folders.push({
              id: node.id,
              title: node.title || '未命名文件夹',
              children: node.children || [],
              bookmarkCount: bookmarkCount
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
});

// 监听插件图标点击事件
chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked");

  // 向内容脚本发送消息以打开书签Modal
  chrome.tabs.sendMessage(tab.id, {
    action: "openBookmarkModal",
    pageInfo: {
      title: tab.title,
      url: tab.url
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message to content script:", chrome.runtime.lastError);
    } else {
      console.log("Message sent to content script:", response);
    }
  });
});

// 监听命令
chrome.commands.onCommand.addListener((command) => {
  console.log(`Command received: ${command}`);

  if (command === "toggle-bookmark-modal") {
    // 获取当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const activeTab = tabs[0];

        // 向内容脚本发送消息以打开书签Modal
        chrome.tabs.sendMessage(activeTab.id, {
          action: "openBookmarkModal",
          pageInfo: {
            title: activeTab.title,
            url: activeTab.url
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message to content script:", chrome.runtime.lastError);
          } else {
            console.log("Message sent to content script:", response);
          }
        });
      }
    });
  }
});