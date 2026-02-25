// Modal Manager Core - Smart Bookmark Extension

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
  this.folderById = new Map(); // 快速查找用

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

  // 文件夹导航状态
  this.navigationStack = [];        // 导航历史栈
  this.currentFolderId = null;      // 当前浏览的文件夹ID
  this.isInFolderView = false;      // 是否在文件夹视图中
  this.lastSearchQuery = '';        // 上次搜索词

  // 标签筛选器状态
  this.currentFilter = 'all';       // 当前筛选类型
  this.currentTagFilter = null;     // 当前标签筛选（null 或标签名）
  this.filterTypes = ['all', 'bookmark', 'folder']; // 可用筛选类型列表
  this._folderDataReadyForTagPrune = false;
  this._bookmarkDataReadyForTagPrune = false;
  this.dynamicDebouncedSearch = null;
  this.searchGeneration = 0;
  this.isDuplicateCheckInProgress = false;
  this.isDuplicateDialogOpen = false;
  this.duplicateDialogCleanup = null;
  this.isDeleteDialogOpen = false;
  this.deleteDialogCleanup = null;
  this.isContextMenuOpen = false;
  this.contextMenuCleanup = null;
  this.isTagEditorOpen = false;
  this.tagEditorCleanup = null;
  this.isTagFilterPopoverOpen = false;
  this.tagFilterPopoverSearch = '';
  this.tagFilterPopoverFocusedIndex = -1;
  this.tagFilterPopoverFilteredTags = [];

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
 * 获取 Shadow Root（辅助方法）
 * @returns {ShadowRoot|Document}
 */

ModalManager.prototype.getRoot = function () {
  return window.getSmartBookmarkRoot();
};

/**
 * 初始化各个组件
 */

ModalManager.prototype.initializeComponents = function () {
  var self = this;

  // console.log('ModalManager.initializeComponents called');

  // 初始化主题管理器
  // console.log('Initializing theme manager...');
  this.themeManager.init();
  // console.log('Theme manager initialized');

  // 初始化键盘管理器
  // console.log('Initializing keyboard manager...');
  this.keyboardManager.init();
  this.keyboardManager.setCallbacks({
    onConfirm: function () { self.handleConfirm(); },
    onModeToggle: function () { self.toggleMode(); },
    onModalClose: function () { self.hide(); },
    onFilterCycle: function (direction) { self.cycleFilter(direction); },
    onGoBack: function () { self.goBack(); },
    onDelete: function () {
      if (self.isDeleteDialogOpen || self.isContextMenuOpen) return;
      var selectedItem = self.keyboardManager.getSelectedItem();
      if (selectedItem && selectedItem.url) {
        self.confirmDeleteBookmark(selectedItem);
      }
    }
  });

  // 监听布局重新计算事件
  window.addEventListener('layout-recalculated', function () {
    self.handleLayoutRecalculated();
  });

  // 预加载标签数据
  if (window.SMART_BOOKMARK_TAGS && typeof window.SMART_BOOKMARK_TAGS.loadTags === 'function') {
    window.SMART_BOOKMARK_TAGS.loadTags().then(function () {
      // 标签加载完成后更新筛选栏标签 tabs
      try {
        var allTags = self.getAvailableFilterTags();
        if (allTags.length > 0 && self.uiManager && typeof self.uiManager.updateTagFilterTabs === 'function') {
          self.uiManager.updateTagFilterTabs(allTags, self.currentTagFilter);
        }
      } catch (e) { }
    });

    // 监听标签变化
    window.SMART_BOOKMARK_TAGS.addChangeListener(function () {
      try {
        var allTags = self.getAvailableFilterTags();
        if (self.uiManager && typeof self.uiManager.updateTagFilterTabs === 'function') {
          self.uiManager.updateTagFilterTabs(allTags, self.currentTagFilter);
        }
        if (self.isTagFilterPopoverOpen && typeof self.renderTagFilterPopoverList === 'function') {
          self.renderTagFilterPopoverList(self.tagFilterPopoverSearch || '');
        }
        // 刷新列表
        if (self.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
          self.updateBookmarkList();
        } else {
          self.updateFolderList();
        }
      } catch (e) { }
    });
  }

  // 预加载置顶数据，以便空搜索时应用置顶排序
  if (window.SMART_BOOKMARK_PINS && typeof window.SMART_BOOKMARK_PINS.loadPins === 'function') {
    window.SMART_BOOKMARK_PINS.loadPins().then(function () {
      try {
        var searchInput = self.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
        var hasQuery = !!(searchInput && searchInput.value.trim());
        if (!hasQuery) {
          if (self.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
            self.updateBookmarkList();
          } else {
            self.updateFolderList();
          }
        }
      } catch (e) { }
    });

    // 监听置顶数据的跨页面实时变化（通过 chrome.storage.onChanged 或本地事件）
    try {
      var onPinsChanged = function () {
        try {
          var searchInput = self.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
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
        } catch (e) { }
      };

      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('smart-bookmark-pins-updated', onPinsChanged);
      }
      if (typeof window.SMART_BOOKMARK_PINS.addChangeListener === 'function') {
        window.SMART_BOOKMARK_PINS.addChangeListener(onPinsChanged);
      }
    } catch (e) { }
  }
};

