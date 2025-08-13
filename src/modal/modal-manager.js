// Modal Manager for the Smart Bookmark Extension - Refactored Version

/**
 * Modal管理器类 - 协调各个组件的主控制器
 */
function ModalManager() {
  this.currentPageInfo = null;
  this.allFolders = [];
  this.filteredFolders = [];
  this.allBookmarks = [];
  this.filteredBookmarks = [];
  this.searchEngine = new window.SearchEngine();
  this.itemHeight = 58; // 每个项目的高度（像素）- 与CSS min-height保持一致（文件夹52px+书签56px的平均值）
  
  // 面包屑缓存，避免重复计算
  this.breadcrumbCache = new Map();

  // 组件实例
  this.uiManager = new window.UIManager();
  this.themeManager = new window.ThemeManager();
  this.keyboardManager = new window.KeyboardManager();
  this.languageManager = new window.LanguageManager();
  this.folderVirtualScroller = null;
  this.bookmarkVirtualScroller = null;
  this.foldersPrefetched = false; // 首次进入为书签模式时的文件夹预取标记

  // 用户交互状态追踪
  this.lastUserInteraction = Date.now();
  this.isUserActive = false;



  this.init();
}

/**
 * 初始化Modal
 */
ModalManager.prototype.init = function () {
  this.createModal();
  this.initializeComponents();  // 先初始化组件
  this.bindEvents();           // 再绑定事件，确保themeManager已经初始化
};

/**
 * 创建Modal DOM元素
 */
ModalManager.prototype.createModal = function () {
  this.uiManager.createModal();
};

/**
 * 初始化各个组件
 */
ModalManager.prototype.initializeComponents = function () {
  var self = this;

  console.log('ModalManager.initializeComponents called');

  // 初始化主题管理器
  console.log('Initializing theme manager...');
  this.themeManager.init();
  console.log('Theme manager initialized');

  // 初始化键盘管理器
  console.log('Initializing keyboard manager...');
  this.keyboardManager.init();
  this.keyboardManager.setCallbacks({
    onConfirm: function () { self.handleConfirm(); },
    onModeToggle: function () { self.toggleMode(); },
    onModalClose: function () { self.hide(); }
  });

  // 监听布局重新计算事件
  window.addEventListener('layout-recalculated', function () {
    self.handleLayoutRecalculated();
  });

  // 预加载置顶数据（与弹窗/newtab共享），以便空搜索时应用置顶排序
  if (window.SMART_BOOKMARK_PINS && typeof window.SMART_BOOKMARK_PINS.loadPins === 'function') {
    window.SMART_BOOKMARK_PINS.loadPins().then(function () {
      try {
        var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
        var hasQuery = !!(searchInput && searchInput.value.trim());
        if (!hasQuery) {
          if (self.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
            self.updateBookmarkList();
          } else {
            self.updateFolderList();
          }
        }
      } catch (e) {}
    });

    // 监听置顶数据的跨页面实时变化（通过 chrome.storage.onChanged 或本地事件）
    try {
      var onPinsChanged = function() {
        try {
          var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
          var hasQuery = !!(searchInput && searchInput.value.trim());
          if (!hasQuery) {
            // 空查询：需要重新排序
            if (self.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
              self.updateBookmarkList();
            } else {
              self.updateFolderList();
            }
          } else {
            // 搜索中：只需刷新当前可见列表
            if (self.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH && self.bookmarkVirtualScroller) {
              self.bookmarkVirtualScroller.forceUpdate();
            } else if (self.folderVirtualScroller) {
              self.folderVirtualScroller.forceUpdate();
            }
          }
        } catch (e) {}
      };

      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('smart-bookmark-pins-updated', onPinsChanged);
      }
      if (typeof window.SMART_BOOKMARK_PINS.addChangeListener === 'function') {
        window.SMART_BOOKMARK_PINS.addChangeListener(onPinsChanged);
      }
    } catch (e) {}
  }
};

/**
 * 绑定事件监听器
 */
