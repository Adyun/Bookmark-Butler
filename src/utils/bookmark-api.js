// Bookmark API wrapper for the Smart Bookmark Extension

// 智能缓存系统
var cache = {
  // 内存缓存
  memory: {
    folders: null,
    bookmarks: null,
    foldersLastFetch: 0,
    bookmarksLastFetch: 0,
    ttl: 60000, // 1分钟内存缓存
    version: 0 // 缓存版本号，用于检测数据变化
  },
  // 持久化缓存
  persistent: {
    key: 'smart_bookmark_cache',
    ttl: 3600000, // 1小时持久化缓存
    enabled: true
  }
};

/**
 * 带重试机制的异步函数执行器
 * @param {Function} asyncFn - 异步函数
 * @param {number} retries - 重试次数
 * @param {number} delay - 重试延迟(ms)
 * @returns {Promise} 异步函数的结果
 */
function retryAsyncFunction(asyncFn, retries, delay) {
  retries = retries || 3;
  delay = delay || 1000;

  return new Promise(function (resolve, reject) {
    var attempt = function (n) {
      asyncFn()
        .then(function (result) {
          resolve(result);
        })
        .catch(function (error) {
          if (n >= retries) {
            reject(error);
          } else {
            // console.log('Attempt ' + (n + 1) + ' failed, retrying in ' + delay + 'ms...');
            setTimeout(function () {
              attempt(n + 1);
            }, delay);
          }
        });
    };

    attempt(0);
  });
}

/**
 * 从持久化存储加载缓存
 * @returns {Promise<Object>} 缓存数据
 */
function loadPersistentCache() {
  return new Promise(function (resolve) {
    if (!cache.persistent.enabled) {
      resolve(null);
      return;
    }

    try {
      // 尝试从 chrome.storage 获取缓存
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([cache.persistent.key], function (result) {
          var cachedData = result[cache.persistent.key];
          if (cachedData && (Date.now() - cachedData.timestamp) < cache.persistent.ttl) {
            resolve(cachedData);
          } else {
            resolve(null);
          }
        });
      } else {
        resolve(null);
      }
    } catch (error) {
      console.error('Error loading persistent cache:', error);
      resolve(null);
    }
  });
}

/**
 * 保存缓存到持久化存储
 * @param {Object} data - 要保存的缓存数据
 */
function savePersistentCache(data) {
  if (!cache.persistent.enabled) return;

  try {
    var cacheData = {
      folders: data.folders,
      bookmarks: data.bookmarks,
      timestamp: Date.now(),
      version: data.version || 0
    };

    // 尝试保存到 chrome.storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        'smart_bookmark_cache': cacheData
      });
    } else {
      // 无可用持久化存储时跳过
    }
  } catch (error) {
    console.error('Error saving persistent cache:', error);
  }
}

/**
 * 获取所有书签文件夹
 * @returns {Promise<Array>} 文件夹列表
 */
function getAllFolders() {
  return retryAsyncFunction(function () {
    var now = Date.now();

    // 检查内存缓存
    if (cache.memory.folders && (now - cache.memory.foldersLastFetch) < cache.memory.ttl) {
      // console.log('Returning cached folders from memory');
      return Promise.resolve(cache.memory.folders);
    }

    // 检查持久化缓存
    return loadPersistentCache().then(function (persistentCache) {
      if (persistentCache && persistentCache.folders) {
        // 更新内存缓存
        cache.memory.folders = persistentCache.folders;
        cache.memory.foldersLastFetch = now;
        cache.memory.version = persistentCache.version || 0;

        // console.log('Returning cached folders from persistent storage');
        return Promise.resolve(persistentCache.folders);
      }

      // 没有有效缓存，从后台脚本获取
      return new Promise(function (resolve, reject) {
        // 检查是否在扩展环境中
        if (!chrome || !chrome.runtime) {
          reject(new Error('Chrome runtime not available'));
          return;
        }

        // 向后台脚本发送消息获取书签
        chrome.runtime.sendMessage({
          action: "getBookmarks"
        }, function (response) {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to communicate with background script: ' + chrome.runtime.lastError.message));
            return;
          }

          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }

          if (response && response.folders) {
            // 更新内存缓存
            cache.memory.folders = response.folders;
            cache.memory.foldersLastFetch = now;
            cache.memory.version++;

            // 保存到持久化缓存
            savePersistentCache({
              folders: response.folders,
              bookmarks: cache.memory.bookmarks,
              version: cache.memory.version
            });

            // console.log('Fetched ' + response.folders.length + ' folders from background script');
            resolve(response.folders);
          } else {
            reject(new Error('Invalid response from background script'));
          }
        });
      });
    });
  });
}

