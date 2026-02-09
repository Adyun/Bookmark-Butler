// UI Manager for the Smart Bookmark Extension

/**
 * UI管理器 - 处理界面布局、状态管理和用户交互
 * 使用 Shadow DOM 实现样式隔离，避免与宿主页面的 CSS 冲突
 */
function UIManager() {
  this.eventListeners = [];
  this.currentMode = window.SMART_BOOKMARK_CONSTANTS.DEFAULT_MODE;
  this.selectedIndex = -1;
  this.isModalVisible = false;

  // Shadow DOM 相关
  this.hostElement = null;
  this.shadowRoot = null;
  this.stylesLoaded = false;
}

/**
 * 创建Modal DOM元素（使用 Shadow DOM 实现样式隔离）
 */
UIManager.prototype.createModal = function () {
  var self = this;

  // 检查是否已经存在宿主元素
  var existingHost = document.getElementById('smart-bookmark-extension-root');
  if (existingHost) {
    this.hostElement = existingHost;
    this.shadowRoot = this.hostElement.shadowRoot;

    // 检查 shadowRoot 是否存在且包含 modal 元素
    if (this.shadowRoot && this.shadowRoot.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID)) {
      // Modal 已存在，直接使用
      return;
    }

    // shadowRoot 存在但 modal 不存在，需要重新创建内容
    if (this.shadowRoot) {
      // 清空旧内容
      this.shadowRoot.innerHTML = '';
      // 重新加载样式
      this.loadStyles();
    } else {
      // shadowRoot 不存在，移除旧宿主并重新创建
      existingHost.remove();
      this.hostElement = null;
      this.shadowRoot = null;
    }
  }

  // 创建 Shadow DOM 宿主元素（仅当不存在时）
  if (!this.hostElement) {
    this.hostElement = document.createElement('div');
    this.hostElement.id = 'smart-bookmark-extension-root';
    this.hostElement.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;';
    document.body.appendChild(this.hostElement);

    // 创建 Shadow Root
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    // 暴露到全局，供其他管理器使用
    window.smartBookmarkShadowRoot = this.shadowRoot;

    // 立即注入FOUC防护样式（在CSS加载前隐藏所有内容）
    this.injectFOUCProtection();

    // 加载 CSS 到 Shadow DOM 内部
    this.loadStyles();
  }

  // 创建 modal 背景层
  var modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'smart-bookmark-modal-backdrop';
  modalBackdrop.style.pointerEvents = 'auto'; // 恢复事件响应

  var modal = document.createElement('div');
  modal.id = window.SMART_BOOKMARK_CONSTANTS.MODAL_ID;
  modal.className = 'smart-bookmark-modal';
  modal.innerHTML =
    '<div class="smart-bookmark-modal-header">' +
    '<h2 class="smart-bookmark-modal-title">搜索书签</h2>' +
    '<div class="smart-bookmark-header-controls">' +
    '<div class="smart-bookmark-header-controls-container">' +

    // 语言设置按钮和下拉
    '<div class="smart-bookmark-control-group">' +
    '<button id="smart-bookmark-language-toggle" class="smart-bookmark-control-toggle" title="语言设置">🌏</button>' +
    '<div id="smart-bookmark-language-dropdown" class="smart-bookmark-control-dropdown">' +
    '<div class="smart-bookmark-control-option" data-language="zh"><span class="smart-bookmark-option-icon">🇨🇳</span>中文</div>' +
    '<div class="smart-bookmark-control-option" data-language="en"><span class="smart-bookmark-option-icon">🇺🇸</span>English</div>' +
    '</div>' +
    '</div>' +

    // 深浅色模式按钮和下拉
    '<div class="smart-bookmark-control-group">' +
    '<button id="smart-bookmark-mode-toggle" class="smart-bookmark-control-toggle" title="深浅色模式">💡</button>' +
    '<div id="smart-bookmark-mode-dropdown" class="smart-bookmark-control-dropdown">' +
    '<div class="smart-bookmark-control-option" data-mode="auto"><span class="smart-bookmark-option-icon">🔄</span>跟随系统</div>' +
    '<div class="smart-bookmark-control-option" data-mode="light"><span class="smart-bookmark-option-icon">☀️</span>浅色模式</div>' +
    '<div class="smart-bookmark-control-option" data-mode="dark"><span class="smart-bookmark-option-icon">🌙</span>深色模式</div>' +
    '</div>' +
    '</div>' +

    // 主题颜色按钮和下拉
    '<div class="smart-bookmark-control-group">' +
    '<button id="smart-bookmark-theme-toggle" class="smart-bookmark-control-toggle" title="主题颜色">🎨</button>' +
    '<div id="smart-bookmark-theme-dropdown" class="smart-bookmark-control-dropdown">' +
    '<div class="smart-bookmark-control-option" data-theme="gray"><span class="smart-bookmark-option-icon">🩶</span>中性灰色（默认）</div>' +
    '<div class="smart-bookmark-control-option" data-theme="red"><span class="smart-bookmark-option-icon">❤️</span>经典红色</div>' +
    '<div class="smart-bookmark-control-option" data-theme="green"><span class="smart-bookmark-option-icon">💚</span>清新绿色</div>' +
    '<div class="smart-bookmark-control-option" data-theme="pink"><span class="smart-bookmark-option-icon">🩷</span>温馨粉色</div>' +
    '<div class="smart-bookmark-control-option" data-theme="purple"><span class="smart-bookmark-option-icon">💜</span>优雅紫色</div>' +
    '<div class="smart-bookmark-control-option" data-theme="blue"><span class="smart-bookmark-option-icon">💙</span>经典蓝色</div>' +
    '</div>' +
    '</div>' +

    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="smart-bookmark-modal-body">' +
    '<input type="text" id="' + window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID + '" class="smart-bookmark-search" placeholder="搜索书签..." autofocus>' +
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

  // 添加 Toast 元素
  var toast = document.createElement('div');
  toast.id = window.SMART_BOOKMARK_CONSTANTS.TOAST_ID;
  toast.className = 'smart-bookmark-toast';

  // 将 modal 放在 backdrop 中，然后添加到 Shadow Root
  modalBackdrop.appendChild(modal);
  this.shadowRoot.appendChild(modalBackdrop);
  this.shadowRoot.appendChild(toast);

  // 修复布局问题
  this.setupModalLayout();
};

