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
 * 主动关闭重复书签对话框
 */
ModalManager.prototype.dismissDuplicateDialog = function () {
  if (typeof this.duplicateDialogCleanup === 'function') {
    this.duplicateDialogCleanup();
  }
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