/**
 * 创建书签
 * @param {string} folderId - 父文件夹ID
 * @param {string} title - 书签标题
 * @param {string} url - 书签URL
 * @returns {Promise<Object>} 创建的书签对象
 */
function createBookmark(folderId, title, url) {
  return retryAsyncFunction(function () {
    // 在内容脚本中，通过后台脚本创建书签
    return new Promise(function (resolve, reject) {
      // 检查是否在扩展环境中
      if (!chrome || !chrome.runtime) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      // 向后台脚本发送消息创建书签
      chrome.runtime.sendMessage({
        action: "createBookmark",
        folderId: folderId,
        title: title,
        url: url
      }, function (response) {
        if (chrome.runtime.lastError) {
          reject(new Error('Failed to communicate with background script: ' + chrome.runtime.lastError.message));
          return;
        }

        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }

        if (response && response.bookmark) {
          // 清除缓存（使用统一方法），以确保后续读取到最新数据
          try {
            if (typeof window !== 'undefined' && window.SMART_BOOKMARK_API && window.SMART_BOOKMARK_API.clearCache) {
              window.SMART_BOOKMARK_API.clearCache();
            } else {
              // 直接操作内部缓存作为兜底
              cache.memory.folders = null;
              cache.memory.bookmarks = null;
              cache.memory.foldersLastFetch = 0;
              cache.memory.bookmarksLastFetch = 0;
              cache.memory.version = (cache.memory.version || 0) + 1;
            }
          } catch (e) { }

          // console.log('Bookmark created successfully via background script');
          resolve(response.bookmark);
        } else {
          reject(new Error('Invalid response from background script'));
        }
      });
    });
  });
}

/**
 * 搜索文件夹
 * @param {string} query - 搜索关键词
 * @returns {Promise<Array>} 匹配的文件夹列表
 */
function searchFolders(query) {
  return retryAsyncFunction(function () {
    // 在内容脚本中，通过后台脚本搜索书签
    return new Promise(function (resolve, reject) {
      // 检查是否在扩展环境中
      if (!chrome || !chrome.runtime) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      // 向后台脚本发送消息搜索书签
      chrome.runtime.sendMessage({
        action: "searchBookmarks",
        query: query,
        type: "folders"
      }, function (response) {
        if (chrome.runtime.lastError) {
          reject(new Error('Failed to communicate with background script: ' + chrome.runtime.lastError.message));
          return;
        }

        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }

        if (response && response.folders) {
          // 补充每个文件夹的子文件夹数量
          getAllFolders().then(function (allFolders) {
            response.folders.forEach(function (folder) {
              var count = 0;
              for (var i = 0; i < allFolders.length; i++) {
                if (allFolders[i].parentId === folder.id) {
                  count++;
                }
              }
              folder.subFolderCount = count;
            });
            resolve(response.folders);
          }).catch(function () {
            // 如果获取所有文件夹失败，仍然返回搜索结果，只是没有数量
            resolve(response.folders);
          });
        } else {
          reject(new Error('Invalid response from background script'));
        }
      });
    });
  });
}

/**
 * 搜索书签
 * @param {string} query - 搜索关键词
 * @returns {Promise<Array>} 匹配的书签列表
 */
