// Modal manager for the Smart Bookmark Extension

/**
 * Modal管理器类
 */
function ModalManager() {
  this.currentPageInfo = null;
  this.allFolders = [];
  this.filteredFolders = [];
  this.allBookmarks = [];
  this.filteredBookmarks = [];
  this.searchEngine = new window.SearchEngine();
  this.eventListeners = []; // 用于跟踪事件监听器以便清理
  this.darkMode = null; // 当前深色模式设置
  this.currentMode = window.SMART_BOOKMARK_CONSTANTS.DEFAULT_MODE; // 当前模式
  this.selectedIndex = -1; // 当前选中的项目索引
  this.isModalVisible = false; // 模态框是否可见
  this.init();
}

/**
 * 初始化Modal
 */
ModalManager.prototype.init = function () {
  this.createModal();
  this.bindEvents();
  this.initDarkMode();
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
    '<h2 class="smart-bookmark-modal-title">搜索书签</h2>' +
    '<div class="smart-bookmark-header-controls">' +
    '<div class="smart-bookmark-mode-tip" title="按空格键切换模式">💡</div>' +
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
    '<ul id="' + window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID + '" class="smart-bookmark-bookmark-list"></ul>' +
    '<ul id="' + window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID + '" class="smart-bookmark-folder-list" style="display: none;"></ul>' +
    '</div>' +
    '<div class="smart-bookmark-modal-footer">' +
    '<div class="smart-bookmark-keyboard-hints">' +
    '<span class="smart-bookmark-keyboard-hint">↑↓ 选择</span>' +
    '<span class="smart-bookmark-keyboard-hint">Enter 确认</span>' +
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

    // 检查点击是否在深色模式下拉菜单内
    var dropdown = document.getElementById('smart-bookmark-dark-mode-dropdown');
    if (dropdown && dropdown.contains(e.target)) {
      return; // 如果点击在下拉菜单内，不关闭模态框
    }

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

  // 深色模式切换按钮事件
  var darkModeToggle = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID);
  if (darkModeToggle) {
    var handleDarkModeToggle = function (e) {
      e.stopPropagation(); // 阻止事件冒泡，避免触发模态框关闭
      self.toggleDarkModeDropdown();
    };

    darkModeToggle.addEventListener('click', handleDarkModeToggle);
    this.eventListeners.push({ element: darkModeToggle, event: 'click', handler: handleDarkModeToggle });
  }

  // 深色模式选项点击事件
  var darkModeOptions = document.querySelectorAll('.smart-bookmark-dark-mode-option');
  for (var i = 0; i < darkModeOptions.length; i++) {
    var option = darkModeOptions[i];
    var handleDarkModeOption = function (e) {
      e.stopPropagation(); // 阻止事件冒泡，避免触发模态框关闭
      var mode = this.getAttribute('data-mode');
      self.handleDarkModeSelect(mode);
    };

    option.addEventListener('click', handleDarkModeOption);
    this.eventListeners.push({ element: option, event: 'click', handler: handleDarkModeOption });
  }

  // 键盘事件处理
  var handleKeyDown = function (e) {
    self.handleKeyDown(e);
  };

  document.addEventListener('keydown', handleKeyDown);
  this.eventListeners.push({ element: document, event: 'keydown', handler: handleKeyDown });
};

/**
 * 初始化深色模式
 */
ModalManager.prototype.initDarkMode = function () {
  var self = this;

  // 从存储中读取深色模式设置
  this.loadDarkModeSetting().then(function (mode) {
    self.darkMode = mode;
    self.applyDarkMode();

    // 如果是自动模式，监听系统主题变化
    if (mode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO) {
      self.listenForSystemThemeChange();
    }
  });
};

/**
 * 从存储中加载深色模式设置
 * @returns {Promise} 返回深色模式设置
 */
ModalManager.prototype.loadDarkModeSetting = function () {
  var self = this;
  return new Promise(function (resolve) {
    // 尝试从 chrome.storage 获取设置
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY], function (result) {
        var mode = result[window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY];
        resolve(mode || window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO); // 默认为跟随系统
      });
    } else {
      // 如果 chrome.storage 不可用，尝试从 localStorage 获取
      var mode = localStorage.getItem(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY);
      resolve(mode || window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO);
    }
  });
};

/**
 * 保存深色模式设置
 * @param {string} mode - 深色模式设置
 */
ModalManager.prototype.saveDarkModeSetting = function (mode) {
  // 尝试保存到 chrome.storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      'smart_bookmark_dark_mode': mode
    });
  } else {
    // 如果 chrome.storage 不可用，保存到 localStorage
    localStorage.setItem(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY, mode);
  }

  this.darkMode = mode;
  this.applyDarkMode();
};

