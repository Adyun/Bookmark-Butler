// Content script entry point
console.log("Smart Bookmark Extension loaded");

// 创建Modal管理器实例
var modalManager = new window.ModalManager();

// 存储事件处理函数的引用，以便后续清理
var keydownHandler = null;
var messageHandler = null;

/**
 * 获取当前页面信息
 * @returns {Object} 页面信息 {title, url}
 */
function getCurrentPageInfo() {
  return {
    title: document.title,
    url: window.location.href
  };
}

/**
 * 初始化扩展
 */
function initExtension() {
  // 监听来自background script的消息
  messageHandler = handleMessage;
  chrome.runtime.onMessage.addListener(messageHandler);

  // 页面卸载时清理事件监听器
  window.addEventListener('beforeunload', cleanup);
}

/**
 * 处理来自background script的消息
 * @param {Object} request - 消息内容
 * @param {Object} sender - 发送者信息
 * @param {Function} sendResponse - 响应函数
 */
function handleMessage(request, sender, sendResponse) {
  if (request.action === "openBookmarkModal") {
    // 显示Modal
    modalManager.show(request.pageInfo);
    sendResponse({ status: "success" });
    return true; // 保持消息通道开放直到sendResponse被调用
  }
}


/**
 * 清理函数
 */
function cleanup() {
  // 移除事件监听器
  if (messageHandler) {
    chrome.runtime.onMessage.removeListener(messageHandler);
    messageHandler = null;
  }

  window.removeEventListener('beforeunload', cleanup);

  // 清理Modal管理器
  if (modalManager && typeof modalManager.cleanup === 'function') {
    modalManager.cleanup();
  }
}

// 初始化扩展
initExtension();