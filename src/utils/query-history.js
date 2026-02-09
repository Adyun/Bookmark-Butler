/**
 * 查询历史管理器 - 记录搜索词与书签的关联，用于优化搜索排序
 */
(function (window) {
    'use strict';

    var STORAGE_KEY = 'queryHistory';
    var MAX_DAYS_TO_KEEP = 90;  // 保留90天内的记录
    var MAX_BOOKMARKS_PER_QUERY = 20;  // 每个搜索词最多关联20个书签
    var inMemoryHistory = null;

    /**
     * 加载历史数据
     * @returns {Promise} 返回历史数据对象
     */
    function loadHistory() {
        return new Promise(function (resolve) {
            if (inMemoryHistory !== null) {
                resolve(inMemoryHistory);
                return;
            }

            chrome.storage.local.get([STORAGE_KEY], function (result) {
                inMemoryHistory = result[STORAGE_KEY] || {};
                resolve(inMemoryHistory);
            });
        });
    }

    /**
     * 保存历史数据
     * @returns {Promise}
     */
    function saveHistory() {
        return new Promise(function (resolve) {
            var data = {};
            data[STORAGE_KEY] = inMemoryHistory;
            chrome.storage.local.set(data, function () {
                resolve();
            });
        });
    }

    /**
     * 规范化搜索词（小写、去除多余空格）
     * @param {string} query - 搜索词
     * @returns {string} 规范化后的搜索词
     */
    function normalizeQuery(query) {
        if (!query) return '';
        return query.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    /**
     * 记录搜索词与书签的关联
     * @param {string} query - 搜索词
     * @param {string} bookmarkId - 书签ID
     * @returns {Promise}
     */
    function recordClick(query, bookmarkId) {
        var normalizedQuery = normalizeQuery(query);
        if (!normalizedQuery || !bookmarkId) {
            return Promise.resolve();
        }

        return loadHistory().then(function () {
            // 确保搜索词条目存在
            if (!inMemoryHistory[normalizedQuery]) {
                inMemoryHistory[normalizedQuery] = {};
            }

            var queryEntry = inMemoryHistory[normalizedQuery];
            var now = Date.now();

            // 更新或创建书签记录
            if (queryEntry[bookmarkId]) {
                queryEntry[bookmarkId].count += 1;
                queryEntry[bookmarkId].lastUsed = now;
            } else {
                queryEntry[bookmarkId] = {
                    count: 1,
                    lastUsed: now
                };
            }

            // 清理过期记录和限制数量
            cleanupQueryEntry(normalizedQuery);

            return saveHistory();
        });
    }

    /**
     * 清理单个搜索词的过期记录，并限制数量
     * @param {string} query - 搜索词
     */
    function cleanupQueryEntry(query) {
        var queryEntry = inMemoryHistory[query];
        if (!queryEntry) return;

        var now = Date.now();
        var maxAge = MAX_DAYS_TO_KEEP * 24 * 60 * 60 * 1000;

        // 删除过期记录
        for (var bookmarkId in queryEntry) {
            if (queryEntry.hasOwnProperty(bookmarkId)) {
                if (now - queryEntry[bookmarkId].lastUsed > maxAge) {
                    delete queryEntry[bookmarkId];
                }
            }
        }

        // 限制数量：保留最近使用的
        var entries = [];
        for (var id in queryEntry) {
            if (queryEntry.hasOwnProperty(id)) {
                entries.push({ id: id, data: queryEntry[id] });
            }
        }

        if (entries.length > MAX_BOOKMARKS_PER_QUERY) {
            // 按最后使用时间排序
            entries.sort(function (a, b) {
                return b.data.lastUsed - a.data.lastUsed;
            });

            // 只保留前N个
            inMemoryHistory[query] = {};
            for (var i = 0; i < MAX_BOOKMARKS_PER_QUERY; i++) {
                inMemoryHistory[query][entries[i].id] = entries[i].data;
            }
        }
    }

    /**
     * 计算历史加成分数
     * @param {string} query - 搜索词
     * @param {string} bookmarkId - 书签ID
     * @returns {Promise<number>} 加成分数 (0-1.0)
     */
    function getBoostScore(query, bookmarkId) {
        var normalizedQuery = normalizeQuery(query);
        if (!normalizedQuery || !bookmarkId) {
            return Promise.resolve(0);
        }

        return loadHistory().then(function () {
            var queryEntry = inMemoryHistory[normalizedQuery];
            if (!queryEntry || !queryEntry[bookmarkId]) {
                return 0;
            }

            var record = queryEntry[bookmarkId];
            var count = record.count;
            var daysSinceLastUse = (Date.now() - record.lastUsed) / (1000 * 60 * 60 * 24);

            // 点击次数加成（对数增长，权重提高）
            // 1次=0.15, 2次=0.23, 3次=0.30, 5次=0.35, 10次=0.52
            var countBoost = Math.log10(count + 1) * 0.5;

            // 时间衰减（越久远衰减越多）
            // 1天内=1.0, 7天=0.79, 30天=0.37, 90天=0.05
            var timeDecay = Math.exp(-daysSinceLastUse / 30);

            // 综合分数，最高1.0分（提高历史权重）
            return Math.min(countBoost * timeDecay, 1.0);
        });
    }

    /**
     * 批量获取历史加成分数（用于搜索结果排序）
     * @param {string} query - 搜索词
     * @param {Array<string>} bookmarkIds - 书签ID数组
     * @returns {Promise<Object>} 书签ID到加成分数的映射
     */
    function getBatchBoostScores(query, bookmarkIds) {
        var normalizedQuery = normalizeQuery(query);
        if (!normalizedQuery || !bookmarkIds || bookmarkIds.length === 0) {
            return Promise.resolve({});
        }

        return loadHistory().then(function () {
            var queryEntry = inMemoryHistory[normalizedQuery];
            var scores = {};

            if (!queryEntry) {
                return scores;
            }

            var now = Date.now();
            for (var i = 0; i < bookmarkIds.length; i++) {
                var bookmarkId = bookmarkIds[i];
                var record = queryEntry[bookmarkId];

                if (record) {
                    var count = record.count;
                    var daysSinceLastUse = (now - record.lastUsed) / (1000 * 60 * 60 * 24);
                    var countBoost = Math.log10(count + 1) * 0.5;
                    var timeDecay = Math.exp(-daysSinceLastUse / 30);
                    scores[bookmarkId] = Math.min(countBoost * timeDecay, 1.0);
                }
            }

            return scores;
        });
    }

    /**
     * 清除所有历史数据
     * @returns {Promise}
     */
    function clearHistory() {
        inMemoryHistory = {};
        return saveHistory();
    }

    /**
     * 获取统计信息（用于调试）
     * @returns {Promise<Object>}
     */
    function getStats() {
        return loadHistory().then(function () {
            var queryCount = Object.keys(inMemoryHistory).length;
            var totalRecords = 0;

            for (var query in inMemoryHistory) {
                if (inMemoryHistory.hasOwnProperty(query)) {
                    totalRecords += Object.keys(inMemoryHistory[query]).length;
                }
            }

            return {
                queryCount: queryCount,
                totalRecords: totalRecords,
                estimatedSize: JSON.stringify(inMemoryHistory).length
            };
        });
    }

    // 导出到全局
    window.SMART_BOOKMARK_QUERY_HISTORY = {
        recordClick: recordClick,
        getBoostScore: getBoostScore,
        getBatchBoostScores: getBatchBoostScores,
        clearHistory: clearHistory,
        getStats: getStats
    };

})(window);
