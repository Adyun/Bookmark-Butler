// Modal manager for the Smart Bookmark Extension

/**
 * Modal管理器类
 */
function ModalManager() {
  this.currentPageInfo = null;
  this.allFolders = [];
  this.filteredFolders = [];
  this.searchEngine = new window.SearchEngine();
  this.eventListeners = []; // 用于跟踪事件监听器以便清理
  this.init();
}

/**
 * 初始化Modal
 */
ModalManager.prototype.init = function () {
  this.createModal();
  this.bindEvents();
};

/**
 * 创建Modal DOM元素
 */
ModalManager.prototype.createModal = function () {
  // 检查是否已经存在Modal
  if (document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID)) {
    return;
  }

  var modal = document.createElement('div');
  modal.id = window.SMART_BOOKMARK_CONSTANTS.MODAL_ID;
  modal.className = 'smart-bookmark-modal';
  modal.innerHTML =
    '<div class="smart-bookmark-modal-header">' +
    '<h2 class="smart-bookmark-modal-title">添加书签到文件夹</h2>' +
    '</div>' +
    '<div class="smart-bookmark-modal-body">' +
    '<input type="text" id="' + window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID + '" class="smart-bookmark-search" placeholder="搜索文件夹...">' +
    '<ul id="' + window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID + '" class="smart-bookmark-folder-list"></ul>' +
    '</div>' +
    '<div class="smart-bookmark-modal-footer">' +
    '<button class="smart-bookmark-btn smart-bookmark-btn-secondary" id="smart-bookmark-cancel">取消</button>' +
    '<button class="smart-bookmark-btn smart-bookmark-btn-primary" id="smart-bookmark-confirm" disabled>添加书签</button>' +
    '</div>';

  // 添加Toast元素
  var toast = document.createElement('div');
  toast.id = window.SMART_BOOKMARK_CONSTANTS.TOAST_ID;
  toast.className = 'smart-bookmark-toast';

  document.body.appendChild(modal);
  document.body.appendChild(toast);
};

/**
 * 绑定事件监听器
 */
ModalManager.prototype.bindEvents = function () {
  // 点击取消按钮或模态框外部关闭模态框
  var self = this;
  var handleClickOutside = function (e) {
    var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
    if (!modal) return;

    if (e.target.id === 'smart-bookmark-cancel' ||
      (modal.classList.contains(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS) &&
        e.target === modal)) {
      self.hide();
    }
  };

  document.addEventListener('click', handleClickOutside);
  this.eventListeners.push({ element: document, event: 'click', handler: handleClickOutside });

  // 搜索输入事件（添加防抖）
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (searchInput) {
    // 使用防抖函数优化搜索性能
    var debouncedSearch = this.debounce(function (query) {
      self.handleSearch(query);
    }, 300);

    var searchHandler = function (e) {
      debouncedSearch(e.target.value);
    };

    searchInput.addEventListener('input', searchHandler);
    this.eventListeners.push({ element: searchInput, event: 'input', handler: searchHandler });
  }

  // 确认按钮事件
  var confirmBtn = document.getElementById('smart-bookmark-confirm');
  if (confirmBtn) {
    var handleConfirm = function () {
      self.handleConfirm();
    };

    confirmBtn.addEventListener('click', handleConfirm);
    this.eventListeners.push({ element: confirmBtn, event: 'click', handler: handleConfirm });
  }
};

/**
 * 清理事件监听器（内存管理）
 */
ModalManager.prototype.cleanup = function () {
  // 移除所有事件监听器
  for (var i = 0; i < this.eventListeners.length; i++) {
    var listener = this.eventListeners[i];
    listener.element.removeEventListener(listener.event, listener.handler);
  }

  // 清空事件监听器数组
  this.eventListeners = [];

  // 移除Modal元素
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  var toast = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.TOAST_ID);

  if (modal) {
    modal.remove();
  }

  if (toast) {
    toast.remove();
  }

  // 清空数据
  this.currentPageInfo = null;
  this.allFolders = [];
  this.filteredFolders = [];
};

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} delay - 延迟时间(ms)
 * @returns {Function} 防抖后的函数
 */
ModalManager.prototype.debounce = function (func, delay) {
  var timeoutId;
  return function () {
    var args = arguments;
    var context = this;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(function () {
      func.apply(context, args);
    }, delay);
  };
};

/**
 * 显示Modal
 * @param {Object} pageInfo - 当前页面信息 {title, url}
 */
ModalManager.prototype.show = function (pageInfo) {
  // 性能监控开始
  var startTime = performance.now();

  this.currentPageInfo = pageInfo;
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);

  if (!modal) {
    console.error('Modal element not found');
    return;
  }

  // 显示Modal
  modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS);

  // 获取文件夹并显示
  this.loadFolders();

  // 聚焦到搜索输入框
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (searchInput) {
    // 使用setTimeout确保在Modal完全显示后再聚焦
    setTimeout(function () {
      searchInput.focus();
      // 选中文本框中的所有文本，方便用户直接输入
      searchInput.select();
    }, 100);
  }

  // 性能监控结束
  var endTime = performance.now();
  console.log('Modal show took ' + (endTime - startTime) + ' milliseconds');
};

