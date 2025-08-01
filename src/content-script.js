// Content script entry point
console.log("Smart Bookmark Extension loaded");

// 内存管理器
const memoryManager = {
  modalManager: null,
  eventListeners: [],
  observers: [],
  intervals: [],
  timeouts: [],

  init() {
    // 创建Modal管理器实例
    this.modalManager = new window.ModalManager();

    // 设置定期清理
    this.setupPeriodicCleanup();

    // 监听页面可见性变化
    this.handleVisibilityChange();

    // 监听页面卸载
    this.setupUnloadHandlers();
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
   * 设置定期清理
   */
  setupPeriodicCleanup() {
    // 每30秒清理一次过期数据
    const cleanupInterval = this.setInterval(() => {
      this.cleanup();
    }, 30000);

    // 每5分钟深度清理
    const deepCleanupInterval = this.setInterval(() => {
      this.deepCleanup();
    }, 5 * 60 * 1000);
  },

  /**
   * 处理页面可见性变化
   */
  handleVisibilityChange() {
    this.addEventListener(document, 'visibilitychange', () => {
      if (document.hidden) {
        // 页面隐藏时（离开页面）立即关闭Modal
        if (this.modalManager && this.modalManager.isModalVisible()) {
          this.modalManager.hide();
          
          // 同时清理缓存
          if (window.SMART_BOOKMARK_API && window.SMART_BOOKMARK_API.clearCache) {
            window.SMART_BOOKMARK_API.clearCache();
          }
          if (window.SMART_BOOKMARK_SORTING && window.SMART_BOOKMARK_SORTING.clearActivityCache) {
            window.SMART_BOOKMARK_SORTING.clearActivityCache();
          }
        }
      }
      // 页面重新可见时不做任何操作，让用户主动重新打开Modal
    });
  },

  /**
   * 设置页面卸载处理程序
   */
  setupUnloadHandlers() {
    // 监听扩展卸载
    if (chrome.runtime.onSuspend) {
      chrome.runtime.onSuspend.addListener(() => this.cleanup());
    }

    // 使用更安全的页面可见性变化监听
    this.addEventListener(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.reduceMemoryUsage();
      }
    });
  },

  /**
   * 减少内存使用
   */
  reduceMemoryUsage() {
    // 清理Modal实例
    if (this.modalManager && this.modalManager.hide) {
      this.modalManager.hide();
    }

    // 清理缓存
    if (window.SMART_BOOKMARK_API && window.SMART_BOOKMARK_API.clearCache) {
      window.SMART_BOOKMARK_API.clearCache();
    }
    if (window.SMART_BOOKMARK_SORTING && window.SMART_BOOKMARK_SORTING.clearActivityCache) {
      window.SMART_BOOKMARK_SORTING.clearActivityCache();
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
  if (request.action === "openBookmarkModal") {
    // 显示Modal
    memoryManager.modalManager.show(request.pageInfo);
    sendResponse({ status: "success" });

    // 移除自动清理逻辑，避免意外关闭模态框
    // 清理将在用户主动关闭模态框时进行

    return true;
  }
}

/**
 * 初始化扩展
 */
function initExtension() {
  // 初始化内存管理器
  memoryManager.init();

  // 确保chrome.runtime.onMessage的正确使用
  if (chrome.runtime.onMessage && chrome.runtime.onMessage.addListener) {
    chrome.runtime.onMessage.addListener(handleMessage);
  }
}

// 初始化扩展
initExtension();

// 监听DOMContentLoaded确保页面完全加载
if (document.readyState === 'loading') {
  memoryManager.addEventListener(document, 'DOMContentLoaded', initExtension);
} else {
  initExtension();
}

// 监听扩展卸载
if (chrome.runtime && chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => memoryManager.deepCleanup());
}

// 暴露清理函数供外部调用
window.SmartBookmarkCleanup = () => memoryManager.deepCleanup();