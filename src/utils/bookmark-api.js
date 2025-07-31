// Bookmark API wrapper for the Smart Bookmark Extension

// 缓存对象
var cache = {
  folders: null,
  lastFetch: 0,
  ttl: 5000 // 5秒缓存
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
            console.log('Attempt ' + (n + 1) + ' failed, retrying in ' + delay + 'ms...');
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
 * 获取所有书签文件夹
 * @returns {Promise<Array>} 文件夹列表
 */
function getAllFolders() {
  return retryAsyncFunction(function () {
    // 检查缓存
    var now = Date.now();
    if (cache.folders && (now - cache.lastFetch) < cache.ttl) {
      console.log('Returning cached folders');
      return Promise.resolve(cache.folders);
    }

    // 在内容脚本中，通过后台脚本获取书签
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
          // 更新缓存
          cache.folders = response.folders;
          cache.lastFetch = now;

          console.log('Fetched ' + response.folders.length + ' folders from background script');
          resolve(response.folders);
        } else {
          reject(new Error('Invalid response from background script'));
        }
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
          // 清除缓存，因为书签结构可能已更改
          cache.folders = null;
          cache.lastFetch = 0;

          console.log('Bookmark created successfully via background script');
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
        query: query
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
          console.log('Found ' + response.folders.length + ' folders matching query via background script');
          resolve(response.folders);
        } else {
          reject(new Error('Invalid response from background script'));
        }
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
  cache.folders = null;
  cache.lastFetch = 0;
}

/**
 * 获取缓存状态
 * @returns {Object} 缓存状态信息
 */
function getCacheStatus() {
  return {
    hasCache: !!cache.folders,
    lastFetch: cache.lastFetch,
    ttl: cache.ttl,
    age: Date.now() - cache.lastFetch
  };
}

// 将函数附加到全局window对象
window.SMART_BOOKMARK_API = {
  getAllFolders: getAllFolders,
  createBookmark: createBookmark,
  searchFolders: searchFolders,
  calculateFolderActivity: calculateFolderActivity,
  clearCache: clearCache,
  getCacheStatus: getCacheStatus,
  requestBookmarksPermission: requestBookmarksPermission
};