/**
 * 隐藏Modal
 */
ModalManager.prototype.hide = function () {
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (modal) {
    modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS);
  }

  // 清空搜索框
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (searchInput) {
    searchInput.value = '';
  }

  // 重置状态
  this.currentPageInfo = null;
};

/**
 * 加载文件夹数据
 */
ModalManager.prototype.loadFolders = function () {
  var self = this;

  // 性能监控开始
  var startTime = performance.now();

  // 获取缓存状态
  var cacheStatus = window.SMART_BOOKMARK_API.getCacheStatus();
  console.log('Cache status:', cacheStatus);

  // 显示加载状态
  self.updateFolderListLoading();

  // 使用Promise链而不是async/await以提高兼容性
  window.SMART_BOOKMARK_API.getAllFolders()
    .then(function (folders) {
      // 检查返回的文件夹数组是否有效
      if (!folders || !Array.isArray(folders)) {
        throw new Error('Invalid folders data received');
      }

      self.allFolders = folders;
      console.log('Retrieved ' + folders.length + ' folders');

      // 如果没有文件夹，显示提示信息
      if (folders.length === 0) {
        self.updateFolderListEmpty();
        return;
      }

      return window.SMART_BOOKMARK_SORTING.sortByBrowserOrder(self.allFolders);
    })
    .then(function (sortedFolders) {
      if (!sortedFolders) return; // 如果没有排序结果（比如没有文件夹），直接返回

      self.allFolders = sortedFolders;

      // 默认显示所有文件夹
      self.filteredFolders = self.allFolders;

      // 更新显示
      self.updateFolderList();

      // 性能监控结束
      var endTime = performance.now();
      console.log('Load folders took ' + (endTime - startTime) + ' milliseconds');
    })
    .catch(function (error) {
      console.error('Failed to load folders:', error);

      // 根据错误类型显示不同的提示信息
      var errorMessage = '加载书签文件夹失败';
      var showPermissionButton = false;

      if (error.message.includes('not available')) {
        errorMessage = '书签功能不可用，请检查扩展权限';
      } else if (error.message.includes('Bookmarks permission not granted')) {
        errorMessage = '缺少书签权限，请点击下方按钮授予权限';
        showPermissionButton = true;
      } else if (error.message.includes('No bookmark tree found')) {
        errorMessage = '没有找到书签，请先创建一些书签文件夹';
      } else if (error.message.includes('Invalid folders data')) {
        errorMessage = '书签数据格式错误，请重试';
      }

      self.updateFolderListError(errorMessage, showPermissionButton);
      window.SMART_BOOKMARK_HELPERS.showToast(errorMessage, true);
    });
};

/**
 * 显示加载状态
 */
ModalManager.prototype.updateFolderListLoading = function () {
  var folderList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID);
  if (!folderList) return;

  folderList.innerHTML = '<li class="smart-bookmark-folder-item loading">正在加载书签文件夹...</li>';
};

/**
 * 显示空文件夹状态
 */
ModalManager.prototype.updateFolderListEmpty = function () {
  var folderList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID);
  if (!folderList) return;

  folderList.innerHTML = '<li class="smart-bookmark-folder-item empty">没有书签文件夹，请先创建一些书签</li>';
};

/**
 * 显示错误状态
 * @param {string} message - 错误消息
 * @param {boolean} showPermissionButton - 是否显示权限请求按钮
 */
ModalManager.prototype.updateFolderListError = function (message, showPermissionButton) {
  var folderList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID);
  if (!folderList) return;

  var html = '<li class="smart-bookmark-folder-item error">' + (message || '加载失败') + '</li>';

  if (showPermissionButton) {
    html += '<li class="smart-bookmark-permission-container">' +
      '<button id="smart-bookmark-request-permission" class="smart-bookmark-btn smart-bookmark-btn-primary">授予权限</button>' +
      '</li>';
  }

  folderList.innerHTML = html;

  // 如果需要显示权限按钮，绑定点击事件
  if (showPermissionButton) {
    var self = this;
    var permissionBtn = document.getElementById('smart-bookmark-request-permission');
    if (permissionBtn) {
      var handlePermissionRequest = function () {
        self.handlePermissionRequest();
      };

      permissionBtn.addEventListener('click', handlePermissionRequest);
      this.eventListeners.push({ element: permissionBtn, event: 'click', handler: handlePermissionRequest });
    }
  }
};

/**
 * 处理权限请求
 */
