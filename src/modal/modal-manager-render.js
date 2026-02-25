// Modal Manager Render - Smart Bookmark Extension

ModalManager.prototype.updateBookmarkList = function () {
  var bookmarkList = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.BOOKMARK_LIST_ID);
  if (!bookmarkList) return;

  var searchInput = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var hasSearchQuery = searchInput && searchInput.value.trim() !== '';

  // 根据当前筛选类型过滤结果
  var sourceItems = this.filteredBookmarks;

  var filtered;
  if (this.currentFilter === 'all') {
    filtered = sourceItems ? sourceItems.slice() : [];
  } else {
    filtered = [];
    for (var i = 0; i < sourceItems.length; i++) {
      if (sourceItems[i].itemType === this.currentFilter) {
        filtered.push(sourceItems[i]);
      }
    }
  }

  // 叠加标签筛选（back 项豁免）
  if (this.currentTagFilter) {
    var tagFiltered = [];
    for (var ti = 0; ti < filtered.length; ti++) {
      var item = filtered[ti];
      if (item.itemType === 'back') {
        tagFiltered.push(item);
        continue;
      }
      var itemTags = item.tags || [];
      var tagFilterLower = this.currentTagFilter.toLowerCase();
      for (var tj = 0; tj < itemTags.length; tj++) {
        if ((itemTags[tj] || '').toLowerCase() === tagFilterLower) {
          tagFiltered.push(item);
          break;
        }
      }
    }
    filtered = tagFiltered;
  }


  // 检查是否有结果
  if (hasSearchQuery && filtered.length === 0) {
    // 清理虚拟滚动器的内容容器，确保无结果消息能正确显示
    if (this.bookmarkVirtualScroller && this.bookmarkVirtualScroller.contentContainer) {
      this.bookmarkVirtualScroller.contentContainer.remove();
    }
    this.uiManager.showNoResultsState('bookmarks');
    return;
  }

  if (!hasSearchQuery && filtered.length === 0) {
    // 清理虚拟滚动器的内容容器
    if (this.bookmarkVirtualScroller && this.bookmarkVirtualScroller.contentContainer) {
      this.bookmarkVirtualScroller.contentContainer.remove();
    }
    this.uiManager.showEmptyState('bookmarks');
    return;
  }

  // 应用置顶规则：
  // - 空搜索：置顶项按置顶时间倒序优先
  // - 有搜索：若结果包含置顶项，则将置顶项提升到顶部但保留搜索相对顺序
  var itemsToRender = filtered.slice();
  if (window.SMART_BOOKMARK_PINS) {
    if (!hasSearchQuery) {
      itemsToRender = window.SMART_BOOKMARK_PINS.applyPinOrdering(itemsToRender, 'bookmarks');
    } else if (window.SMART_BOOKMARK_PINS.hasAnyPinned(itemsToRender, 'bookmarks')) {
      itemsToRender = window.SMART_BOOKMARK_PINS.promotePinnedPreserveOrder(itemsToRender, 'bookmarks');
    }
  }
  // 保持键盘导航与渲染顺序一致
  this.keyboardManager.setCurrentItems(itemsToRender);

  // 使用虚拟滚动渲染书签列表
  this.renderBookmarkListWithVirtualScroll(bookmarkList, hasSearchQuery, itemsToRender);

  // 渲染后自动选中第一项
  var self = this;
  setTimeout(function () {
    // 使用当前键盘管理器中的项目数量来判断，避免闭包中的 itemsToRender 过时
    var currentCount = self.keyboardManager.currentItems.length;
    if (currentCount > 0) {
      self.keyboardManager.setSelectedIndex(0);
    } else {
      self.keyboardManager.setSelectedIndex(-1);
    }
  }, 50);
};

/**
 * 更新文件夹列表显示
 */

