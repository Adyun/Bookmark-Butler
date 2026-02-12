// Modal Manager Search - Smart Bookmark Extension

ModalManager.prototype.handleSearch = function (query) {
  var startTime = performance.now();
  var self = this;
  var searchGeneration = ++this.searchGeneration;



  // 记录当前高度
  var modal = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  var currentHeight = null;
  if (modal) {
    currentHeight = modal.offsetHeight;
    modal.style.height = currentHeight + 'px'; // 设置当前高度
    modal.classList.add('content-changing');
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
    this.filteredFolders = this.searchEngine.search(query, this.allFolders);
    this.keyboardManager.setCurrentItems(this.filteredFolders);
    this.updateFolderList();
  }

  // 计算新高度并应用动画
  setTimeout(function () {
    if (searchGeneration !== self.searchGeneration) return;
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

  // 更新标签的 active 状态
  var filterBar = this.getRoot().getElementById('smart-bookmark-filter-bar');
  if (filterBar) {
    var tabs = filterBar.querySelectorAll('.smart-bookmark-filter-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-filter') === filterType) {
        tabs[i].classList.add('active');
      } else {
        tabs[i].classList.remove('active');
      }
    }
  }

  // 应用筛选并刷新列表
  this.updateBookmarkList();
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
