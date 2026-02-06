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

    // 完全匹配
    if (name === searchTerm) return 1;

    // 前缀匹配
    if (name.indexOf(searchTerm) === 0) return 0.8;

    // 包含匹配
    if (name.indexOf(searchTerm) > -1) return 0.5;

    // 模糊匹配：检查每个字符是否都包含在文件夹名称中
    var searchTermChars = searchTerm.split('');
    var allCharsFound = true;
    var lastIndex = -1;

    for (var i = 0; i < searchTermChars.length; i++) {
      var charIndex = name.indexOf(searchTermChars[i], lastIndex + 1);
      if (charIndex === -1) {
        allCharsFound = false;
        break;
      }
      lastIndex = charIndex;
    }

    if (allCharsFound && searchTerm.length > 0) {
      // 模糊匹配评分：根据搜索词和文件夹名的长度比例计算
      var ratio = searchTerm.length / name.length;
      return Math.max(0.15, ratio * 0.4);
    }

    // 对于中文搜索，如果搜索词较长但完全没有匹配，不应该返回分数
    // 移除之前的 hasAnyChar 宽松匹配，避免单字符误匹配

    return 0;
  };

  window.SMART_BOOKMARK_HELPERS = {
    showToast: showToast,
    debounce: debounce,
    extractFolders: extractFolders,
    calculateSearchScore: calculateSearchScore
  };

})(window, document);