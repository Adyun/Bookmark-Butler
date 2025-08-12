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

  // 点击取消按钮或模态框外部关闭模态框
  var handleClickOutside = function (e) {
    var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
    if (!modal) return;

    // 检查点击是否在深色模式下拉菜单内
    var dropdown = document.getElementById('smart-bookmark-dark-mode-dropdown');
    if (dropdown && dropdown.contains(e.target)) {
      return; // 如果点击在下拉菜单内，不关闭模态框
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

  // 设置当前模式
  this.setMode(this.uiManager.currentMode);

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

  // 使用虚拟滚动渲染文件夹列表
  this.renderFolderListWithVirtualScroll(folderList, hasSearchQuery);
};

/**
 * 使用虚拟滚动渲染文件夹列表
 * @param {Element} folderList - 文件夹列表容器
 * @param {boolean} hasSearchQuery - 是否有搜索查询
 */
ModalManager.prototype.renderFolderListWithVirtualScroll = function (folderList, hasSearchQuery) {
  var self = this;

  // 销毁旧的虚拟滚动器
  if (this.folderVirtualScroller) {
    this.folderVirtualScroller.destroy();
  }

  // 创建新的虚拟滚动器
  this.folderVirtualScroller = new window.VirtualScroller(
    folderList,
    this.itemHeight,
    this.filteredFolders.length,
    function (folder, index) {
      return self.renderFolderItem(folder, index, hasSearchQuery);
    }
  );

  // 设置键盘管理器的虚拟滚动器引用
  this.keyboardManager.setVirtualScroller(this.folderVirtualScroller);

  // 更新虚拟滚动器的数据
  this.folderVirtualScroller.updateData(this.filteredFolders);
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
  
  item.innerHTML =
    '<span class="smart-bookmark-folder-icon">📁</span>' +
    '<div class="smart-bookmark-folder-content">' +
    '<div class="smart-bookmark-folder-main">' +
    '<span class="smart-bookmark-folder-name">' + folder.title + '</span>' +
    '<span class="smart-bookmark-folder-count">' + (folder.bookmarkCount || 0) + '</span>' +
    '</div>' +
    (breadcrumb ? breadcrumb : '') +
    '</div>';

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

  // 使用虚拟滚动渲染书签列表
  this.renderBookmarkListWithVirtualScroll(bookmarkList, hasSearchQuery);
};

/**
 * 使用虚拟滚动渲染书签列表
 * @param {Element} bookmarkList - 书签列表容器
 * @param {boolean} hasSearchQuery - 是否有搜索查询
 */
ModalManager.prototype.renderBookmarkListWithVirtualScroll = function (bookmarkList, hasSearchQuery) {
  var self = this;

  // 销毁旧的虚拟滚动器
  if (this.bookmarkVirtualScroller) {
    this.bookmarkVirtualScroller.destroy();
  }

  // 创建新的虚拟滚动器
  this.bookmarkVirtualScroller = new window.VirtualScroller(
    bookmarkList,
    this.itemHeight,
    this.filteredBookmarks.length,
    function (bookmark, index) {
      return self.renderBookmarkItem(bookmark, index, hasSearchQuery);
    }
  );

  // 设置键盘管理器的虚拟滚动器引用
  this.keyboardManager.setVirtualScroller(this.bookmarkVirtualScroller);

  // 更新虚拟滚动器的数据
  this.bookmarkVirtualScroller.updateData(this.filteredBookmarks);
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
  
  // 重构为上下布局 - 参考文件夹模式的完美样式
  item.innerHTML =
    '<div class="smart-bookmark-bookmark-content">' +
    '<span class="smart-bookmark-bookmark-icon">🔗</span>' +
    '<div class="smart-bookmark-bookmark-text">' +
    '<div class="smart-bookmark-bookmark-title-container">' +
    '<span class="smart-bookmark-bookmark-title">' + bookmark.title + '</span>' +
    '</div>' +
    '<div class="smart-bookmark-bookmark-url" title="' + bookmark.url + '">' + this.formatUrlForDisplay(bookmark.url) + '</div>' +
    (breadcrumb ? breadcrumb : '') +
    '</div>' +
    '</div>';

  // 绑定点击事件
  var self = this;
  item.addEventListener('click', function (e) {
    self.selectBookmark(e.currentTarget);
  });

  return item;
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
      window.SMART_BOOKMARK_HELPERS.showToast('无法打开特殊URL，请手动在浏览器中访问', true);
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
    var startTime = performance.now();

    window.SMART_BOOKMARK_API.createBookmark(folderId, this.currentPageInfo.title, this.currentPageInfo.url)
      .then(function () {
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
  this.uiManager.setMode(mode);
  this.keyboardManager.setMode(mode);

  if (mode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    this.loadBookmarks();
  } else {
    this.loadFolders();
  }
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