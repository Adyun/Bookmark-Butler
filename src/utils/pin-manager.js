// Pin Manager for Smart Bookmark Extension
// 负责置顶状态的加载、保存与查询（在弹窗与 newtab 模式间共享）

(function() {
  var STORAGE_KEY = 'smart_bookmark_pins_v1';

  var inMemoryPins = {
    bookmarks: {},
    folders: {}
  };

  var hasLoaded = false;
  var listeners = [];

  function notifyPinsUpdated() {
    try {
      // 回调监听列表
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](inMemoryPins); } catch (e) {}
      }
      // 派发全局事件，供页面间通信（newtab 与 弹窗）
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        var evt = new CustomEvent('smart-bookmark-pins-updated', { detail: inMemoryPins });
        window.dispatchEvent(evt);
      }
    } catch (e) {}
  }

  function getStorageArea() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return chrome.storage.local;
      }
    } catch (e) {}
    return null;
  }

  function loadPins() {
    return new Promise(function(resolve) {
      var storage = getStorageArea();
      if (!storage) {
        // fallback localStorage
        try {
          var raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            var parsed = JSON.parse(raw);
            inMemoryPins = normalizePins(parsed);
          }
        } catch (e) {}
        hasLoaded = true;
        resolve(inMemoryPins);
        return;
      }

      storage.get([STORAGE_KEY], function(result) {
        try {
          var pins = result && result[STORAGE_KEY] ? result[STORAGE_KEY] : null;
          if (pins) {
            inMemoryPins = normalizePins(pins);
          }
        } catch (e) {}
        hasLoaded = true;
        resolve(inMemoryPins);
      });
    });
  }

  function savePins(pins) {
    inMemoryPins = normalizePins(pins || inMemoryPins);
    var storage = getStorageArea();
    if (!storage) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryPins));
      } catch (e) {}
      // localStorage 不会触发 chrome.storage.onChanged，手动通知
      notifyPinsUpdated();
      return Promise.resolve();
    }
    return new Promise(function(resolve) {
      var data = {};
      data[STORAGE_KEY] = inMemoryPins;
      storage.set(data, function() { resolve(); });
    });
  }

  function normalizePins(pins) {
    var safe = pins || {};
    if (!safe.bookmarks || typeof safe.bookmarks !== 'object') safe.bookmarks = {};
    if (!safe.folders || typeof safe.folders !== 'object') safe.folders = {};
    return safe;
  }

  function getPins() {
    return inMemoryPins;
  }

  function isPinned(type, id) {
    var table = type === 'folders' ? inMemoryPins.folders : inMemoryPins.bookmarks;
    return !!(table && id != null && table[id]);
  }

  function getPinnedAt(type, id) {
    var table = type === 'folders' ? inMemoryPins.folders : inMemoryPins.bookmarks;
    return table && table[id] ? table[id] : 0;
  }

  function togglePin(type, id) {
    var now = Date.now();
    var table = type === 'folders' ? inMemoryPins.folders : inMemoryPins.bookmarks;
    if (!table) {
      if (type === 'folders') inMemoryPins.folders = {};
      else inMemoryPins.bookmarks = {};
      table = type === 'folders' ? inMemoryPins.folders : inMemoryPins.bookmarks;
    }
    var pinnedNow;
    if (table[id]) {
      delete table[id];
      pinnedNow = false;
    } else {
      table[id] = now;
      pinnedNow = true;
    }
    return savePins(inMemoryPins).then(function() { return pinnedNow; });
  }

  function applyPinOrdering(items, type) {
    if (!Array.isArray(items) || items.length === 0) return items || [];
    var table = type === 'folders' ? inMemoryPins.folders : inMemoryPins.bookmarks;
    if (!table || Object.keys(table).length === 0) return items.slice();

    var pinned = [];
    var unpinned = [];
    for (var i = 0; i < items.length; i++) {
      var itm = items[i];
      var id = itm && itm.id;
      if (id != null && table[id]) pinned.push(itm); else unpinned.push(itm);
    }
    if (pinned.length === 0) return items.slice();
    pinned.sort(function(a, b) {
      var at = table[a.id] || 0;
      var bt = table[b.id] || 0;
      return bt - at; // newer first
    });
    return pinned.concat(unpinned);
  }

  function hasAnyPinned(items, type) {
    if (!Array.isArray(items) || items.length === 0) return false;
    var table = type === 'folders' ? inMemoryPins.folders : inMemoryPins.bookmarks;
    if (!table || Object.keys(table).length === 0) return false;
    for (var i = 0; i < items.length; i++) {
      var id = items[i] && items[i].id;
      if (id != null && table[id]) return true;
    }
    return false;
  }

  // 在保留输入顺序的前提下，将置顶项提升到前面（用于搜索结果）
  function promotePinnedPreserveOrder(items, type) {
    if (!Array.isArray(items) || items.length === 0) return items || [];
    var table = type === 'folders' ? inMemoryPins.folders : inMemoryPins.bookmarks;
    if (!table || Object.keys(table).length === 0) return items.slice();
    var pinned = [];
    var unpinned = [];
    for (var i = 0; i < items.length; i++) {
      var itm = items[i];
      var id = itm && itm.id;
      if (id != null && table[id]) pinned.push(itm); else unpinned.push(itm);
    }
    if (pinned.length === 0) return items.slice();
    // 不改变 pinned 内部顺序，保留搜索引擎的相关性排序
    return pinned.concat(unpinned);
  }

  window.SMART_BOOKMARK_PINS = {
    loadPins: loadPins,
    savePins: savePins,
    getPins: getPins,
    isPinned: isPinned,
    getPinnedAt: getPinnedAt,
    togglePin: togglePin,
    applyPinOrdering: applyPinOrdering,
    hasAnyPinned: hasAnyPinned,
    promotePinnedPreserveOrder: promotePinnedPreserveOrder,
    hasLoaded: function() { return hasLoaded; },
    addChangeListener: function(cb) { if (typeof cb === 'function') listeners.push(cb); }
  };

  // 全局监听 chrome.storage 变化，跨页面实时同步
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function(changes, areaName) {
        try {
          if (areaName !== 'local') return;
          if (!changes || !changes[STORAGE_KEY]) return;
          var newPins = changes[STORAGE_KEY].newValue || {};
          inMemoryPins = normalizePins(newPins);
          notifyPinsUpdated();
        } catch (e) {}
      });
    }
  } catch (e) {}
})();

