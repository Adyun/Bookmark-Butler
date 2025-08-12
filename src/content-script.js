// Content script entry point
console.log("Smart Bookmark Extension content script loaded");

// 向background script报告脚本已加载
if (chrome.runtime && chrome.runtime.sendMessage) {
  chrome.runtime.sendMessage({
    action: "contentScriptLoaded",
    url: window.location.href,
    timestamp: Date.now()
  }).catch((error) => {
    console.log("Could not send loaded message:", error);
  });
}

// 内存管理器
const memoryManager = {
  modalManager: null,
  eventListeners: [],
  observers: [],
  intervals: [],
  timeouts: [],

  init() {
    console.log("Initializing memory manager");
    
    try {
      // 检查必要的依赖是否存在
      if (!window.ModalManager) {
        console.error("ModalManager class not found");
        return false;
      }

      // 创建Modal管理器实例
      this.modalManager = new window.ModalManager();
      console.log("ModalManager created successfully");
      
      // 暴露到全局，供其他组件使用
      window.modalManager = this.modalManager;

      // 设置定期清理
      this.setupPeriodicCleanup();

      // 监听页面可见性变化
      this.handleVisibilityChange();

      // 监听页面卸载
      this.setupUnloadHandlers();
      
      return true;
    } catch (error) {
      console.error("Error initializing memory manager:", error);
      return false;
    }
  },

  /**
   * 添加事件监听器并记录引用
   */
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
    return handler;
  },

  /**
   * 设置超时并记录引用
   */
  setTimeout(callback, delay) {
    const timeoutId = setTimeout(callback, delay);
    this.timeouts.push(timeoutId);
    return timeoutId;
  },

  /**
   * 设置间隔并记录引用
   */
  setInterval(callback, delay) {
    const intervalId = setInterval(callback, delay);
    this.intervals.push(intervalId);
    return intervalId;
  },

  /**
   * 创建观察器并记录引用
   */
  createObserver(type, callback, options) {
    let observer;

    switch (type) {
      case 'MutationObserver':
        observer = new MutationObserver(callback);
        break;
      case 'IntersectionObserver':
        observer = new IntersectionObserver(callback, options);
        break;
      case 'ResizeObserver':
        observer = new ResizeObserver(callback);
        break;
    }

    if (observer) {
      this.observers.push(observer);
    }

    return observer;
  },

  /**
   * 设置定期清理 - 优化版本，避免在使用时清理
   */
  setupPeriodicCleanup() {
    // 每2分钟清理一次过期数据（但不在Modal显示时）
    const cleanupInterval = this.setInterval(() => {
      if (!this.modalManager || !this.modalManager.isModalVisible()) {
        this.cleanup();
      }
    }, 2 * 60 * 1000);

    // 每10分钟深度清理（但不在Modal显示时）
    const deepCleanupInterval = this.setInterval(() => {
      if (!this.modalManager || !this.modalManager.isModalVisible()) {
        this.deepCleanup();
      }
    }, 10 * 60 * 1000);
  },

  /**
   * 处理页面可见性变化 - 优化版本，避免误关闭
   */
  handleVisibilityChange() {
    let hideTimeout = null;
    
    this.addEventListener(document, 'visibilitychange', () => {
      if (document.hidden) {
        // 延迟关闭Modal，避免短暂失焦导致的误关闭
        hideTimeout = setTimeout(() => {
          if (document.hidden && this.modalManager && this.modalManager.isModalVisible()) {
            // 检查用户是否在活跃交互，如果是则不关闭
            if (this.modalManager.isUserActive) {
              console.log('User is active, not closing modal despite page being hidden');
              return;
            }
            console.log('Page hidden for extended time, closing modal');
            this.modalManager.hide();
            
            // 清理缓存
            if (window.SMART_BOOKMARK_API && window.SMART_BOOKMARK_API.clearCache) {
              window.SMART_BOOKMARK_API.clearCache();
            }
            if (window.SMART_BOOKMARK_SORTING && window.SMART_BOOKMARK_SORTING.clearActivityCache) {
              window.SMART_BOOKMARK_SORTING.clearActivityCache();
            }
          }
        }, 3000); // 3秒后才关闭，避免短暂失焦
      } else {
        // 页面重新可见时取消关闭
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
      }
    });
  },

  /**
   * 设置页面卸载处理程序 - 精简版本，避免重复监听
   */
  setupUnloadHandlers() {
    // 监听扩展卸载
    if (chrome.runtime.onSuspend) {
      chrome.runtime.onSuspend.addListener(() => this.cleanup());
    }

    // 注意：visibilitychange 已在 handleVisibilityChange 中处理，不重复添加
  },

  /**
   * 减少内存使用 - 优化版本，避免在活跃使用时清理
   */
  reduceMemoryUsage() {
    // 只在Modal不可见时才进行内存清理
    if (!this.modalManager || !this.modalManager.isModalVisible()) {
      // 清理缓存
      if (window.SMART_BOOKMARK_API && window.SMART_BOOKMARK_API.clearCache) {
        window.SMART_BOOKMARK_API.clearCache();
      }
      if (window.SMART_BOOKMARK_SORTING && window.SMART_BOOKMARK_SORTING.clearActivityCache) {
        window.SMART_BOOKMARK_SORTING.clearActivityCache();
      }
      console.log('Memory usage reduced (modal not active)');
    } else {
      console.log('Skipped memory cleanup - modal is active');
    }
  },

  /**
   * 常规清理
   */
  cleanup() {
    this.reduceMemoryUsage();

    // 清理过期的超时和间隔
    const now = Date.now();
    this.timeouts = this.timeouts.filter(id => {
      try {
        clearTimeout(id);
        return false;
      } catch (e) {
        return true; // 已经被清理
      }
    });

    this.intervals = this.intervals.filter(id => {
      try {
        clearInterval(id);
        return false;
      } catch (e) {
        return true; // 已经被清理
      }
    });
  },

  /**
   * 深度清理
   */
  deepCleanup() {
    // 清理事件监听器
    this.eventListeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler);
      } catch (e) {
        // 忽略已经移除的监听器
      }
    });
    this.eventListeners = [];

    // 清理观察器
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (e) {
        // 忽略已经断开的观察器
      }
    });
    this.observers = [];

    // 清理Modal管理器
    if (this.modalManager && this.modalManager.cleanup) {
      this.modalManager.cleanup();
    }

    // 重置引用
    this.modalManager = null;

    console.log("Content script memory cleaned up");
  }
};

