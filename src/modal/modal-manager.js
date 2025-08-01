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
  this.itemHeight = 48; // 每个项目的高度（像素）- 与CSS min-height保持一致

  // 组件实例
  this.uiManager = new window.UIManager();
  this.themeManager = new window.ThemeManager();
  this.keyboardManager = new window.KeyboardManager();
  this.folderVirtualScroller = null;
  this.bookmarkVirtualScroller = null;

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
    onConfirm: function() { self.handleConfirm(); },
    onModeToggle: function() { self.toggleMode(); },
    onModalClose: function() { self.hide(); }
  });

  // 监听布局重新计算事件
  window.addEventListener('layout-recalculated', function() {
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
  var addEventListenerFn = function(element, event, handler) {
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

    if (e.target.id === 'smart-bookmark-cancel' ||
      (modal.classList.contains(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS) &&
        e.target === modal)) {
      self.hide();
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
      debouncedSearch(e.target.value);
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

  window.SMART_BOOKMARK_API.getAllBookmarks()
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

      // 构建搜索索引
      if (self.searchEngine && typeof self.searchEngine.buildIndexes === 'function') {
        self.searchEngine.buildIndexes(self.allFolders, self.allBookmarks);
      }

      // 更新键盘管理器的当前项目
      self.keyboardManager.setCurrentItems(self.filteredBookmarks);

      // 更新显示
      self.updateBookmarkList();

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

  if (this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    this.filteredBookmarks = this.searchEngine.searchBookmarks(query, this.allBookmarks);
    this.keyboardManager.setCurrentItems(this.filteredBookmarks);
    this.updateBookmarkList();
  } else {
    this.filteredFolders = this.searchEngine.search(query, this.allFolders);
    this.keyboardManager.setCurrentItems(this.filteredFolders);
    this.updateFolderList();
  }

  // 重置选中索引
  this.keyboardManager.setSelectedIndex(-1);

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

  var matchClass = '';
  if (hasSearchQuery && folder.score !== undefined) {
    if (folder.score >= 0.8) {
      matchClass = 'high-match';
    } else if (folder.score >= 0.5) {
      matchClass = 'medium-match';
    } else if (folder.score > 0) {
      matchClass = 'low-match';
    }
  }

  var item = document.createElement('div');
  item.className = 'smart-bookmark-folder-item ' + matchClass;
  item.setAttribute('data-folder-id', folder.id);
  item.innerHTML =
    '<span class="smart-bookmark-folder-icon">📁</span>' +
    '<span class="smart-bookmark-folder-name">' + folder.title + '</span>' +
    '<span class="smart-bookmark-folder-count">' + (folder.bookmarkCount || 0) + '</span>';

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

  var matchClass = '';
  if (hasSearchQuery && bookmark.score !== undefined) {
    if (bookmark.score >= 0.8) {
      matchClass = 'high-match';
    } else if (bookmark.score >= 0.5) {
      matchClass = 'medium-match';
    } else if (bookmark.score > 0) {
      matchClass = 'low-match';
    }
  }

  var item = document.createElement('div');
  item.className = 'smart-bookmark-bookmark-item ' + matchClass;
  item.setAttribute('data-bookmark-id', bookmark.id);
  item.setAttribute('data-bookmark-url', bookmark.url);
  
  // 重构为上下布局 - 参考文件夹模式的完美样式
  item.innerHTML =
    '<div class="smart-bookmark-bookmark-content">' +
    '<span class="smart-bookmark-bookmark-icon">🔗</span>' +
    '<div class="smart-bookmark-bookmark-text">' +
    '<div class="smart-bookmark-bookmark-title-container">' +
    '<span class="smart-bookmark-bookmark-title">' + bookmark.title + '</span>' +
    '</div>' +
    '<div class="smart-bookmark-bookmark-url">' + this.getDomainFromUrl(bookmark.url) + '</div>' +
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
};

// 将类附加到全局window对象
window.ModalManager = ModalManager;