/**
 * 检测系统是否使用深色模式
 * @returns {boolean} 是否使用深色模式
 */
ModalManager.prototype.isSystemDarkMode = function () {
  // 检查浏览器是否支持 prefers-color-scheme
  if (window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
};

/**
 * 监听系统主题变化
 */
ModalManager.prototype.listenForSystemThemeChange = function () {
  var self = this;

  if (window.matchMedia) {
    var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // 添加监听器
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', function (e) {
        if (self.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO) {
          self.applyDarkMode();
        }
      });
    } else if (mediaQuery.addListener) {
      // 兼容旧版浏览器
      mediaQuery.addListener(function (e) {
        if (self.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO) {
          self.applyDarkMode();
        }
      });
    }
  }
};

/**
 * 应用深色模式
 */
ModalManager.prototype.applyDarkMode = function () {
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (!modal) return;

  var isDark = false;

  if (this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK) {
    isDark = true;
  } else if (this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO) {
    isDark = this.isSystemDarkMode();
  }

  if (isDark) {
    modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
  } else {
    modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
  }

  // 更新深色模式下拉菜单中的选中状态
  this.updateDarkModeDropdownSelection();
};

/**
 * 更新深色模式下拉菜单中的选中状态
 */
ModalManager.prototype.updateDarkModeDropdownSelection = function () {
  var options = document.querySelectorAll('.smart-bookmark-dark-mode-option');
  var self = this;

  options.forEach(function (option) {
    option.classList.remove('active');

    var mode = option.getAttribute('data-mode');
    if (
      (self.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO && mode === 'auto') ||
      (self.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_LIGHT && mode === 'light') ||
      (self.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK && mode === 'dark')
    ) {
      option.classList.add('active');
    }
  });

  // 更深色模式切换按钮图标
  var toggle = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID);
  if (toggle) {
    if (this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK) {
      toggle.textContent = '🌙'; // 深色模式图标
    } else if (this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_LIGHT) {
      toggle.textContent = '☀️'; // 浅色模式图标
    } else {
      toggle.textContent = '🌗'; // 自动模式图标
    }
  }
};

/**
 * 切换深色模式下拉菜单
 */
ModalManager.prototype.toggleDarkModeDropdown = function () {
  var dropdown = document.getElementById('smart-bookmark-dark-mode-dropdown');
  if (!dropdown) return;

  if (dropdown.classList.contains('show')) {
    dropdown.classList.remove('show');
  } else {
    dropdown.classList.add('show');
  }
};

/**
 * 处理深色模式选择
 * @param {string} mode - 选择的模式
 */
ModalManager.prototype.handleDarkModeSelect = function (mode) {
  var mappedMode;

  if (mode === 'auto') {
    mappedMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO;
  } else if (mode === 'light') {
    mappedMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_LIGHT;
  } else if (mode === 'dark') {
    mappedMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK;
  }

  if (mappedMode) {
    this.saveDarkModeSetting(mappedMode);
  }

  // 关闭下拉菜单
  var dropdown = document.getElementById('smart-bookmark-dark-mode-dropdown');
  if (dropdown) {
    dropdown.classList.remove('show');
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
  this.allBookmarks = [];
  this.filteredBookmarks = [];
  this.selectedIndex = -1;
  this.currentMode = window.SMART_BOOKMARK_CONSTANTS.DEFAULT_MODE;
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
  this.isModalVisible = true;
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);

  if (!modal) {
    console.error('Modal element not found');
    return;
  }

  // 显示Modal
  modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS);

  // 应用深色模式设置
  this.applyDarkMode();

  // 设置当前模式
  this.setMode(this.currentMode);

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
  this.selectedIndex = -1;
  this.isModalVisible = false;

  // 重置为默认模式（书签搜索模式）
  this.currentMode = window.SMART_BOOKMARK_CONSTANTS.DEFAULT_MODE;
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

  if (this.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    this.filteredBookmarks = this.searchEngine.searchBookmarks(query, this.allBookmarks);
    this.updateBookmarkList();
  } else {
    this.filteredFolders = this.searchEngine.search(query, this.allFolders);
    this.updateFolderList();
  }

  // 重置选中索引
  this.selectedIndex = -1;

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
      '<span class="smart-bookmark-folder-icon">📁</span>' +
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
  if (this.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    // 书签搜索模式：打开选中的书签
    var selectedBookmark = document.querySelector('.smart-bookmark-bookmark-item.active');
    if (!selectedBookmark) {
      return;
    }

    var url = selectedBookmark.getAttribute('data-bookmark-url');
    if (url) {
      // 检查是否是特殊URL（如edge://, chrome://等）
      if (!this.isSpecialUrl(url)) {
        // 在新标签页中打开书签
        window.open(url, '_blank');
      } else {
        // 显示提示信息
        window.SMART_BOOKMARK_HELPERS.showToast('无法打开特殊URL，请手动在浏览器中访问', true);
      }
      this.hide();
    }
  } else {
    // 文件夹选择模式：添加书签到选中的文件夹
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
  }
};