/**
 * 绑定事件监听器
 */

ModalManager.prototype.bindEvents = function () {
  var self = this;

  // console.log('ModalManager.bindEvents called');

  // 使用UI管理器的事件监听器管理
  var addEventListenerFn = function (element, event, handler) {
    return self.uiManager.addEventListener(element, event, handler);
  };

  // 禁用主题管理器的旧事件绑定以避免冲突
  // this.themeManager.bindEvents(addEventListenerFn);

  // 点击取消按钮或模态框外部关闭模态框
  var handleClickOutside = function (e) {
    var modal = self.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
    if (!modal) return;

    // 检查是否点击在下拉菜单内
    var dropdowns = [
      self.getRoot().getElementById('smart-bookmark-language-dropdown'),
      self.getRoot().getElementById('smart-bookmark-mode-dropdown'),
      self.getRoot().getElementById('smart-bookmark-theme-dropdown'),
      self.getRoot().getElementById('smart-bookmark-dark-mode-dropdown') // 兼容性
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
      self.getRoot().getElementById('smart-bookmark-language-toggle'),
      self.getRoot().getElementById('smart-bookmark-mode-toggle'),
      self.getRoot().getElementById('smart-bookmark-theme-toggle'),
      self.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID) // 兼容性
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

    // 点击取消按钮关闭（支持按钮内部子元素点击）
    var cancelBtn = self.getRoot().getElementById('smart-bookmark-cancel');
    if (cancelBtn && (e.target === cancelBtn || cancelBtn.contains(e.target))) {
      self.hide();
      return;
    }

    // 点击modal外部关闭（但不包括modal内部）
    if (modal.classList.contains(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS)) {
      var backdrop = self.getRoot().querySelector('.smart-bookmark-modal-backdrop');

      // 如果点击的是backdrop（背景）或者点击在modal外部，则关闭
      if (e.target === backdrop || (backdrop && backdrop.contains(e.target) && !modal.contains(e.target))) {
        self.hide();
      }
    }
  };

  addEventListenerFn(document, 'click', handleClickOutside);

  // 搜索输入事件（动态防抖）
  var searchInput = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (searchInput) {
    this.dynamicDebouncedSearch = this.debounceDynamic(function (query) {
      // 仅保留打开书签模式的输入动画触发，避免添加书签模式出现二次闪烁
      if (self.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH &&
        self.bookmarkVirtualScroller) {
        self.bookmarkVirtualScroller.shouldAnimateOnNextRender = true;
      }
      self.handleSearch(query);
    }, function () { return self.getSearchDebounceDelay(); });

    addEventListenerFn(searchInput, 'input', function (e) {
      self.updateUserActivity(); // 记录用户活动
      self.dynamicDebouncedSearch(e.target.value);
    });

    // 监听其他用户交互
    addEventListenerFn(searchInput, 'keydown', function () {
      self.updateUserActivity();
    });
    addEventListenerFn(searchInput, 'focus', function () {
      self.updateUserActivity();
    });
  }

  // 取消按钮事件（直接绑定，因为 Shadow DOM 事件不会冒泡到 document）
  var cancelBtn = this.getRoot().getElementById('smart-bookmark-cancel');
  if (cancelBtn) {
    addEventListenerFn(cancelBtn, 'click', function (e) {
      e.stopPropagation();
      self.hide();
    });
  }

  // 语言切换按钮事件
  var languageToggle = this.getRoot().getElementById('smart-bookmark-language-toggle');
  if (languageToggle) {
    // console.log('绑定语言切换按钮事件');
    addEventListenerFn(languageToggle, 'click', function (e) {
      // console.log('语言切换按钮被点击');
      e.stopPropagation();
      self.toggleDropdown('smart-bookmark-language-dropdown');
    });
  } else {
    console.warn('找不到语言切换按钮:', 'smart-bookmark-language-toggle');
  }

  // 深浅色模式切换按钮事件
  var modeToggle = this.getRoot().getElementById('smart-bookmark-mode-toggle');
  if (modeToggle) {
    // console.log('绑定深浅色模式切换按钮事件');
    addEventListenerFn(modeToggle, 'click', function (e) {
      // console.log('深浅色模式切换按钮被点击');
      e.stopPropagation();
      self.toggleDropdown('smart-bookmark-mode-dropdown');
    });
  } else {
    console.warn('找不到深浅色模式切换按钮:', 'smart-bookmark-mode-toggle');
  }

  // 主题颜色切换按钮事件
  var themeToggle = this.getRoot().getElementById('smart-bookmark-theme-toggle');
  if (themeToggle) {
    // console.log('绑定主题颜色切换按钮事件');
    addEventListenerFn(themeToggle, 'click', function (e) {
      // console.log('主题颜色切换按钮被点击');
      e.stopPropagation();
      self.toggleDropdown('smart-bookmark-theme-dropdown');
    });
  } else {
    console.warn('找不到主题颜色切换按钮:', 'smart-bookmark-theme-toggle');
  }

  // 语言选项点击事件
  var languageOptions = this.getRoot().querySelectorAll('[data-language]');
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
  var modeOptions = this.getRoot().querySelectorAll('[data-mode]');
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
  var themeOptions = this.getRoot().querySelectorAll('[data-theme]');
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
  var modal = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (modal) {
    addEventListenerFn(modal, 'mousemove', function () {
      self.updateUserActivity();
    });
    addEventListenerFn(modal, 'click', function () {
      self.updateUserActivity();
    });
  }

  // 筛选器标签点击事件（使用事件委托）
  var filterBar = this.getRoot().getElementById('smart-bookmark-filter-bar');
  if (filterBar) {
    addEventListenerFn(filterBar, 'click', function (e) {
      var moreBtn = e.target.closest('[data-more-tags-toggle]');
      if (moreBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (self.isTagFilterPopoverOpen) {
          self.closeTagFilterPopover();
        } else {
          self.openTagFilterPopover();
        }
        return;
      }

      var tab = e.target.closest('.smart-bookmark-filter-tab');
      if (!tab) return;

      // 类型筛选 tab
      if (tab.dataset.filter) {
        self.setFilter(tab.dataset.filter);
        return;
      }

      // 标签筛选 tab（toggle 行为）
      if (tab.dataset.filterTag) {
        var clickedTag = tab.dataset.filterTag;
        if (self.currentTagFilter && self.currentTagFilter.toLowerCase() === clickedTag.toLowerCase()) {
          self.clearTagFilter();
        } else {
          self.setTagFilter(clickedTag);
        }
        if (self.isTagFilterPopoverOpen) {
          self.closeTagFilterPopover();
        }
      }
    });
  }

  // 在ShadowRoot内点击外部区域时关闭“更多标签”Popover
  var rootRef = this.getRoot();
  if (rootRef) {
    addEventListenerFn(rootRef, 'click', function (e) {
      if (!self.isTagFilterPopoverOpen) return;
      var pop = rootRef.getElementById('smart-bookmark-tag-popover');
      var moreBtn = rootRef.getElementById('smart-bookmark-more-tags-btn');
      if (!pop) return;

      var target = e.target;
      var clickedInsidePopover = !!(target && pop.contains(target));
      var clickedMoreBtn = !!(moreBtn && target && moreBtn.contains(target));
      if (!clickedInsidePopover && !clickedMoreBtn) {
        self.closeTagFilterPopover();
      }
    });
  }

  // 列表内标签点击触发筛选（事件委托）：书签列表与文件夹列表共用
  var bindTagClickFilterDelegation = function (listEl) {
    if (!listEl) return;
    addEventListenerFn(listEl, 'click', function (e) {
      var tagEl = e.target.closest('.smart-bookmark-tag');
      if (!tagEl || !tagEl.dataset.tag) return;

      e.stopPropagation();
      var clickedTag = tagEl.dataset.tag;
      if (self.currentTagFilter && self.currentTagFilter.toLowerCase() === clickedTag.toLowerCase()) {
        self.clearTagFilter();
      } else {
        self.setTagFilter(clickedTag);
      }
    });
  };

  var bookmarkList = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID);
  var folderList = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID);
  bindTagClickFilterDelegation(bookmarkList);
  bindTagClickFilterDelegation(folderList);

  // 确认按钮事件
  var confirmBtn = this.getRoot().getElementById('smart-bookmark-confirm');
  if (confirmBtn) {
    addEventListenerFn(confirmBtn, 'click', function () {
      self.handleConfirm();
    });
  }

  // 绑定主题相关事件
  // console.log('Binding theme manager events...');
  this.themeManager.bindEvents(addEventListenerFn);
  // console.log('Theme manager events bound');
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
 * 动态防抖：延迟由函数实时计算
 * @param {Function} func
 * @param {Function} getDelay - 返回delay(ms)
 */

