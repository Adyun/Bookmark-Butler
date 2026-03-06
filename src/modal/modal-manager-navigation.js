// Modal Manager Navigation - Smart Bookmark Extension

ModalManager.prototype.enterFolder = function (folderId, folderTitle, options) {
  var self = this;
  options = options || {};
  var skipHistoryPush = !!options.skipHistoryPush;
  if (typeof this.closeTagFilterPopover === 'function') {
    this.closeTagFilterPopover();
  }

  // 保存当前状态到导航栈
  if (!skipHistoryPush) {
    if (this.isInFolderView) {
      this.navigationStack.push({
        type: 'folder',
        folderId: this.currentFolderId,
        folderTitle: this.currentFolderTitle
      });
    } else {
      this.navigationStack.push({
        type: 'search',
        query: this.lastSearchQuery,
        results: this.filteredBookmarks.slice() // 保存当前搜索结果副本
      });
    }
  }

  // 更新状态
  this.isInFolderView = true;
  this.currentFolderId = folderId;
  this.currentFolderTitle = folderTitle;

  // 清空搜索框
  var searchInput = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (searchInput) {
    searchInput.value = '';
  }

  // 获取文件夹内容：优先从本地 parentId 索引查找（O(1)），索引不可用时回退到 API
  var localSubs = (typeof self.getLocalSubFolders === 'function') ? self.getLocalSubFolders(folderId) : null;
  var localBms = (typeof self.getLocalBookmarksByFolder === 'function') ? self.getLocalBookmarksByFolder(folderId) : null;

  var subFoldersPromise = localSubs !== null ? Promise.resolve(localSubs) : window.SMART_BOOKMARK_API.getSubFolders(folderId);
  var bookmarksPromise = localBms !== null ? Promise.resolve(localBms) : window.SMART_BOOKMARK_API.getBookmarksByFolder(folderId);

  var tagsReadyPromise = Promise.resolve();
  if (window.SMART_BOOKMARK_TAGS && !window.SMART_BOOKMARK_TAGS.hasLoaded()) {
    tagsReadyPromise = window.SMART_BOOKMARK_TAGS.loadTags();
  }

  return Promise.all([
    subFoldersPromise,
    bookmarksPromise,
    tagsReadyPromise
  ]).then(function (results) {
    var subFolders = results[0];
    var bookmarks = results[1];

    // 过滤浏览器内部/特殊协议书签（如 edge://、chrome://、about: 等）
    var visibleBookmarks = [];
    for (var vb = 0; vb < bookmarks.length; vb++) {
      var folderBookmark = bookmarks[vb];
      if (!folderBookmark || !folderBookmark.url) continue;
      if (typeof self.isSpecialUrl === 'function' && self.isSpecialUrl(folderBookmark.url)) {
        continue;
      }
      visibleBookmarks.push(folderBookmark);
    }
    bookmarks = visibleBookmarks;

    // 合并：子文件夹在前，书签在后
    var combinedItems = [];

    // 添加返回项
    combinedItems.push({
      id: '__back__',
      title: '← 返回',
      itemType: 'back'
    });

    // 添加子文件夹
    for (var i = 0; i < subFolders.length; i++) {
      var folderTags = (window.SMART_BOOKMARK_TAGS && window.SMART_BOOKMARK_TAGS.hasLoaded())
        ? window.SMART_BOOKMARK_TAGS.getTagsForItem('folders', subFolders[i].id) : [];
      combinedItems.push({
        id: subFolders[i].id,
        title: subFolders[i].title,
        parentId: subFolders[i].parentId,
        bookmarkCount: subFolders[i].bookmarkCount,
        subFolderCount: subFolders[i].subFolderCount,
        itemType: 'folder',
        tags: folderTags
      });
    }

    // 添加书签
    for (var j = 0; j < bookmarks.length; j++) {
      var bmTags = (window.SMART_BOOKMARK_TAGS && window.SMART_BOOKMARK_TAGS.hasLoaded())
        ? window.SMART_BOOKMARK_TAGS.getTagsForItem('bookmarks', bookmarks[j].id) : [];
      combinedItems.push({
        id: bookmarks[j].id,
        title: bookmarks[j].title,
        url: bookmarks[j].url,
        parentId: bookmarks[j].parentId,
        itemType: 'bookmark',
        tags: bmTags
      });
    }

    self.filteredBookmarks = combinedItems;

    // 进入文件夹时重置筛选器为"全部"
    if (self.currentFilter !== 'all' || self.currentTagFilter) {
      self.currentFilter = 'all';
      self.currentTagFilter = null;
      self.refreshFilterBarState();
    }

    self.keyboardManager.setCurrentItems(self.filteredBookmarks);
    self.updateBookmarkList();
    // 默认选中第一项
    self.keyboardManager.navigateToFirst();
  });
};

/**
 * 返回上一级
 */

ModalManager.prototype.goBack = function () {
  // 仅在书签搜索模式下处理返回导航，避免文件夹选择模式误触发状态回退
  if (this.uiManager.currentMode !== window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    return;
  }

  if (this.navigationStack.length === 0) {
    // 没有历史，回到默认状态
    this.isInFolderView = false;
    this.currentFolderId = null;
    this.currentFolderTitle = null;
    this.handleSearch('');
    return;
  }

  var prevState = this.navigationStack.pop();

  if (prevState.type === 'search') {
    // 恢复搜索状态
    this.isInFolderView = false;
    this.currentFolderId = null;
    this.currentFolderTitle = null;

    // 恢复搜索框和结果
    var searchInput = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
    if (searchInput) {
      searchInput.value = prevState.query;
    }

    this.filteredBookmarks = prevState.results;
    this.keyboardManager.setCurrentItems(this.filteredBookmarks);
    this.updateBookmarkList();
    // 默认选中第一项
    this.keyboardManager.navigateToFirst();
  } else if (prevState.type === 'folder') {
    // 返回上一级文件夹
    this.enterFolder(prevState.folderId, prevState.folderTitle);
    // enterFolder 会再次 push，需要 pop 掉
    this.navigationStack.pop();
  }
};

/**
 * 处理搜索
 * @param {string} query - 搜索关键词
 */

ModalManager.prototype.selectFolder = function (folderItem) {
  // 移除之前选中的样式
  var items = this.getRoot().querySelectorAll('.smart-bookmark-folder-item');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('active');
  }

  // 添加选中样式
  folderItem.classList.add('active');

  // 更新键盘管理器的选中索引
  var folderId = folderItem.getAttribute('data-folder-id');
  var currentItems = this.keyboardManager && this.keyboardManager.currentItems ? this.keyboardManager.currentItems : [];
  for (var j = 0; j < currentItems.length; j++) {
    if (currentItems[j] && currentItems[j].id === folderId) {
      this.keyboardManager.setSelectedIndex(j);
      break;
    }
  }

  // 启用确认按钮
  var confirmBtn = this.getRoot().getElementById('smart-bookmark-confirm');
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
  var bookmarkId = bookmarkItem.getAttribute('data-bookmark-id');

  if (url) {
    // 记录搜索词与书签的关联（用于历史加成排序）
    var searchInput = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
    var searchTerm = searchInput ? searchInput.value.trim() : '';
    if (searchTerm && bookmarkId && window.SMART_BOOKMARK_QUERY_HISTORY) {
      window.SMART_BOOKMARK_QUERY_HISTORY.recordClick(searchTerm, bookmarkId);
    }

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
    var protocol = (urlObj.protocol || '').toLowerCase();
    // 仅允许常规网页链接，其他协议（edge://、chrome://、about:、moz-extension: 等）统一视为特殊链接
    return !(protocol === 'http:' || protocol === 'https:');
  } catch (e) {
    return true;
  }
};

