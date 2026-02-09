(function (window, document) {
  'use strict';

  var showToast = function (message, isError) {
    isError = isError || false;
    // 优先从 Shadow Root 中查找 toast 元素
    var root = window.smartBookmarkShadowRoot || document;
    var toast = root.getElementById('smart-bookmark-toast');
    if (toast) {
      toast.textContent = message;
      toast.className += ' show';

      setTimeout(function () {
        toast.className = toast.className.replace(' show', '');
      }, 3000);
    }
  };

  var debounce = function (func, delay) {
    var timeoutId;
    return function () {
      var args = arguments;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(function () {
        func.apply(this, args);
      }, delay);
    };
  };

  var extractFolders = function (bookmarkTree) {
    var folders = [];

    var traverse = function (node) {
      if (node && !node.url) {
        folders.push({
          id: node.id,
          title: node.title,
          children: node.children || [],
          bookmarkCount: (node.children || []).filter(function (child) {
            return child.url;
          }).length
        });
      }

      if (node.children) {
        node.children.forEach(function (child) {
          traverse(child);
        });
      }
    };

    traverse(bookmarkTree);
    return folders;
  };

  var calculateSearchScore = function (folderName, query) {
    if (!folderName || !query) return 0;

    var name = folderName.toLowerCase();
    var searchTerm = query.toLowerCase().trim();

    // 如果搜索词为空，返回最高分数
    if (!searchTerm) return 1;

    // 支持多关键词搜索：按空格拆分
    var keywords = searchTerm.split(/\s+/).filter(function (k) { return k.length > 0; });

    // 如果没有有效关键词，返回最高分数
    if (keywords.length === 0) return 1;

    // 计算每个关键词的分数
    var scores = [];
    for (var i = 0; i < keywords.length; i++) {
      var keyword = keywords[i];
      var score = calculateSingleKeywordScore(name, keyword);

      // 如果任意一个关键词完全不匹配，返回0
      if (score === 0) return 0;

      scores.push(score);
    }

    // 返回所有关键词分数的平均值
    var total = 0;
    for (var j = 0; j < scores.length; j++) {
      total += scores[j];
    }
    return total / scores.length;
  };

  // 计算单个关键词的匹配分数
  var calculateSingleKeywordScore = function (name, keyword) {
    // 完全匹配
    if (name === keyword) return 1;

    // 前缀匹配
    if (name.indexOf(keyword) === 0) return 0.8;

    // 包含匹配
    if (name.indexOf(keyword) > -1) return 0.5;

    // 不再使用模糊匹配（逐字符匹配），因为太容易误匹配
    // 没有匹配返回0
    return 0;
  };

  window.SMART_BOOKMARK_HELPERS = {
    showToast: showToast,
    debounce: debounce,
    extractFolders: extractFolders,
    calculateSearchScore: calculateSearchScore
  };

})(window, document);