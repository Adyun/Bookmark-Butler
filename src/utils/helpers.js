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
      // 更宽松的评分：让更多弱匹配被包含，参考书签模式
      var ratio = searchTerm.length / name.length;
      return Math.max(0.15, ratio * 0.4); // 提高最低分和比例系数
    }

    // 额外的宽松匹配：如果包含任意字符，给予很低但非零的分数
    var hasAnyChar = false;
    for (var j = 0; j < searchTermChars.length; j++) {
      if (name.indexOf(searchTermChars[j]) > -1) {
        hasAnyChar = true;
        break;
      }
    }

    if (hasAnyChar && searchTerm.length > 0) {
      return 0.05; // 很低的分数，但足以被包含
    }

    return 0;
  };

  window.SMART_BOOKMARK_HELPERS = {
    showToast: showToast,
    debounce: debounce,
    extractFolders: extractFolders,
    calculateSearchScore: calculateSearchScore
  };

})(window, document);