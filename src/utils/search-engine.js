// Search engine for the Smart Bookmark Extension

/**
 * 搜索索引类 - 用于优化搜索性能
 */
function SearchIndex() {
  this.titleIndex = new Map(); // 标题倒排索引
  this.urlIndex = new Map();    // URL倒排索引
  this.trieIndex = null;        // Trie索引，用于前缀搜索
  this.built = false;           // 索引是否已构建
}

/**
 * 构建搜索索引
 * @param {Array} items - 要索引的项目（文件夹或书签）
 * @param {string} type - 项目类型 ('folders' 或 'bookmarks')
 */
SearchIndex.prototype.buildIndex = function (items, type) {
  // 清空现有索引
  this.titleIndex.clear();
  this.urlIndex.clear();
  this.trieIndex = new Trie();

  // 构建倒排索引
  for (var i = 0; i < items.length; i++) {
    var item = items[i];

    if (type === 'folders') {
      this.indexFolder(item);
    } else if (type === 'bookmarks') {
      this.indexBookmark(item);
    }
  }

  this.built = true;
  // console.log('Search index built for ' + items.length + ' ' + type);
};

/**
 * 索引文件夹
 * @param {Object} folder - 文件夹对象
 */
SearchIndex.prototype.indexFolder = function (folder) {
  if (!folder || !folder.title) return;

  var title = folder.title.toLowerCase();
  var words = this.tokenize(title);

  // 为每个词建立索引
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (!this.titleIndex.has(word)) {
      this.titleIndex.set(word, []);
    }
    this.titleIndex.get(word).push(folder);
  }

  // 添加到Trie索引用于前缀搜索
  this.trieIndex.insert(title, folder);

  // 索引标签
  if (folder.tags && Array.isArray(folder.tags)) {
    for (var t = 0; t < folder.tags.length; t++) {
      var tagText = folder.tags[t].toLowerCase();
      var tagWords = this.tokenize(tagText);
      for (var tw = 0; tw < tagWords.length; tw++) {
        if (!this.titleIndex.has(tagWords[tw])) {
          this.titleIndex.set(tagWords[tw], []);
        }
        this.titleIndex.get(tagWords[tw]).push(folder);
      }
      this.trieIndex.insert(tagText, folder);
    }
  }
};

/**
 * 索引书签
 * @param {Object} bookmark - 书签对象
 */
SearchIndex.prototype.indexBookmark = function (bookmark) {
  if (!bookmark || (!bookmark.title && !bookmark.url)) return;

  // 索引标题
  if (bookmark.title) {
    var title = bookmark.title.toLowerCase();
    var titleWords = this.tokenize(title);

    for (var i = 0; i < titleWords.length; i++) {
      var word = titleWords[i];
      if (!this.titleIndex.has(word)) {
        this.titleIndex.set(word, []);
      }
      this.titleIndex.get(word).push(bookmark);
    }

    // 添加到Trie索引
    this.trieIndex.insert(title, bookmark);
  }

  // 索引URL
  if (bookmark.url) {
    var url = bookmark.url.toLowerCase();
    var urlWords = this.tokenize(url);

    for (var i = 0; i < urlWords.length; i++) {
      var word = urlWords[i];
      if (!this.urlIndex.has(word)) {
        this.urlIndex.set(word, []);
      }
      this.urlIndex.get(word).push(bookmark);
    }
  }

  // 索引标签
  if (bookmark.tags && Array.isArray(bookmark.tags)) {
    for (var t = 0; t < bookmark.tags.length; t++) {
      var tagText = bookmark.tags[t].toLowerCase();
      var tagWords = this.tokenize(tagText);
      for (var tw = 0; tw < tagWords.length; tw++) {
        if (!this.titleIndex.has(tagWords[tw])) {
          this.titleIndex.set(tagWords[tw], []);
        }
        this.titleIndex.get(tagWords[tw]).push(bookmark);
      }
      this.trieIndex.insert(tagText, bookmark);
    }
  }
};

/**
 * 分词处理
 * @param {string} text - 要分词的文本
 * @returns {Array} 分词结果
 */
