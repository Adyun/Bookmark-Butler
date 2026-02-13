// Modal Manager Navigation - Smart Bookmark Extension

ModalManager.prototype.enterFolder = function (folderId, folderTitle) {
  var self = this;

  // 保存当前状态到导航栈
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

  // 更新状态
  this.isInFolderView = true;
  this.currentFolderId = folderId;
  this.currentFolderTitle = folderTitle;

  // 清空搜索框
  var searchInput = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (searchInput) {
    searchInput.value = '';
  }

  // 获取文件夹内容（子文件夹 + 书签）
  return Promise.all([
    window.SMART_BOOKMARK_API.getSubFolders(folderId),
    window.SMART_BOOKMARK_API.getBookmarksByFolder(folderId)
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
      combinedItems.push({
        id: subFolders[i].id,
        title: subFolders[i].title,
        parentId: subFolders[i].parentId,
        bookmarkCount: subFolders[i].bookmarkCount,
        subFolderCount: subFolders[i].subFolderCount,
        itemType: 'folder'
      });
    }

    // 添加书签
    for (var j = 0; j < bookmarks.length; j++) {
      combinedItems.push({
        id: bookmarks[j].id,
        title: bookmarks[j].title,
        url: bookmarks[j].url,
        parentId: bookmarks[j].parentId,
        itemType: 'bookmark'
      });
    }

    self.filteredBookmarks = combinedItems;

    // 进入文件夹时重置筛选器为"全部"
    if (self.currentFilter !== 'all') {
      self.currentFilter = 'all';
      // 更新筛选标签 UI
      var tabs = self.getRoot().querySelectorAll('.smart-bookmark-filter-tab');
      for (var k = 0; k < tabs.length; k++) {
        if (tabs[k].getAttribute('data-filter') === 'all') {
          tabs[k].classList.add('active');
        } else {
          tabs[k].classList.remove('active');
        }
      }
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
  for (var j = 0; j < this.filteredFolders.length; j++) {
    if (this.filteredFolders[j].id === folderId) {
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
 * 显示右键上下文菜单
 * @param {MouseEvent} event - 右键事件
 * @param {Object} bookmark - 书签对象
 */
ModalManager.prototype.showContextMenu = function (event, bookmark) {
  if (!bookmark || !bookmark.id) return;
  if (bookmark.url && typeof this.isSpecialUrl === 'function' && this.isSpecialUrl(bookmark.url)) {
    return;
  }

  var self = this;
  this.dismissContextMenu();

  var root = this.getRoot();

  // 菜单项数据（数据驱动，便于后续扩展）
  var menuItems = [
    {
      action: 'delete',
      label: this.languageManager ? this.languageManager.t('deleteConfirmBtn') : '删除',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
      destructive: true
    }
    // 后续扩展示例：
    // { action: 'edit', label: '编辑', icon: '<svg ...>...</svg>', destructive: false }
  ];

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
        self.handleContextMenuAction(action, bookmark);
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
        self.handleContextMenuAction(action, bookmark);
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
 * @param {Object} bookmark - 书签对象
 */
ModalManager.prototype.handleContextMenuAction = function (action, bookmark) {
  switch (action) {
    case 'delete':
      this.confirmDeleteBookmark(bookmark);
      break;
    // 后续扩展：
    // case 'edit':
    //   this.editBookmark(bookmark);
    //   break;
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

    var filterBar = this.getRoot().getElementById('smart-bookmark-filter-bar');
    if (filterBar) {
      filterBar.style.display = '';
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
        .then(function () {
          self.isDuplicateCheckInProgress = false;
          window.SMART_BOOKMARK_HELPERS.showToast(self.languageManager.t('bookmarkAdded'));
          self.hide();
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
  this.cancelPendingSearch();
  this.uiManager.toggleMode();
  this.keyboardManager.setMode(this.uiManager.currentMode);

  // 控制筛选器栏的显示/隐藏
  var filterBar = this.getRoot().getElementById('smart-bookmark-filter-bar');
  if (filterBar) {
    if (this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
      filterBar.style.display = '';
      // 重置筛选为"全部"
      this.currentFilter = 'all';
      var tabs = filterBar.querySelectorAll('.smart-bookmark-filter-tab');
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].getAttribute('data-filter') === 'all') {
          tabs[i].classList.add('active');
        } else {
          tabs[i].classList.remove('active');
        }
      }
    } else {
      filterBar.style.display = 'none';
    }
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
    return '<div class="breadcrumb" title="' + rootText + '">' + rootText + '</div>';
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