ModalManager.prototype.updateFolderList = function () {
  var folderList = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.FOLDER_LIST_ID);
  if (!folderList) return;

  var searchInput = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var hasSearchQuery = searchInput && searchInput.value.trim() !== '';
  var hasActiveTagFilter = !!this.currentTagFilter;

  // 基于当前搜索结果叠加标签筛选
  var sourceItems = this.filteredFolders ? this.filteredFolders.slice() : [];
  var filteredFolders = sourceItems;
  if (this.currentTagFilter) {
    filteredFolders = [];
    var tagFilterLower = this.currentTagFilter.toLowerCase();
    for (var fi = 0; fi < sourceItems.length; fi++) {
      var folder = sourceItems[fi];
      var folderTags = folder && folder.tags ? folder.tags : [];
      for (var ft = 0; ft < folderTags.length; ft++) {
        if ((folderTags[ft] || '').toLowerCase() === tagFilterLower) {
          filteredFolders.push(folder);
          break;
        }
      }
    }
  }

  // 检查是否有结果
  if ((hasSearchQuery || hasActiveTagFilter) && filteredFolders.length === 0) {
    // 清理虚拟滚动器的内容容器，确保无结果消息能正确显示
    if (this.folderVirtualScroller && this.folderVirtualScroller.contentContainer) {
      this.folderVirtualScroller.contentContainer.remove();
    }
    this.uiManager.showNoResultsState('folders');
    return;
  }

  if (!hasSearchQuery && !hasActiveTagFilter && filteredFolders.length === 0) {
    // 清理虚拟滚动器的内容容器
    if (this.folderVirtualScroller && this.folderVirtualScroller.contentContainer) {
      this.folderVirtualScroller.contentContainer.remove();
    }
    this.uiManager.showEmptyState('folders');
    return;
  }

  // 应用置顶规则：
  // - 空搜索：置顶项按置顶时间倒序优先
  // - 有搜索：若结果包含置顶项，则将置顶项提升到顶部但保留搜索相对顺序
  var itemsToRender = filteredFolders.slice();
  if (window.SMART_BOOKMARK_PINS) {
    if (!hasSearchQuery) {
      itemsToRender = window.SMART_BOOKMARK_PINS.applyPinOrdering(itemsToRender, 'folders');
    } else if (window.SMART_BOOKMARK_PINS.hasAnyPinned(itemsToRender, 'folders')) {
      itemsToRender = window.SMART_BOOKMARK_PINS.promotePinnedPreserveOrder(itemsToRender, 'folders');
    }
  }

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

  // 首次创建，后续复用实例仅更新数据
  if (!this.folderVirtualScroller) {
    this.folderVirtualScroller = new window.VirtualScroller(
      folderList,
      this.itemHeight,
      (itemsToRender && itemsToRender.length) || 0,
      function (folder, index) {
        return self.renderFolderItem(folder, index, hasSearchQuery);
      }
    );
  }
  // 每次渲染时都更新键盘管理器的虚拟滚动器引用，确保模式切换时引用正确
  this.keyboardManager.setVirtualScroller(this.folderVirtualScroller);
  // 更新渲染函数以使用最新的 hasSearchQuery 等上下文
  if (this.folderVirtualScroller && typeof this.folderVirtualScroller.setRenderItem === 'function') {
    this.folderVirtualScroller.setRenderItem(function (folder, index) {
      return self.renderFolderItem(folder, index, hasSearchQuery);
    });
  }

  // 更新虚拟滚动器的数据
  // 文件夹模式下，输入搜索时关闭入场动画，避免结果量变化触发的二次闪烁感
  this.folderVirtualScroller.updateData(itemsToRender, !hasSearchQuery);
  // 同步键盘管理器的当前项目
  this.keyboardManager.setCurrentItems(itemsToRender);
};

/**
 * 生成文件夹数量摘要文本
 * @param {Object} folder
 * @returns {string}
 */
ModalManager.prototype.getFolderCountText = function (folder) {
  var hasI18n = !!this.languageManager;
  var t = hasI18n ? this.languageManager.t.bind(this.languageManager) : null;
  var formatText = function (template, vars) {
    var out = template || '';
    for (var key in vars) {
      if (!Object.prototype.hasOwnProperty.call(vars, key)) continue;
      var reg = new RegExp('\\{' + key + '\\}', 'g');
      out = out.replace(reg, String(vars[key]));
    }
    return out;
  };

  var countParts = [];
  if (folder && folder.subFolderCount > 0) {
    if (hasI18n) {
      countParts.push(formatText(t('folderSummaryPartFolders'), {
        count: folder.subFolderCount,
        suffix: folder.subFolderCount === 1 ? '' : 's'
      }));
    } else {
      countParts.push(folder.subFolderCount + ' 个文件夹');
    }
  }
  if (folder && folder.bookmarkCount > 0) {
    if (hasI18n) {
      countParts.push(formatText(t('folderSummaryPartBookmarks'), {
        count: folder.bookmarkCount,
        suffix: folder.bookmarkCount === 1 ? '' : 's'
      }));
    } else {
      countParts.push(folder.bookmarkCount + ' 个书签');
    }
  }

  if (countParts.length === 0) {
    return hasI18n ? t('folderSummaryEmpty') : '空文件夹';
  }

  if (hasI18n) {
    return formatText(t('folderSummaryContains'), {
      parts: countParts.join(t('folderSummaryJoiner'))
    });
  }

  return '内含 ' + countParts.join('，');
};