ModalManager.prototype.bindEvents = function () {
  var self = this;

  console.log('ModalManager.bindEvents called');

  // 使用UI管理器的事件监听器管理
  var addEventListenerFn = function (element, event, handler) {
    return self.uiManager.addEventListener(element, event, handler);
  };
  
  // 禁用主题管理器的旧事件绑定以避免冲突
  // this.themeManager.bindEvents(addEventListenerFn);

  // 点击取消按钮或模态框外部关闭模态框
  var handleClickOutside = function (e) {
    var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
    if (!modal) return;

    // 检查是否点击在下拉菜单内
    var dropdowns = [
      document.getElementById('smart-bookmark-language-dropdown'),
      document.getElementById('smart-bookmark-mode-dropdown'),
      document.getElementById('smart-bookmark-theme-dropdown'),
      document.getElementById('smart-bookmark-dark-mode-dropdown') // 兼容性
    ];
    
    var clickedInDropdown = false;
    for (var i = 0; i < dropdowns.length; i++) {
      if (dropdowns[i] && dropdowns[i].contains(e.target)) {
        clickedInDropdown = true;
        break;
      }
    }
    
    // 检查是否点击在控制按钮上
    var controlButtons = [
      document.getElementById('smart-bookmark-language-toggle'),
      document.getElementById('smart-bookmark-mode-toggle'),
      document.getElementById('smart-bookmark-theme-toggle'),
      document.getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID) // 兼容性
    ];
    
    var clickedOnButton = false;
    for (var j = 0; j < controlButtons.length; j++) {
      if (controlButtons[j] && controlButtons[j].contains(e.target)) {
        clickedOnButton = true;
        break;
      }
    }
    
    // 如果点击在下拉菜单外部且不在控制按钮上，关闭所有下拉菜单
    if (!clickedInDropdown && !clickedOnButton) {
      self.closeAllDropdowns();
    }
    
    // 如果点击在下拉菜单或控制按钮上，不关闭模态框
    if (clickedInDropdown || clickedOnButton) {
      return;
    }

    // 点击取消按钮关闭
    if (e.target.id === 'smart-bookmark-cancel') {
      self.hide();
      return;
    }

    // 点击modal外部关闭（但不包括modal内部）
    if (modal.classList.contains(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS)) {
      var backdrop = document.querySelector('.smart-bookmark-modal-backdrop');

      // 如果点击的是backdrop（背景）或者点击在modal外部，则关闭
      if (e.target === backdrop || (backdrop && backdrop.contains(e.target) && !modal.contains(e.target))) {
        self.hide();
      }
    }
  };

  addEventListenerFn(document, 'click', handleClickOutside);

  // 搜索输入事件（添加防抖）
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (searchInput) {
    var debouncedSearch = this.debounce(function (query) {
      self.handleSearch(query);
      // 搜索输入触发：下一次渲染需要动画
      if (self.folderVirtualScroller) self.folderVirtualScroller.shouldAnimateOnNextRender = true;
      if (self.bookmarkVirtualScroller) self.bookmarkVirtualScroller.shouldAnimateOnNextRender = true;
    }, 300);

    addEventListenerFn(searchInput, 'input', function (e) {
      self.updateUserActivity(); // 记录用户活动
      debouncedSearch(e.target.value);
    });

    // 监听其他用户交互
    addEventListenerFn(searchInput, 'keydown', function () {
      self.updateUserActivity();
    });
    addEventListenerFn(searchInput, 'focus', function () {
      self.updateUserActivity();
    });
  }

  // 语言切换按钮事件
  var languageToggle = document.getElementById('smart-bookmark-language-toggle');
  if (languageToggle) {
    console.log('绑定语言切换按钮事件');
    addEventListenerFn(languageToggle, 'click', function (e) {
      console.log('语言切换按钮被点击');
      e.stopPropagation();
      self.toggleDropdown('smart-bookmark-language-dropdown');
    });
  } else {
    console.warn('找不到语言切换按钮:', 'smart-bookmark-language-toggle');
  }

  // 深浅色模式切换按钮事件
  var modeToggle = document.getElementById('smart-bookmark-mode-toggle');
  if (modeToggle) {
    console.log('绑定深浅色模式切换按钮事件');
    addEventListenerFn(modeToggle, 'click', function (e) {
      console.log('深浅色模式切换按钮被点击');
      e.stopPropagation();
      self.toggleDropdown('smart-bookmark-mode-dropdown');
    });
  } else {
    console.warn('找不到深浅色模式切换按钮:', 'smart-bookmark-mode-toggle');
  }

  // 主题颜色切换按钮事件
  var themeToggle = document.getElementById('smart-bookmark-theme-toggle');
  if (themeToggle) {
    console.log('绑定主题颜色切换按钮事件');
    addEventListenerFn(themeToggle, 'click', function (e) {
      console.log('主题颜色切换按钮被点击');
      e.stopPropagation();
      self.toggleDropdown('smart-bookmark-theme-dropdown');
    });
  } else {
    console.warn('找不到主题颜色切换按钮:', 'smart-bookmark-theme-toggle');
  }

  // 语言选项点击事件
  var languageOptions = document.querySelectorAll('[data-language]');
  for (var i = 0; i < languageOptions.length; i++) {
    addEventListenerFn(languageOptions[i], 'click', function (e) {
      e.stopPropagation();
      var language = e.target.getAttribute('data-language');
      if (language) {
        self.languageManager.setLanguage(language);
        self.closeAllDropdowns();
      }
    });
  }
  
  // 深浅色模式选项点击事件
  var modeOptions = document.querySelectorAll('[data-mode]');
  for (var j = 0; j < modeOptions.length; j++) {
    addEventListenerFn(modeOptions[j], 'click', function (e) {
      e.stopPropagation();
      var mode = e.target.getAttribute('data-mode');
      if (mode) {
        self.themeManager.setDarkMode(mode);
        self.closeAllDropdowns();
      }
    });
  }
  
  // 主题颜色选项点击事件
  var themeOptions = document.querySelectorAll('[data-theme]');
  for (var k = 0; k < themeOptions.length; k++) {
    addEventListenerFn(themeOptions[k], 'click', function (e) {
      e.stopPropagation();
      var theme = e.target.getAttribute('data-theme');
      if (theme) {
        self.themeManager.setTheme(theme);
        self.closeAllDropdowns();
      }
    });
  }

  // 监听modal内的鼠标活动
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (modal) {
    addEventListenerFn(modal, 'mousemove', function () {
      self.updateUserActivity();
    });
    addEventListenerFn(modal, 'click', function () {
      self.updateUserActivity();
    });
  }

  // 确认按钮事件
  var confirmBtn = document.getElementById('smart-bookmark-confirm');
  if (confirmBtn) {
    addEventListenerFn(confirmBtn, 'click', function () {
      self.handleConfirm();
    });
  }

  // 绑定主题相关事件
  console.log('Binding theme manager events...');
  this.themeManager.bindEvents(addEventListenerFn);
  console.log('Theme manager events bound');
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
 * 更新用户活动状态
 */
ModalManager.prototype.updateUserActivity = function () {
  this.lastUserInteraction = Date.now();
  this.isUserActive = true;

  // 如果用户持续不活动5秒，标记为非活跃
  var self = this;
  setTimeout(function () {
    if (Date.now() - self.lastUserInteraction >= 5000) {
      self.isUserActive = false;
    }
  }, 5000);
};

/**
 * 显示Modal
 * @param {Object} pageInfo - 当前页面信息 {title, url}
 */