ModalManager.prototype.debounceDynamic = function (func, getDelay) {
  var timeoutId;
  var debounced = function () {
    var args = arguments;
    var context = this;
    clearTimeout(timeoutId);
    var delay = 400;
    try { delay = Math.max(200, Math.min(800, Number(getDelay && getDelay()) || 400)); } catch (e) { }
    timeoutId = setTimeout(function () {
      func.apply(context, args);
    }, delay);
  };
  debounced.cancel = function () {
    clearTimeout(timeoutId);
    timeoutId = null;
  };
  return debounced;
};

/**
 * 计算搜索防抖延迟：根据数据量动态 400–500ms（大数据更高）
 */

ModalManager.prototype.getSearchDebounceDelay = function () {
  var base = 400;
  var len = 0;
  try {
    if (this.uiManager && this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
      len = (this.allBookmarks && this.allBookmarks.length) || 0;
    } else {
      len = (this.allFolders && this.allFolders.length) || 0;
    }
  } catch (e) { }
  if (len > 2000) return 600;
  if (len > 1000) return 500;
  return base; // 400ms
};

/**
 * 取消待执行搜索，并让旧搜索结果失效
 */

ModalManager.prototype.cancelPendingSearch = function () {
  if (this.dynamicDebouncedSearch && typeof this.dynamicDebouncedSearch.cancel === 'function') {
    this.dynamicDebouncedSearch.cancel();
  }
  this.searchGeneration++;
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

  this.isDuplicateCheckInProgress = false;
  this.currentPageInfo = pageInfo;

  // 显示Modal
  this.uiManager.showModal(pageInfo);

  // 应用主题
  this.themeManager.applyDarkMode();

  // 更新语言
  this.languageManager.updateUI();

  // 设置当前模式（触发动画）
  this.setMode(this.uiManager.currentMode);

  // 根据模式控制筛选器层级（书签模式：类型+标签；添加模式：仅标签）
  this.applyFilterBarModeState();
  // 标记：窗口出现时下一次渲染需要动画
  if (this.folderVirtualScroller) this.folderVirtualScroller.shouldAnimateOnNextRender = true;
  if (this.bookmarkVirtualScroller) this.bookmarkVirtualScroller.shouldAnimateOnNextRender = true;

  // 设置键盘管理器状态
  this.keyboardManager.setModalVisible(true);

  // 打开时不强制刷新数据：改为缓存优先（SWR可在后台做，但此处不阻塞首屏）

  var endTime = performance.now();
  // console.log('Modal show took ' + (endTime - startTime) + ' milliseconds');
};