// 获取当前页面信息
function getCurrentPageInfo() {
  return {
    title: document.title,
    url: window.location.href
  };
}

/**
 * 处理来自background script的消息
 */
function handleMessage(request, sender, sendResponse) {
  console.log("Content script received message:", request);
  
  try {
    // 简单的ping响应，用于检测脚本是否加载
    if (request.action === "ping") {
      console.log("Responding to ping");
      sendResponse({ status: "success", message: "Content script is alive" });
      return true;
    }
    
    if (request.action === "openBookmarkModal") {
      // 检查modalManager是否存在
      if (!memoryManager.modalManager) {
        console.error("ModalManager not initialized");
        sendResponse({ status: "error", message: "ModalManager not initialized" });
        return true;
      }

      // 显示Modal
      memoryManager.modalManager.show(request.pageInfo);
      sendResponse({ status: "success" });
      
      console.log("Modal opened successfully");
      return true;
    }
  } catch (error) {
    console.error("Error in handleMessage:", error);
    sendResponse({ status: "error", message: error.message });
    return true;
  }
  
  // 未知的action
  sendResponse({ status: "error", message: "Unknown action: " + request.action });
  return true;
}

/**
 * 初始化扩展
 */
let isInitialized = false;

function initExtension() {
  if (isInitialized) {
    console.log("Extension already initialized, skipping");
    return;
  }
  
  console.log("Initializing Smart Bookmark Extension");
  
  try {
    // 初始化内存管理器
    const initSuccess = memoryManager.init();
    
    if (!initSuccess) {
      console.error("Failed to initialize memory manager");
      return;
    }

    // 确保chrome.runtime.onMessage的正确使用
    if (chrome.runtime.onMessage && chrome.runtime.onMessage.addListener) {
      chrome.runtime.onMessage.addListener(handleMessage);
      console.log("Message listener added successfully");
    } else {
      console.error("chrome.runtime.onMessage not available");
    }
    
    isInitialized = true;
    console.log("Smart Bookmark Extension initialized successfully");
  } catch (error) {
    console.error("Error initializing extension:", error);
  }
}

// 监听DOMContentLoaded确保页面完全加载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  // 页面已经加载完成，直接初始化
  initExtension();
}

// 监听扩展卸载
if (chrome.runtime && chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => memoryManager.deepCleanup());
}

// 暴露清理函数供外部调用
window.SmartBookmarkCleanup = () => memoryManager.deepCleanup();