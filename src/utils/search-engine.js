// Search engine for the Smart Bookmark Extension

/**
 * 搜索引擎类
 */
function SearchEngine() {
  // 构造函数
}

/**
 * 搜索文件夹
 * @param {string} query - 搜索关键词
 * @param {Array} folders - 待搜索文件夹列表
 * @returns {Array} 匹配的文件夹，按相关性排序
 */
SearchEngine.prototype.search = function (query, folders) {
  if (!query || query.trim() === '') {
    // 如果没有搜索词或只有空格，返回所有文件夹
    for (var i = 0; i < folders.length; i++) {
      folders[i].score = 1;
    }
    return folders;
  }

  // 计算每个文件夹的匹配分数
  var foldersWithScore = [];
  for (var j = 0; j < folders.length; j++) {
    var folder = folders[j];
    var score = this.calculateScore(folder.title, query);
    // 确保复制所有必要的属性
    var folderWithScore = {
      id: folder.id,
      title: folder.title,
      children: folder.children,
      bookmarkCount: folder.bookmarkCount,
      activity: folder.activity,
      score: score
    };

    // 添加所有文件夹，但按分数排序
    foldersWithScore.push(folderWithScore);
  }

  // 按分数降序排序
  foldersWithScore.sort(function (a, b) {
    return b.score - a.score;
  });

  return foldersWithScore;
};

/**
 * 搜索书签
 * @param {string} query - 搜索关键词
 * @param {Array} bookmarks - 待搜索书签列表
 * @returns {Array} 匹配的书签，按相关性排序
 */
SearchEngine.prototype.searchBookmarks = function (query, bookmarks) {
  if (!query || query.trim() === '') {
    // 如果没有搜索词或只有空格，返回所有书签
    for (var i = 0; i < bookmarks.length; i++) {
      bookmarks[i].score = 1;
    }
    return bookmarks;
  }

  // 计算每个书签的匹配分数
  var bookmarksWithScore = [];
  for (var j = 0; j < bookmarks.length; j++) {
    var bookmark = bookmarks[j];
    var score = this.calculateBookmarkScore(bookmark, query);
    // 确保复制所有必要的属性
    var bookmarkWithScore = {
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      parentId: bookmark.parentId,
      score: score
    };

    // 添加所有书签，但按分数排序
    bookmarksWithScore.push(bookmarkWithScore);
  }

  // 按分数降序排序
  bookmarksWithScore.sort(function (a, b) {
    return b.score - a.score;
  });

  return bookmarksWithScore;
};

/**
 * 计算匹配分数
 * @param {string} folderName - 文件夹名称
 * @param {string} query - 搜索关键词
 * @returns {number} 匹配分数 (0-1)
 */
SearchEngine.prototype.calculateScore = function (folderName, query) {
  // 使用全局帮助函数
  return window.SMART_BOOKMARK_HELPERS.calculateSearchScore(folderName, query);
};

/**
 * 计算书签匹配分数
 * @param {Object} bookmark - 书签对象
 * @param {string} query - 搜索关键词
 * @returns {number} 匹配分数 (0-1)
 */
SearchEngine.prototype.calculateBookmarkScore = function (bookmark, query) {
  if (!bookmark || !query) return 0;

  var title = bookmark.title ? bookmark.title.toLowerCase() : '';
  var url = bookmark.url ? bookmark.url.toLowerCase() : '';
  var searchTerm = query.toLowerCase().trim();

  // 如果搜索词为空，返回最高分数
  if (!searchTerm) return 1;

  // 计算标题匹配分数
  var titleScore = 0;
  if (title === searchTerm) {
    titleScore = 1; // 完全匹配
  } else if (title.indexOf(searchTerm) === 0) {
    titleScore = 0.8; // 前缀匹配
  } else if (title.indexOf(searchTerm) > -1) {
    titleScore = 0.5; // 包含匹配
  } else {
    // 模糊匹配：检查每个字符是否都包含在标题中
    var searchTermChars = searchTerm.split('');
    var allCharsFound = true;
    var lastIndex = -1;

    for (var i = 0; i < searchTermChars.length; i++) {
      var charIndex = title.indexOf(searchTermChars[i], lastIndex + 1);
      if (charIndex === -1) {
        allCharsFound = false;
        break;
      }
      lastIndex = charIndex;
    }

    if (allCharsFound && searchTerm.length > 0) {
      var ratio = searchTerm.length / title.length;
      titleScore = Math.max(0.1, ratio * 0.3);
    }
  }

  // 计算URL匹配分数
  var urlScore = 0;
  if (url.indexOf(searchTerm) > -1) {
    // URL匹配的权重较低
    urlScore = 0.3;
  }

  // 综合分数，标题匹配权重更高
  return Math.max(titleScore, urlScore * 0.5);
};

// 将类附加到全局window对象
window.SearchEngine = SearchEngine;