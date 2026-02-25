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

      // 附着标签数据（确保标签已加载）
      var attachFolderTags = function () {
        if (window.SMART_BOOKMARK_TAGS) {
          for (var ti = 0; ti < self.allFolders.length; ti++) {
            self.allFolders[ti].tags = window.SMART_BOOKMARK_TAGS.getTagsForItem('folders', self.allFolders[ti].id);
          }
        }
      };

      var ensureTagsLoaded = Promise.resolve();
      if (window.SMART_BOOKMARK_TAGS && !window.SMART_BOOKMARK_TAGS.hasLoaded()) {
        ensureTagsLoaded = window.SMART_BOOKMARK_TAGS.loadTags();
      }

      return Promise.resolve(ensureTagsLoaded).then(function () {
        attachFolderTags();
        self._folderDataReadyForTagPrune = true;
        if (self.uiManager && typeof self.uiManager.updateTagFilterTabs === 'function') {
          var folderModeTags = (typeof self.getAvailableFilterTags === 'function')
            ? self.getAvailableFilterTags()
            : (window.SMART_BOOKMARK_TAGS ? window.SMART_BOOKMARK_TAGS.getAllTags() : []);
          self.uiManager.updateTagFilterTabs(folderModeTags, self.currentTagFilter);
        }
        if (typeof self.refreshFilterBarState === 'function') {
          self.refreshFilterBarState();
        }
        return self.maybePruneOrphanTags();
      }).then(function () {

        // 构建快速查找表
        self.buildFolderIdMap();
        // console.log('Retrieved ' + folders.length + ' folders');

        if (folders.length === 0) {
          self.uiManager.showEmptyState('folders');
          return;
        }

        return window.SMART_BOOKMARK_SORTING.updateFolderActivity(self.allFolders);
      });
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

      // 将默认排序结果作为文件夹主数据源，统一后续空查询展示顺序
      self.allFolders = sortedFolders.slice();
      self.filteredFolders = self.getDefaultFolderResults();

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
          self._folderDataReadyForTagPrune = true;
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

      // 过滤浏览器内部/特殊协议书签（如 edge://、chrome://、about: 等）
      // 这些链接通常无法在当前上下文打开，也不应出现在扩展列表中
      var visibleBookmarks = [];
      for (var bi = 0; bi < bookmarks.length; bi++) {
        var bm = bookmarks[bi];
        if (!bm || !bm.url) continue;
        if (typeof self.isSpecialUrl === 'function' && self.isSpecialUrl(bm.url)) {
          continue;
        }
        visibleBookmarks.push(bm);
      }

      self.allBookmarks = visibleBookmarks;

      // 构建 parentId → 书签索引（供 enterFolder O(1) 查找）
      self.buildBookmarkParentMap();

      // 附着标签数据（确保标签已加载）
      var attachBookmarkTags = function () {
        if (window.SMART_BOOKMARK_TAGS) {
          for (var ti = 0; ti < self.allBookmarks.length; ti++) {
            self.allBookmarks[ti].tags = window.SMART_BOOKMARK_TAGS.getTagsForItem('bookmarks', self.allBookmarks[ti].id);
          }
        }
      };
      var attachFolderTags = function () {
        if (window.SMART_BOOKMARK_TAGS) {
          for (var fi = 0; fi < self.allFolders.length; fi++) {
            self.allFolders[fi].tags = window.SMART_BOOKMARK_TAGS.getTagsForItem('folders', self.allFolders[fi].id);
          }
        }
      };

      var ensureTagsLoaded = Promise.resolve();
      if (window.SMART_BOOKMARK_TAGS && !window.SMART_BOOKMARK_TAGS.hasLoaded()) {
        ensureTagsLoaded = window.SMART_BOOKMARK_TAGS.loadTags();
      }

      return Promise.resolve(ensureTagsLoaded).then(function () {
        attachBookmarkTags();
        attachFolderTags();
        self._bookmarkDataReadyForTagPrune = true;
        if (self.uiManager && typeof self.uiManager.updateTagFilterTabs === 'function') {
          var bookmarkModeTags = (typeof self.getAvailableFilterTags === 'function')
            ? self.getAvailableFilterTags()
            : (window.SMART_BOOKMARK_TAGS ? window.SMART_BOOKMARK_TAGS.getAllTags() : []);
          self.uiManager.updateTagFilterTabs(bookmarkModeTags, self.currentTagFilter);
        }
        if (typeof self.refreshFilterBarState === 'function') {
          self.refreshFilterBarState();
        }
        return self.maybePruneOrphanTags();
      }).then(function () {
        // console.log('Retrieved ' + bookmarks.length + ' bookmarks');

        if (self.allBookmarks.length === 0) {
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
      });
    })
    .catch(function (error) {
      console.error('Failed to load bookmarks:', error);
      self.handleLoadError('bookmarks', error);
    });
};

