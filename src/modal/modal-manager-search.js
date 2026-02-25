// Modal Manager Search - Smart Bookmark Extension

ModalManager.prototype.handleSearch = function (query) {
  var startTime = performance.now();
  var self = this;
  var searchGeneration = ++this.searchGeneration;
  var shouldAnimateModalHeight = this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH;



  // 标记高度动画（延迟到搜索结果渲染后执行，避免搜索前同步回流）
  var modal = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (modal && shouldAnimateModalHeight) {
    modal.classList.add('content-changing');
  } else if (modal) {
    modal.classList.remove('content-changing');
  }

  // 执行搜索
  if (this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    // 如果在文件夹视图中，退出文件夹视图进行新搜索
    if (this.isInFolderView) {
      this.isInFolderView = false;
      this.currentFolderId = null;
      this.navigationStack = [];
    }

    // 保存搜索词
    var queryTrimmed = query ? query.trim() : '';
    this.lastSearchQuery = queryTrimmed;

    // 使用 searchAll 同时搜索书签和文件夹
    this.filteredBookmarks = this.searchEngine.searchAll(queryTrimmed, this.allBookmarks, this.allFolders);

    // 应用历史加成分数（仅对书签）
    if (queryTrimmed && window.SMART_BOOKMARK_QUERY_HISTORY && this.filteredBookmarks.length > 0) {
      var bookmarkIds = [];
      for (var i = 0; i < this.filteredBookmarks.length; i++) {
        if (this.filteredBookmarks[i].itemType === 'bookmark') {
          bookmarkIds.push(this.filteredBookmarks[i].id);
        }
      }

      if (bookmarkIds.length > 0) {
        window.SMART_BOOKMARK_QUERY_HISTORY.getBatchBoostScores(queryTrimmed, bookmarkIds)
          .then(function (boostScores) {
            if (searchGeneration !== self.searchGeneration ||
              self.uiManager.currentMode !== window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
              return;
            }
            // 叠加历史加成分数
            for (var i = 0; i < self.filteredBookmarks.length; i++) {
              var item = self.filteredBookmarks[i];
              if (item.itemType === 'bookmark') {
                var boost = boostScores[item.id] || 0;
                item.score = (item.score || 0) + boost;
              }
            }
            // 重新排序：文件夹在前，书签在后，各自按分数排序
            self.filteredBookmarks.sort(function (a, b) {
              if (a.itemType !== b.itemType) {
                return a.itemType === 'folder' ? -1 : 1;
              }
              return (b.score || 0) - (a.score || 0);
            });
            // 更新显示
            self.keyboardManager.setCurrentItems(self.filteredBookmarks);
            self.updateBookmarkList();
          });
      } else {
        this.keyboardManager.setCurrentItems(this.filteredBookmarks);
        this.updateBookmarkList();
      }
    } else {
      this.keyboardManager.setCurrentItems(this.filteredBookmarks);
      this.updateBookmarkList();
    }
  } else {
    var folderQueryTrimmed = query ? query.trim() : '';

    if (folderQueryTrimmed === '') {
      this.filteredFolders = this.getDefaultFolderResults();
    } else {
      this.filteredFolders = this.searchEngine.search(query, this.allFolders);
    }

    this.keyboardManager.setCurrentItems(this.filteredFolders);
    this.updateFolderList();
  }

  // 使用 rAF 批量处理高度过渡，减少强制回流次数
  requestAnimationFrame(function () {
    if (searchGeneration !== self.searchGeneration) return;
    if (modal && shouldAnimateModalHeight) {
      // FLIP: 读取当前实际高度 → 设为 auto 测量目标高度 → 恢复 → 动画到目标
      var fromHeight = modal.offsetHeight; // 回流 1（必要：读取当前渲染高度）
      modal.style.height = 'auto';
      var toHeight = modal.offsetHeight;   // 回流 2（必要：测量 auto 高度）

      if (fromHeight !== toHeight) {
        modal.style.height = fromHeight + 'px';
        void modal.offsetHeight; // 强制浏览器记录起始值
        modal.style.height = toHeight + 'px';
      } else {
        modal.style.height = toHeight + 'px';
      }

      // 动画完成后清理
      setTimeout(function () {
        if (modal) {
          modal.classList.remove('content-changing');
        }
      }, 350);
    }
  });

  // 延迟设置选中索引，确保虚拟滚动器完全渲染后再进行选择
  setTimeout(function () {
    if (searchGeneration !== self.searchGeneration) return;
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
  // console.log('Search took ' + (endTime - startTime) + ' milliseconds');
};

/**
 * 设置筛选类型
 * @param {string} filterType - 筛选类型 ('all', 'bookmark', 'folder')
 */

ModalManager.prototype.setFilter = function (filterType) {

  if (this.currentFilter === filterType) return;
  this.currentFilter = filterType;
  if (this.isTagFilterPopoverOpen && typeof this.closeTagFilterPopover === 'function') {
    this.closeTagFilterPopover();
  }

  // 刷新筛选栏 active 状态
  this.refreshFilterBarState();

  // 应用筛选并刷新列表
  this.updateBookmarkList();
};

/**
 * 设置标签筛选
 * @param {string} tag - 标签名
 */
ModalManager.prototype.setTagFilter = function (tag) {
  this.currentTagFilter = tag || null;

  if (window.SMART_BOOKMARK_TAGS && this.currentTagFilter &&
    typeof window.SMART_BOOKMARK_TAGS.recordTagFilterUsage === 'function') {
    window.SMART_BOOKMARK_TAGS.recordTagFilterUsage(this.currentTagFilter);
  }
  if (window.SMART_BOOKMARK_TAGS && this.uiManager && typeof this.uiManager.updateTagFilterTabs === 'function') {
    this.uiManager.updateTagFilterTabs(this.getAvailableFilterTags(), this.currentTagFilter);
  }

  this.refreshFilterBarState();
  if (this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    this.updateBookmarkList();
  } else {
    this.updateFolderList();
  }
};

/**
 * 清除标签筛选
 */
ModalManager.prototype.clearTagFilter = function () {
  this.currentTagFilter = null;
  if (window.SMART_BOOKMARK_TAGS && this.uiManager && typeof this.uiManager.updateTagFilterTabs === 'function') {
    this.uiManager.updateTagFilterTabs(this.getAvailableFilterTags(), this.currentTagFilter);
  }
  this.refreshFilterBarState();
  if (this.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH) {
    this.updateBookmarkList();
  } else {
    this.updateFolderList();
  }
};

/**
 * 统一刷新筛选栏 tab 的 active 状态
 */
ModalManager.prototype.refreshFilterBarState = function () {
  var filterBar = this.getRoot().getElementById('smart-bookmark-filter-bar');
  if (!filterBar) return;

  var tabs = filterBar.querySelectorAll('.smart-bookmark-filter-tab');
  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    // 类型 tab
    if (tab.dataset.filter) {
      if (tab.dataset.filter === this.currentFilter) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    }
    // 标签 tab
    if (tab.dataset.filterTag) {
      var tabTag = (tab.dataset.filterTag || '').toLowerCase();
      var activeTag = (this.currentTagFilter || '').toLowerCase();
      if (tabTag && activeTag && tabTag === activeTag) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    }
  }

  // 空态标签提示显示控制
  var tagEmpty = this.getRoot().getElementById('smart-bookmark-filter-tag-empty');
  var tagRow = this.getRoot().getElementById('smart-bookmark-filter-tag-tabs');
  var moreBtn = this.getRoot().getElementById('smart-bookmark-more-tags-btn');
  if (tagEmpty && tagRow) {
    var hasTagTabs = tagRow.querySelectorAll('[data-filter-tag]').length > 0;
    var hasMoreBtn = !!(moreBtn && moreBtn.style.display !== 'none');
    tagEmpty.style.display = (hasTagTabs || hasMoreBtn) ? 'none' : '';
  }

};

/**
 * 打开“更多标签”筛选面板
 */
ModalManager.prototype.openTagFilterPopover = function () {
  var root = this.getRoot();
  var pop = root.getElementById('smart-bookmark-tag-popover');
  var searchInput = root.getElementById('smart-bookmark-tag-popover-search');
  var moreBtn = root.getElementById('smart-bookmark-more-tags-btn');
  if (!pop || !searchInput || !moreBtn) return;

  this.isTagFilterPopoverOpen = true;
  pop.classList.add('show');
  moreBtn.classList.add('active');
  searchInput.value = this.tagFilterPopoverSearch || '';
  this.renderTagFilterPopoverList(this.tagFilterPopoverSearch || '');

  var self = this;
  requestAnimationFrame(function () {
    searchInput.focus();
    if (searchInput.value) searchInput.select();
  });

  if (!searchInput._tagPopoverHandlersBound) {
    searchInput._tagPopoverHandlersBound = true;
    searchInput.addEventListener('keydown', function (e) {
      if (!self.isTagFilterPopoverOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        self.closeTagFilterPopover({ focusToggle: true });
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        self.moveTagFilterPopoverFocus(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        self.moveTagFilterPopoverFocus(-1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        self.applyTagFilterFromPopover();
      }
    });
    searchInput.addEventListener('input', function () {
      self.tagFilterPopoverSearch = searchInput.value || '';
      self.renderTagFilterPopoverList(self.tagFilterPopoverSearch);
    });
  }
};

/**
 * 关闭“更多标签”筛选面板
 * @param {{focusToggle?: boolean}} options
 */
ModalManager.prototype.closeTagFilterPopover = function (options) {
  options = options || {};
  var root = this.getRoot();
  var pop = root.getElementById('smart-bookmark-tag-popover');
  var moreBtn = root.getElementById('smart-bookmark-more-tags-btn');
  if (pop) pop.classList.remove('show');
  if (moreBtn) moreBtn.classList.remove('active');
  this.isTagFilterPopoverOpen = false;
  this.tagFilterPopoverSearch = '';
  this.tagFilterPopoverFocusedIndex = -1;
  this.tagFilterPopoverFilteredTags = [];
  var searchInput = root.getElementById('smart-bookmark-tag-popover-search');
  if (searchInput) searchInput.value = '';
  if (options.focusToggle && moreBtn && typeof moreBtn.focus === 'function') {
    moreBtn.focus();
  }
};

ModalManager.prototype.renderTagFilterPopoverList = function (searchText) {
  var root = this.getRoot();
  var listEl = root.getElementById('smart-bookmark-tag-popover-list');
  if (!listEl || !window.SMART_BOOKMARK_TAGS) return;

  var allTags = this.getAvailableFilterTags();
  var sorted = this.uiManager && typeof this.uiManager.sortTagsForFilter === 'function'
    ? this.uiManager.sortTagsForFilter(allTags, this.currentTagFilter, { preferUsage: true })
    : allTags.slice();
  var q = (searchText || '').toLowerCase().trim();
  var filtered = [];
  for (var i = 0; i < sorted.length; i++) {
    if (!q || (sorted[i] || '').toLowerCase().indexOf(q) > -1) {
      filtered.push(sorted[i]);
    }
  }

  this.tagFilterPopoverFilteredTags = filtered;
  if (this.tagFilterPopoverFocusedIndex < 0 || this.tagFilterPopoverFocusedIndex >= filtered.length) {
    this.tagFilterPopoverFocusedIndex = filtered.length > 0 ? 0 : -1;
  }

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'smart-bookmark-tag-popover-empty';
    empty.textContent = this.languageManager ? this.languageManager.t('noMatchingTags') : '没有匹配标签';
    listEl.appendChild(empty);
    return;
  }

  for (var j = 0; j < filtered.length; j++) {
    var tag = filtered[j];
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'smart-bookmark-tag-popover-item smart-bookmark-filter-tab';
    btn.setAttribute('data-filter-tag', tag);
    btn.setAttribute('data-index', j);
    btn.textContent = '🏷️ ' + tag;
    if (this.currentTagFilter && tag.toLowerCase() === this.currentTagFilter.toLowerCase()) {
      btn.classList.add('active');
    }
    if (j === this.tagFilterPopoverFocusedIndex) {
      btn.classList.add('focused');
    }
    listEl.appendChild(btn);
  }
};

ModalManager.prototype.moveTagFilterPopoverFocus = function (direction) {
  if (!this.tagFilterPopoverFilteredTags || this.tagFilterPopoverFilteredTags.length === 0) return;
  var len = this.tagFilterPopoverFilteredTags.length;
  var idx = this.tagFilterPopoverFocusedIndex;
  if (idx < 0) idx = 0;
  idx = (idx + direction + len) % len;
  this.tagFilterPopoverFocusedIndex = idx;

  var root = this.getRoot();
  var listEl = root.getElementById('smart-bookmark-tag-popover-list');
  if (!listEl) return;
  var items = listEl.querySelectorAll('.smart-bookmark-tag-popover-item');
  for (var i = 0; i < items.length; i++) {
    if (i === idx) {
      items[i].classList.add('focused');
      if (typeof items[i].scrollIntoView === 'function') {
        items[i].scrollIntoView({ block: 'nearest' });
      }
    } else {
      items[i].classList.remove('focused');
    }
  }
};

ModalManager.prototype.applyTagFilterFromPopover = function () {
  if (!this.tagFilterPopoverFilteredTags || this.tagFilterPopoverFilteredTags.length === 0) return;
  var idx = this.tagFilterPopoverFocusedIndex;
  if (idx < 0 || idx >= this.tagFilterPopoverFilteredTags.length) idx = 0;
  var tag = this.tagFilterPopoverFilteredTags[idx];
  if (!tag) return;

  if (this.currentTagFilter && this.currentTagFilter.toLowerCase() === tag.toLowerCase()) {
    this.clearTagFilter();
  } else {
    this.setTagFilter(tag);
  }
  this.closeTagFilterPopover({ focusToggle: false });
};

/**
 * 循环切换筛选标签
 * @param {number} direction - 方向（1: 下一个, -1: 上一个）
 */

ModalManager.prototype.cycleFilter = function (direction) {
  var currentIndex = this.filterTypes.indexOf(this.currentFilter);
  if (currentIndex === -1) currentIndex = 0;

  var newIndex = (currentIndex + direction + this.filterTypes.length) % this.filterTypes.length;
  this.setFilter(this.filterTypes[newIndex]);
};



/**
 * 更新书签列表显示
 */

ModalManager.prototype.highlightText = function (text, searchTerm) {
  if (!text || !searchTerm) return this.escapeHtml(text || '');

  var self = this;
  var lowerText = text.toLowerCase();
  var searchTermTrimmed = searchTerm.toLowerCase().trim();

  // 支持多关键词：按空格拆分
  var keywords = searchTermTrimmed.split(/\s+/).filter(function (k) { return k.length > 0; });

  if (keywords.length === 0) return this.escapeHtml(text);

  // 找出所有需要高亮的位置区间
  var highlights = [];

  for (var k = 0; k < keywords.length; k++) {
    var keyword = keywords[k];
    var pos = 0;

    // 找出该关键词在文本中所有出现的位置
    while (true) {
      var index = lowerText.indexOf(keyword, pos);
      if (index === -1) break;

      highlights.push({
        start: index,
        end: index + keyword.length
      });

      pos = index + 1;
    }
  }

  // 如果没有找到任何匹配，返回原文
  if (highlights.length === 0) {
    return this.escapeHtml(text);
  }

  // 合并重叠的区间
  highlights.sort(function (a, b) { return a.start - b.start; });
  var merged = [highlights[0]];
  for (var i = 1; i < highlights.length; i++) {
    var last = merged[merged.length - 1];
    var curr = highlights[i];
    if (curr.start <= last.end) {
      // 重叠，合并
      last.end = Math.max(last.end, curr.end);
    } else {
      merged.push(curr);
    }
  }

  // 构建高亮后的文本
  var result = [];
  var lastEnd = 0;

  for (var j = 0; j < merged.length; j++) {
    var range = merged[j];

    // 添加高亮前的普通文本
    if (range.start > lastEnd) {
      result.push(this.escapeHtml(text.substring(lastEnd, range.start)));
    }

    // 添加高亮文本
    result.push('<span class="smart-bookmark-highlight">');
    result.push(this.escapeHtml(text.substring(range.start, range.end)));
    result.push('</span>');

    lastEnd = range.end;
  }

  // 添加剩余文本
  if (lastEnd < text.length) {
    result.push(this.escapeHtml(text.substring(lastEnd)));
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
