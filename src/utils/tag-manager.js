// Tag Manager for Smart Bookmark Extension
// 负责标签的加载、保存、查询与同步

(function () {
    var STORAGE_KEY = 'smart_bookmark_tags_v1';
    var MAX_TAGS_PER_ITEM = 20;
    var MAX_TAG_LENGTH = 24;

    var inMemoryTags = {
        bookmarks: {},
        folders: {}
    };

    var hasLoaded = false;
    var listeners = [];

    // ========== 内部工具 ==========

    function notifyTagsUpdated() {
        try {
            for (var i = 0; i < listeners.length; i++) {
                try { listeners[i](inMemoryTags); } catch (e) { }
            }
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                var evt = new CustomEvent('smart-bookmark-tags-updated', { detail: inMemoryTags });
                window.dispatchEvent(evt);
            }
        } catch (e) { }
    }

    function getStorageArea() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                return chrome.storage.local;
            }
        } catch (e) { }
        return null;
    }

    function normalizeTags(tags) {
        var safe = tags || {};
        if (!safe.bookmarks || typeof safe.bookmarks !== 'object') safe.bookmarks = {};
        if (!safe.folders || typeof safe.folders !== 'object') safe.folders = {};
        return safe;
    }

    /**
     * 规范化单个标签列表：trim、去空、去重（大小写不敏感）、限长
     * @param {Array} tagList
     * @returns {Array}
     */
    function normalizeTagList(tagList) {
        if (!Array.isArray(tagList)) return [];
        var seen = {};
        var result = [];
        for (var i = 0; i < tagList.length; i++) {
            var tag = (tagList[i] || '').toString().trim();
            if (!tag) continue;
            if (tag.length > MAX_TAG_LENGTH) tag = tag.substring(0, MAX_TAG_LENGTH);
            var lower = tag.toLowerCase();
            if (seen[lower]) continue;
            seen[lower] = true;
            result.push(tag);
            if (result.length >= MAX_TAGS_PER_ITEM) break;
        }
        return result;
    }

    // ========== 存储操作 ==========

    function loadTags() {
        return new Promise(function (resolve) {
            var storage = getStorageArea();
            if (!storage) {
                try {
                    var raw = localStorage.getItem(STORAGE_KEY);
                    if (raw) {
                        var parsed = JSON.parse(raw);
                        inMemoryTags = normalizeTags(parsed);
                    }
                } catch (e) { }
                hasLoaded = true;
                resolve(inMemoryTags);
                return;
            }

            storage.get([STORAGE_KEY], function (result) {
                try {
                    var tags = result && result[STORAGE_KEY] ? result[STORAGE_KEY] : null;
                    if (tags) {
                        inMemoryTags = normalizeTags(tags);
                    }
                } catch (e) { }
                hasLoaded = true;
                resolve(inMemoryTags);
            });
        });
    }

    function saveTags(tags) {
        inMemoryTags = normalizeTags(tags || inMemoryTags);
        var storage = getStorageArea();
        if (!storage) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryTags));
            } catch (e) { }
            notifyTagsUpdated();
            return Promise.resolve();
        }
        return new Promise(function (resolve) {
            var data = {};
            data[STORAGE_KEY] = inMemoryTags;
            storage.set(data, function () { resolve(); });
        });
    }

    // ========== 读取 API ==========

    function getTagsForItem(type, id) {
        var table = type === 'folders' ? inMemoryTags.folders : inMemoryTags.bookmarks;
        if (!table || id == null) return [];
        return (table[id] || []).slice();
    }

    function getAllTags(type) {
        var seen = {};
        var result = [];

        function collectFrom(table) {
            if (!table || typeof table !== 'object') return;
            var keys = Object.keys(table);
            for (var i = 0; i < keys.length; i++) {
                var tagList = table[keys[i]];
                if (!Array.isArray(tagList)) continue;
                for (var j = 0; j < tagList.length; j++) {
                    var tag = tagList[j];
                    var lower = (tag || '').toLowerCase();
                    if (!lower || seen[lower]) continue;
                    seen[lower] = true;
                    result.push(tag);
                }
            }
        }

        if (!type || type === 'bookmarks') collectFrom(inMemoryTags.bookmarks);
        if (!type || type === 'folders') collectFrom(inMemoryTags.folders);

        return result;
    }

    function getItemsByTag(type, tag) {
        var result = [];
        if (!tag) return result;
        var lower = tag.toLowerCase();
        var table = type === 'folders' ? inMemoryTags.folders : inMemoryTags.bookmarks;
        if (!table) return result;
        var keys = Object.keys(table);
        for (var i = 0; i < keys.length; i++) {
            var tagList = table[keys[i]];
            if (!Array.isArray(tagList)) continue;
            for (var j = 0; j < tagList.length; j++) {
                if ((tagList[j] || '').toLowerCase() === lower) {
                    result.push(keys[i]);
                    break;
                }
            }
        }
        return result;
    }

    // ========== 写入 API ==========

    function setTagsForItem(type, id, tags) {
        var table = type === 'folders' ? inMemoryTags.folders : inMemoryTags.bookmarks;
        if (!table) {
            if (type === 'folders') inMemoryTags.folders = {};
            else inMemoryTags.bookmarks = {};
            table = type === 'folders' ? inMemoryTags.folders : inMemoryTags.bookmarks;
        }
        var normalized = normalizeTagList(tags);
        if (normalized.length === 0) {
            delete table[id];
        } else {
            table[id] = normalized;
        }
        return saveTags(inMemoryTags);
    }

    function removeAllTagsForItem(type, id) {
        var table = type === 'folders' ? inMemoryTags.folders : inMemoryTags.bookmarks;
        if (table && id != null) {
            delete table[id];
        }
        return saveTags(inMemoryTags);
    }

    // ========== 清理 API ==========

    function pruneOrphanTags(validBookmarkIds, validFolderIds) {
        var changed = false;

        if (validBookmarkIds && inMemoryTags.bookmarks) {
            var bmSet = {};
            for (var i = 0; i < validBookmarkIds.length; i++) {
                bmSet[validBookmarkIds[i]] = true;
            }
            var bmKeys = Object.keys(inMemoryTags.bookmarks);
            for (var j = 0; j < bmKeys.length; j++) {
                if (!bmSet[bmKeys[j]]) {
                    delete inMemoryTags.bookmarks[bmKeys[j]];
                    changed = true;
                }
            }
        }

        if (validFolderIds && inMemoryTags.folders) {
            var fdSet = {};
            for (var k = 0; k < validFolderIds.length; k++) {
                fdSet[validFolderIds[k]] = true;
            }
            var fdKeys = Object.keys(inMemoryTags.folders);
            for (var m = 0; m < fdKeys.length; m++) {
                if (!fdSet[fdKeys[m]]) {
                    delete inMemoryTags.folders[fdKeys[m]];
                    changed = true;
                }
            }
        }

        if (changed) {
            return saveTags(inMemoryTags);
        }
        return Promise.resolve();
    }

    // ========== 颜色生成 ==========

    /**
     * 根据标签名 hash 生成稳定的 HSL 颜色
     * @param {string} tag
     * @returns {{ bg: string, text: string }}
     */
    function generateTagColor(tag) {
        var hash = 0;
        var str = (tag || '').toLowerCase();
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        var hue = Math.abs(hash) % 360;
        return {
            bg: 'hsl(' + hue + ', 65%, 92%)',
            text: 'hsl(' + hue + ', 55%, 35%)',
            darkBg: 'hsl(' + hue + ', 40%, 25%)',
            darkText: 'hsl(' + hue + ', 55%, 75%)'
        };
    }

    // ========== 暴露 API ==========

    window.SMART_BOOKMARK_TAGS = {
        loadTags: loadTags,
        saveTags: saveTags,
        getTagsForItem: getTagsForItem,
        setTagsForItem: setTagsForItem,
        removeAllTagsForItem: removeAllTagsForItem,
        getAllTags: getAllTags,
        getItemsByTag: getItemsByTag,
        pruneOrphanTags: pruneOrphanTags,
        generateTagColor: generateTagColor,
        normalizeTagList: normalizeTagList,
        hasLoaded: function () { return hasLoaded; },
        addChangeListener: function (cb) { if (typeof cb === 'function') listeners.push(cb); }
    };

    // 全局监听 chrome.storage 变化，跨页面实时同步
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener(function (changes, areaName) {
                try {
                    if (areaName !== 'local') return;
                    if (!changes || !changes[STORAGE_KEY]) return;
                    var newTags = changes[STORAGE_KEY].newValue || {};
                    inMemoryTags = normalizeTags(newTags);
                    notifyTagsUpdated();
                } catch (e) { }
            });
        }
    } catch (e) { }
})();
