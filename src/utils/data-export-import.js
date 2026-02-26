// Data Export/Import Manager for Smart Bookmark Extension
// 负责用户数据的导出与导入（标签、置顶、搜索历史）

(function () {
    'use strict';

    // 导出格式版本号
    var FORMAT_VERSION = 1;

    // 需要导出/导入的 chrome.storage.local key 列表
    var EXPORT_KEYS = [
        'smart_bookmark_tags_v1',
        'smart_bookmark_tag_filter_stats_v1',
        'smart_bookmark_pins_v1',
        'queryHistory'
    ];

    /**
     * 获取当前日期的 YYYY-MM-DD 格式字符串
     * @returns {string}
     */
    function getDateString() {
        var d = new Date();
        var year = d.getFullYear();
        var month = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        return year + '-' + month + '-' + day;
    }

    /**
     * 导出数据
     * @returns {Promise<{success: boolean, message: string}>}
     */
    function exportData() {
        return new Promise(function (resolve) {
            try {
                if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                    resolve({ success: false, message: 'Chrome storage API not available' });
                    return;
                }

                chrome.storage.local.get(EXPORT_KEYS, function (result) {
                    try {
                        var exportObj = {
                            version: FORMAT_VERSION,
                            extensionVersion: chrome.runtime.getManifest
                                ? chrome.runtime.getManifest().version
                                : '1.0.0',
                            exportedAt: new Date().toISOString(),
                            data: {
                                tags: result['smart_bookmark_tags_v1'] || null,
                                tagFilterStats: result['smart_bookmark_tag_filter_stats_v1'] || null,
                                pins: result['smart_bookmark_pins_v1'] || null,
                                queryHistory: result['queryHistory'] || null
                            }
                        };

                        var jsonStr = JSON.stringify(exportObj, null, 2);
                        var blob = new Blob([jsonStr], { type: 'application/json' });
                        var url = URL.createObjectURL(blob);

                        var a = document.createElement('a');
                        a.href = url;
                        a.download = 'smart-bookmark-backup-' + getDateString() + '.json';
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();

                        // 清理
                        setTimeout(function () {
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }, 100);

                        // 计算统计信息
                        var stats = buildStats(exportObj.data);
                        resolve({
                            success: true,
                            message: stats
                        });
                    } catch (e) {
                        resolve({ success: false, message: 'Export failed: ' + e.message });
                    }
                });
            } catch (e) {
                resolve({ success: false, message: 'Export failed: ' + e.message });
            }
        });
    }

    /**
     * 校验并清理标签表：确保每个条目的值是数组
     * @param {Object} table - { id: [...tags] }
     * @returns {Object} 清理后的表
     */
    function sanitizeTagTable(table) {
        if (!table || typeof table !== 'object') return {};
        var clean = {};
        var keys = Object.keys(table);
        for (var i = 0; i < keys.length; i++) {
            var val = table[keys[i]];
            if (Array.isArray(val)) {
                clean[keys[i]] = val;
            }
            // 非数组的条目直接丢弃
        }
        return clean;
    }

    /**
     * 校验并清理置顶表：确保每个条目的值是数字（时间戳）
     * @param {Object} table - { id: timestamp }
     * @returns {Object} 清理后的表
     */
    function sanitizePinTable(table) {
        if (!table || typeof table !== 'object') return {};
        var clean = {};
        var keys = Object.keys(table);
        for (var i = 0; i < keys.length; i++) {
            var val = table[keys[i]];
            if (typeof val === 'number' && val > 0) {
                clean[keys[i]] = val;
            }
            // 非法值丢弃
        }
        return clean;
    }

    /**
     * 从 JSON 字符串导入数据（真正的覆盖模式：先清除再写入）
     * @param {string} jsonString - 导出的 JSON 字符串
     * @returns {Promise<{success: boolean, message: string}>}
     */
    function importData(jsonString) {
        return new Promise(function (resolve) {
            try {
                if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                    resolve({ success: false, message: 'Chrome storage API not available' });
                    return;
                }

                var parsed;
                try {
                    parsed = JSON.parse(jsonString);
                } catch (e) {
                    resolve({ success: false, message: 'JSON parse error' });
                    return;
                }

                // 校验格式
                if (!parsed || typeof parsed !== 'object' || !parsed.version || !parsed.data) {
                    resolve({ success: false, message: 'Invalid backup format' });
                    return;
                }

                if (parsed.version > FORMAT_VERSION) {
                    resolve({ success: false, message: 'Unsupported version: ' + parsed.version });
                    return;
                }

                var data = parsed.data;

                // 真正的覆盖模式：为所有导出 key 构建写入数据
                // 备份文件中缺失/null 的字段 → 写入空值清除旧数据
                var writeData = {};

                // 标签数据：深度校验每个条目是否为数组
                if (data.tags && typeof data.tags === 'object') {
                    writeData['smart_bookmark_tags_v1'] = {
                        bookmarks: sanitizeTagTable(data.tags.bookmarks),
                        folders: sanitizeTagTable(data.tags.folders)
                    };
                } else {
                    // 备份中无标签 → 清空本地标签
                    writeData['smart_bookmark_tags_v1'] = { bookmarks: {}, folders: {} };
                }

                // 标签筛选统计
                if (data.tagFilterStats && typeof data.tagFilterStats === 'object') {
                    writeData['smart_bookmark_tag_filter_stats_v1'] = data.tagFilterStats;
                } else {
                    writeData['smart_bookmark_tag_filter_stats_v1'] = {};
                }

                // 置顶数据：深度校验每个条目是否为数字
                if (data.pins && typeof data.pins === 'object') {
                    writeData['smart_bookmark_pins_v1'] = {
                        bookmarks: sanitizePinTable(data.pins.bookmarks),
                        folders: sanitizePinTable(data.pins.folders)
                    };
                } else {
                    writeData['smart_bookmark_pins_v1'] = { bookmarks: {}, folders: {} };
                }

                // 搜索历史
                if (data.queryHistory && typeof data.queryHistory === 'object') {
                    writeData['queryHistory'] = data.queryHistory;
                } else {
                    writeData['queryHistory'] = {};
                }

                // 覆盖写入（所有 key 都被赋值，确保旧数据不残留）
                chrome.storage.local.set(writeData, function () {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, message: 'Storage write error: ' + chrome.runtime.lastError.message });
                        return;
                    }

                    // 刷新内存中所有缓存（含 queryHistory）
                    refreshInMemoryData().then(function () {
                        var stats = buildStats(data);
                        resolve({
                            success: true,
                            message: stats
                        });
                    });
                });
            } catch (e) {
                resolve({ success: false, message: 'Import failed: ' + e.message });
            }
        });
    }

    /**
     * 打开文件选择器并导入
     * @returns {Promise<{success: boolean, message: string}>}
     */
    function pickFileAndImport() {
        return new Promise(function (resolve) {
            var resolved = false;
            var changeTriggered = false; // change 事件已触发（文件已选中、正在读取）

            function safeResolve(result) {
                if (resolved) return;
                resolved = true;
                resolve(result);
            }

            try {
                var input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.style.display = 'none';

                // 清理 input 元素
                function cleanupInput() {
                    try {
                        if (input.parentNode) {
                            input.parentNode.removeChild(input);
                        }
                    } catch (e) { }
                }

                input.addEventListener('change', function (e) {
                    changeTriggered = true; // 立即标记：用户已选择文件

                    var file = e.target.files && e.target.files[0];
                    if (!file) {
                        cleanupInput();
                        safeResolve({ success: false, message: 'No file selected' });
                        return;
                    }

                    var reader = new FileReader();
                    reader.onload = function (event) {
                        cleanupInput();
                        importData(event.target.result).then(safeResolve);
                    };
                    reader.onerror = function () {
                        cleanupInput();
                        safeResolve({ success: false, message: 'File read error' });
                    };
                    reader.readAsText(file);
                });

                document.body.appendChild(input);
                input.click();

                // 处理用户取消选择：监听 focus 回到 window
                // 浏览器在文件选择器关闭后会将焦点返回到 window
                function onWindowFocus() {
                    // 延迟检查，给 change 事件留出触发时间
                    setTimeout(function () {
                        // 只有 change 事件从未触发过才认为是"取消"
                        if (!changeTriggered && !resolved) {
                            cleanupInput();
                            safeResolve({ success: false, message: 'Cancelled' });
                        }
                    }, 500);
                    window.removeEventListener('focus', onWindowFocus);
                }
                window.addEventListener('focus', onWindowFocus);
            } catch (e) {
                safeResolve({ success: false, message: 'File picker error: ' + e.message });
            }
        });
    }

    /**
     * 刷新内存中的标签、置顶和搜索历史数据
     * @returns {Promise}
     */
    function refreshInMemoryData() {
        var promises = [];

        // 重新加载标签
        if (window.SMART_BOOKMARK_TAGS && typeof window.SMART_BOOKMARK_TAGS.loadTags === 'function') {
            promises.push(window.SMART_BOOKMARK_TAGS.loadTags());
        }

        // 重新加载置顶
        if (window.SMART_BOOKMARK_PINS && typeof window.SMART_BOOKMARK_PINS.loadPins === 'function') {
            promises.push(window.SMART_BOOKMARK_PINS.loadPins());
        }

        // 重新加载搜索历史：将内存缓存置 null 后从 storage 重读
        if (window.SMART_BOOKMARK_QUERY_HISTORY && typeof window.SMART_BOOKMARK_QUERY_HISTORY.reloadHistory === 'function') {
            promises.push(window.SMART_BOOKMARK_QUERY_HISTORY.reloadHistory());
        }

        if (promises.length === 0) {
            return Promise.resolve();
        }

        return Promise.all(promises).catch(function () {
            // 忽略刷新错误
        });
    }

    /**
     * 构建统计摘要
     * @param {Object} data - 导出/导入的数据对象
     * @returns {string} 统计摘要
     */
    function buildStats(data) {
        var parts = [];

        if (data.tags) {
            var bmTagCount = data.tags.bookmarks ? Object.keys(data.tags.bookmarks).length : 0;
            var fdTagCount = data.tags.folders ? Object.keys(data.tags.folders).length : 0;
            if (bmTagCount + fdTagCount > 0) {
                parts.push((bmTagCount + fdTagCount) + ' tags');
            }
        }

        if (data.pins) {
            var bmPinCount = data.pins.bookmarks ? Object.keys(data.pins.bookmarks).length : 0;
            var fdPinCount = data.pins.folders ? Object.keys(data.pins.folders).length : 0;
            if (bmPinCount + fdPinCount > 0) {
                parts.push((bmPinCount + fdPinCount) + ' pins');
            }
        }

        if (data.queryHistory) {
            var queryCount = Object.keys(data.queryHistory).length;
            if (queryCount > 0) {
                parts.push(queryCount + ' queries');
            }
        }

        return parts.length > 0 ? parts.join(', ') : 'empty';
    }

    // 暴露到全局
    window.SMART_BOOKMARK_DATA_IO = {
        exportData: exportData,
        importData: importData,
        pickFileAndImport: pickFileAndImport
    };
})();