/**
 * 生成文件夹卡片主体 HTML（名称/数量/路径/标签）
 * @param {Object} folder
 * @param {string} searchTerm
 * @param {boolean} hasSearchQuery
 * @param {boolean} showArrow
 * @returns {string}
 */
ModalManager.prototype.renderFolderCardContent = function (folder, searchTerm, hasSearchQuery, showArrow) {
  var titleText = folder && folder.title ? folder.title : '';
  var highlightedTitle = hasSearchQuery && searchTerm
    ? this.highlightText(titleText, searchTerm)
    : this.escapeHtml(titleText);
  var countText = this.escapeHtml(this.getFolderCountText(folder));
  var breadcrumb = this.generateBreadcrumb(folder ? folder.parentId : null);
  var folderTagsHtml = this.renderTagsHtml(folder || {}, searchTerm);

  return '' +
    '<div class="smart-bookmark-bookmark-content">' +
    '<span class="smart-bookmark-bookmark-icon folder-icon">📁</span>' +
    '<div class="smart-bookmark-bookmark-text">' +
    '<div class="smart-bookmark-bookmark-title-container">' +
    '<span class="smart-bookmark-bookmark-title">' + highlightedTitle + '</span>' +
    '</div>' +
    '<div class="smart-bookmark-bookmark-url">' + countText + '</div>' +
    (breadcrumb ? breadcrumb : '') +
    folderTagsHtml +
    '</div>' +
    (showArrow ? '<span class="smart-bookmark-folder-arrow">›</span>' : '') +
    '</div>';
};

/**
 * 绑定文件夹右键菜单（编辑标签）
 * @param {Element} itemEl
 * @param {Object} folder
 */
ModalManager.prototype.bindFolderContextMenu = function (itemEl, folder) {
  if (!itemEl || !folder) return;
  var self = this;
  itemEl.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof self.showContextMenu === 'function') {
      self.showContextMenu(e, folder, 'folder');
    }
  });
};

/**
 * 追加置顶按钮（右上角）
 * @param {Element} itemEl
 * @param {'bookmarks'|'folders'} itemType
 * @param {string} itemId
 */
ModalManager.prototype.attachPinActionButton = function (itemEl, itemType, itemId) {
  if (!itemEl || !itemType || !itemId) return;
  itemEl.classList.add('has-actions');

  var actions = document.createElement('div');
  actions.className = 'smart-bookmark-item-actions';

  var pinBtn = document.createElement('button');
  pinBtn.className = 'smart-bookmark-pin-btn';
  pinBtn.type = 'button';
  pinBtn.innerHTML = '<svg class="smart-bookmark-pin-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M23.9986 5L17.8856 17.4776L4 19.4911L14.0589 29.3251L11.6544 43L23.9986 36.4192L36.3454 43L33.9586 29.3251L44 19.4911L30.1913 17.4776L23.9986 5Z"/></svg>';
  if (window.SMART_BOOKMARK_PINS && window.SMART_BOOKMARK_PINS.isPinned(itemType, itemId)) {
    pinBtn.classList.add('pinned');
  }

  var self = this;
  pinBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!window.SMART_BOOKMARK_PINS) return;

    window.SMART_BOOKMARK_PINS.togglePin(itemType, itemId).then(function (pinnedNow) {
      if (pinnedNow) pinBtn.classList.add('pinned');
      else pinBtn.classList.remove('pinned');

      var searchInput = self.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
      var hasSearchQuery = !!(searchInput && searchInput.value.trim() !== '');
      if (!hasSearchQuery) {
        if (itemType === 'folders') self.updateFolderList();
        else self.updateBookmarkList();
      } else if (itemType === 'folders' && self.folderVirtualScroller) {
        self.folderVirtualScroller.forceUpdate();
      } else if (itemType === 'bookmarks' && self.bookmarkVirtualScroller) {
        self.bookmarkVirtualScroller.forceUpdate();
      }
    });
  });

  actions.appendChild(pinBtn);
  itemEl.appendChild(actions);
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

  // 获取搜索关键词并构建卡片主体
  var searchInput = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var searchTerm = searchInput ? searchInput.value.trim() : '';
  item.innerHTML = this.renderFolderCardContent(folder, searchTerm, hasSearchQuery, false);
  this.attachPinActionButton(item, 'folders', folder.id);
  this.bindFolderContextMenu(item, folder);

  // 绑定点击事件
  var self = this;
  item.addEventListener('click', function (e) {
    if (e.target && typeof e.target.closest === 'function') {
      if (e.target.closest('.smart-bookmark-tag') || e.target.closest('.smart-bookmark-item-actions')) {
        return;
      }
    }
    self.selectFolder(e.currentTarget);
  });

  return item;
};