ModalManager.prototype.show = function (pageInfo) {
  var startTime = performance.now();

  this.currentPageInfo = pageInfo;

  // 显示Modal
  this.uiManager.showModal(pageInfo);

  // 应用主题
  this.themeManager.applyDarkMode();
  
  // 更新语言
  this.languageManager.updateUI();

  // 设置当前模式（触发动画）
  this.setMode(this.uiManager.currentMode);
  // 标记：窗口出现时下一次渲染需要动画
  if (this.folderVirtualScroller) this.folderVirtualScroller.shouldAnimateOnNextRender = true;
  if (this.bookmarkVirtualScroller) this.bookmarkVirtualScroller.shouldAnimateOnNextRender = true;

  // 设置键盘管理器状态
  this.keyboardManager.setModalVisible(true);

  var endTime = performance.now();
  console.log('Modal show took ' + (endTime - startTime) + ' milliseconds');
};

/**
 * 隐藏Modal
 */
ModalManager.prototype.hide = function () {
  this.uiManager.hideModal();
  this.keyboardManager.setModalVisible(false);
  this.currentPageInfo = null;
};

/**
 * 加载文件夹数据
 */
ModalManager.prototype.loadFolders = function () {
  var self = this;
  var startTime = performance.now();

  // 显示加载状态
  this.uiManager.showLoadingState('folders');

  window.SMART_BOOKMARK_API.getAllFolders()
    .then(function (folders) {
      if (!folders || !Array.isArray(folders)) {
        throw new Error('Invalid folders data received');
      }

      self.allFolders = folders;
      console.log('Retrieved ' + folders.length + ' folders');

      if (folders.length === 0) {
        self.uiManager.showEmptyState('folders');
        return;
      }

      return window.SMART_BOOKMARK_SORTING.updateFolderActivity(self.allFolders);
    })
    .then(function (foldersWithActivity) {
      if (!foldersWithActivity) return;

      self.allFolders = foldersWithActivity;

      // 清理面包屑缓存，因为文件夹数据已更新
      self.clearBreadcrumbCache();

      // 构建搜索索引
      if (self.searchEngine && typeof self.searchEngine.buildIndexes === 'function') {
        self.searchEngine.buildIndexes(self.allFolders, self.allBookmarks);
      }

      return window.SMART_BOOKMARK_SORTING.sortByActivity(self.allFolders);
    })
    .then(function (sortedFolders) {
      if (!sortedFolders) return;

      self.filteredFolders = sortedFolders;

      // 更新键盘管理器的当前项目
      self.keyboardManager.setCurrentItems(self.filteredFolders);

      // 更新显示
      self.updateFolderList();

      // 进入模式不自动选中，只有搜索后才默认选中

      var endTime = performance.now();
      console.log('Load folders took ' + (endTime - startTime) + ' milliseconds');
    })
    .catch(function (error) {
      console.error('Failed to load folders:', error);
      self.handleLoadError('folders', error);
    });
};

/**
 * 加载书签数据
 */
ModalManager.prototype.loadBookmarks = function () {
  var self = this;
  var startTime = performance.now();

  this.uiManager.showLoadingState('bookmarks');

  // 首次进入如果还未加载过文件夹，为书签面包屑预取文件夹信息
  var foldersPromise;
  if (!this.foldersPrefetched && (!this.allFolders || this.allFolders.length === 0)) {
    foldersPromise = window.SMART_BOOKMARK_API.getAllFolders()
      .then(function (folders) {
        if (folders && Array.isArray(folders)) {
          self.allFolders = folders;
          self.foldersPrefetched = true;
          // 预取后清理面包屑缓存，保证后续生成正确
          self.clearBreadcrumbCache();
        }
      })
      .catch(function () { /* 忽略预取失败，不影响书签加载 */ });
  } else {
    foldersPromise = Promise.resolve();
  }

  Promise.resolve(foldersPromise)
    .then(function () {
      return window.SMART_BOOKMARK_API.getAllBookmarks();
    })
    .then(function (bookmarks) {
      if (!bookmarks || !Array.isArray(bookmarks)) {
        throw new Error('Invalid bookmarks data received');
      }

      self.allBookmarks = bookmarks;
      console.log('Retrieved ' + bookmarks.length + ' bookmarks');

      if (bookmarks.length === 0) {
        self.uiManager.showEmptyState('bookmarks');
        return;
      }

      self.filteredBookmarks = self.allBookmarks;
      
      // 清理面包屑缓存，因为数据已更新
      self.clearBreadcrumbCache();

      // 构建搜索索引
      if (self.searchEngine && typeof self.searchEngine.buildIndexes === 'function') {
        self.searchEngine.buildIndexes(self.allFolders, self.allBookmarks);
      }

      // 更新键盘管理器的当前项目
      self.keyboardManager.setCurrentItems(self.filteredBookmarks);

      // 更新显示
      self.updateBookmarkList();

      // 进入模式不自动选中，只有搜索后才默认选中

      var endTime = performance.now();
      console.log('Load bookmarks took ' + (endTime - startTime) + ' milliseconds');
    })
    .catch(function (error) {
      console.error('Failed to load bookmarks:', error);
      self.handleLoadError('bookmarks', error);
    });
};

/**
 * 处理加载错误
 * @param {string} type - 数据类型 ('folders' 或 'bookmarks')
 * @param {Error} error - 错误对象
 */
ModalManager.prototype.handleLoadError = function (type, error) {
  var errorMessage = '加载' + (type === 'folders' ? '书签文件夹' : '书签') + '失败';
  var showPermissionButton = false;

  if (error.message.includes('not available')) {
    errorMessage = '书签功能不可用，请检查扩展权限';
  } else if (error.message.includes('Bookmarks permission not granted')) {
    errorMessage = '缺少书签权限，请点击下方按钮授予权限';
    showPermissionButton = true;
  } else if (error.message.includes('No bookmark tree found')) {
    errorMessage = '没有找到' + (type === 'folders' ? '书签文件夹' : '书签') + '，请先创建一些书签';
  } else if (error.message.includes('Invalid data')) {
    errorMessage = '书签数据格式错误，请重试';
  }

  this.uiManager.showErrorState(type, errorMessage, showPermissionButton);
  window.SMART_BOOKMARK_HELPERS.showToast(errorMessage, true);

  // 如果显示了权限按钮，绑定事件
  if (showPermissionButton) {
    this.bindPermissionRequestButton(type);
  }
};