/**
 * 主动关闭重复书签对话框
 */
ModalManager.prototype.dismissDuplicateDialog = function () {
  if (typeof this.duplicateDialogCleanup === 'function') {
    this.duplicateDialogCleanup();
  }
};

/**
 * 主动关闭删除确认对话框
 */
ModalManager.prototype.dismissDeleteDialog = function () {
  if (typeof this.deleteDialogCleanup === 'function') {
    this.deleteDialogCleanup();
  }
};

/**
 * 关闭右键上下文菜单
 */
ModalManager.prototype.dismissContextMenu = function () {
  if (typeof this.contextMenuCleanup === 'function') {
    this.contextMenuCleanup();
  }
};

/**
 * 关闭标签编辑弹窗
 */
ModalManager.prototype.dismissTagEditor = function () {
  if (typeof this.tagEditorCleanup === 'function') {
    this.tagEditorCleanup();
  }
};

/**
 * 显示右键上下文菜单
 * @param {MouseEvent} event - 右键事件
 * @param {Object} item - 书签/文件夹对象
 * @param {string} [itemType] - 项目类型 ('folder' 或 undefined/bookmark)
 */
ModalManager.prototype.showContextMenu = function (event, item, itemType) {
  if (!item || !item.id) return;
  if (item.url && typeof this.isSpecialUrl === 'function' && this.isSpecialUrl(item.url)) {
    return;
  }

  var self = this;
  this.dismissContextMenu();

  var root = this.getRoot();

  // 菜单项数据（数据驱动，便于后续扩展）
  var menuItems = [
    {
      action: 'editTags',
      label: this.languageManager ? this.languageManager.t('editTags') : '编辑标签',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
      destructive: false
    }
  ];

  // 书签额外添加删除项
  if (itemType !== 'folder') {
    menuItems.push({
      action: 'delete',
      label: this.languageManager ? this.languageManager.t('deleteConfirmBtn') : '删除',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
      destructive: true
    });
  }

  // 构建菜单 DOM
  var menu = document.createElement('div');
  menu.className = 'smart-bookmark-context-menu';
  menu.setAttribute('role', 'menu');

  var focusedIndex = -1;
  var itemElements = [];

  for (var i = 0; i < menuItems.length; i++) {
    var mi = menuItems[i];
    var itemEl = document.createElement('div');
    itemEl.className = 'smart-bookmark-context-menu-item' + (mi.destructive ? ' destructive' : '');
    itemEl.setAttribute('role', 'menuitem');
    itemEl.setAttribute('data-action', mi.action);
    itemEl.innerHTML =
      '<span class="smart-bookmark-context-menu-icon">' + mi.icon + '</span>' +
      '<span>' + self.escapeHtml(mi.label) + '</span>';

    itemEl.addEventListener('click', (function (action) {
      return function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.dismissContextMenu();
        self.handleContextMenuAction(action, item, itemType);
      };
    })(mi.action));

    menu.appendChild(itemEl);
    itemElements.push(itemEl);
  }

  // 同步主题 CSS 变量
  var modalElement = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (modalElement && window.getComputedStyle) {
    try {
      var modalStyles = window.getComputedStyle(modalElement);
      var themeVarKeys = [
        '--sb-popover', '--sb-popover-foreground', '--sb-border',
        '--sb-accent', '--sb-accent-foreground', '--sb-ring',
        '--sb-destructive', '--sb-destructive-foreground'
      ];
      for (var p = 0; p < themeVarKeys.length; p++) {
        var propValue = modalStyles.getPropertyValue(themeVarKeys[p]);
        if (propValue) {
          menu.style.setProperty(themeVarKeys[p], propValue);
        }
      }
    } catch (e) { }
  }

  root.appendChild(menu);
  this.isContextMenuOpen = true;

  // 定位菜单到鼠标位置（含边界检测）
  var x = event.clientX;
  var y = event.clientY;
  var menuRect = menu.getBoundingClientRect();
  var viewportW = window.innerWidth;
  var viewportH = window.innerHeight;

  if (x + menuRect.width > viewportW) {
    x = viewportW - menuRect.width - 4;
  }
  if (y + menuRect.height > viewportH) {
    y = viewportH - menuRect.height - 4;
  }
  if (x < 0) x = 4;
  if (y < 0) y = 4;

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  // 动画显示
  requestAnimationFrame(function () {
    menu.classList.add('show');
  });

  // 键盘导航辅助函数
  var updateFocus = function (newIndex) {
    if (newIndex < 0) newIndex = itemElements.length - 1;
    if (newIndex >= itemElements.length) newIndex = 0;
    for (var fi = 0; fi < itemElements.length; fi++) {
      itemElements[fi].classList.remove('focused');
    }
    focusedIndex = newIndex;
    itemElements[focusedIndex].classList.add('focused');
  };

  // 清理函数
  var cleanup = function () {
    self.isContextMenuOpen = false;
    self.contextMenuCleanup = null;
    document.removeEventListener('keydown', contextKeydownHandler, true);
    document.removeEventListener('mousedown', contextClickHandler, true);

    menu.classList.remove('show');
    setTimeout(function () {
      if (menu.parentNode) menu.remove();
    }, 120);
  };

  self.contextMenuCleanup = cleanup;

  // 全局点击关闭
  var contextClickHandler = function (e) {
    var clickedInsideMenu = false;
    if (typeof e.composedPath === 'function') {
      var path = e.composedPath();
      for (var i = 0; i < path.length; i++) {
        if (path[i] === menu) {
          clickedInsideMenu = true;
          break;
        }
      }
    } else {
      clickedInsideMenu = menu.contains(e.target);
    }

    if (!clickedInsideMenu) {
      cleanup();
    }
  };

  // 键盘事件处理
  var contextKeydownHandler = function (e) {
    if (!self.isContextMenuOpen) return;

    var key = e.key;

    if (key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      cleanup();
      return;
    }

    if (key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      updateFocus(focusedIndex + 1);
      return;
    }

    if (key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      updateFocus(focusedIndex - 1);
      return;
    }

    if (key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (focusedIndex >= 0 && focusedIndex < menuItems.length) {
        var action = menuItems[focusedIndex].action;
        cleanup();
        self.handleContextMenuAction(action, item, itemType);
      }
      return;
    }

    // 屏蔽其他功能键，防止穿透
    var blockedKeys = {
      Backspace: true, ' ': true, Delete: true, Tab: true,
      Home: true, End: true, PageUp: true, PageDown: true
    };
    if (blockedKeys[key]) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }
  };

  // 延迟注册，避免当前右键事件触发关闭
  setTimeout(function () {
    document.addEventListener('keydown', contextKeydownHandler, true);
    document.addEventListener('mousedown', contextClickHandler, true);
  }, 0);

  // 默认聚焦第一项
  if (itemElements.length > 0) {
    updateFocus(0);
  }
};

