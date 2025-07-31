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
 * 计算匹配分数
 * @param {string} folderName - 文件夹名称
 * @param {string} query - 搜索关键词
 * @returns {number} 匹配分数 (0-1)
 */
SearchEngine.prototype.calculateScore = function (folderName, query) {
  // 使用全局帮助函数
  return window.SMART_BOOKMARK_HELPERS.calculateSearchScore(folderName, query);
};

// 将类附加到全局window对象
window.SearchEngine = SearchEngine;