SearchIndex.prototype.tokenize = function (text) {
  var words = [];
  var addedWords = {}; // 用于去重

  // 按空格和标点符号分割
  var basicWords = text.split(/[\s\-_\.\/:]+/).filter(function (word) {
    return word.length > 0;
  });

  // 添加词到结果中（去重）
  var addWord = function (word) {
    if (!addedWords[word] && word.length > 0) {
      words.push(word);
      addedWords[word] = true;
    }
  };

  // 对每个基础词进行进一步处理
  for (var i = 0; i < basicWords.length; i++) {
    var word = basicWords[i];
    addWord(word); // 保留原始词

    // 对于长度大于1的词，生成有意义的子字符串（用于中文支持）
    if (word.length > 1) {
      // 对于较短的词（长度<=6），生成所有子字符串
      if (word.length <= 6) {
        // 生成长度为1到word.length-1的子字符串
        for (var len = 1; len < word.length; len++) {
          for (var start = 0; start <= word.length - len; start++) {
            var substring = word.substring(start, start + len);
            addWord(substring);
          }
        }
      } else {
        // 对于较长的词，只生成前缀、后缀和一些有意义的子字符串

        // 生成前缀（长度2-4）
        for (var prefixLen = 2; prefixLen <= Math.min(4, word.length); prefixLen++) {
          addWord(word.substring(0, prefixLen));
        }

        // 生成后缀（长度2-4）
        for (var suffixLen = 2; suffixLen <= Math.min(4, word.length); suffixLen++) {
          addWord(word.substring(word.length - suffixLen));
        }

        // 生成中间的子字符串（长度2-3）
        for (var midLen = 2; midLen <= 3 && midLen < word.length; midLen++) {
          for (var midStart = 1; midStart <= word.length - midLen - 1; midStart++) {
            addWord(word.substring(midStart, midStart + midLen));
          }
        }

        // 生成单字符
        for (var j = 0; j < word.length; j++) {
          addWord(word.charAt(j));
        }
      }
    }
  }

  return words;
};

/**
 * 使用索引搜索
 * @param {string} query - 搜索查询
 * @param {string} type - 搜索类型 ('folders' 或 'bookmarks')
 * @returns {Array} 搜索结果
 */
SearchIndex.prototype.search = function (query, type) {
  if (!this.built || !query) return [];

  var queryLower = query.toLowerCase();
  var results = new Map(); // 使用Map去重

  // 1. 使用Trie索引进行前缀搜索
  var prefixResults = this.trieIndex.searchPrefix(queryLower);
  for (var i = 0; i < prefixResults.length; i++) {
    var item = prefixResults[i];
    results.set(item.id, item);
  }

  // 2. 使用倒排索引进行词搜索
  var queryWords = this.tokenize(queryLower);
  for (var j = 0; j < queryWords.length; j++) {
    var word = queryWords[j];

    // 搜索标题索引
    var titleMatches = this.titleIndex.get(word);
    if (titleMatches) {
      for (var k = 0; k < titleMatches.length; k++) {
        var item = titleMatches[k];
        results.set(item.id, item);
      }
    }

    // 如果是书签搜索，也搜索URL索引
    if (type === 'bookmarks') {
      var urlMatches = this.urlIndex.get(word);
      if (urlMatches) {
        for (var l = 0; l < urlMatches.length; l++) {
          var item = urlMatches[l];
          results.set(item.id, item);
        }
      }
    }
  }

  // 转换为数组并计算分数
  var finalResults = Array.from(results.values());
  var filteredResults = [];

  for (var m = 0; m < finalResults.length; m++) {
    finalResults[m].score = this.calculateScore(finalResults[m], query);
    // 只包含有匹配分数的项目
    if (finalResults[m].score > 0) {
      filteredResults.push(finalResults[m]);
    }
  }

  // 按分数排序
  filteredResults.sort(function (a, b) {
    return b.score - a.score;
  });

  return filteredResults;
};

/**
 * 计算搜索分数
 * @param {Object} item - 搜索结果项
 * @param {string} query - 搜索查询
 * @returns {number} 分数
 */