/**
 * 处理右键菜单操作分发
 * @param {string} action - 操作类型
 * @param {Object} item - 书签/文件夹对象
 * @param {string} [itemType] - 项目类型
 */
ModalManager.prototype.handleContextMenuAction = function (action, item, itemType) {
  switch (action) {
    case 'delete':
      this.confirmDeleteBookmark(item);
      break;
    case 'editTags':
      this.showTagEditor(item, itemType === 'folder' ? 'folders' : 'bookmarks');
      break;
    default:
      console.warn('Unknown context menu action:', action);
      break;
  }
};

/**
 * 显示删除确认对话框
 * @param {Object} bookmark - 要删除的书签对象
 */
ModalManager.prototype.confirmDeleteBookmark = function (bookmark) {
  if (!bookmark || !bookmark.id) return;

  var self = this;
  this.dismissDeleteDialog();

  var root = this.getRoot();

  // 构建确认消息
  var titleText = this.languageManager ? this.languageManager.t('deleteConfirmTitle') : '确认删除';
  var messageText = this.languageManager
    ? this.languageManager.t('deleteConfirmMessage').replace('{title}', bookmark.title || '')
    : '确定要删除书签「' + (bookmark.title || '') + '」吗？此操作不可撤销。';
  var confirmBtnText = this.languageManager ? this.languageManager.t('deleteConfirmBtn') : '删除';
  var cancelBtnText = this.languageManager ? this.languageManager.t('deleteCancelBtn') : '取消';

  var overlay = document.createElement('div');
  overlay.className = 'smart-bookmark-delete-overlay';
  overlay.style.pointerEvents = 'auto';
  overlay.setAttribute('role', 'presentation');
  overlay.innerHTML =
    '<div class="smart-bookmark-delete-dialog" role="dialog" aria-modal="true">' +
    '<div class="smart-bookmark-delete-header">' +
    '<span class="smart-bookmark-delete-icon-large">🗑️</span>' +
    '<h3 class="smart-bookmark-delete-title">' + this.escapeHtml(titleText) + '</h3>' +
    '</div>' +
    '<div class="smart-bookmark-delete-body">' +
    '<div class="smart-bookmark-delete-message">' + this.escapeHtml(messageText) + '</div>' +
    '</div>' +
    '<div class="smart-bookmark-delete-footer">' +
    '<button class="smart-bookmark-btn smart-bookmark-btn-secondary" data-action="cancel">' +
    this.escapeHtml(cancelBtnText) +
    '</button>' +
    '<button class="smart-bookmark-btn smart-bookmark-btn-destructive" data-action="delete">' +
    this.escapeHtml(confirmBtnText) +
    '</button>' +
    '</div>' +
    '</div>';

  // 同步主题CSS变量
  var modalElement = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (modalElement && window.getComputedStyle) {
    try {
      var modalStyles = window.getComputedStyle(modalElement);
      var themeVarKeys = [
        '--sb-background', '--sb-foreground', '--sb-muted', '--sb-muted-foreground',
        '--sb-border', '--sb-input', '--sb-primary', '--sb-primary-foreground',
        '--sb-primary-hover', '--sb-secondary', '--sb-secondary-foreground',
        '--sb-accent', '--sb-accent-foreground', '--sb-ring', '--sb-ring-light',
        '--sb-radius', '--sb-destructive', '--sb-destructive-foreground'
      ];
      for (var p = 0; p < themeVarKeys.length; p++) {
        var propValue = modalStyles.getPropertyValue(themeVarKeys[p]);
        if (propValue) {
          overlay.style.setProperty(themeVarKeys[p], propValue);
        }
      }
    } catch (e) { }
  }

  root.appendChild(overlay);
  this.isDeleteDialogOpen = true;

  requestAnimationFrame(function () {
    overlay.classList.add('active');
  });

  var settled = false;
  var buttons = overlay.querySelectorAll('[data-action]');

  var cleanup = function (skipAnimation) {
    self.isDeleteDialogOpen = false;
    self.deleteDialogCleanup = null;
    document.removeEventListener('keydown', deleteKeydownHandler, true);

    if (skipAnimation) {
      if (overlay.parentNode) overlay.remove();
      return;
    }

    overlay.classList.remove('active');
    setTimeout(function () {
      if (overlay.parentNode) overlay.remove();
    }, 200);
  };

  var finish = function (action, skipAnimation) {
    if (settled) return;
    settled = true;
    cleanup(skipAnimation);

    if (action === 'delete') {
      self.executeDeleteBookmark(bookmark);
    }
  };

  self.deleteDialogCleanup = function () {
    finish('cancel', true);
  };

  var deleteKeydownHandler = function (e) {
    if (!self.isDeleteDialogOpen) return;

    var key = e.key;
    var blockedKeys = {
      Escape: true, Backspace: true, ' ': true, Enter: true,
      ArrowUp: true, ArrowDown: true, Home: true, End: true,
      PageUp: true, PageDown: true, Tab: true, Delete: true
    };

    if (key === 'Tab') {
      if (buttons.length > 0) {
        var activeElement = (root && root.activeElement) || document.activeElement;
        var currentIndex = -1;
        for (var i = 0; i < buttons.length; i++) {
          if (buttons[i] === activeElement) {
            currentIndex = i;
            break;
          }
        }
        var nextIndex;
        if (e.shiftKey) {
          nextIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex >= buttons.length - 1 ? 0 : currentIndex + 1;
        }
        buttons[nextIndex].focus();
      }
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      return;
    }

    if (key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      finish('cancel');
      return;
    }

    if (key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      var active = (root && root.activeElement) || document.activeElement;
      if (active && typeof active.closest === 'function') {
        var actionElement = active.closest('[data-action]');
        if (actionElement) {
          finish(actionElement.getAttribute('data-action'));
        }
      }
      return;
    }

    if (blockedKeys[key]) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }
  };

  document.addEventListener('keydown', deleteKeydownHandler, true);

  for (var j = 0; j < buttons.length; j++) {
    buttons[j].addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      finish(this.getAttribute('data-action'));
    });
  }

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      finish('cancel');
    }
  });

  // 默认聚焦取消按钮（安全选择）
  if (buttons.length > 0) {
    buttons[0].focus();
  }
};

/**
 * 执行删除书签
 * @param {Object} bookmark - 要删除的书签对象
 */
