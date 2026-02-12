// Modal Manager Data - Smart Bookmark Extension

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
      // 构建快速查找表
      self.buildFolderIdMap();
      // console.log('Retrieved ' + folders.length + ' folders');

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

      // 索引后台空闲时构建（不阻塞首屏）
      self.scheduleBuildIndexes();

      return window.SMART_BOOKMARK_SORTING.sortByActivity(self.allFolders);
    })
    .then(function (sortedFolders) {
      if (!sortedFolders) return;

      self.filteredFolders = sortedFolders;

      // 更新键盘管理器的当前项目
      self.keyboardManager.setCurrentItems(self.filteredFolders);

      // 更新显示
      self.updateFolderList();

      // 修复Bug 2: 切换模式时默认选中第一个项目
      if (self.filteredFolders.length > 0) {
        self.keyboardManager.setSelectedIndex(0);
      }

      // 进入模式不自动选中，只有搜索后才默认选中

      var endTime = performance.now();
      // console.log('Load folders took ' + (endTime - startTime) + ' milliseconds');
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
          // 预取后构建查找表
          self.buildFolderIdMap();
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
      // console.log('Retrieved ' + bookmarks.length + ' bookmarks');

      if (bookmarks.length === 0) {
        self.uiManager.showEmptyState('bookmarks');
        return;
      }

      // 使用空字符串搜索来获取默认视图（包含文件夹和书签，且按规则排序）
      self.filteredBookmarks = self.searchEngine.searchAll('', self.allBookmarks, self.allFolders);

      // 清理面包屑缓存，因为数据已更新
      self.clearBreadcrumbCache();

      // 索引后台空闲时构建（不阻塞首屏）
      self.scheduleBuildIndexes();

      // 更新键盘管理器的当前项目
      self.keyboardManager.setCurrentItems(self.filteredBookmarks);

      // 更新显示
      self.updateBookmarkList();

      // 修复Bug 1: 默认打开时选中第一个项目
      if (self.filteredBookmarks.length > 0) {
        self.keyboardManager.setSelectedIndex(0);
      }

      // 进入模式不自动选中，只有搜索后才默认选中

      var endTime = performance.now();
      // console.log('Load bookmarks took ' + (endTime - startTime) + ' milliseconds');
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
  var permissionBtn = this.getRoot().getElementById(buttonId);

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
 * 进入文件夹，显示其中的书签和子文件夹
 * @param {string} folderId - 文件夹ID
 * @param {string} folderTitle - 文件夹标题
 */

ModalManager.prototype.buildFolderIdMap = function () {
  try {
    this.folderById = new Map();
    for (var i = 0; i < (this.allFolders || []).length; i++) {
      var f = this.allFolders[i];
      if (f && f.id) this.folderById.set(f.id, f);
    }
  } catch (e) {
    // 忽略
  }
};

/**
 * 切换下拉菜单显示状态
 * @param {string} dropdownId - 下拉菜单ID
 */