/**
 * 使用虚拟滚动渲染书签列表
 * @param {Element} bookmarkList - 书签列表容器
 * @param {boolean} hasSearchQuery - 是否有搜索查询
 */

ModalManager.prototype.renderBookmarkListWithVirtualScroll = function (bookmarkList, hasSearchQuery, itemsToRender) {
  var self = this;

  // 首次创建，后续复用实例仅更新数据
  if (!this.bookmarkVirtualScroller) {
    this.bookmarkVirtualScroller = new window.VirtualScroller(
      bookmarkList,
      this.itemHeight,
      (itemsToRender && itemsToRender.length) || 0,
      function (bookmark, index) {
        return self.renderBookmarkItem(bookmark, index, hasSearchQuery);
      }
    );
  }
  // 每次渲染时都更新键盘管理器的虚拟滚动器引用，确保模式切换时引用正确
  this.keyboardManager.setVirtualScroller(this.bookmarkVirtualScroller);
  // 更新渲染函数以使用最新的 hasSearchQuery 等上下文
  if (this.bookmarkVirtualScroller && typeof this.bookmarkVirtualScroller.setRenderItem === 'function') {
    this.bookmarkVirtualScroller.setRenderItem(function (bookmark, index) {
      return self.renderBookmarkItem(bookmark, index, hasSearchQuery);
    });
  }

  // 更新虚拟滚动器的数据
  // 模式切换/首次渲染/搜索后：确保本次渲染播放动画
  this.bookmarkVirtualScroller.shouldAnimateOnNextRender = true;
  this.bookmarkVirtualScroller.updateData(itemsToRender);
  // 同步键盘管理器的当前项目
  this.keyboardManager.setCurrentItems(itemsToRender);
};

/**
 * 渲染单个书签项目（支持书签和文件夹）
 * @param {Object} bookmark - 书签或文件夹对象
 * @param {number} index - 索引
 * @param {boolean} hasSearchQuery - 是否有搜索查询
 * @returns {Element} 书签/文件夹元素
 */