ModalManager.prototype.executeDeleteBookmark = function (bookmark) {
  if (!bookmark || !bookmark.id) return;

  var self = this;
  var bookmarkId = bookmark.id;

  window.SMART_BOOKMARK_API.deleteBookmark(bookmarkId)
    .then(function () {
      // 显示成功提示
      var successMsg = self.languageManager ? self.languageManager.t('bookmarkDeleted') : '书签已删除';
      window.SMART_BOOKMARK_HELPERS.showToast(successMsg);

      // 清理已删除书签的标签
      if (window.SMART_BOOKMARK_TAGS) {
        window.SMART_BOOKMARK_TAGS.removeAllTagsForItem('bookmarks', bookmarkId);
      }

      // 从当前结果集中移除该书签
      if (self.filteredBookmarks && self.filteredBookmarks.length > 0) {
        for (var i = 0; i < self.filteredBookmarks.length; i++) {
          if (self.filteredBookmarks[i].id === bookmarkId) {
            self.filteredBookmarks.splice(i, 1);
            break;
          }
        }
      }

      // 同步删除主数据源，避免下一次搜索把已删除书签重新算进结果
      if (self.allBookmarks && self.allBookmarks.length > 0) {
        for (var j = 0; j < self.allBookmarks.length; j++) {
          if (self.allBookmarks[j].id === bookmarkId) {
            self.allBookmarks.splice(j, 1);
            break;
          }
        }
      }

      // 同步历史导航中的搜索快照，避免返回时出现已删除项
      if (self.navigationStack && self.navigationStack.length > 0) {
        for (var k = 0; k < self.navigationStack.length; k++) {
          var state = self.navigationStack[k];
          if (state && state.type === 'search' && state.results && state.results.length > 0) {
            for (var m = state.results.length - 1; m >= 0; m--) {
              if (state.results[m].id === bookmarkId) {
                state.results.splice(m, 1);
              }
            }
          }
        }
      }

      // 非文件夹视图下，重新按当前查询构建结果，保证排序/筛选一致
      if (!self.isInFolderView) {
        self.handleSearch(self.lastSearchQuery || '');
        return;
      }

      // 文件夹视图内只刷新当前列表
      self.keyboardManager.setCurrentItems(self.filteredBookmarks);
      self.updateBookmarkList();
    })
    .catch(function (error) {
      console.error('Failed to delete bookmark:', error);
      var failMsg = self.languageManager ? self.languageManager.t('bookmarkDeleteFailed') : '删除书签失败，请重试';
      window.SMART_BOOKMARK_HELPERS.showToast(failMsg, true);
    });
};

/**
 * 检查重复书签（全局范围，URL 标准化匹配）
 * @param {string} url - 要检查的 URL
 * @returns {Promise<Array>} 匹配的重复书签列表
 */
ModalManager.prototype.checkDuplicateBookmarks = function (url) {
  var normalizedUrl = window.SMART_BOOKMARK_HELPERS.normalizeUrl(url);
  if (!normalizedUrl) {
    return Promise.resolve([]);
  }

  return window.SMART_BOOKMARK_API.getAllBookmarks().then(function (allBookmarks) {
    var duplicates = [];
    for (var i = 0; i < allBookmarks.length; i++) {
      if (window.SMART_BOOKMARK_HELPERS.normalizeUrl(allBookmarks[i].url) === normalizedUrl) {
        duplicates.push(allBookmarks[i]);
      }
    }
    return duplicates;
  });
};

/**
 * 显示重复书签确认对话框
 * @param {Array} duplicates - 重复书签列表
 * @returns {Promise<string>} 用户操作：'cancel' | 'add' | 'jump'
 */
ModalManager.prototype.showDuplicateDialog = function (duplicates) {
  var self = this;

  this.dismissDuplicateDialog();

  return new Promise(function (resolve) {
    var root = self.getRoot();

    // 构建重复项列表
    var itemsHtml = '';
    for (var i = 0; i < duplicates.length; i++) {
      var dup = duplicates[i];
      var breadcrumb = self.generateBreadcrumb(dup.parentId);
      var pathText = breadcrumb
        ? breadcrumb.replace(/<[^>]*>/g, '')
        : (self.languageManager.t('rootDirectory'));

      itemsHtml +=
        '<li class="smart-bookmark-duplicate-item">' +
        '<div class="smart-bookmark-duplicate-item-title">' + self.escapeHtml(dup.title) + '</div>' +
        '<div class="smart-bookmark-duplicate-item-path">' + self.escapeHtml(pathText) + '</div>' +
        '</li>';
    }

    var titleText = duplicates.length === 1
      ? self.languageManager.t('duplicateFound')
      : self.languageManager.t('duplicatesFound').replace('{count}', duplicates.length);

    var overlay = document.createElement('div');
    overlay.className = 'smart-bookmark-duplicate-overlay';
    overlay.style.pointerEvents = 'auto';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML =
      '<div class="smart-bookmark-duplicate-dialog" role="dialog" aria-modal="true">' +
      '<div class="smart-bookmark-duplicate-header">' +
      '<span class="smart-bookmark-duplicate-icon">\u26A0\uFE0F</span>' +
      '<h3 class="smart-bookmark-duplicate-title">' + titleText + '</h3>' +
      '</div>' +
      '<div class="smart-bookmark-duplicate-body">' +
      '<div class="smart-bookmark-duplicate-message">' + self.languageManager.t('duplicateMessage') + '</div>' +
      '<ul class="smart-bookmark-duplicate-list">' + itemsHtml + '</ul>' +
      '</div>' +
      '<div class="smart-bookmark-duplicate-footer">' +
      '<button class="smart-bookmark-btn smart-bookmark-btn-secondary" data-action="cancel">' +
      self.languageManager.t('duplicateCancel') +
      '</button>' +
      '<button class="smart-bookmark-btn smart-bookmark-btn-secondary" data-action="jump">' +
      self.languageManager.t('duplicateJumpTo') +
      '</button>' +
      '<button class="smart-bookmark-btn smart-bookmark-btn-primary" data-action="add">' +
      self.languageManager.t('duplicateStillAdd') +
      '</button>' +
      '</div>' +
      '</div>';

    // 重复弹窗挂在 ShadowRoot 下，不会继承 modal 上的 --sb-* 变量；显式同步以适配主题/暗色模式
    var modalElement = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
    if (modalElement && window.getComputedStyle) {
      try {
        var modalStyles = window.getComputedStyle(modalElement);
        var themeVarKeys = [
          '--sb-background',
          '--sb-foreground',
          '--sb-muted',
          '--sb-muted-foreground',
          '--sb-border',
          '--sb-input',
          '--sb-primary',
          '--sb-primary-foreground',
          '--sb-primary-hover',
          '--sb-secondary',
          '--sb-secondary-foreground',
          '--sb-accent',
          '--sb-accent-foreground',
          '--sb-ring',
          '--sb-ring-light',
          '--sb-radius'
        ];
        for (var p = 0; p < themeVarKeys.length; p++) {
          var propName = themeVarKeys[p];
          var propValue = modalStyles.getPropertyValue(propName);
          if (propValue) {
            overlay.style.setProperty(propName, propValue);
          }
        }
      } catch (e) {
        // 忽略样式同步失败，走CSS fallback
      }
    }

    root.appendChild(overlay);
    self.isDuplicateDialogOpen = true;

    requestAnimationFrame(function () {
      overlay.classList.add('active');
    });

    var settled = false;
    var buttons = overlay.querySelectorAll('[data-action]');
    var cleanup = function (skipAnimation) {
      self.isDuplicateDialogOpen = false;
      self.duplicateDialogCleanup = null;
      document.removeEventListener('keydown', documentKeydownHandler, true);

      if (skipAnimation) {
        if (overlay.parentNode) overlay.remove();
        return;
      }

      overlay.classList.remove('active');
      setTimeout(function () {
        if (overlay.parentNode) overlay.remove();
      }, 200);
    };

    var finish = function (action, skipAnimation) {
      if (settled) return;
      settled = true;
      cleanup(skipAnimation);
      resolve(action);
    };

    self.duplicateDialogCleanup = function () {
      finish('cancel', true);
    };

    var documentKeydownHandler = function (e) {
      if (!self.isDuplicateDialogOpen) return;

      var key = e.key;
      var blockedKeys = {
        Escape: true,
        Backspace: true,
        ' ': true,
        Enter: true,
        ArrowUp: true,
        ArrowDown: true,
        Home: true,
        End: true,
        PageUp: true,
        PageDown: true,
        Tab: true
      };

      if (key === 'Tab') {
        if (buttons.length > 0) {
          var activeElement = (root && root.activeElement) || document.activeElement;
          var currentIndex = -1;
          for (var i = 0; i < buttons.length; i++) {
            if (buttons[i] === activeElement) {
              currentIndex = i;
              break;
            }
          }
          var nextIndex;
          if (e.shiftKey) {
            nextIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1;
          } else {
            nextIndex = currentIndex >= buttons.length - 1 ? 0 : currentIndex + 1;
          }
          buttons[nextIndex].focus();
        }
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        return;
      }

      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        finish('cancel');
        return;
      }

      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

        var active = (root && root.activeElement) || document.activeElement;
        if (active && typeof active.closest === 'function') {
          var actionElement = active.closest('[data-action]');
          if (actionElement) {
            finish(actionElement.getAttribute('data-action'));
          }
        }
        return;
      }

      if (blockedKeys[key]) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      }
    };

    document.addEventListener('keydown', documentKeydownHandler, true);

    for (var j = 0; j < buttons.length; j++) {
      buttons[j].addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        finish(this.getAttribute('data-action'));
      });
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        finish('cancel');
      }
    });

    if (buttons.length > 0) {
      buttons[0].focus();
    }
  });
};