/**
 * 隐藏Modal
 */

ModalManager.prototype.hide = function () {
  if (typeof this.closeTagFilterPopover === 'function') {
    this.closeTagFilterPopover();
  }
  if (typeof this.dismissTagEditor === 'function') {
    this.dismissTagEditor();
  }
  if (typeof this.dismissDuplicateDialog === 'function') {
    this.dismissDuplicateDialog();
  }
  if (typeof this.dismissDeleteDialog === 'function') {
    this.dismissDeleteDialog();
  }
  if (typeof this.dismissContextMenu === 'function') {
    this.dismissContextMenu();
  }
  this.isDuplicateCheckInProgress = false;
  this.uiManager.hideModal();
  this.keyboardManager.setModalVisible(false);
  this.currentPageInfo = null;
  this.currentFilter = 'all';
  this.currentTagFilter = null;
  this.isInFolderView = false;
  this.currentFolderId = null;
  this.currentFolderTitle = null;
  this.navigationStack = [];
  this.lastSearchQuery = '';
  this.isTagEditorOpen = false;
  this.isTagFilterPopoverOpen = false;
  this.tagFilterPopoverSearch = '';
  this.tagFilterPopoverFocusedIndex = -1;
  this.tagFilterPopoverFilteredTags = [];
  if (typeof this.refreshFilterBarState === 'function') {
    this.refreshFilterBarState();
  }
};

/**
 * 加载文件夹数据
 */