ModalManager.prototype.renderBookmarkItem = function (bookmark, index, hasSearchQuery) {
  if (!bookmark) return null;

  var self = this;
  var isFolder = bookmark.itemType === 'folder';
  var isBack = bookmark.itemType === 'back';

  // 移除匹配度样式，保持统一简约风格
  var matchClass = '';

  var item = document.createElement('div');
  item.className = 'smart-bookmark-bookmark-item ' + matchClass +
    (isFolder ? ' is-folder' : '') +
    (isBack ? ' is-back-btn' : '');

  // 处理返回按钮 - 三行结构：标题 / 副标题 / 当前位置
  if (isBack) {
    item.innerHTML =
      '<div class="smart-bookmark-bookmark-content">' +
      '<span class="smart-bookmark-bookmark-icon">←</span>' +
      '<div class="smart-bookmark-bookmark-text">' +
      '<div class="smart-bookmark-bookmark-title-container">' +
      '<span class="smart-bookmark-bookmark-title">返回上一级</span>' +
      '</div>' +
      '<div class="smart-bookmark-bookmark-url">点击或按回车键返回</div>' +
      '<div class="breadcrumb">当前：' + (self.currentFolderTitle || '搜索结果') + '</div>' +
      '</div>' +
      '</div>';

    item.addEventListener('click', function () {
      self.goBack();
    });
    return item;
  }

  if (isFolder) {
    item.setAttribute('data-folder-id', bookmark.id);
  } else {
    item.setAttribute('data-bookmark-id', bookmark.id);
    item.setAttribute('data-bookmark-url', bookmark.url);
  }

  // 生成面包屑
  var breadcrumb = this.generateBreadcrumb(bookmark.parentId);

  // 获取搜索关键词并应用高亮
  var searchInput = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  var searchTerm = searchInput ? searchInput.value.trim() : '';
  var highlightedTitle = hasSearchQuery && searchTerm ?
    this.highlightText(bookmark.title, searchTerm) : bookmark.title;

  if (isFolder) {
    item.innerHTML = this.renderFolderCardContent(bookmark, searchTerm, hasSearchQuery, true);

    // 文件夹点击进入
    item.addEventListener('click', function (e) {
      // 点击标签时不进入文件夹，由列表层事件委托处理标签筛选
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('.smart-bookmark-tag')) {
        return;
      }
      self.enterFolder(bookmark.id, bookmark.title);
    });
    this.bindFolderContextMenu(item, bookmark);
  } else {
    // 渲染书签
    var displayUrl = this.formatUrlForDisplay(bookmark.url);
    var highlightedUrl = hasSearchQuery && searchTerm ?
      this.highlightText(displayUrl, searchTerm) : displayUrl;

    var bookmarkTagsHtml = this.renderTagsHtml(bookmark, searchTerm);
    item.innerHTML =
      '<div class="smart-bookmark-bookmark-content">' +
      '<span class="smart-bookmark-bookmark-icon">🔗</span>' +
      '<div class="smart-bookmark-bookmark-text">' +
      '<div class="smart-bookmark-bookmark-title-container">' +
      '<span class="smart-bookmark-bookmark-title">' + highlightedTitle + '</span>' +
      '</div>' +
      '<div class="smart-bookmark-bookmark-url" title="' + bookmark.url + '">' + highlightedUrl + '</div>' +
      (breadcrumb ? breadcrumb : '') +
      bookmarkTagsHtml +
      '</div>' +
      '</div>';

    this.attachPinActionButton(item, 'bookmarks', bookmark.id);

    // 右键上下文菜单（仅书签项，不含文件夹和返回按钮）
    var selfRef2 = this;
    item.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof selfRef2.showContextMenu === 'function') {
        selfRef2.showContextMenu(e, bookmark);
      }
    });

    // 书签点击打开
    item.addEventListener('click', function (e) {
      // 点击标签时不打开书签，由列表层事件委托处理标签筛选
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('.smart-bookmark-tag')) {
        return;
      }
      self.selectBookmark(e.currentTarget);
    });
  }

  return item;
};

/**
 * 生成标签 HTML（单行展示，最多 5 个 + +N）
 * @param {Object} item - 书签/文件夹对象
 * @param {string} searchTerm - 当前搜索词（用于高亮）
 * @returns {string} HTML 字符串
 */
ModalManager.prototype.renderTagsHtml = function (item, searchTerm) {
  var tags = item.tags || [];
  var html = '<div class="smart-bookmark-tags-container">';
  if (tags.length === 0) {
    var noTagsText = this.languageManager ? this.languageManager.t('noTags') : '暂无标签';
    html += '<span class="smart-bookmark-tag-empty">' + this.escapeHtml(noTagsText) + '</span>';
    html += '</div>';
    return html;
  }

  var MAX_VISIBLE = 5;

  var visibleCount = Math.min(tags.length, MAX_VISIBLE);
  for (var i = 0; i < visibleCount; i++) {
    var tag = tags[i];
    var safeTag = this.escapeHtml(tag);
    var colors = window.SMART_BOOKMARK_TAGS ? window.SMART_BOOKMARK_TAGS.generateTagColor(tag) : { bg: '#f1f5f9', text: '#334155' };
    var displayTag = safeTag;
    // 搜索高亮（highlightText 本身会再转义，传原始 tag）
    if (searchTerm) {
      displayTag = this.highlightText(tag, searchTerm);
    }
    html += '<span class="smart-bookmark-tag" data-tag="' + safeTag.replace(/"/g, '&quot;') + '" ' +
      'style="background:' + colors.bg + ';color:' + colors.text + '">' +
      displayTag + '</span>';
  }

  if (tags.length > MAX_VISIBLE) {
    html += '<span class="smart-bookmark-tag-more">+' + (tags.length - MAX_VISIBLE) + '</span>';
  }

  html += '</div>';
  return html;
};

/**
 * 高亮匹配文本（支持多关键词）
 * @param {string} text - 原始文本
 * @param {string} searchTerm - 搜索关键词（可能包含多个空格分隔的关键词）
 * @returns {string} 包含高亮标签的HTML文本
 */