/**
 * 跳转到已有书签所在的文件夹并高亮
 * @param {Object} bookmark - 已有书签对象
 */
ModalManager.prototype.jumpToExistingBookmark = function (bookmark) {
  var self = this;
  if (!bookmark || !bookmark.id || !bookmark.parentId) return;

  // 切换到书签搜索模式（仅切UI，避免触发loadBookmarks覆盖enterFolder结果）
  if (this.uiManager.currentMode !== window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    this.cancelPendingSearch();
    this.uiManager.setMode(window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH);
    this.keyboardManager.setMode(window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH);
    if (typeof this.applyFilterBarModeState === 'function') {
      this.applyFilterBarModeState();
    }
  }

  var parentFolder = this.findFolderById(bookmark.parentId);
  var folderTitle = parentFolder ? parentFolder.title : '';

  this.enterFolder(bookmark.parentId, folderTitle).then(function () {
    // updateBookmarkList 内有 setTimeout(50ms) 自动选中第一项，
    // 需要在其之后再设置目标索引
    setTimeout(function () {
      var items = self.filteredBookmarks;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === bookmark.id) {
          self.keyboardManager.setSelectedIndex(i);
          break;
        }
      }
    }, 100);
  }).catch(function (error) {
    console.error('Failed to jump to existing bookmark:', error);
  });
};

/**
 * 处理确认操作
 */

ModalManager.prototype.handleConfirm = function () {
  if (this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    // 书签搜索模式：根据选中项类型处理
    var selectedItem = this.keyboardManager.getSelectedItem();
    if (!selectedItem) return;

    // 处理返回按钮
    if (selectedItem.itemType === 'back') {
      this.goBack();
      return;
    }

    // 处理文件夹进入
    if (selectedItem.itemType === 'folder') {
      this.enterFolder(selectedItem.id, selectedItem.title);
      return;
    }

    // 处理书签打开
    if (selectedItem.url) {
      // 记录搜索词与书签的关联（用于历史加成排序）
      var searchInput = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
      var searchTerm = searchInput ? searchInput.value.trim() : '';
      if (searchTerm && selectedItem.id && window.SMART_BOOKMARK_QUERY_HISTORY) {
        window.SMART_BOOKMARK_QUERY_HISTORY.recordClick(searchTerm, selectedItem.id);
      }

      if (!this.isSpecialUrl(selectedItem.url)) {
        window.open(selectedItem.url, '_blank');
      } else {
        window.SMART_BOOKMARK_HELPERS.showToast(this.languageManager.t('specialUrlWarning'), true);
      }
      this.hide();
    }
  } else {
    // 文件夹选择模式：添加书签到选中的文件夹
    if (this.isDuplicateCheckInProgress || this.isDuplicateDialogOpen) {
      return;
    }

    var selectedFolder = this.getRoot().querySelector('.smart-bookmark-folder-item.active');
    if (!selectedFolder || !this.currentPageInfo) {
      return;
    }

    this.isDuplicateCheckInProgress = true;
    var folderId = selectedFolder.getAttribute('data-folder-id');
    var self = this;
    var pageTitle = this.currentPageInfo.title;
    var pageUrl = this.currentPageInfo.url;
    var isFlowActive = function () {
      return !!(self.uiManager && self.uiManager.isModalVisible && self.currentPageInfo && self.currentPageInfo.url === pageUrl);
    };

    var doCreate = function () {
      if (!isFlowActive()) {
        self.isDuplicateCheckInProgress = false;
        return;
      }
      window.SMART_BOOKMARK_API.createBookmark(folderId, pageTitle, pageUrl)
        .then(function (createdBookmark) {
          self.isDuplicateCheckInProgress = false;
          window.SMART_BOOKMARK_HELPERS.showToast(self.languageManager.t('bookmarkAdded'));
          if (typeof self.openTagEditorAfterCreate === 'function') {
            self.openTagEditorAfterCreate(createdBookmark, folderId);
          } else {
            self.hide();
          }
        })
        .catch(function (error) {
          self.isDuplicateCheckInProgress = false;
          console.error('Failed to create bookmark:', error);
          window.SMART_BOOKMARK_HELPERS.showToast(self.languageManager.t('bookmarkAddFailed'), true);
        });
    };

    var duplicateCheckPromise;
    try {
      duplicateCheckPromise = this.checkDuplicateBookmarks(pageUrl);
    } catch (syncError) {
      console.error('Duplicate check failed:', syncError);
      doCreate();
      return;
    }

    Promise.resolve(duplicateCheckPromise)
      .then(function (duplicates) {
        if (!isFlowActive()) {
          self.isDuplicateCheckInProgress = false;
          return;
        }

        if (duplicates.length === 0) {
          doCreate();
          return;
        }

        self.showDuplicateDialog(duplicates).then(function (action) {
          if (!isFlowActive()) {
            self.isDuplicateCheckInProgress = false;
            return;
          }

          if (action === 'add') {
            doCreate();
          } else if (action === 'jump') {
            self.isDuplicateCheckInProgress = false;
            self.jumpToExistingBookmark(duplicates[0]);
          } else {
            self.isDuplicateCheckInProgress = false;
          }
        }).catch(function (dialogError) {
          // 对话框渲染/交互失败时降级为直接创建
          console.error('Duplicate dialog failed:', dialogError);
          doCreate();
        });
      })
      .catch(function (error) {
        // 重复检测失败，降级为直接创建
        console.error('Duplicate check failed:', error);
        doCreate();
      });
  }
};

