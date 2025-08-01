// UI Manager for the Smart Bookmark Extension

/**
 * UI管理器 - 处理界面布局、状态管理和用户交互
 */
function UIManager() {
  this.eventListeners = [];
  this.currentMode = window.SMART_BOOKMARK_CONSTANTS.DEFAULT_MODE;
  this.selectedIndex = -1;
  this.isModalVisible = false;
}

/**
 * 创建Modal DOM元素
 */
UIManager.prototype.createModal = function () {
  // 检查是否已经存在Modal
  if (document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID)) {
    return;
  }

  // 创建modal背景层
  var modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'smart-bookmark-modal-backdrop';
  
  var modal = document.createElement('div');
  modal.id = window.SMART_BOOKMARK_CONSTANTS.MODAL_ID;
  modal.className = 'smart-bookmark-modal';
  modal.innerHTML =
    '<div class="smart-bookmark-modal-header">' +
    '<h2 class="smart-bookmark-modal-title">搜索书签</h2>' +
    '<div class="smart-bookmark-header-controls">' +
    '<button id="' + window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID + '" class="smart-bookmark-dark-mode-toggle" title="深色模式设置">🌙</button>' +
    '<div id="smart-bookmark-dark-mode-dropdown" class="smart-bookmark-dark-mode-dropdown">' +
    '<div class="smart-bookmark-dark-mode-option" data-mode="auto">跟随系统</div>' +
    '<div class="smart-bookmark-dark-mode-option" data-mode="light">浅色模式</div>' +
    '<div class="smart-bookmark-dark-mode-option" data-mode="dark">深色模式</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="smart-bookmark-modal-body">' +
    '<input type="text" id="' + window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID + '" class="smart-bookmark-search" placeholder="搜索书签...">' +
    '<div class="smart-bookmark-list-container">' +
    '<ul id="' + window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID + '" class="smart-bookmark-bookmark-list"></ul>' +
    '<ul id="' + window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID + '" class="smart-bookmark-folder-list" style="display: none;"></ul>' +
    '</div>' +
    '</div>' +
    '<div class="smart-bookmark-modal-footer">' +
    '<div class="smart-bookmark-keyboard-hints">' +
    '<span class="smart-bookmark-keyboard-hint">↑↓ 选择</span>' +
    '<span class="smart-bookmark-keyboard-hint">Enter 确认</span>' +
    '<span class="smart-bookmark-keyboard-hint">Space 切换模式</span>' +
    '</div>' +
    '<div class="smart-bookmark-footer-buttons">' +
    '<button class="smart-bookmark-btn smart-bookmark-btn-secondary" id="smart-bookmark-cancel">取消</button>' +
    '<button class="smart-bookmark-btn smart-bookmark-btn-primary" id="smart-bookmark-confirm" style="display: none;">添加书签</button>' +
    '</div>' +
    '</div>';

  // 添加Toast元素
  var toast = document.createElement('div');
  toast.id = window.SMART_BOOKMARK_CONSTANTS.TOAST_ID;
  toast.className = 'smart-bookmark-toast';

  // 将modal放在backdrop中
  modalBackdrop.appendChild(modal);
  document.body.appendChild(modalBackdrop);
  document.body.appendChild(toast);

  // 修复布局问题 - 确保Modal内容区域正确计算高度
  this.setupModalLayout();
};

/**
 * 设置Modal布局 - 修复高度计算问题
 */
UIManager.prototype.setupModalLayout = function () {
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (!modal) return;

  // 使用CSS变量来动态计算高度，但不强制固定高度
  var style = document.createElement('style');
  style.textContent = `
    .smart-bookmark-modal {
      --header-height: 70px;
      --footer-height: 80px;
      --padding: 40px;
    }
    
    .smart-bookmark-modal-body {
      /* 让body根据内容自适应高度 */
      flex: 1;
      min-height: 300px;
      max-height: calc(70vh - var(--header-height) - var(--footer-height));
    }
    
    .smart-bookmark-list-container {
      height: calc(100% - 80px); /* 减去搜索框和间距的高度 */
      min-height: 250px;
      display: flex;
      flex-direction: column;
    }
    
    .smart-bookmark-folder-list,
    .smart-bookmark-bookmark-list {
      flex: 1;
      min-height: 0;
      margin: 16px 0 0;
    }
    
    /* 确保在小屏幕上也有合适的高度 */
    @media (max-height: 600px) {
      .smart-bookmark-modal {
        --header-height: 60px;
        --footer-height: 70px;
      }
      
      .smart-bookmark-modal-body {
        min-height: 200px;
        max-height: calc(60vh - var(--header-height) - var(--footer-height));
      }
      
      .smart-bookmark-list-container {
        min-height: 150px;
        height: calc(100% - 60px);
      }
    }
  `;
  
  // 如果已经有样式标签，替换它
  var existingStyle = document.getElementById('smart-bookmark-layout-fix');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  style.id = 'smart-bookmark-layout-fix';
  document.head.appendChild(style);
};