/**
 * 绑定权限请求按钮事件
 * @param {string} type - 数据类型
 */
ModalManager.prototype.bindPermissionRequestButton = function (type) {
  var self = this;
  var buttonId = 'smart-bookmark-request-permission-' + type;
  var permissionBtn = document.getElementById(buttonId);

  if (permissionBtn) {
    this.uiManager.addEventListener(permissionBtn, 'click', function () {
      self.handlePermissionRequest();
    });
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
        // 重新加载数据
        if (self.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_FOLDER_SELECT) {
          self.loadFolders();
        } else {
          self.loadBookmarks();
        }
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
  var startTime = performance.now();
  var self = this;



  // 记录当前高度
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  var currentHeight = null;
  if (modal) {
    currentHeight = modal.offsetHeight;
    modal.style.height = currentHeight + 'px'; // 设置当前高度
    modal.classList.add('content-changing');
  }

  // 执行搜索
  if (this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    this.filteredBookmarks = this.searchEngine.searchBookmarks(query, this.allBookmarks);
    this.keyboardManager.setCurrentItems(this.filteredBookmarks);
    this.updateBookmarkList();
  } else {
    this.filteredFolders = this.searchEngine.search(query, this.allFolders);
    this.keyboardManager.setCurrentItems(this.filteredFolders);
    this.updateFolderList();
  }

  // 计算新高度并应用动画
  setTimeout(function () {
    if (modal) {
      // 临时设置为auto来测量新高度
      modal.style.height = 'auto';
      var newHeight = modal.offsetHeight;

      // 恢复原高度触发重排
      modal.style.height = currentHeight + 'px';
      modal.offsetHeight; // 强制重排

      // 设置新高度触发动画
      modal.style.height = newHeight + 'px';

      // 动画完成后清理
      setTimeout(function () {
        if (modal) {
          modal.classList.remove('content-changing');
        }
      }, 400);
    }
  }, 50);

  // 延迟设置选中索引，确保虚拟滚动器完全渲染后再进行选择
  setTimeout(function () {
    if (self.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
      if (self.filteredBookmarks.length > 0) {
        self.keyboardManager.setSelectedIndex(0);
      } else {
        self.keyboardManager.setSelectedIndex(-1);
      }
    } else {
      if (self.filteredFolders.length > 0) {
        self.keyboardManager.setSelectedIndex(0);
      } else {
        self.keyboardManager.setSelectedIndex(-1);
      }
    }
  }, 100); // 确保虚拟滚动器完全准备好

  var endTime = performance.now();
  console.log('Search took ' + (endTime - startTime) + ' milliseconds');
};

/**
 * 更新文件夹列表显示
 */
ModalManager.prototype.updateFolderList = function () {
  var folderList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID);
  if (!folderList) return;

  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var hasSearchQuery = searchInput && searchInput.value.trim() !== '';

  // 检查是否有结果
  if (hasSearchQuery && this.filteredFolders.length === 0) {
    this.uiManager.showNoResultsState('folders');
    return;
  }

  if (!hasSearchQuery && this.filteredFolders.length === 0) {
    this.uiManager.showEmptyState('folders');
    return;
  }

  // 应用置顶规则：
  // - 空搜索：置顶项按置顶时间倒序优先
  // - 有搜索：若结果包含置顶项，则将置顶项提升到顶部但保留搜索相对顺序
  var itemsToRender = this.filteredFolders ? this.filteredFolders.slice() : [];
  if (window.SMART_BOOKMARK_PINS) {
    if (!hasSearchQuery) {
      itemsToRender = window.SMART_BOOKMARK_PINS.applyPinOrdering(itemsToRender, 'folders');
    } else if (window.SMART_BOOKMARK_PINS.hasAnyPinned(itemsToRender, 'folders')) {
      itemsToRender = window.SMART_BOOKMARK_PINS.promotePinnedPreserveOrder(itemsToRender, 'folders');
    }
  }
  // 确保后续选择索引与渲染顺序一致
  this.filteredFolders = itemsToRender.slice();

  // 使用虚拟滚动渲染文件夹列表
  this.renderFolderListWithVirtualScroll(folderList, hasSearchQuery, itemsToRender);
};

/**
 * 使用虚拟滚动渲染文件夹列表
 * @param {Element} folderList - 文件夹列表容器
 * @param {boolean} hasSearchQuery - 是否有搜索查询
 */
ModalManager.prototype.renderFolderListWithVirtualScroll = function (folderList, hasSearchQuery, itemsToRender) {
  var self = this;

  // 销毁旧的虚拟滚动器
  if (this.folderVirtualScroller) {
    this.folderVirtualScroller.destroy();
  }

  // 创建新的虚拟滚动器
  this.folderVirtualScroller = new window.VirtualScroller(
    folderList,
    this.itemHeight,
    (itemsToRender && itemsToRender.length) || 0,
    function (folder, index) {
      return self.renderFolderItem(folder, index, hasSearchQuery);
    }
  );

  // 设置键盘管理器的虚拟滚动器引用
  this.keyboardManager.setVirtualScroller(this.folderVirtualScroller);

  // 更新虚拟滚动器的数据
  // 模式切换/首次渲染/搜索后：确保本次渲染播放动画
  this.folderVirtualScroller.shouldAnimateOnNextRender = true;
  this.folderVirtualScroller.updateData(itemsToRender);
  // 同步键盘管理器的当前项目
  this.keyboardManager.setCurrentItems(itemsToRender);
};

