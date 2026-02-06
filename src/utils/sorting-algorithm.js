// Sorting algorithms for the Smart Bookmark Extension

// 预计算的活跃度缓存
const ACTIVITY_CACHE = {
  data: new Map(),
  lastUpdate: 0,
  ttl: 5 * 60 * 1000, // 5分钟缓存
  maxSize: 1000
};

/**
 * 获取缓存的文件夹活跃度
 * @param {string} folderId - 文件夹ID
 * @returns {number|null} 缓存的活跃度值，如果没有缓存返回null
 */
function getCachedActivity(folderId) {
  const now = Date.now();
  if (now - ACTIVITY_CACHE.lastUpdate > ACTIVITY_CACHE.ttl) {
    // 缓存过期，清空缓存
    ACTIVITY_CACHE.data.clear();
    return null;
  }

  return ACTIVITY_CACHE.data.get(folderId) || null;
}

/**
 * 设置文件夹活跃度缓存
 * @param {string} folderId - 文件夹ID
 * @param {number} activity - 活跃度值
 */
function setCachedActivity(folderId, activity) {
  // 控制缓存大小
  if (ACTIVITY_CACHE.data.size >= ACTIVITY_CACHE.maxSize) {
    // 移除最旧的缓存项
    const oldestKey = ACTIVITY_CACHE.data.keys().next().value;
    if (oldestKey) {
      ACTIVITY_CACHE.data.delete(oldestKey);
    }
  }

  ACTIVITY_CACHE.data.set(folderId, activity);
}

/**
 * 预计算所有文件夹的活跃度
 * @param {Array} folders - 文件夹列表
 * @returns {Promise<Map>} 文件夹活跃度映射
 */
async function preCalculateFolderActivity(folders) {
  if (!folders || !Array.isArray(folders) || folders.length === 0) {
    return new Map();
  }

  const startTime = performance.now();
  const activityMap = new Map();

  // 批量计算活跃度
  const promises = folders.map(async (folder) => {
    if (!folder || !folder.id) return null;

    // 检查缓存
    const cachedActivity = getCachedActivity(folder.id);
    if (cachedActivity !== null) {
      return { id: folder.id, activity: cachedActivity };
    }

    try {
      const activity = await window.SMART_BOOKMARK_API.calculateFolderActivity(folder);
      const finalActivity = activity || 0;

      // 缓存结果
      setCachedActivity(folder.id, finalActivity);

      return { id: folder.id, activity: finalActivity };
    } catch (error) {
      console.error('Error calculating activity for folder:', folder, error);
      return { id: folder.id, activity: 0 };
    }
  });

  const results = await Promise.all(promises);

  // 构建活动度映射
  results.forEach(result => {
    if (result) {
      activityMap.set(result.id, result.activity);
    }
  });

  const endTime = performance.now();
  // console.log(`Pre-calculated activity for ${folders.length} folders in ${(endTime - startTime).toFixed(2)}ms`);

  return activityMap;
}

/**
 * 按活跃度排序文件夹
 * @param {Array} folders - 文件夹列表
 * @returns {Promise<Array>} 排序后的文件夹列表
 */
async function sortByBrowserOrder(folders) {
  // 检查folders是否有效
  if (!folders || !Array.isArray(folders) || folders.length === 0) {
    // console.log('Invalid or empty folders array, returning empty array');
    return [];
  }

  try {
    // 按照浏览器的原始顺序排序
    // 由于我们从书签树中提取文件夹时已经保持了原始顺序，
    // 所以这里只需要返回原始数组即可
    return folders;
  } catch (error) {
    console.error('Error in sortByBrowserOrder:', error);
    return folders; // 出错时返回原始数组
  }
}

/**
 * 按活跃度排序文件夹（优化版本）
 * @param {Array} folders - 文件夹列表
 * @param {Map} activityMap - 预计算的活动度映射（可选）
 * @returns {Promise<Array>} 排序后的文件夹列表
 */
async function sortByActivity(folders, activityMap = null) {
  // 检查folders是否有效
  if (!folders || !Array.isArray(folders) || folders.length === 0) {
    // console.log('Invalid or empty folders array, returning empty array');
    return [];
  }

  try {
    let finalActivityMap = activityMap;

    // 如果没有提供活动度映射，则预计算
    if (!finalActivityMap) {
      finalActivityMap = await preCalculateFolderActivity(folders);
    }

    // 使用预计算的活动度进行排序
    const sortedFolders = folders
      .filter(folder => folder && folder.id)
      .map(folder => ({
        ...folder,
        activity: finalActivityMap.get(folder.id) || 0
      }))
      .sort((a, b) => (b.activity || 0) - (a.activity || 0));

    return sortedFolders;
  } catch (error) {
    console.error('Error in sortByActivity:', error);
    return folders; // 出错时返回原始数组
  }
}

/**
 * 批量更新文件夹活跃度
 * @param {Array} folders - 文件夹列表
 * @returns {Promise<Array>} 更新活跃度后的文件夹列表
 */
async function updateFolderActivity(folders) {
  if (!folders || !Array.isArray(folders) || folders.length === 0) {
    return [];
  }

  const activityMap = await preCalculateFolderActivity(folders);

  return folders.map(folder => ({
    ...folder,
    activity: activityMap.get(folder.id) || 0
  }));
}

/**
 * 获取最近使用的文件夹
 * @param {Array} folders - 所有文件夹
 * @param {number} limit - 返回数量限制
 * @returns {Promise<Array>} 最近使用的文件夹
 */
async function getRecentFolders(folders, limit = 5) {
  // 按照活跃度排序返回前N个
  const sortedFolders = await sortByActivity(folders);
  return sortedFolders.slice(0, limit);
}

/**
 * 清理活跃度缓存
 */
function clearActivityCache() {
  ACTIVITY_CACHE.data.clear();
  ACTIVITY_CACHE.lastUpdate = 0;
}

// 将函数附加到全局window对象
window.SMART_BOOKMARK_SORTING = {
  sortByBrowserOrder,
  sortByActivity,
  getRecentFolders,
  preCalculateFolderActivity,
  updateFolderActivity,
  clearActivityCache
};