function searchBookmarks(query) {
  return retryAsyncFunction(function () {
    // 在内容脚本中，通过后台脚本搜索书签
    return new Promise(function (resolve, reject) {
      // 检查是否在扩展环境中
      if (!chrome || !chrome.runtime) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      // 向后台脚本发送消息搜索书签
      chrome.runtime.sendMessage({
        action: "searchBookmarks",
        query: query,
        type: "bookmarks"
      }, function (response) {
        if (chrome.runtime.lastError) {
          reject(new Error('Failed to communicate with background script: ' + chrome.runtime.lastError.message));
          return;
        }

        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }

        if (response && response.bookmarks) {
          // console.log('Found ' + response.bookmarks.length + ' bookmarks matching query via background script');
          resolve(response.bookmarks);
        } else {
          reject(new Error('Invalid response from background script'));
        }
      });
    });
  });
}

/**
 * 获取所有书签
 * @returns {Promise<Array>} 书签列表
 */
function getAllBookmarks() {
  return retryAsyncFunction(function () {
    var now = Date.now();

    // 检查内存缓存
    if (cache.memory.bookmarks && (now - cache.memory.bookmarksLastFetch) < cache.memory.ttl) {
      // console.log('Returning cached bookmarks from memory');
      return Promise.resolve(cache.memory.bookmarks);
    }

    // 检查持久化缓存
    return loadPersistentCache().then(function (persistentCache) {
      if (persistentCache && persistentCache.bookmarks) {
        // 更新内存缓存
        cache.memory.bookmarks = persistentCache.bookmarks;
        cache.memory.bookmarksLastFetch = now;
        cache.memory.version = persistentCache.version || 0;

        // console.log('Returning cached bookmarks from persistent storage');
        return Promise.resolve(persistentCache.bookmarks);
      }

      // 没有有效缓存，从后台脚本获取
      return new Promise(function (resolve, reject) {
        // 检查是否在扩展环境中
        if (!chrome || !chrome.runtime) {
          reject(new Error('Chrome runtime not available'));
          return;
        }

        // 向后台脚本发送消息获取书签
        chrome.runtime.sendMessage({
          action: "getAllBookmarks"
        }, function (response) {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to communicate with background script: ' + chrome.runtime.lastError.message));
            return;
          }

          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }

          if (response && response.bookmarks) {
            // 更新内存缓存
            cache.memory.bookmarks = response.bookmarks;
            cache.memory.bookmarksLastFetch = now;
            cache.memory.version++;

            // 保存到持久化缓存
            savePersistentCache({
              folders: cache.memory.folders,
              bookmarks: response.bookmarks,
              version: cache.memory.version
            });

            // console.log('Fetched ' + response.bookmarks.length + ' bookmarks from background script');
            resolve(response.bookmarks);
          } else {
            reject(new Error('Invalid response from background script'));
          }
        });
      });
    });
  });
}

/**
 * 计算文件夹活跃度
 * 注意：Chrome书签API不提供访问频率信息，这里使用文件夹中书签数量作为活跃度指标
 * @param {Object} folder - 文件夹对象
 * @returns {Promise<number>} 活跃度分数
 */
function calculateFolderActivity(folder) {
  // 在实际应用中，我们可能需要更复杂的算法来计算活跃度
  // 这里简单地使用书签数量作为活跃度指标
  return Promise.resolve(folder.bookmarkCount || 0);
}

/**
 * 请求书签权限
 * @returns {Promise<boolean>} 是否成功获取权限
 */
function requestBookmarksPermission() {
  return new Promise(function (resolve, reject) {
    if (!chrome || !chrome.permissions) {
      reject(new Error('Chrome permissions API not available'));
      return;
    }

    chrome.permissions.request({
      permissions: ['bookmarks']
    }, function (granted) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(granted);
      }
    });
  });
}

/**
 * 清除缓存
 */
function clearCache() {
  cache.memory.folders = null;
  cache.memory.bookmarks = null;
  cache.memory.foldersLastFetch = 0;
  cache.memory.bookmarksLastFetch = 0;
  cache.memory.version = 0;

  // 清除持久化缓存
  try {
    // 检查扩展上下文是否有效
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.runtime.id) {
      chrome.storage.local.remove([cache.persistent.key]);
    }
  } catch (error) {
    // 忽略扩展上下文无效的错误，这是正常的页面卸载时的行为
    if (!error.message.includes('Extension context invalidated')) {
      console.error('Error clearing persistent cache:', error);
    }
  }
}