/**
 * 设置模式
 * @param {string} mode - 模式类型
 */
ModalManager.prototype.setMode = function (mode) {
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (!modal) return;

  // 添加过渡动画类
  modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.MODE_TRANSITION_CLASS);

  // 移除所有模式类
  modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_SEARCH_MODE_CLASS);
  modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.FOLDER_SELECT_MODE_CLASS);

  // 设置新模式
  this.currentMode = mode;
  this.selectedIndex = -1;

  // 添加新模式类
  if (mode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_SEARCH_MODE_CLASS);

    // 更新UI
    var title = document.querySelector('.smart-bookmark-modal-title');
    if (title) title.textContent = '打开书签';

    var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
    if (searchInput) searchInput.placeholder = '搜索书签...';

    var bookmarkList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID);
    var folderList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID);
    var confirmBtn = document.getElementById('smart-bookmark-confirm');

    if (bookmarkList) bookmarkList.style.display = 'block';
    if (folderList) folderList.style.display = 'none';
    if (confirmBtn) confirmBtn.style.display = 'none';

    // 加载书签
    this.loadBookmarks();
  } else {
    modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.FOLDER_SELECT_MODE_CLASS);

    // 更新UI
    var title = document.querySelector('.smart-bookmark-modal-title');
    if (title) title.textContent = '添加书签';

    var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
    if (searchInput) searchInput.placeholder = '搜索文件夹...';

    var bookmarkList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID);
    var folderList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID);
    var confirmBtn = document.getElementById('smart-bookmark-confirm');

    if (bookmarkList) bookmarkList.style.display = 'none';
    if (folderList) folderList.style.display = 'block';
    if (confirmBtn) confirmBtn.style.display = 'inline-block';

    // 加载文件夹
    this.loadFolders();
  }

  // 清空搜索框
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (searchInput) {
    searchInput.value = '';
  }

  // 移除过渡动画类
  setTimeout(function () {
    modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.MODE_TRANSITION_CLASS);
  }, 300);
};

/**
 * 切换模式
 */
ModalManager.prototype.toggleMode = function () {
  if (this.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    this.setMode(window.SMART_BOOKMARK_CONSTANTS.MODE_FOLDER_SELECT);
  } else {
    this.setMode(window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH);
  }
};

/**
 * 加载书签数据
 */
ModalManager.prototype.loadBookmarks = function () {
  var self = this;

  // 性能监控开始
  var startTime = performance.now();

  // 显示加载状态
  self.updateBookmarkListLoading();

  // 使用Promise链而不是async/await以提高兼容性
  window.SMART_BOOKMARK_API.getAllBookmarks()
    .then(function (bookmarks) {
      // 检查返回的书签数组是否有效
      if (!bookmarks || !Array.isArray(bookmarks)) {
        throw new Error('Invalid bookmarks data received');
      }

      self.allBookmarks = bookmarks;
      console.log('Retrieved ' + bookmarks.length + ' bookmarks');

      // 如果没有书签，显示提示信息
      if (bookmarks.length === 0) {
        self.updateBookmarkListEmpty();
        return;
      }

      // 默认显示所有书签
      self.filteredBookmarks = self.allBookmarks;

      // 更新显示
      self.updateBookmarkList();

      // 性能监控结束
      var endTime = performance.now();
      console.log('Load bookmarks took ' + (endTime - startTime) + ' milliseconds');
    })
    .catch(function (error) {
      console.error('Failed to load bookmarks:', error);

      // 根据错误类型显示不同的提示信息
      var errorMessage = '加载书签失败';
      var showPermissionButton = false;

      if (error.message.includes('not available')) {
        errorMessage = '书签功能不可用，请检查扩展权限';
      } else if (error.message.includes('Bookmarks permission not granted')) {
        errorMessage = '缺少书签权限，请点击下方按钮授予权限';
        showPermissionButton = true;
      } else if (error.message.includes('No bookmark tree found')) {
        errorMessage = '没有找到书签，请先创建一些书签';
      } else if (error.message.includes('Invalid bookmarks data')) {
        errorMessage = '书签数据格式错误，请重试';
      }

      self.updateBookmarkListError(errorMessage, showPermissionButton);
      window.SMART_BOOKMARK_HELPERS.showToast(errorMessage, true);
    });
};

