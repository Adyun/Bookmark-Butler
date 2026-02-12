(function (window, document) {
  'use strict';

  var showToast = function (message, isError) {
    isError = isError || false;

    // 移除已有的 toast（避免重叠）
    var existing = document.getElementById('smart-bookmark-global-toast');
    if (existing) {
      existing.remove();
    }

    // 在 document.body 上创建独立 toast，脱离 Shadow DOM
    var toast = document.createElement('div');
    toast.id = 'smart-bookmark-global-toast';
    toast.textContent = message;
    var bg = isError
      ? 'background:linear-gradient(135deg,#ef4444,#dc2626);'
      : 'background:linear-gradient(135deg,#22c55e,#16a34a);';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-80px);' +
      bg + 'color:#fff;padding:10px 20px;border-radius:50px;' +
      'z-index:2147483647;font-size:14px;font-weight:500;font-family:system-ui,-apple-system,sans-serif;' +
      'box-shadow:0 8px 24px rgba(0,0,0,0.15);transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);' +
      'pointer-events:none;backdrop-filter:blur(8px);';
    document.body.appendChild(toast);

    // 触发重排后启动弹入动画
    toast.offsetHeight;
    toast.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(function () {
      toast.style.transform = 'translateX(-50%) translateY(-80px)';
      setTimeout(function () {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, 3000);
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
          }).length,
          subFolderCount: (node.children || []).filter(function (child) {
            return !child.url && child.id;
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

  var normalizeUrl = function (url) {
    if (!url) return '';
    try {
      var urlObj = new URL(url);
      var hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
      var port = urlObj.port;
      if (port) {
        var isDefaultHttpPort = urlObj.protocol === 'http:' && port === '80';
        var isDefaultHttpsPort = urlObj.protocol === 'https:' && port === '443';
        if (!isDefaultHttpPort && !isDefaultHttpsPort) {
          hostname += ':' + port;
        }
      }
      var pathname = urlObj.pathname.replace(/\/+$/, '') || '';
      return hostname + pathname;
    } catch (e) {
      return url.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/[?#].*$/, '')
        .replace(/\/+$/, '');
    }
  };

  window.SMART_BOOKMARK_HELPERS = {
    showToast: showToast,
    debounce: debounce,
    extractFolders: extractFolders,
    calculateSearchScore: calculateSearchScore,
    normalizeUrl: normalizeUrl
  };

})(window, document);