/**
 * 渲染单个文件夹项目
 * @param {Object} folder - 文件夹对象
 * @param {number} index - 索引
 * @param {boolean} hasSearchQuery - 是否有搜索查询
 * @returns {Element} 文件夹元素
 */
ModalManager.prototype.renderFolderItem = function (folder, index, hasSearchQuery) {
  if (!folder) return null;

  // 移除匹配度样式，保持统一简约风格
  var matchClass = '';

  var item = document.createElement('div');
  item.className = 'smart-bookmark-folder-item ' + matchClass;
  item.setAttribute('data-folder-id', folder.id);
  
  // 生成面包屑
  var breadcrumb = this.generateBreadcrumb(folder.parentId);
  
  // 获取搜索关键词并应用高亮
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var searchTerm = searchInput ? searchInput.value.trim() : '';
  var highlightedTitle = hasSearchQuery && searchTerm ? 
    this.highlightText(folder.title, searchTerm) : folder.title;
  
  item.innerHTML =
    '<span class="smart-bookmark-folder-icon">📁</span>' +
    '<div class="smart-bookmark-folder-content">' +
    '<div class="smart-bookmark-folder-main">' +
    '<span class="smart-bookmark-folder-name">' + highlightedTitle + '</span>' +
    '</div>' +
    (breadcrumb ? breadcrumb : '') +
    '</div>';

  // 右侧操作区域：数量和置顶按钮
  try {
    item.classList.add('has-actions');
    var actions = document.createElement('div');
    actions.className = 'smart-bookmark-item-actions';
    
    // 文件夹数量
    var countSpan = document.createElement('span');
    countSpan.className = 'smart-bookmark-folder-count';
    countSpan.textContent = folder.bookmarkCount || 0;
    actions.appendChild(countSpan);
    
    // 置顶按钮
    var pinBtn = document.createElement('button');
    pinBtn.className = 'smart-bookmark-pin-btn';
    pinBtn.type = 'button';
    pinBtn.innerHTML = '<svg class="smart-bookmark-pin-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M23.9986 5L17.8856 17.4776L4 19.4911L14.0589 29.3251L11.6544 43L23.9986 36.4192L36.3454 43L33.9586 29.3251L44 19.4911L30.1913 17.4776L23.9986 5Z"/></svg>';
    if (window.SMART_BOOKMARK_PINS && window.SMART_BOOKMARK_PINS.isPinned('folders', folder.id)) {
      pinBtn.classList.add('pinned');
    }
    var selfRef = this;
    pinBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!window.SMART_BOOKMARK_PINS) return;
      window.SMART_BOOKMARK_PINS.togglePin('folders', folder.id).then(function(pinnedNow) {
        if (pinnedNow) pinBtn.classList.add('pinned'); else pinBtn.classList.remove('pinned');
        // 空搜索时刷新排序，搜索态仅刷新按钮样式
        var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
        var hasSearchQuery = searchInput && searchInput.value.trim() !== '';
        if (!hasSearchQuery) {
          selfRef.updateFolderList();
        } else if (selfRef.folderVirtualScroller) {
          selfRef.folderVirtualScroller.forceUpdate();
        }
      });
    });
    actions.appendChild(pinBtn);
    item.appendChild(actions);
  } catch (e) {}

  // 绑定点击事件
  var self = this;
  item.addEventListener('click', function (e) {
    self.selectFolder(e.currentTarget);
  });

  return item;
};

/**
 * 更新书签列表显示
 */
ModalManager.prototype.updateBookmarkList = function () {
  var bookmarkList = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID);
  if (!bookmarkList) return;

  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var hasSearchQuery = searchInput && searchInput.value.trim() !== '';

  // 检查是否有结果
  if (hasSearchQuery && this.filteredBookmarks.length === 0) {
    this.uiManager.showNoResultsState('bookmarks');
    return;
  }

  if (!hasSearchQuery && this.filteredBookmarks.length === 0) {
    this.uiManager.showEmptyState('bookmarks');
    return;
  }

  // 应用置顶规则：
  // - 空搜索：置顶项按置顶时间倒序优先
  // - 有搜索：若结果包含置顶项，则将置顶项提升到顶部但保留搜索相对顺序
  var itemsToRender = this.filteredBookmarks ? this.filteredBookmarks.slice() : [];
  if (window.SMART_BOOKMARK_PINS) {
    if (!hasSearchQuery) {
      itemsToRender = window.SMART_BOOKMARK_PINS.applyPinOrdering(itemsToRender, 'bookmarks');
    } else if (window.SMART_BOOKMARK_PINS.hasAnyPinned(itemsToRender, 'bookmarks')) {
      itemsToRender = window.SMART_BOOKMARK_PINS.promotePinnedPreserveOrder(itemsToRender, 'bookmarks');
    }
  }
  // 保持键盘导航与渲染顺序一致
  this.filteredBookmarks = itemsToRender.slice();

  // 使用虚拟滚动渲染书签列表
  this.renderBookmarkListWithVirtualScroll(bookmarkList, hasSearchQuery, itemsToRender);
};

/**
 * 使用虚拟滚动渲染书签列表
 * @param {Element} bookmarkList - 书签列表容器
 * @param {boolean} hasSearchQuery - 是否有搜索查询
 */