/**
 * 显示书签列表加载状态
 */
ModalManager.prototype.updateBookmarkListLoading = function () {
  var bookmarkList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID);
  if (!bookmarkList) return;

  bookmarkList.innerHTML = '<li class="smart-bookmark-bookmark-item loading">正在加载书签...</li>';
};

/**
 * 显示空书签列表状态
 */
ModalManager.prototype.updateBookmarkListEmpty = function () {
  var bookmarkList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID);
  if (!bookmarkList) return;

  bookmarkList.innerHTML = '<li class="smart-bookmark-bookmark-item empty">没有书签，请先创建一些书签</li>';
};

/**
 * 显示书签列表错误状态
 * @param {string} message - 错误消息
 * @param {boolean} showPermissionButton - 是否显示权限请求按钮
 */
ModalManager.prototype.updateBookmarkListError = function (message, showPermissionButton) {
  var bookmarkList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID);
  if (!bookmarkList) return;

  var html = '<li class="smart-bookmark-bookmark-item error">' + (message || '加载失败') + '</li>';

  if (showPermissionButton) {
    html += '<li class="smart-bookmark-permission-container">' +
      '<button id="smart-bookmark-request-permission-bookmark" class="smart-bookmark-btn smart-bookmark-btn-primary">授予权限</button>' +
      '</li>';
  }

  bookmarkList.innerHTML = html;

  // 如果需要显示权限按钮，绑定点击事件
  if (showPermissionButton) {
    var self = this;
    var permissionBtn = document.getElementById('smart-bookmark-request-permission-bookmark');
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
 * 更新书签列表显示
 */
ModalManager.prototype.updateBookmarkList = function () {
  var bookmarkList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID);
  if (!bookmarkList) return;

  // 获取搜索框的当前值
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var hasSearchQuery = searchInput && searchInput.value.trim() !== '';

  // 如果有搜索查询但没有结果，显示提示信息
  if (hasSearchQuery && this.filteredBookmarks.length === 0) {
    bookmarkList.innerHTML = '<li class="smart-bookmark-bookmark-item no-results">未找到匹配的书签，请尝试其他关键词</li>';
    return;
  }

  // 如果没有搜索查询但没有书签，显示不同提示
  if (!hasSearchQuery && this.filteredBookmarks.length === 0) {
    bookmarkList.innerHTML = '<li class="smart-bookmark-bookmark-item no-results">没有可用的书签</li>';
    return;
  }

  var html = '';
  for (var i = 0; i < this.filteredBookmarks.length; i++) {
    var bookmark = this.filteredBookmarks[i];
    var matchClass = '';

    // 如果有搜索查询，根据匹配度添加不同的样式类
    if (hasSearchQuery && bookmark.score !== undefined) {
      if (bookmark.score >= 0.8) {
        matchClass = 'high-match';
      } else if (bookmark.score >= 0.5) {
        matchClass = 'medium-match';
      } else if (bookmark.score > 0) {
        matchClass = 'low-match';
      }
    }

    html += '<li class="smart-bookmark-bookmark-item ' + matchClass + '" data-bookmark-id="' + bookmark.id + '" data-bookmark-url="' + bookmark.url + '">' +
      '<div class="smart-bookmark-bookmark-content">' +
      '<span class="smart-bookmark-bookmark-icon">🔗</span>' +
      '<span class="smart-bookmark-bookmark-title">' + bookmark.title + '</span>' +
      '<span class="smart-bookmark-bookmark-url">' + this.getDomainFromUrl(bookmark.url) + '</span>' +
      '</div>' +
      '</li>';
  }
  bookmarkList.innerHTML = html;

  // 绑定书签选择事件
  var self = this;
  var items = bookmarkList.querySelectorAll('.smart-bookmark-bookmark-item:not(.no-results)');
  for (var j = 0; j < items.length; j++) {
    var item = items[j];
    var handleBookmarkSelect = function (e) {
      self.selectBookmark(e.currentTarget);
    };

    item.addEventListener('click', handleBookmarkSelect);
    this.eventListeners.push({ element: item, event: 'click', handler: handleBookmarkSelect });
  }
};

/**
 * 选择书签
 * @param {Element} bookmarkItem - 书签元素
 */