/**
 * 设置模式
 * @param {string} mode - 模式类型
 */

ModalManager.prototype.setMode = function (mode) {
  this.cancelPendingSearch();
  if (typeof this.closeTagFilterPopover === 'function') {
    this.closeTagFilterPopover();
  }
  this.uiManager.setMode(mode);
  this.keyboardManager.setMode(mode);

  // 模式切换统一重置筛选状态，避免跨模式残留造成误筛选
  this.currentFilter = 'all';
  this.currentTagFilter = null;
  if (typeof this.applyFilterBarModeState === 'function') {
    this.applyFilterBarModeState();
  } else if (typeof this.refreshFilterBarState === 'function') {
    this.refreshFilterBarState();
  }

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
  this.cancelPendingSearch();
  if (typeof this.closeTagFilterPopover === 'function') {
    this.closeTagFilterPopover();
  }
  this.uiManager.toggleMode();
  this.keyboardManager.setMode(this.uiManager.currentMode);
  // 模式切换统一重置筛选并刷新筛选栏结构
  this.currentFilter = 'all';
  this.currentTagFilter = null;
  if (typeof this.applyFilterBarModeState === 'function') {
    this.applyFilterBarModeState();
  } else {
    this.refreshFilterBarState();
  }

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
    // 空闲时构建索引
    self.scheduleBuildIndexes();
  });
};

/**
 * 在后台空闲时构建搜索索引（SWR）
 */