ModalManager.prototype.scheduleBuildIndexes = function () {
  var self = this;
  var runner = function () {
    try {
      if (self.searchEngine && typeof self.searchEngine.buildIndexes === 'function') {
        self.searchEngine.buildIndexes(self.allFolders || [], self.allBookmarks || []);
      }
    } catch (e) { }
  };
  // 优先使用 requestIdleCallback
  if (typeof window.requestIdleCallback === 'function') {
    try {
      window.requestIdleCallback(runner, { timeout: 1500 });
      return;
    } catch (e) { }
  }
  // 退化：用 setTimeout 放到事件循环后
  setTimeout(runner, 0);
};

/**
 * 处理布局重新计算
 */

ModalManager.prototype.handleLayoutRecalculated = function () {
  if (window.SMART_BOOKMARK_TAGS && this.uiManager && typeof this.uiManager.updateTagFilterTabs === 'function') {
    this.uiManager.updateTagFilterTabs(this.getAvailableFilterTags(), this.currentTagFilter);
  }
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

ModalManager.prototype.toggleDropdown = function (dropdownId) {
  // console.log('切换下拉菜单:', dropdownId);

  // 先关闭所有其他下拉菜单
  this.closeAllDropdowns();

  // 切换目标下拉菜单
  var dropdown = this.getRoot().getElementById(dropdownId);
  if (dropdown) {
    var hasShowClass = dropdown.classList.contains('show');
    if (hasShowClass) {
      dropdown.classList.remove('show');
      // console.log('下拉菜单', dropdownId, '已关闭');
    } else {
      dropdown.classList.add('show');
      // console.log('下拉菜单', dropdownId, '已打开');
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
    var dropdown = this.getRoot().getElementById(id);
    if (dropdown) {
      dropdown.classList.remove('show');
      dropdown.style.display = 'none';
    }
  }.bind(this));
};

/**
 * 清理面包屑缓存
 */

ModalManager.prototype.clearBreadcrumbCache = function () {
  this.breadcrumbCache.clear();
};

/**
 * 获取文件夹模式的默认结果顺序（按活跃度降序）
 * 作为单一策略入口，避免不同调用点出现排序不一致
 * @returns {Array} 排序后的文件夹列表副本
 */
ModalManager.prototype.getDefaultFolderResults = function () {
  var folders = (this.allFolders || []).slice();

  folders.sort(function (a, b) {
    return (b && b.activity ? b.activity : 0) - (a && a.activity ? a.activity : 0);
  });

  for (var i = 0; i < folders.length; i++) {
    folders[i].score = 1;
  }

  return folders;
};

/**
 * 获取当前模式下筛选栏应展示的标签集合
 * - 书签搜索模式：书签+文件夹标签
 * - 添加书签模式：仅文件夹标签
 * @returns {Array}
 */
ModalManager.prototype.getAvailableFilterTags = function () {
  if (!window.SMART_BOOKMARK_TAGS) return [];
  if (this.uiManager && this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_FOLDER_SELECT) {
    return window.SMART_BOOKMARK_TAGS.getAllTags('folders');
  }
  return window.SMART_BOOKMARK_TAGS.getAllTags();
};

/**
 * 根据当前模式更新筛选栏显示状态
 * - 书签搜索模式：显示类型+标签
 * - 添加书签模式：显示标签，隐藏类型
 */
ModalManager.prototype.applyFilterBarModeState = function () {
  var root = this.getRoot();
  var filterBar = root.getElementById('smart-bookmark-filter-bar');
  if (!filterBar) return;

  var typeGroup = root.querySelector('.smart-bookmark-filter-group-type');
  var isFolderMode = !!(this.uiManager && this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_FOLDER_SELECT);

  filterBar.style.display = '';
  if (typeGroup) {
    typeGroup.style.display = isFolderMode ? 'none' : '';
  }

  if (window.SMART_BOOKMARK_TAGS && this.uiManager && typeof this.uiManager.updateTagFilterTabs === 'function') {
    this.uiManager.updateTagFilterTabs(this.getAvailableFilterTags(), this.currentTagFilter);
  }
  if (typeof this.refreshFilterBarState === 'function') {
    this.refreshFilterBarState();
  }
};

/**
 * 清理Modal管理器
 */

ModalManager.prototype.cleanup = function () {
  if (typeof this.closeTagFilterPopover === 'function') {
    this.closeTagFilterPopover();
  }
  if (typeof this.dismissTagEditor === 'function') {
    this.dismissTagEditor();
  }
  if (typeof this.dismissDuplicateDialog === 'function') {
    this.dismissDuplicateDialog();
  }
  if (typeof this.dismissDeleteDialog === 'function') {
    this.dismissDeleteDialog();
  }
  if (typeof this.dismissContextMenu === 'function') {
    this.dismissContextMenu();
  }
  this.isDuplicateCheckInProgress = false;

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
  var modal = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  var toast = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.TOAST_ID);

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