/**
 * 获取缓存状态
 * @returns {Object} 缓存状态信息
 */
function getCacheStatus() {
  var now = Date.now();
  return {
    memoryCache: {
      hasFolders: !!cache.memory.folders,
      lastFetch: cache.memory.foldersLastFetch,
      ttl: cache.memory.ttl,
      age: now - cache.memory.foldersLastFetch,
      version: cache.memory.version
    },
    bookmarksMemoryCache: {
      hasBookmarks: !!cache.memory.bookmarks,
      lastFetch: cache.memory.bookmarksLastFetch,
      ttl: cache.memory.ttl,
      age: now - cache.memory.bookmarksLastFetch,
      version: cache.memory.version
    },
    persistentCache: {
      enabled: cache.persistent.enabled,
      ttl: cache.persistent.ttl
    }
  };
}

/**
 * 获取指定文件夹中的书签
 * @param {string} folderId - 文件夹ID
 * @returns {Promise<Array>} 该文件夹中的书签列表
 */
function getBookmarksByFolder(folderId) {
  return getAllBookmarks().then(function (allBookmarks) {
    return allBookmarks.filter(function (bookmark) {
      return bookmark.parentId === folderId;
    });
  });
}

/**
 * 获取指定文件夹中的子文件夹
 * @param {string} folderId - 文件夹ID
 * @returns {Promise<Array>} 该文件夹中的子文件夹列表
 */
function getSubFolders(folderId) {
  return getAllFolders().then(function (allFolders) {
    var subFolders = allFolders.filter(function (folder) {
      return folder.parentId === folderId;
    });

    // 计算每个子文件夹的子文件夹数量
    subFolders.forEach(function (subFolder) {
      var count = 0;
      for (var i = 0; i < allFolders.length; i++) {
        if (allFolders[i].parentId === subFolder.id) {
          count++;
        }
      }
      subFolder.subFolderCount = count;
    });

    return subFolders;
  });
}

/**
 * 删除书签
 * @param {string} bookmarkId - 要删除的书签ID
 * @returns {Promise<boolean>} 是否删除成功
 */
function deleteBookmark(bookmarkId) {
  return new Promise(function (resolve, reject) {
    // 检查是否在扩展环境中
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      reject(new Error('Chrome runtime not available'));
      return;
    }

    // 向后台脚本发送消息删除书签
    chrome.runtime.sendMessage({
      action: "deleteBookmark",
      bookmarkId: bookmarkId
    }, function (response) {
      if (chrome.runtime.lastError) {
        reject(new Error('Failed to communicate with background script: ' + chrome.runtime.lastError.message));
        return;
      }

      if (response && response.error) {
        reject(new Error(response.error));
        return;
      }

      if (response && response.success) {
        // 清除缓存
        try {
          if (typeof window !== 'undefined' && window.SMART_BOOKMARK_API && window.SMART_BOOKMARK_API.clearCache) {
            window.SMART_BOOKMARK_API.clearCache();
          } else {
            cache.memory.folders = null;
            cache.memory.bookmarks = null;
            cache.memory.foldersLastFetch = 0;
            cache.memory.bookmarksLastFetch = 0;
            cache.memory.version = (cache.memory.version || 0) + 1;
          }
        } catch (e) { }

        resolve(true);
      } else {
        reject(new Error('Invalid response from background script'));
      }
    });
  });
}

// 将函数附加到全局window对象
window.SMART_BOOKMARK_API = {
  getAllFolders: getAllFolders,
  getAllBookmarks: getAllBookmarks,
  getBookmarksByFolder: getBookmarksByFolder,
  getSubFolders: getSubFolders,
  createBookmark: createBookmark,
  deleteBookmark: deleteBookmark,
  searchFolders: searchFolders,
  searchBookmarks: searchBookmarks,
  calculateFolderActivity: calculateFolderActivity,
  clearCache: clearCache,
  getCacheStatus: getCacheStatus,
  requestBookmarksPermission: requestBookmarksPermission,
  loadPersistentCache: loadPersistentCache,
  savePersistentCache: savePersistentCache
};