SearchIndex.prototype.calculateScore = function (item, query) {
  var queryLower = query.toLowerCase();
  var score = 0;

  // 标题匹配
  if (item.title) {
    var title = item.title.toLowerCase();
    if (title === queryLower) {
      score += 1.0; // 完全匹配
    } else if (title.indexOf(queryLower) === 0) {
      score += 0.8; // 前缀匹配
    } else if (title.indexOf(queryLower) > -1) {
      score += 0.5; // 包含匹配
    }
  }

  // 标签匹配
  if (item.tags && Array.isArray(item.tags)) {
    var tagScore = 0;
    for (var t = 0; t < item.tags.length; t++) {
      var tag = item.tags[t].toLowerCase();
      if (tag === queryLower) {
        tagScore = Math.max(tagScore, 0.7);
      } else if (tag.indexOf(queryLower) === 0) {
        tagScore = Math.max(tagScore, 0.55);
      } else if (tag.indexOf(queryLower) > -1) {
        tagScore = Math.max(tagScore, 0.4);
      }
    }
    score = Math.max(score, tagScore);
  }

  // URL匹配（仅书签）
  if (item.url && queryLower.length > 2) {
    var url = item.url.toLowerCase();
    if (url.indexOf(queryLower) > -1) {
      score += 0.3; // URL匹配权重较低
    }
  }

  return Math.min(score, 1.0);
};

/**
 * Trie树实现 - 用于高效的前缀搜索
 */
function Trie() {
  this.root = {};
  this.END_SYMBOL = '$';
}

/**
 * 向Trie中插入单词
 * @param {string} word - 要插入的单词
 * @param {Object} data - 关联的数据
 */
Trie.prototype.insert = function (word, data) {
  var node = this.root;

  for (var i = 0; i < word.length; i++) {
    var char = word[i];
    if (!node[char]) {
      node[char] = {};
    }
    node = node[char];
  }

  // 在单词结尾存储数据
  if (!node[this.END_SYMBOL]) {
    node[this.END_SYMBOL] = [];
  }
  node[this.END_SYMBOL].push(data);
};

/**
 * 搜索前缀
 * @param {string} prefix - 前缀
 * @returns {Array} 匹配的数据数组
 */
Trie.prototype.searchPrefix = function (prefix) {
  var node = this.root;
  var results = [];

  // 遍历到前缀的最后一个字符
  for (var i = 0; i < prefix.length; i++) {
    var char = prefix[i];
    if (!node[char]) {
      return results; // 没有匹配的前缀
    }
    node = node[char];
  }

  // 收集所有以该前缀开头的单词的数据
  this.collectAllData(node, results);

  return results;
};

/**
 * 收集节点下的所有数据
 * @param {Object} node - 当前节点
 * @param {Array} results - 结果数组
 */
Trie.prototype.collectAllData = function (node, results) {
  // 检查当前节点是否有结束符号
  if (node[this.END_SYMBOL]) {
    results.push.apply(results, node[this.END_SYMBOL]);
  }

  // 递归收集子节点的数据
  for (var key in node) {
    if (key !== this.END_SYMBOL) {
      this.collectAllData(node[key], results);
    }
  }
};

/**
 * 搜索引擎类
 */
function SearchEngine() {
  this.folderIndex = new SearchIndex();
  this.bookmarkIndex = new SearchIndex();
  this.indexBuilt = false;
}

/**
 * 搜索文件夹
 * @param {string} query - 搜索关键词
 * @param {Array} folders - 待搜索文件夹列表
 * @returns {Array} 匹配的文件夹，按相关性排序
 */
/**
 * 构建搜索索引
 * @param {Array} folders - 文件夹数组
 * @param {Array} bookmarks - 书签数组
 */