/**
 * 注入FOUC防护样式（在CSS加载前隐藏所有内容以防止闪烁）
 */
UIManager.prototype.injectFOUCProtection = function () {
  var foucStyle = document.createElement('style');
  foucStyle.id = 'smart-bookmark-fouc-protection';
  foucStyle.textContent = `
    /* FOUC防护：在主CSS加载完成前隐藏所有内容 */
    :host {
      visibility: hidden !important;
    }
    .smart-bookmark-modal-backdrop {
      visibility: hidden !important;
      opacity: 0 !important;
    }
  `;
  this.shadowRoot.appendChild(foucStyle);
};

/**
 * 移除FOUC防护样式（在CSS加载完成后调用）
 */
UIManager.prototype.removeFOUCProtection = function () {
  if (!this.shadowRoot) return;
  var foucStyle = this.shadowRoot.getElementById('smart-bookmark-fouc-protection');
  if (foucStyle) {
    foucStyle.remove();
  }
};

/**
 * 加载 CSS 到 Shadow DOM 内部
 */
UIManager.prototype.loadStyles = function () {
  var self = this;

  // 方式1：使用 adoptedStyleSheets（现代浏览器，更高效）
  // 方式2：使用 <style> 标签（兼容性更好）

  // 获取 CSS 文件 URL
  var cssUrl = chrome.runtime.getURL('src/styles/modal.css');

  fetch(cssUrl)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Failed to load CSS: ' + response.status);
      }
      return response.text();
    })
    .then(function (cssText) {
      // 创建 style 元素并注入到 Shadow Root
      var styleElement = document.createElement('style');
      styleElement.id = 'smart-bookmark-main-styles';
      styleElement.textContent = cssText;

      // 插入到 Shadow Root 的最前面（在FOUC防护样式之前）
      if (self.shadowRoot.firstChild) {
        self.shadowRoot.insertBefore(styleElement, self.shadowRoot.firstChild);
      } else {
        self.shadowRoot.appendChild(styleElement);
      }

      self.stylesLoaded = true;
      // console.log('Shadow DOM styles loaded successfully');

      // CSS加载完成后移除FOUC防护
      self.removeFOUCProtection();
    })
    .catch(function (error) {
      console.error('Failed to load Shadow DOM styles:', error);
      // 回退：尝试使用内联关键样式
      self.injectFallbackStyles();
      // 即使失败也要移除FOUC防护，否则永远不可见
      self.removeFOUCProtection();
    });
};

/**
 * 注入回退样式（当 fetch 失败时使用）
 */