/**
 * 显示Modal
 * @param {Object} pageInfo - 当前页面信息 {title, url}
 */
UIManager.prototype.showModal = function (pageInfo) {
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  var backdrop = document.querySelector('.smart-bookmark-modal-backdrop');
  if (!modal || !backdrop) {
    console.error('Modal element not found');
    return;
  }

  this.isModalVisible = true;

  // 显示Modal和背景
  backdrop.classList.add('active');
  modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS);

  // 聚焦到搜索输入框
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (searchInput) {
    // 使用setTimeout确保在Modal完全显示后再聚焦
    setTimeout(function () {
      searchInput.focus();
      searchInput.select();
    }, 100);
  }

  // 在显示后强制重新计算布局
  setTimeout(() => {
    this.recalculateLayout();
  }, 200);
};

/**
 * 隐藏Modal
 */
UIManager.prototype.hideModal = function () {
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  var backdrop = document.querySelector('.smart-bookmark-modal-backdrop');
  if (modal) {
    modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS);
  }
  if (backdrop) {
    backdrop.classList.remove('active');
  }

  // 清空搜索框
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (searchInput) {
    searchInput.value = '';
  }

  // 重置状态
  this.selectedIndex = -1;
  this.isModalVisible = false;

  // 重置为默认模式
  this.currentMode = window.SMART_BOOKMARK_CONSTANTS.DEFAULT_MODE;
};

/**
 * 设置模式
 * @param {string} mode - 模式类型
 */
UIManager.prototype.setMode = function (mode) {
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (!modal) return;

  var self = this;

  // 添加过渡动画类
  modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.MODE_TRANSITION_CLASS);
  modal.classList.add('content-changing');

  // 移除所有模式类
  modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_SEARCH_MODE_CLASS);
  modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.FOLDER_SELECT_MODE_CLASS);

  // 设置新模式
  this.currentMode = mode;
  this.selectedIndex = -1;

  // 获取UI元素
  var title = document.querySelector('.smart-bookmark-modal-title');
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var bookmarkList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID);
  var folderList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID);
  var confirmBtn = document.getElementById('smart-bookmark-confirm');

  // 添加新模式类并更新UI
  if (mode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_SEARCH_MODE_CLASS);

    if (title) title.textContent = '打开书签';
    if (searchInput) searchInput.placeholder = '搜索书签...';
    if (bookmarkList) bookmarkList.style.display = 'block';
    if (folderList) folderList.style.display = 'none';
    if (confirmBtn) confirmBtn.style.display = 'none';
  } else {
    modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.FOLDER_SELECT_MODE_CLASS);

    if (title) title.textContent = '添加书签';
    if (searchInput) searchInput.placeholder = '搜索文件夹...';
    if (bookmarkList) bookmarkList.style.display = 'none';
    if (folderList) folderList.style.display = 'block';
    if (confirmBtn) confirmBtn.style.display = 'inline-block';
  }

  // 清空搜索框
  if (searchInput) {
    searchInput.value = '';
  }

  // 延迟重新计算布局，让动画效果可见
  setTimeout(function() {
    self.updateModalHeight();
  }, 50);
  
  // 再次延迟确保高度动画完成后更新布局
  setTimeout(function() {
    self.recalculateLayout();
  }, 100);

  // 移除过渡动画类
  setTimeout(function () {
    modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.MODE_TRANSITION_CLASS);
    modal.classList.remove('content-changing');
  }, 300); // 简化延迟时间
};

/**
 * 切换模式
 */
UIManager.prototype.toggleMode = function () {
  if (this.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    this.setMode(window.SMART_BOOKMARK_CONSTANTS.MODE_FOLDER_SELECT);
  } else {
    this.setMode(window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH);
  }
};

/**
 * 重新计算布局
 */
UIManager.prototype.recalculateLayout = function () {
  this.updateModalHeight();
  
  // 通知虚拟滚动器更新
  var event = new CustomEvent('layout-recalculated');
  window.dispatchEvent(event);
};

/**
 * 更新Modal高度以启用transition动画
 */