ModalManager.prototype.renderBookmarkListWithVirtualScroll = function (bookmarkList, hasSearchQuery, itemsToRender) {
  var self = this;

  // 销毁旧的虚拟滚动器
  if (this.bookmarkVirtualScroller) {
    this.bookmarkVirtualScroller.destroy();
  }

  // 创建新的虚拟滚动器
  this.bookmarkVirtualScroller = new window.VirtualScroller(
    bookmarkList,
    this.itemHeight,
    (itemsToRender && itemsToRender.length) || 0,
    function (bookmark, index) {
      return self.renderBookmarkItem(bookmark, index, hasSearchQuery);
    }
  );

  // 设置键盘管理器的虚拟滚动器引用
  this.keyboardManager.setVirtualScroller(this.bookmarkVirtualScroller);

  // 更新虚拟滚动器的数据
  // 模式切换/首次渲染/搜索后：确保本次渲染播放动画
  this.bookmarkVirtualScroller.shouldAnimateOnNextRender = true;
  this.bookmarkVirtualScroller.updateData(itemsToRender);
  // 同步键盘管理器的当前项目
  this.keyboardManager.setCurrentItems(itemsToRender);
};

/**
 * 渲染单个书签项目
 * @param {Object} bookmark - 书签对象
 * @param {number} index - 索引
 * @param {boolean} hasSearchQuery - 是否有搜索查询
 * @returns {Element} 书签元素
 */
ModalManager.prototype.renderBookmarkItem = function (bookmark, index, hasSearchQuery) {
  if (!bookmark) return null;

  // 移除匹配度样式，保持统一简约风格
  var matchClass = '';

  var item = document.createElement('div');
  item.className = 'smart-bookmark-bookmark-item ' + matchClass;
  item.setAttribute('data-bookmark-id', bookmark.id);
  item.setAttribute('data-bookmark-url', bookmark.url);

  // 生成面包屑
  var breadcrumb = this.generateBreadcrumb(bookmark.parentId);
  
  // 获取搜索关键词并应用高亮
  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var searchTerm = searchInput ? searchInput.value.trim() : '';
  var highlightedTitle = hasSearchQuery && searchTerm ? 
    this.highlightText(bookmark.title, searchTerm) : bookmark.title;
  var displayUrl = this.formatUrlForDisplay(bookmark.url);
  var highlightedUrl = hasSearchQuery && searchTerm ? 
    this.highlightText(displayUrl, searchTerm) : displayUrl;
  
  // 重构为上下布局 - 参考文件夹模式的完美样式
  item.innerHTML =
    '<div class="smart-bookmark-bookmark-content">' +
    '<span class="smart-bookmark-bookmark-icon">🔗</span>' +
    '<div class="smart-bookmark-bookmark-text">' +
    '<div class="smart-bookmark-bookmark-title-container">' +
    '<span class="smart-bookmark-bookmark-title">' + highlightedTitle + '</span>' +
    '</div>' +
    '<div class="smart-bookmark-bookmark-url" title="' + bookmark.url + '">' + highlightedUrl + '</div>' +
    (breadcrumb ? breadcrumb : '') +
    '</div>' +
    '</div>';

  // 右侧置顶按钮（搜索态仍显示，但不改变排序）
  try {
    item.classList.add('has-actions');
    var actions = document.createElement('div');
    actions.className = 'smart-bookmark-item-actions';
    var pinBtn = document.createElement('button');
    pinBtn.className = 'smart-bookmark-pin-btn';
    pinBtn.type = 'button';
    pinBtn.innerHTML = '<svg class="smart-bookmark-pin-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M23.9986 5L17.8856 17.4776L4 19.4911L14.0589 29.3251L11.6544 43L23.9986 36.4192L36.3454 43L33.9586 29.3251L44 19.4911L30.1913 17.4776L23.9986 5Z"/></svg>';
    if (window.SMART_BOOKMARK_PINS && window.SMART_BOOKMARK_PINS.isPinned('bookmarks', bookmark.id)) {
      pinBtn.classList.add('pinned');
    }
    var selfRef = this;
    pinBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!window.SMART_BOOKMARK_PINS) return;
      window.SMART_BOOKMARK_PINS.togglePin('bookmarks', bookmark.id).then(function(pinnedNow) {
        if (pinnedNow) pinBtn.classList.add('pinned'); else pinBtn.classList.remove('pinned');
        // 空搜索时刷新排序，搜索态仅刷新按钮样式
        var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
        var hasSearchQuery = searchInput && searchInput.value.trim() !== '';
        if (!hasSearchQuery) {
          selfRef.updateBookmarkList();
        } else if (selfRef.bookmarkVirtualScroller) {
          selfRef.bookmarkVirtualScroller.forceUpdate();
        }
      });
    });
    actions.appendChild(pinBtn);
    item.appendChild(actions);
  } catch (e) {}

  // 绑定点击事件
  var self = this;
  item.addEventListener('click', function (e) {
    self.selectBookmark(e.currentTarget);
  });

  return item;
};

/**
 * 高亮匹配文本
 * @param {string} text - 原始文本
 * @param {string} searchTerm - 搜索关键词
 * @returns {string} 包含高亮标签的HTML文本
 */