UIManager.prototype.injectFallbackStyles = function () {
  var fallbackCSS = `
    .smart-bookmark-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9999;
      display: none;
      opacity: 0;
      transition: opacity 0.2s ease-out;
    }
    .smart-bookmark-modal-backdrop.active {
      display: flex;
      opacity: 1;
    }
    .smart-bookmark-modal {
      position: relative;
      margin: auto;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
      width: 760px;
      max-width: 95vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      opacity: 0;
      transform: scale(0.95);
      transition: opacity 0.2s, transform 0.2s;
    }
    .smart-bookmark-modal.active {
      opacity: 1;
      transform: scale(1);
    }
  `;

  var styleElement = document.createElement('style');
  styleElement.textContent = fallbackCSS;
  this.shadowRoot.insertBefore(styleElement, this.shadowRoot.firstChild);
};

/**
 * 获取 Shadow Root（辅助方法，供内部和外部使用）
 * @returns {ShadowRoot|Document} Shadow Root 或 document 作为回退
 */
UIManager.prototype.getRoot = function () {
  return this.shadowRoot || document;
};

/**
 * 设置Modal布局 - 修复高度计算问题
 */
UIManager.prototype.setupModalLayout = function () {
  if (!this.shadowRoot) return;

  var modal = this.shadowRoot.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (!modal) return;

  // 使用CSS变量来动态计算高度，但不强制固定高度
  var style = document.createElement('style');
  style.id = 'smart-bookmark-layout-fix';
  style.textContent = `
    .smart-bookmark-modal {
      --header-height: 70px;
      --footer-height: 80px;
      --padding: 40px;
    }
    
    .smart-bookmark-modal-body {
      /* 让body根据内容自适应高度 */
      flex: 1;
      min-height: 450px;
      max-height: calc(70vh - var(--header-height) - var(--footer-height));
    }
    
    .smart-bookmark-list-container {
      height: calc(100% - 80px); /* 减去搜索框和间距的高度 */
      min-height: 400px;
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

  // 如果已经有样式标签，替换它（在 Shadow Root 内查找）
  var existingStyle = this.shadowRoot.getElementById('smart-bookmark-layout-fix');
  if (existingStyle) {
    existingStyle.remove();
  }

  // 将样式添加到 Shadow Root 内部
  this.shadowRoot.appendChild(style);
};

/**
 * 显示Modal
 * @param {Object} pageInfo - 当前页面信息 {title, url}
 */
UIManager.prototype.showModal = function (pageInfo) {
  var root = this.getRoot();
  var modal = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  var backdrop = root.querySelector('.smart-bookmark-modal-backdrop');
  if (!modal || !backdrop) {
    console.error('Modal element not found');
    return;
  }

  this.isModalVisible = true;

  // 显示Modal和背景
  backdrop.classList.add('active');
  modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS);

  // 聚焦到搜索输入框
  var searchInput = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
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
  var root = this.getRoot();
  var modal = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  var backdrop = root.querySelector('.smart-bookmark-modal-backdrop');
  if (modal) {
    modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS);
  }
  if (backdrop) {
    backdrop.classList.remove('active');
  }

  // 清空搜索框
  var searchInput = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
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
  var root = this.getRoot();
  var modal = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
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
  var title = root.querySelector('.smart-bookmark-modal-title');
  var searchInput = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var bookmarkList = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID);
  var folderList = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID);
  var confirmBtn = root.getElementById('smart-bookmark-confirm');

  // 添加新模式类并更新UI
  if (mode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_SEARCH_MODE_CLASS);

    // UI显示状态切换（文本由语言管理器处理）
    if (bookmarkList) bookmarkList.style.display = 'block';
    if (folderList) folderList.style.display = 'none';
    if (confirmBtn) confirmBtn.style.display = 'none';
  } else {
    modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.FOLDER_SELECT_MODE_CLASS);

    // UI显示状态切换（文本由语言管理器处理）
    if (bookmarkList) bookmarkList.style.display = 'none';
    if (folderList) folderList.style.display = 'block';
    if (confirmBtn) confirmBtn.style.display = 'inline-block';
  }

  // 清空搜索框
  if (searchInput) {
    searchInput.value = '';
  }

  // 立即更新语言文本（如果存在语言管理器）
  if (window.modalManager && window.modalManager.languageManager) {
    window.modalManager.languageManager.updateUI();
  }

  // 延迟重新计算布局，让动画效果可见
  setTimeout(function () {
    self.updateModalHeight();
  }, 50);

  // 再次延迟确保高度动画完成后更新布局
  setTimeout(function () {
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
  var root = this.getRoot();
  var modal = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
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

  var list = this.getRoot().getElementById(listId);
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

  var list = this.getRoot().getElementById(listId);
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

  var list = this.getRoot().getElementById(listId);
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

  var list = this.getRoot().getElementById(listId);
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

  // 移除样式标签（在 Shadow Root 内查找）
  var root = this.getRoot();
  var layoutStyle = root.getElementById('smart-bookmark-layout-fix');
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