/**
 * 在书签与文件夹都就绪后清理孤儿标签，避免单侧触发误删
 * @returns {Promise<void>}
 */
ModalManager.prototype.maybePruneOrphanTags = function () {
  if (!window.SMART_BOOKMARK_TAGS) return Promise.resolve();
  if (!window.SMART_BOOKMARK_TAGS.hasLoaded()) return Promise.resolve();
  if (!this._folderDataReadyForTagPrune || !this._bookmarkDataReadyForTagPrune) return Promise.resolve();

  var validBmIds = [];
  for (var bi = 0; bi < this.allBookmarks.length; bi++) {
    if (this.allBookmarks[bi] && this.allBookmarks[bi].id) {
      validBmIds.push(this.allBookmarks[bi].id);
    }
  }

  var validFdIds = [];
  for (var fi = 0; fi < this.allFolders.length; fi++) {
    if (this.allFolders[fi] && this.allFolders[fi].id) {
      validFdIds.push(this.allFolders[fi].id);
    }
  }

  return window.SMART_BOOKMARK_TAGS.pruneOrphanTags(validBmIds, validFdIds);
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
    this.folderChildrenByParent = new Map(); // parentId → [folder, ...]
    for (var i = 0; i < (this.allFolders || []).length; i++) {
      var f = this.allFolders[i];
      if (f && f.id) {
        this.folderById.set(f.id, f);
        // 构建 parentId → children 索引
        if (f.parentId) {
          if (!this.folderChildrenByParent.has(f.parentId)) {
            this.folderChildrenByParent.set(f.parentId, []);
          }
          this.folderChildrenByParent.get(f.parentId).push(f);
        }
      }
    }
  } catch (e) {
    // 忽略
  }
};

/**
 * 构建书签 parentId → [bookmark, ...] 索引（书签数据加载后调用）
 */
ModalManager.prototype.buildBookmarkParentMap = function () {
  try {
    this.bookmarkChildrenByParent = new Map();
    for (var i = 0; i < (this.allBookmarks || []).length; i++) {
      var bm = this.allBookmarks[i];
      if (bm && bm.id && bm.parentId) {
        if (!this.bookmarkChildrenByParent.has(bm.parentId)) {
          this.bookmarkChildrenByParent.set(bm.parentId, []);
        }
        this.bookmarkChildrenByParent.get(bm.parentId).push(bm);
      }
    }
  } catch (e) {
    // 忽略
  }
};

/**
 * 从本地索引获取子文件夹（O(1)），带 subFolderCount 计算
 * @param {string} folderId
 * @returns {Array|null} 子文件夹列表，索引不可用时返回 null
 */
ModalManager.prototype.getLocalSubFolders = function (folderId) {
  if (!this.folderChildrenByParent) return null;
  var children = this.folderChildrenByParent.get(folderId) || [];
  // 补充每个子文件夹的 subFolderCount
  for (var i = 0; i < children.length; i++) {
    var sub = children[i];
    if (typeof sub.subFolderCount === 'undefined') {
      sub.subFolderCount = (this.folderChildrenByParent.get(sub.id) || []).length;
    }
  }
  return children;
};

/**
 * 从本地索引获取文件夹内书签（O(1)）
 * @param {string} folderId
 * @returns {Array|null} 书签列表，索引不可用时返回 null
 */
ModalManager.prototype.getLocalBookmarksByFolder = function (folderId) {
  if (!this.bookmarkChildrenByParent) return null;
  return this.bookmarkChildrenByParent.get(folderId) || [];
};

/**
 * 仅刷新文件夹数据与 parentId 索引（不触发列表 UI 切换）
 * 用于书签模式下接收外部变更后保持 enterFolder 导航数据新鲜
 * @returns {Promise<void>}
 */
ModalManager.prototype.refreshFoldersForNavigation = function () {
  var self = this;
  if (!window.SMART_BOOKMARK_API || typeof window.SMART_BOOKMARK_API.getAllFolders !== 'function') {
    return Promise.resolve();
  }

  return window.SMART_BOOKMARK_API.getAllFolders()
    .then(function (folders) {
      if (!folders || !Array.isArray(folders)) return;

      self.allFolders = folders;

      // 若标签已加载，补齐文件夹标签，保持过滤与显示一致
      if (window.SMART_BOOKMARK_TAGS && window.SMART_BOOKMARK_TAGS.hasLoaded()) {
        for (var i = 0; i < self.allFolders.length; i++) {
          self.allFolders[i].tags = window.SMART_BOOKMARK_TAGS.getTagsForItem('folders', self.allFolders[i].id);
        }
      }

      self.buildFolderIdMap();
      self.clearBreadcrumbCache();
    })
    .catch(function () {
      // 忽略导航索引刷新失败，不影响主流程
    });
};

/**
 * 切换下拉菜单显示状态
 * @param {string} dropdownId - 下拉菜单ID
 */