ModalManager.prototype.generateBreadcrumb = function (parentId) {
  if (!parentId) {
    return '';
  }

  // 根目录特殊处理
  if (parentId === '0') {
    var rootText = this.languageManager ? this.languageManager.t('rootDirectory') : '根目录';
    var safeRootText = this.escapeHtml(rootText);
    var safeRootTitle = this.escapeHtmlAttribute(rootText);
    return '<div class="breadcrumb" title="' + safeRootTitle + '">' + safeRootText + '</div>';
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
    var safeDisplayPath = this.escapeHtml(displayPath);
    var safeDisplayPathTitle = this.escapeHtmlAttribute(displayPath);
    breadcrumbHtml = '<div class="breadcrumb" title="' + safeDisplayPathTitle + '">' + safeDisplayPath + '</div>';
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
  // 先用Map O(1) 查询
  if (this.folderById && this.folderById.size > 0) {
    var hit = this.folderById.get(folderId);
    if (hit) return hit;
  }
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
 * 构建id->folder的快速查找表
 */

/**
 * 显示标签编辑弹窗
 * @param {Object} item - 书签/文件夹对象
 * @param {string} type - 'bookmarks' 或 'folders'
 * @param {{onSaved?: Function, onCancel?: Function}=} options
 */
ModalManager.prototype.showTagEditor = function (item, type, options) {
  if (!item || !item.id || !window.SMART_BOOKMARK_TAGS) return;
  options = options || {};

  var self = this;
  // 先关闭可能存在的旧弹窗，避免重复实例和悬挂监听器
  self.dismissTagEditor();
  if (!window.SMART_BOOKMARK_TAGS.hasLoaded()) {
    window.SMART_BOOKMARK_TAGS.loadTags().then(function () {
      self.showTagEditor(item, type, options);
    });
    return;
  }
  var root = this.getRoot();

  // 当前标签副本
  var currentTags = (window.SMART_BOOKMARK_TAGS.getTagsForItem(type, item.id) || []).slice();

  // 创建 overlay
  var overlay = document.createElement('div');
  overlay.className = 'smart-bookmark-tag-editor-overlay';
  overlay.style.pointerEvents = 'auto';
  overlay.setAttribute('role', 'presentation');

  var editorTitle = self.languageManager ? self.languageManager.t('tagEditorTitle') : '管理标签';
  var targetTypeLabel = type === 'folders'
    ? (self.languageManager ? self.languageManager.t('tagEditorFolderLabel') : '文件夹')
    : (self.languageManager ? self.languageManager.t('tagEditorBookmarkLabel') : '链接');
  var targetTitle = (item && item.title ? item.title : '').toString().trim();
  if (!targetTitle) {
    targetTitle = type === 'folders' ? '未命名文件夹' : '未命名书签';
  }
  var editorTitleWithTarget = editorTitle + ' · ' + targetTypeLabel + '：' + targetTitle;
  var placeholderText = self.languageManager ? self.languageManager.t('tagPlaceholder') : '输入标签名称...';
  var hintText = self.languageManager ? self.languageManager.t('tagEditorHint') : '↑↓ 选建议 · Enter 添加 · Ctrl+Enter 保存 · Esc 取消';

  overlay.innerHTML =
    '<div class="smart-bookmark-tag-editor-dialog">' +
    '<div class="smart-bookmark-tag-editor-header">' +
    '<span>🏷️</span>' +
    '<h3 class="smart-bookmark-tag-editor-title" title="' + self.escapeHtmlAttribute(editorTitleWithTarget) + '">' + self.escapeHtml(editorTitleWithTarget) + '</h3>' +
    '</div>' +
    '<div class="smart-bookmark-tag-editor-body">' +
    '<div class="smart-bookmark-tag-editor-chips" id="smart-bookmark-tag-chips"></div>' +
    '<div class="smart-bookmark-tag-editor-input-wrap">' +
    '<input class="smart-bookmark-tag-editor-input" id="smart-bookmark-tag-input" type="text" placeholder="' + self.escapeHtmlAttribute(placeholderText) + '" autocomplete="off">' +
    '<div class="smart-bookmark-tag-autocomplete" id="smart-bookmark-tag-autocomplete"></div>' +
    '</div>' +
    '<div class="smart-bookmark-tag-editor-hint" id="smart-bookmark-tag-editor-hint">' + self.escapeHtml(hintText) + '</div>' +
    '</div>' +
    '<div class="smart-bookmark-tag-editor-footer">' +
    '<button class="smart-bookmark-btn smart-bookmark-btn-secondary" id="smart-bookmark-tag-cancel">' +
    (self.languageManager ? self.languageManager.t('cancelBtn') : '取消') +
    '</button>' +
    '<button class="smart-bookmark-btn smart-bookmark-btn-primary" id="smart-bookmark-tag-save">' +
    (self.languageManager ? self.languageManager.t('tagSaveBtn') : '保存') +
    '</button>' +
    '</div>' +
    '</div>';

  // 同步主题
  var modalElement = root.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (modalElement) {
    try {
      var cs = window.getComputedStyle(modalElement);
      var vars = [
        '--sb-background', '--sb-foreground', '--sb-border', '--sb-input',
        '--sb-ring', '--sb-muted', '--sb-muted-foreground', '--sb-accent',
        '--sb-accent-foreground', '--sb-popover', '--sb-popover-foreground',
        '--sb-radius', '--sb-primary', '--sb-primary-foreground', '--sb-primary-hover'
      ];
      for (var vi = 0; vi < vars.length; vi++) {
        var val = cs.getPropertyValue(vars[vi]);
        if (val) overlay.style.setProperty(vars[vi], val);
      }
    } catch (e) { }
  }

  root.appendChild(overlay);
  self.isTagEditorOpen = true;

  // DOM 引用
  var chipsContainer = overlay.querySelector('#smart-bookmark-tag-chips');
  var input = overlay.querySelector('#smart-bookmark-tag-input');
  var autocomplete = overlay.querySelector('#smart-bookmark-tag-autocomplete');
  var cancelBtn = overlay.querySelector('#smart-bookmark-tag-cancel');
  var saveBtn = overlay.querySelector('#smart-bookmark-tag-save');
  var hintEl = overlay.querySelector('#smart-bookmark-tag-editor-hint');
  var activeAutocompleteIndex = -1;
  var autocompleteCandidates = [];
  var callbackSettled = false;

  function invokeEditorCallback(kind, payload) {
    if (callbackSettled) return;
    callbackSettled = true;
    try {
      if (kind === 'saved' && typeof options.onSaved === 'function') {
        options.onSaved(payload);
      } else if (kind === 'cancel' && typeof options.onCancel === 'function') {
        options.onCancel();
      }
    } catch (e) { }
  }

  function addTagToCurrent(tag) {
    var normalized = window.SMART_BOOKMARK_TAGS.normalizeTagList(currentTags.concat([tag]));
    currentTags = normalized;
    input.value = '';
    activeAutocompleteIndex = -1;
    autocompleteCandidates = [];
    autocomplete.classList.remove('show');
    renderChips();
  }

  function setAutocompleteFocus(index) {
    var options = autocomplete.querySelectorAll('.smart-bookmark-tag-autocomplete-item');
    if (!options.length) return;
    if (index < 0) index = options.length - 1;
    if (index >= options.length) index = 0;
    activeAutocompleteIndex = index;
    for (var oi = 0; oi < options.length; oi++) {
      if (oi === index) {
        options[oi].classList.add('focused');
      } else {
        options[oi].classList.remove('focused');
      }
    }
    if (typeof options[index].scrollIntoView === 'function') {
      options[index].scrollIntoView({ block: 'nearest' });
    }
  }

  function applyAutocompleteSelection(index) {
    if (index < 0 || index >= autocompleteCandidates.length) return;
    addTagToCurrent(autocompleteCandidates[index]);
    input.focus();
  }

  // 渲染 chips
  function renderChips() {
    chipsContainer.innerHTML = '';
    for (var ci = 0; ci < currentTags.length; ci++) {
      var tagName = currentTags[ci];
      var colors = window.SMART_BOOKMARK_TAGS.generateTagColor(tagName);
      var chip = document.createElement('span');
      chip.className = 'smart-bookmark-tag-editor-chip';
      chip.style.background = colors.bg;
      chip.style.color = colors.text;
      var safeTagName = self.escapeHtml(tagName);
      chip.innerHTML = safeTagName + ' <span class="smart-bookmark-tag-editor-chip-remove" data-index="' + ci + '">×</span>';
      chipsContainer.appendChild(chip);
    }

    if (currentTags.length === 0) {
      var noTagHint = document.createElement('span');
      noTagHint.style.cssText = 'font-size:12px;color:var(--sb-muted-foreground)';
      noTagHint.textContent = self.languageManager ? self.languageManager.t('noTags') : '暂无标签';
      chipsContainer.appendChild(noTagHint);
    }
  }

  // 删除标签
  chipsContainer.addEventListener('click', function (e) {
    var removeBtn = e.target.closest('.smart-bookmark-tag-editor-chip-remove');
    if (removeBtn) {
      var idx = parseInt(removeBtn.getAttribute('data-index'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < currentTags.length) {
        currentTags.splice(idx, 1);
        renderChips();
      }
    }
  });

  // 自动补全
  function updateAutocomplete(val) {
    autocomplete.innerHTML = '';
    autocompleteCandidates = [];
    activeAutocompleteIndex = -1;
    if (!val) {
      autocomplete.classList.remove('show');
      return;
    }
    var allTags = window.SMART_BOOKMARK_TAGS.getAllTags();
    var lower = val.toLowerCase();
    var matches = [];
    for (var ai = 0; ai < allTags.length; ai++) {
      if (allTags[ai].toLowerCase().indexOf(lower) > -1) {
        // 排除已选
        var alreadySelected = false;
        for (var ci = 0; ci < currentTags.length; ci++) {
          if (currentTags[ci].toLowerCase() === allTags[ai].toLowerCase()) {
            alreadySelected = true;
            break;
          }
        }
        if (!alreadySelected) matches.push(allTags[ai]);
      }
    }
    if (matches.length === 0) {
      autocomplete.classList.remove('show');
      return;
    }
    autocompleteCandidates = matches.slice();
    for (var mi = 0; mi < matches.length; mi++) {
      var optEl = document.createElement('div');
      optEl.className = 'smart-bookmark-tag-autocomplete-item';
      optEl.textContent = matches[mi];
      optEl.addEventListener('click', (function (tag) {
        return function () {
          addTagToCurrent(tag);
          input.focus();
        };
      })(matches[mi]));
      autocomplete.appendChild(optEl);
    }
    autocomplete.classList.add('show');
    setAutocompleteFocus(0);
  }

  input.addEventListener('input', function () {
    updateAutocomplete(input.value.trim());
  });

  input.addEventListener('focus', function () {
    if (hintEl) hintEl.classList.add('show');
  });
  input.addEventListener('blur', function () {
    if (hintEl) hintEl.classList.remove('show');
  });

  // 回车添加新标签
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        saveBtn.click();
        return;
      }
      if (autocomplete.classList.contains('show') && activeAutocompleteIndex >= 0) {
        applyAutocompleteSelection(activeAutocompleteIndex);
        return;
      }
      var val = input.value.trim();
      if (val) {
        addTagToCurrent(val);
      }
    } else if (e.key === 'ArrowDown') {
      if (autocomplete.classList.contains('show') && autocompleteCandidates.length > 0) {
        e.preventDefault();
        setAutocompleteFocus(activeAutocompleteIndex + 1);
      }
    } else if (e.key === 'ArrowUp') {
      if (autocomplete.classList.contains('show') && autocompleteCandidates.length > 0) {
        e.preventDefault();
        setAutocompleteFocus(activeAutocompleteIndex - 1);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelAndDismissEditor();
    }
  });

  // 拦截键盘防穿透（在冒泡阶段处理，避免阻断输入框自身的 Enter 逻辑）
  var editorKeydownHandler = function (e) {
    var insideEditor = false;
    if (typeof e.composedPath === 'function') {
      var path = e.composedPath();
      for (var pi = 0; pi < path.length; pi++) {
        if (path[pi] === overlay) {
          insideEditor = true;
          break;
        }
      }
    } else if (overlay.contains(e.target)) {
      insideEditor = true;
    }

    if (!insideEditor) return;

    if (e.key === 'Tab') {
      var focusable = overlay.querySelectorAll('input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      var focusableList = [];
      for (var fi = 0; fi < focusable.length; fi++) {
        if (focusable[fi] && focusable[fi].offsetParent !== null) {
          focusableList.push(focusable[fi]);
        }
      }

      if (focusableList.length > 0) {
        var activeElement = (root && root.activeElement) || document.activeElement;
        var currentIndex = -1;
        for (var ci = 0; ci < focusableList.length; ci++) {
          if (focusableList[ci] === activeElement) {
            currentIndex = ci;
            break;
          }
        }

        var nextIndex;
        if (e.shiftKey) {
          nextIndex = currentIndex <= 0 ? focusableList.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex >= focusableList.length - 1 ? 0 : currentIndex + 1;
        }
        focusableList[nextIndex].focus();
      }

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      return;
    }

    // 输入框自己处理 Escape/Enter；这里只兜底处理非输入焦点下的 Escape
    if (e.key === 'Escape' && e.target !== input) {
      e.preventDefault();
      cancelAndDismissEditor();
      return;
    }

    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }
  };
  document.addEventListener('keydown', editorKeydownHandler, false);

  // 关闭编辑器
  var disposed = false;
  function cleanupEditor(skipAnimation) {
    if (disposed) return;
    disposed = true;
    self.isTagEditorOpen = false;
    self.tagEditorCleanup = null;
    document.removeEventListener('keydown', editorKeydownHandler, false);

    if (skipAnimation) {
      if (overlay.parentNode) overlay.remove();
      return;
    }

    overlay.classList.remove('active');
    setTimeout(function () {
      if (overlay.parentNode) overlay.remove();
    }, 200);
  }

  self.tagEditorCleanup = function () {
    cleanupEditor(true);
  };

  function dismissEditor() {
    cleanupEditor(false);
  }

  function cancelAndDismissEditor() {
    invokeEditorCallback('cancel');
    dismissEditor();
  }

  // 取消
  cancelBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    cancelAndDismissEditor();
  });

  // 保存
  saveBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    // 保存前将输入框里尚未按 Enter 的标签一并纳入，避免“看起来保存成功但实际没写入”
    var pendingTag = input.value.trim();
    var tagsToSave = currentTags.slice();
    if (pendingTag) {
      tagsToSave = window.SMART_BOOKMARK_TAGS.normalizeTagList(tagsToSave.concat([pendingTag]));
    }

    window.SMART_BOOKMARK_TAGS.setTagsForItem(type, item.id, tagsToSave).then(function () {
      // 更新内存中的 item
      currentTags = tagsToSave.slice();
      item.tags = tagsToSave.slice();

      // 同步主数据与当前结果中的同 ID 项，避免仅刷新局部对象导致搜索索引与列表数据不一致
      var expectedItemType = type === 'folders' ? 'folder' : 'bookmark';
      var applyTagsToList = function (list, useItemTypeCheck) {
        if (!list || !list.length) return;
        for (var li = 0; li < list.length; li++) {
          var row = list[li];
          if (!row || row.id !== item.id) continue;
          if (useItemTypeCheck && row.itemType && row.itemType !== expectedItemType) continue;
          row.tags = tagsToSave.slice();
        }
      };

      applyTagsToList(self.allBookmarks, false);
      applyTagsToList(self.allFolders, false);
      applyTagsToList(self.filteredBookmarks, true);
      applyTagsToList(self.filteredFolders, false);

      if (self.navigationStack && self.navigationStack.length > 0) {
        for (var ni = 0; ni < self.navigationStack.length; ni++) {
          var state = self.navigationStack[ni];
          if (state && state.type === 'search' && state.results) {
            applyTagsToList(state.results, true);
          }
        }
      }

      // 若当前标签筛选已无任何项（两种类型都检查），先清空状态再更新标签 tabs
      if (self.currentTagFilter) {
        var bmIds = window.SMART_BOOKMARK_TAGS.getItemsByTag('bookmarks', self.currentTagFilter);
        var fdIds = window.SMART_BOOKMARK_TAGS.getItemsByTag('folders', self.currentTagFilter);
        if (bmIds.length === 0 && fdIds.length === 0) {
          self.currentTagFilter = null;
        }
      }

      // 刷新筛选栏标签 tabs 与 active 状态
      if (self.uiManager && typeof self.uiManager.updateTagFilterTabs === 'function') {
        var allTags = (typeof self.getAvailableFilterTags === 'function')
          ? self.getAvailableFilterTags()
          : window.SMART_BOOKMARK_TAGS.getAllTags();
        self.uiManager.updateTagFilterTabs(allTags, self.currentTagFilter);
      }
      if (typeof self.refreshFilterBarState === 'function') {
        self.refreshFilterBarState();
      }

      // 刷新搜索引擎索引
      self.scheduleBuildIndexes();

      // 按视图分流刷新
      if (self.isInFolderView && self.currentFolderId) {
        return self.enterFolder(self.currentFolderId, self.currentFolderTitle, { skipHistoryPush: true })
          .catch(function () {
            // 刷新失败时降级为本地刷新，不影响已保存标签
            self.updateBookmarkList();
          });
      }

      var searchInput = self.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
      var query = searchInput ? searchInput.value.trim() : (self.lastSearchQuery || '');
      self.handleSearch(query);
      return Promise.resolve();
    }).then(function () {
      var msg = self.languageManager ? self.languageManager.t('tagSaved') : '标签已保存';
      window.SMART_BOOKMARK_HELPERS.showToast(msg);
      invokeEditorCallback('saved', tagsToSave.slice());
      dismissEditor();
    }).catch(function () {
      var errMsg = self.languageManager ? self.languageManager.t('tagSaveFailed') : '标签保存失败';
      window.SMART_BOOKMARK_HELPERS.showToast(errMsg, true);
    });
  });

  // 点击 overlay 背景关闭
  overlay.addEventListener('mousedown', function (e) {
    if (e.target === overlay) {
      e.preventDefault();
      cancelAndDismissEditor();
    }
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      cancelAndDismissEditor();
    }
  });

  // 初始渲染
  renderChips();

  // 动画显示
  requestAnimationFrame(function () {
    overlay.classList.add('active');
    setTimeout(function () {
      input.focus();
    }, 200);
  });
};

/**
 * 添加书签成功后，立即进入标签编辑流程
 * @param {Object} createdBookmark - 新创建的书签对象
 * @param {string} parentFolderId - 目标文件夹ID（兜底）
 */
ModalManager.prototype.openTagEditorAfterCreate = function (createdBookmark, parentFolderId) {
  var self = this;
  if (!createdBookmark || !createdBookmark.id || typeof this.showTagEditor !== 'function') {
    this.hide();
    return;
  }

  var bookmarkForEditor = {
    id: createdBookmark.id,
    title: createdBookmark.title || '',
    url: createdBookmark.url || '',
    parentId: createdBookmark.parentId || parentFolderId || '',
    itemType: 'bookmark',
    tags: []
  };

  this.showTagEditor(bookmarkForEditor, 'bookmarks', {
    onSaved: function () {
      self.hide();
    },
    onCancel: function () {
      self.hide();
    }
  });
};