UIManager.prototype.updateModalHeight = function () {
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (!modal) return;
  
  // 临时设置为auto来测量实际需要的高度
  var originalHeight = modal.style.height;
  modal.style.height = 'auto';
  var actualHeight = modal.offsetHeight;
  
  // 恢复原始高度（如果有的话）
  if (originalHeight) {
    modal.style.height = originalHeight;
  }
  
  // 强制重排
  modal.offsetHeight;
  
  // 设置新的高度，触发transition动画
  modal.style.height = actualHeight + 'px';
};

/**
 * 显示加载状态
 * @param {string} listType - 列表类型 ('folders' 或 'bookmarks')
 */
UIManager.prototype.showLoadingState = function (listType) {
  var listId = listType === 'folders' ? 
    window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID : 
    window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID;
  
  var list = document.getElementById(listId);
  if (!list) return;

  var itemClass = listType === 'folders' ? 'smart-bookmark-folder-item' : 'smart-bookmark-bookmark-item';
  var message = listType === 'folders' ? '正在加载书签文件夹...' : '正在加载书签...';
  
  list.innerHTML = '<li class="' + itemClass + ' loading">' + message + '</li>';
};

/**
 * 显示空状态
 * @param {string} listType - 列表类型 ('folders' 或 'bookmarks')
 */
UIManager.prototype.showEmptyState = function (listType) {
  var listId = listType === 'folders' ? 
    window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID : 
    window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID;
  
  var list = document.getElementById(listId);
  if (!list) return;

  var itemClass = listType === 'folders' ? 'smart-bookmark-folder-item' : 'smart-bookmark-bookmark-item';
  var message = listType === 'folders' ? '没有书签文件夹，请先创建一些书签' : '没有书签，请先创建一些书签';
  
  list.innerHTML = '<li class="' + itemClass + ' empty">' + message + '</li>';
};

/**
 * 显示错误状态
 * @param {string} listType - 列表类型 ('folders' 或 'bookmarks')
 * @param {string} message - 错误消息
 * @param {boolean} showPermissionButton - 是否显示权限请求按钮
 */
UIManager.prototype.showErrorState = function (listType, message, showPermissionButton) {
  var listId = listType === 'folders' ? 
    window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID : 
    window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID;
  
  var list = document.getElementById(listId);
  if (!list) return;

  var itemClass = listType === 'folders' ? 'smart-bookmark-folder-item' : 'smart-bookmark-bookmark-item';
  var html = '<li class="' + itemClass + ' error">' + (message || '加载失败') + '</li>';

  if (showPermissionButton) {
    var buttonId = 'smart-bookmark-request-permission-' + listType;
    html += '<li class="smart-bookmark-permission-container">' +
      '<button id="' + buttonId + '" class="smart-bookmark-btn smart-bookmark-btn-primary">授予权限</button>' +
      '</li>';
  }

  list.innerHTML = html;
};

/**
 * 显示无搜索结果状态
 * @param {string} listType - 列表类型 ('folders' 或 'bookmarks')
 */
UIManager.prototype.showNoResultsState = function (listType) {
  var listId = listType === 'folders' ? 
    window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID : 
    window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID;
  
  var list = document.getElementById(listId);
  if (!list) return;

  var itemClass = listType === 'folders' ? 'smart-bookmark-folder-item' : 'smart-bookmark-bookmark-item';
  var message = listType === 'folders' ? 
    '未找到匹配的文件夹，请尝试其他关键词' : 
    '未找到匹配的书签，请尝试其他关键词';
  
  list.innerHTML = '<li class="' + itemClass + ' no-results">' + message + '</li>';
};

/**
 * 添加事件监听器
 * @param {Element} element - 元素
 * @param {string} event - 事件类型
 * @param {Function} handler - 处理函数
 */
UIManager.prototype.addEventListener = function (element, event, handler) {
  element.addEventListener(event, handler);
  this.eventListeners.push({ element: element, event: event, handler: handler });
  return handler;
};

/**
 * 清理UI管理器
 */
UIManager.prototype.cleanup = function () {
  // 移除所有事件监听器
  for (var i = 0; i < this.eventListeners.length; i++) {
    var listener = this.eventListeners[i];
    try {
      listener.element.removeEventListener(listener.event, listener.handler);
    } catch (e) {
      // 忽略移除失败的监听器
    }
  }

  this.eventListeners = [];

  // 移除样式标签
  var layoutStyle = document.getElementById('smart-bookmark-layout-fix');
  if (layoutStyle) {
    layoutStyle.remove();
  }

  // 重置状态
  this.selectedIndex = -1;
  this.currentMode = window.SMART_BOOKMARK_CONSTANTS.DEFAULT_MODE;
  this.isModalVisible = false;
};

// 将类附加到全局window对象
window.UIManager = UIManager;