SearchEngine.prototype.buildIndexes = function (folders, bookmarks) {
  this.folderIndex.buildIndex(folders, 'folders');
  this.bookmarkIndex.buildIndex(bookmarks, 'bookmarks');
  this.indexBuilt = true;
};

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

  var indexedResults = [];
  var fallbackResults = [];

  // 如果索引已构建，使用索引搜索
  if (this.indexBuilt) {
    indexedResults = this.folderIndex.search(query, 'folders');
  }

  // 总是执行回退搜索以确保完整性，特别是对中文搜索
  fallbackResults = this.fallbackSearch(query, folders, 'folders');

  // 合并结果并去重
  var combinedResults = this.combineSearchResults(indexedResults, fallbackResults);

  return combinedResults;
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

  var indexedResults = [];
  var fallbackResults = [];

  // 如果索引已构建，使用索引搜索
  if (this.indexBuilt) {
    indexedResults = this.bookmarkIndex.search(query, 'bookmarks');
  }

  // 总是执行回退搜索以确保完整性，特别是对中文搜索
  fallbackResults = this.fallbackSearch(query, bookmarks, 'bookmarks');

  // 合并结果并去重
  var combinedResults = this.combineSearchResults(indexedResults, fallbackResults);

  return combinedResults;
};

/**
 * 回退搜索方法（原始搜索算法）
 * @param {string} query - 搜索关键词
 * @param {Array} items - 待搜索项目列表
 * @param {string} type - 项目类型 ('folders' 或 'bookmarks')
 * @returns {Array} 匹配的项目，按相关性排序
 */