ModalManager.prototype.handlePermissionRequest = function () {
  var self = this;

  window.SMART_BOOKMARK_API.requestBookmarksPermission()
    .then(function (granted) {
      if (granted) {
        window.SMART_BOOKMARK_HELPERS.showToast('权限获取成功，正在重新加载书签...');
        // 重新加载文件夹
        self.loadFolders();
      } else {
        window.SMART_BOOKMARK_HELPERS.showToast('权限获取失败，请手动在扩展管理页面授予权限', true);
      }
    })
    .catch(function (error) {
      console.error('Error requesting bookmarks permission:', error);
      window.SMART_BOOKMARK_HELPERS.showToast('权限请求失败，请手动在扩展管理页面授予权限', true);
    });
};

/**
 * 处理搜索
 * @param {string} query - 搜索关键词
 */
ModalManager.prototype.handleSearch = function (query) {
  // 性能监控开始
  var startTime = performance.now();

  this.filteredFolders = this.searchEngine.search(query, this.allFolders);
  this.updateFolderList();

  // 性能监控结束
  var endTime = performance.now();
  console.log('Search took ' + (endTime - startTime) + ' milliseconds');
};

/**
 * 更新文件夹列表显示
 */
ModalManager.prototype.updateFolderList = function () {
  var folderList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID);
  if (!folderList) return;

  // 获取搜索框的当前值
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var hasSearchQuery = searchInput && searchInput.value.trim() !== '';

  // 如果有搜索查询但没有结果，显示提示信息
  if (hasSearchQuery && this.filteredFolders.length === 0) {
    folderList.innerHTML = '<li class="smart-bookmark-folder-item no-results">未找到匹配的文件夹，请尝试其他关键词</li>';
    return;
  }

  // 如果没有搜索查询但没有文件夹，显示不同提示
  if (!hasSearchQuery && this.filteredFolders.length === 0) {
    folderList.innerHTML = '<li class="smart-bookmark-folder-item no-results">没有可用的书签文件夹</li>';
    return;
  }

  var html = '';
  for (var i = 0; i < this.filteredFolders.length; i++) {
    var folder = this.filteredFolders[i];
    var matchClass = '';

    // 如果有搜索查询，根据匹配度添加不同的样式类
    if (hasSearchQuery && folder.score !== undefined) {
      if (folder.score >= 0.8) {
        matchClass = 'high-match';
      } else if (folder.score >= 0.5) {
        matchClass = 'medium-match';
      } else if (folder.score > 0) {
        matchClass = 'low-match';
      }
    }

    html += '<li class="smart-bookmark-folder-item ' + matchClass + '" data-folder-id="' + folder.id + '">' +
      '<span class="smart-bookmark-folder-name">' + folder.title + '</span>' +
      '<span class="smart-bookmark-folder-count">' + (folder.bookmarkCount || 0) + '</span>' +
      '</li>';
  }
  folderList.innerHTML = html;

  // 绑定文件夹选择事件
  var self = this;
  var items = folderList.querySelectorAll('.smart-bookmark-folder-item:not(.no-results)');
  for (var j = 0; j < items.length; j++) {
    var item = items[j];
    var handleFolderSelect = function (e) {
      self.selectFolder(e.currentTarget);
    };

    item.addEventListener('click', handleFolderSelect);
    this.eventListeners.push({ element: item, event: 'click', handler: handleFolderSelect });
  }
};

/**
 * 选择文件夹
 * @param {Element} folderItem - 文件夹元素
 */
ModalManager.prototype.selectFolder = function (folderItem) {
  // 移除之前选中的样式
  var items = document.querySelectorAll('.smart-bookmark-folder-item');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('active');
  }

  // 添加选中样式
  folderItem.classList.add('active');

  // 启用确认按钮
  var confirmBtn = document.getElementById('smart-bookmark-confirm');
  if (confirmBtn) {
    confirmBtn.disabled = false;
  }
};

/**
 * 处理确认操作
 */
ModalManager.prototype.handleConfirm = function () {
  var selectedFolder = document.querySelector('.smart-bookmark-folder-item.active');
  if (!selectedFolder || !this.currentPageInfo) {
    return;
  }

  var folderId = selectedFolder.getAttribute('data-folder-id');
  var self = this;

  // 性能监控开始
  var startTime = performance.now();

  // 创建书签
  window.SMART_BOOKMARK_API.createBookmark(folderId, this.currentPageInfo.title, this.currentPageInfo.url)
    .then(function () {
      // 性能监控结束
      var endTime = performance.now();
      console.log('Create bookmark took ' + (endTime - startTime) + ' milliseconds');

      window.SMART_BOOKMARK_HELPERS.showToast('书签添加成功！');
      self.hide();
    })
    .catch(function (error) {
      console.error('Failed to create bookmark:', error);
      window.SMART_BOOKMARK_HELPERS.showToast('添加书签失败，请重试', true);
    });
};

// 将类附加到全局window对象
window.ModalManager = ModalManager;