ModalManager.prototype.highlightText = function (text, searchTerm) {
  if (!text || !searchTerm) return this.escapeHtml(text || '');
  
  var escapedText = this.escapeHtml(text);
  var escapedSearchTerm = this.escapeHtml(searchTerm);
  var lowerText = text.toLowerCase();
  var lowerSearchTerm = searchTerm.toLowerCase();
  
  // 1. 完全匹配
  if (lowerText === lowerSearchTerm) {
    return '<span class="smart-bookmark-highlight">' + escapedText + '</span>';
  }
  
  // 2. 前缀匹配
  if (lowerText.indexOf(lowerSearchTerm) === 0) {
    var matchLength = searchTerm.length;
    var highlighted = '<span class="smart-bookmark-highlight">' + 
      this.escapeHtml(text.substring(0, matchLength)) + '</span>';
    var remaining = this.escapeHtml(text.substring(matchLength));
    return highlighted + remaining;
  }
  
  // 3. 包含匹配
  var index = lowerText.indexOf(lowerSearchTerm);
  if (index > -1) {
    var before = this.escapeHtml(text.substring(0, index));
    var match = '<span class="smart-bookmark-highlight">' + 
      this.escapeHtml(text.substring(index, index + searchTerm.length)) + '</span>';
    var after = this.escapeHtml(text.substring(index + searchTerm.length));
    return before + match + after;
  }
  
  // 4. 模糊匹配（逐字符高亮）
  var result = [];
  var textChars = text.split('');
  var searchChars = searchTerm.toLowerCase().split('');
  var searchIndex = 0;
  var isInHighlight = false;
  
  for (var i = 0; i < textChars.length; i++) {
    var char = textChars[i];
    var lowerChar = char.toLowerCase();
    
    if (searchIndex < searchChars.length && lowerChar === searchChars[searchIndex]) {
      // 匹配的字符
      if (!isInHighlight) {
        result.push('<span class="smart-bookmark-highlight">');
        isInHighlight = true;
      }
      result.push(this.escapeHtml(char));
      searchIndex++;
      
      // 检查是否需要关闭高亮
      if (searchIndex >= searchChars.length || 
          (i + 1 < textChars.length && 
           searchIndex < searchChars.length && 
           textChars[i + 1].toLowerCase() !== searchChars[searchIndex])) {
        result.push('</span>');
        isInHighlight = false;
      }
    } else {
      // 非匹配字符
      if (isInHighlight) {
        result.push('</span>');
        isInHighlight = false;
      }
      result.push(this.escapeHtml(char));
    }
  }
  
  // 确保关闭未闭合的高亮标签
  if (isInHighlight) {
    result.push('</span>');
  }
  
  return result.join('');
};

/**
 * HTML转义函数
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的文本
 */