SearchEngine.prototype.fallbackSearch = function (query, items, type) {
  var itemsWithScore = [];

  for (var j = 0; j < items.length; j++) {
    var item = items[j];
    var score;

    if (type === 'folders') {
      score = this.calculateFolderScore(item, query);
    } else {
      score = this.calculateBookmarkScore(item, query);
    }

    // 确保复制所有必要的属性
    var itemWithScore = {
      id: item.id,
      title: item.title,
      score: score,
      tags: item.tags || []
    };

    if (type === 'folders') {
      itemWithScore.children = item.children;
      itemWithScore.bookmarkCount = item.bookmarkCount;
      itemWithScore.subFolderCount = item.subFolderCount;
      itemWithScore.activity = item.activity;
    } else {
      itemWithScore.url = item.url;
      itemWithScore.parentId = item.parentId;
    }

    // 只添加有匹配分数的项目（分数大于0）
    if (score > 0) {
      itemsWithScore.push(itemWithScore);
    }
  }

  // 按分数降序排序
  itemsWithScore.sort(function (a, b) {
    return b.score - a.score;
  });

  return itemsWithScore;
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
 * 计算文件夹匹配分数（标题 + 标签）
 * @param {Object} folder - 文件夹对象
 * @param {string} query - 搜索关键词
 * @returns {number} 匹配分数 (0-1)
 */
SearchEngine.prototype.calculateFolderScore = function (folder, query) {
  var titleScore = this.calculateScore(folder.title, query);
  var tagScore = 0;
  if (folder.tags && Array.isArray(folder.tags)) {
    var searchTerm = query.toLowerCase().trim();
    for (var t = 0; t < folder.tags.length; t++) {
      var tag = folder.tags[t].toLowerCase();
      if (tag === searchTerm) {
        tagScore = Math.max(tagScore, 0.7);
      } else if (tag.indexOf(searchTerm) === 0) {
        tagScore = Math.max(tagScore, 0.55);
      } else if (tag.indexOf(searchTerm) > -1) {
        tagScore = Math.max(tagScore, 0.4);
      }
    }
  }
  return Math.max(titleScore, tagScore);
};

/**
 * 合并搜索结果并去重
 * @param {Array} indexedResults - 索引搜索结果
 * @param {Array} fallbackResults - 回退搜索结果
 * @returns {Array} 合并后的搜索结果
 */
SearchEngine.prototype.combineSearchResults = function (indexedResults, fallbackResults) {
  var resultsMap = new Map();
  var results = [];

  // 添加索引搜索结果（优先级更高）
  for (var i = 0; i < indexedResults.length; i++) {
    var item = indexedResults[i];
    if (item.id) {
      resultsMap.set(item.id, item);
    }
  }

  // 添加回退搜索结果，但只添加不重复的项目
  for (var j = 0; j < fallbackResults.length; j++) {
    var item = fallbackResults[j];
    if (item.id && !resultsMap.has(item.id)) {
      resultsMap.set(item.id, item);
    } else if (item.id && resultsMap.has(item.id)) {
      // 如果项目已存在，选择分数更高的
      var existingItem = resultsMap.get(item.id);
      if (item.score > existingItem.score) {
        resultsMap.set(item.id, item);
      }
    }
  }

  // 转换为数组并按分数排序
  results = Array.from(resultsMap.values());
  results.sort(function (a, b) {
    return b.score - a.score;
  });

  return results;
};

/**
 * 清除索引
 */
SearchEngine.prototype.clearIndexes = function () {
  this.folderIndex = new SearchIndex();
  this.bookmarkIndex = new SearchIndex();
  this.indexBuilt = false;
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

  // 支持多关键词搜索：按空格拆分
  var keywords = searchTerm.split(/\s+/).filter(function (k) { return k.length > 0; });

  // 如果没有有效关键词，返回最高分数
  if (keywords.length === 0) return 1;

  // 计算每个关键词的分数
  var scores = [];
  for (var i = 0; i < keywords.length; i++) {
    var keyword = keywords[i];
    var tags = bookmark.tags || [];
    var score = this.calculateSingleKeywordBookmarkScore(title, url, tags, keyword);

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

/**
 * 计算单个关键词的书签匹配分数
 * @param {string} title - 书签标题（小写）
 * @param {string} url - 书签URL（小写）
 * @param {string} keyword - 单个关键词（小写）
 * @returns {number} 匹配分数 (0-1)
 */
SearchEngine.prototype.calculateSingleKeywordBookmarkScore = function (title, url, tags, keyword) {
  // 计算标题匹配分数
  var titleScore = 0;
  if (title === keyword) {
    titleScore = 1; // 完全匹配
  } else if (title.indexOf(keyword) === 0) {
    titleScore = 0.8; // 前缀匹配
  } else if (title.indexOf(keyword) > -1) {
    titleScore = 0.5; // 包含匹配
  }

  // 计算标签匹配分数
  var tagScore = 0;
  if (tags && Array.isArray(tags)) {
    for (var t = 0; t < tags.length; t++) {
      var tag = tags[t].toLowerCase();
      if (tag === keyword) {
        tagScore = Math.max(tagScore, 0.7);
      } else if (tag.indexOf(keyword) === 0) {
        tagScore = Math.max(tagScore, 0.55);
      } else if (tag.indexOf(keyword) > -1) {
        tagScore = Math.max(tagScore, 0.4);
      }
    }
  }

  // 计算URL匹配分数
  var urlScore = 0;
  if (url.indexOf(keyword) > -1) {
    urlScore = 0.3;
  }

  // 综合分数：标题 > 标签 > URL
  return Math.max(titleScore, tagScore, urlScore * 0.5);
};

/**
 * 同时搜索书签和文件夹
 * @param {string} query - 搜索词
 * @param {Array} bookmarks - 所有书签
 * @param {Array} folders - 所有文件夹
 * @returns {Array} 混合结果，每项带有 itemType 属性
 */
SearchEngine.prototype.searchAll = function (query, bookmarks, folders) {
  var bookmarkResults = this.searchBookmarks(query, bookmarks);
  var folderResults = this.search(query, folders);

  // 标记类型
  var taggedBookmarks = [];
  for (var i = 0; i < bookmarkResults.length; i++) {
    var b = bookmarkResults[i];
    taggedBookmarks.push({
      id: b.id,
      title: b.title,
      url: b.url,
      parentId: b.parentId,
      score: b.score,
      tags: b.tags || [],
      itemType: 'bookmark'
    });
  }

  var taggedFolders = [];
  for (var j = 0; j < folderResults.length; j++) {
    var f = folderResults[j];
    taggedFolders.push({
      id: f.id,
      title: f.title,
      parentId: f.parentId,
      bookmarkCount: f.bookmarkCount,
      subFolderCount: f.subFolderCount,
      score: f.score,
      tags: f.tags || [],
      itemType: 'folder'
    });
  }

  // 合并结果：文件夹在前，书签在后，各自按分数排序
  var combined = taggedFolders.concat(taggedBookmarks);

  return combined;
};

// 将类附加到全局window对象
window.SearchEngine = SearchEngine;