ModalManager.prototype.selectBookmark = function (bookmarkItem) {
  // 移除之前选中的样式
  var items = document.querySelectorAll('.smart-bookmark-bookmark-item');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('active');
  }

  // 添加选中样式
  bookmarkItem.classList.add('active');

  // 更新选中索引
  var items = document.querySelectorAll('.smart-bookmark-bookmark-item:not(.no-results)');
  for (var i = 0; i < items.length; i++) {
    if (items[i] === bookmarkItem) {
      this.selectedIndex = i;
      break;
    }
  }

  // 直接打开书签
  var url = bookmarkItem.getAttribute('data-bookmark-url');
  if (url) {
    // 检查是否是特殊URL（如edge://, chrome://等）
    if (!this.isSpecialUrl(url)) {
      // 在新标签页中打开书签
      window.open(url, '_blank');
    } else {
      // 显示提示信息
      window.SMART_BOOKMARK_HELPERS.showToast('无法打开特殊URL，请手动在浏览器中访问', true);
    }
    this.hide();
  }
};

/**
 * 从URL中提取域名
 * @param {string} url - URL
 * @returns {string} 域名
 */
ModalManager.prototype.getDomainFromUrl = function (url) {
  try {
    var domain = new URL(url).hostname;
    // 移除www.前缀
    return domain.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
};

/**
 * 检查是否是特殊URL（如edge://, chrome://等）
 * @param {string} url - URL
 * @returns {boolean} 是否是特殊URL
 */
ModalManager.prototype.isSpecialUrl = function (url) {
  try {
    var urlObj = new URL(url);
    var protocol = urlObj.protocol;

    // 检查是否是特殊协议
    var specialProtocols = [
      'edge:', 'chrome:', 'chrome-extension:', 'moz-extension:',
      'about:', 'data:', 'javascript:', 'file:', 'ftp:'
    ];

    return specialProtocols.some(function (specialProtocol) {
      return protocol === specialProtocol;
    });
  } catch (e) {
    // 如果URL解析失败，也认为是特殊URL
    return true;
  }
};

/**
 * 处理键盘事件
 * @param {Event} e - 键盘事件
 */
ModalManager.prototype.handleKeyDown = function (e) {
  // 如果模态框不可见，不处理键盘事件
  if (!this.isModalVisible) return;

  // 如果焦点在搜索框中，且按下了Escape键，关闭模态框
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (document.activeElement === searchInput && e.key === 'Escape') {
    this.hide();
    return;
  }

  // 如果按下了Escape键，关闭模态框
  if (e.key === 'Escape') {
    this.hide();
    return;
  }

  // 如果按下了空格键，且搜索框为空，切换模式
  if (e.key === ' ') {
    var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
    if (searchInput && searchInput.value.trim() === '') {
      e.preventDefault();
      this.toggleMode();
      return;
    }
  }

  // 如果按下了Enter键，确认当前选择
  if (e.key === 'Enter') {
    e.preventDefault();
    if (this.selectedIndex >= 0) {
      this.handleConfirm();
    }
    return;
  }

  // 如果按下了上箭头键，向上选择
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.navigateSelection(-1);
    return;
  }

  // 如果按下了下箭头键，向下选择
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    this.navigateSelection(1);
    return;
  }
};

/**
 * 导航选择
 * @param {number} direction - 方向（1为向下，-1为向上）
 */
ModalManager.prototype.navigateSelection = function (direction) {
  var items;
  if (this.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    items = document.querySelectorAll('.smart-bookmark-bookmark-item:not(.no-results):not(.loading):not(.empty):not(.error)');
  } else {
    items = document.querySelectorAll('.smart-bookmark-folder-item:not(.no-results):not(.loading):not(.empty):not(.error)');
  }

  if (items.length === 0) return;

  // 如果没有选中项，选择第一个或最后一个
  if (this.selectedIndex < 0) {
    this.selectedIndex = direction > 0 ? 0 : items.length - 1;
  } else {
    // 计算新的选中索引
    this.selectedIndex = (this.selectedIndex + direction + items.length) % items.length;
  }

  // 移除所有选中状态
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('active');
  }

  // 添加选中状态
  items[this.selectedIndex].classList.add('active');

  // 确保选中项可见
  items[this.selectedIndex].scrollIntoView({ block: 'nearest' });

  // 如果是文件夹选择模式，启用确认按钮
  if (this.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_FOLDER_SELECT) {
    var confirmBtn = document.getElementById('smart-bookmark-confirm');
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }
  }
};

// 将类附加到全局window对象
window.ModalManager = ModalManager;