ModalManager.prototype.escapeHtml = function (text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * 从URL中提取域名
 * @param {string} url - URL
 * @returns {string} 域名
 */
ModalManager.prototype.getDomainFromUrl = function (url) {
  try {
    var domain = new URL(url).hostname;
    return domain.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
};

/**
 * 格式化URL用于显示 - 显示完整URL但去掉协议前缀
 * @param {string} url - URL
 * @returns {string} 格式化的URL
 */
ModalManager.prototype.formatUrlForDisplay = function (url) {
  try {
    // 移除协议前缀（http://、https://）
    var displayUrl = url.replace(/^https?:\/\//, '');

    // 移除www前缀（可选）
    displayUrl = displayUrl.replace(/^www\./, '');

    // 如果URL太长，确保末尾有足够空间显示省略号
    // CSS会处理实际的截断和省略号显示
    return displayUrl;
  } catch (e) {
    // 如果URL格式有问题，直接返回原URL
    return url;
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

  // 更新键盘管理器的选中索引
  var folderId = folderItem.getAttribute('data-folder-id');
  for (var j = 0; j < this.filteredFolders.length; j++) {
    if (this.filteredFolders[j].id === folderId) {
      this.keyboardManager.setSelectedIndex(j);
      break;
    }
  }

  // 启用确认按钮
  var confirmBtn = document.getElementById('smart-bookmark-confirm');
  if (confirmBtn) {
    confirmBtn.disabled = false;
  }
};

/**
 * 选择书签
 * @param {Element} bookmarkItem - 书签元素
 */
ModalManager.prototype.selectBookmark = function (bookmarkItem) {
  // 直接打开书签
  var url = bookmarkItem.getAttribute('data-bookmark-url');
  if (url) {
    if (!this.isSpecialUrl(url)) {
      window.open(url, '_blank');
    } else {
      window.SMART_BOOKMARK_HELPERS.showToast(this.languageManager.t('specialUrlWarning'), true);
    }
    this.hide();
  }
};

/**
 * 检查是否是特殊URL
 * @param {string} url - URL
 * @returns {boolean} 是否是特殊URL
 */
ModalManager.prototype.isSpecialUrl = function (url) {
  try {
    var urlObj = new URL(url);
    var protocol = urlObj.protocol;
    var specialProtocols = [
      'edge:', 'chrome:', 'chrome-extension:', 'moz-extension:',
      'about:', 'data:', 'javascript:', 'file:', 'ftp:'
    ];
    return specialProtocols.some(function (specialProtocol) {
      return protocol === specialProtocol;
    });
  } catch (e) {
    return true;
  }
};

/**
 * 处理确认操作
 */
ModalManager.prototype.handleConfirm = function () {
  if (this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    // 书签搜索模式：打开选中的书签
    var selectedItem = this.keyboardManager.getSelectedItem();
    if (selectedItem && selectedItem.url) {
      if (!this.isSpecialUrl(selectedItem.url)) {
        window.open(selectedItem.url, '_blank');
          } else {
      window.SMART_BOOKMARK_HELPERS.showToast(this.languageManager.t('specialUrlWarning'), true);
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
    var startTime = performance.now();

    window.SMART_BOOKMARK_API.createBookmark(folderId, this.currentPageInfo.title, this.currentPageInfo.url)
      .then(function () {
        var endTime = performance.now();
        console.log('Create bookmark took ' + (endTime - startTime) + ' milliseconds');
        window.SMART_BOOKMARK_HELPERS.showToast(self.languageManager.t('bookmarkAdded'));
        self.hide();
      })
      .catch(function (error) {
        console.error('Failed to create bookmark:', error);
        window.SMART_BOOKMARK_HELPERS.showToast(self.languageManager.t('bookmarkAddFailed'), true);
      });
  }
};

/**
 * 设置模式
 * @param {string} mode - 模式类型
 */
ModalManager.prototype.setMode = function (mode) {
  this.uiManager.setMode(mode);
  this.keyboardManager.setMode(mode);

  if (mode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    this.loadBookmarks();
  } else {
    this.loadFolders();
  }
  
  // 模式设置时也需要动画标记
  var self = this;
  requestAnimationFrame(function () {
    if (self.folderVirtualScroller) self.folderVirtualScroller.shouldAnimateOnNextRender = true;
    if (self.bookmarkVirtualScroller) self.bookmarkVirtualScroller.shouldAnimateOnNextRender = true;
  });
};

/**
 * 切换模式
 */
ModalManager.prototype.toggleMode = function () {
  this.uiManager.toggleMode();
  this.keyboardManager.setMode(this.uiManager.currentMode);

  if (this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    this.loadBookmarks();
  } else {
    this.loadFolders();
  }
  // 延迟一帧，确保UI切换完成且列表可见，再设置动画标记
  var self = this;
  requestAnimationFrame(function () {
    // 更新语言管理器的界面文本
    self.languageManager.updateUI();
    if (self.folderVirtualScroller) self.folderVirtualScroller.shouldAnimateOnNextRender = true;
    if (self.bookmarkVirtualScroller) self.bookmarkVirtualScroller.shouldAnimateOnNextRender = true;
  });
};

/**
 * 处理布局重新计算
 */
ModalManager.prototype.handleLayoutRecalculated = function () {
  // 强制更新虚拟滚动器
  if (this.folderVirtualScroller) {
    this.folderVirtualScroller.forceUpdate();
  }
  if (this.bookmarkVirtualScroller) {
    this.bookmarkVirtualScroller.forceUpdate();
  }
};

/**
 * 获取Modal可见状态
 */
ModalManager.prototype.isModalVisible = function () {
  return this.uiManager.isModalVisible;
};

/**
 * 生成面包屑路径
 * @param {string} parentId - 父文件夹ID
 * @returns {string} 面包屑HTML字符串
 */
ModalManager.prototype.generateBreadcrumb = function (parentId) {
  if (!parentId || parentId === '0') {
    return ''; // 根目录不显示面包屑
  }
  
  // 检查缓存
  if (this.breadcrumbCache.has(parentId)) {
    return this.breadcrumbCache.get(parentId);
  }
  
  var path = [];
  var currentId = parentId;
  var maxDepth = 10; // 防止无限循环
  var depth = 0;
  
  // 向上追溯路径
  while (currentId && currentId !== '0' && depth < maxDepth) {
    var folder = this.findFolderById(currentId);
    if (folder) {
      path.unshift(folder.title);
      currentId = folder.parentId;
    } else {
      break;
    }
    depth++;
  }
  
  // 生成面包屑HTML：不再按层级数量截断，交给CSS根据容器宽度省略
  var breadcrumbHtml = '';
  if (path.length > 0) {
    var displayPath = path.join(' › ');
    breadcrumbHtml = '<div class="breadcrumb" title="' + displayPath + '">' + displayPath + '</div>';
  }
  
  // 缓存结果
  this.breadcrumbCache.set(parentId, breadcrumbHtml);
  return breadcrumbHtml;
};

/**
 * 根据ID查找文件夹
 * @param {string} folderId - 文件夹ID
 * @returns {Object|null} 文件夹对象
 */
ModalManager.prototype.findFolderById = function (folderId) {
  // 优先从当前加载的文件夹列表中查找
  for (var i = 0; i < this.allFolders.length; i++) {
    if (this.allFolders[i].id === folderId) {
      return this.allFolders[i];
    }
  }
  
  // 如果找不到，可能是根文件夹或系统文件夹
  if (folderId === '1') {
    return { id: '1', title: '书签栏', parentId: '0' };
  } else if (folderId === '2') {
    return { id: '2', title: '其他书签', parentId: '0' };
  } else if (folderId === '3') {
    return { id: '3', title: '移动设备书签', parentId: '0' };
  }
  
  return null;
};

/**
 * 切换下拉菜单显示状态
 * @param {string} dropdownId - 下拉菜单ID
 */
ModalManager.prototype.toggleDropdown = function (dropdownId) {
  console.log('切换下拉菜单:', dropdownId);
  
  // 先关闭所有其他下拉菜单
  this.closeAllDropdowns();
  
  // 切换目标下拉菜单
  var dropdown = document.getElementById(dropdownId);
  if (dropdown) {
    var hasShowClass = dropdown.classList.contains('show');
    if (hasShowClass) {
      dropdown.classList.remove('show');
      console.log('下拉菜单', dropdownId, '已关闭');
    } else {
      dropdown.classList.add('show');
      console.log('下拉菜单', dropdownId, '已打开');
    }
  } else {
    console.warn('找不到下拉菜单:', dropdownId);
  }
};

/**
 * 关闭所有下拉菜单
 */
ModalManager.prototype.closeAllDropdowns = function () {
  var dropdowns = [
    'smart-bookmark-language-dropdown',
    'smart-bookmark-mode-dropdown',
    'smart-bookmark-theme-dropdown',
    'smart-bookmark-dark-mode-dropdown' // 兼容性
  ];
  
  dropdowns.forEach(function (id) {
    var dropdown = document.getElementById(id);
    if (dropdown) {
      dropdown.classList.remove('show');
      dropdown.style.display = 'none';
    }
  });
};

/**
 * 清理面包屑缓存
 */
ModalManager.prototype.clearBreadcrumbCache = function () {
  this.breadcrumbCache.clear();
};

/**
 * 清理Modal管理器
 */
ModalManager.prototype.cleanup = function () {
  // 清理组件
  if (this.uiManager) {
    this.uiManager.cleanup();
  }
  if (this.themeManager) {
    this.themeManager.cleanup();
  }
  if (this.keyboardManager) {
    this.keyboardManager.cleanup();
  }

  // 清理虚拟滚动器
  if (this.folderVirtualScroller) {
    this.folderVirtualScroller.destroy();
    this.folderVirtualScroller = null;
  }
  if (this.bookmarkVirtualScroller) {
    this.bookmarkVirtualScroller.destroy();
    this.bookmarkVirtualScroller = null;
  }

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
  
  // 清理面包屑缓存
  this.clearBreadcrumbCache();
};

// 将类附加到全局window对象
window.ModalManager = ModalManager;