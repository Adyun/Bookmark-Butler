// Sorting algorithms for the Smart Bookmark Extension

/**
 * 按活跃度排序文件夹
 * @param {Array} folders - 文件夹列表
 * @returns {Promise<Array>} 排序后的文件夹列表
 */
async function sortByBrowserOrder(folders) {
  // 检查folders是否有效
  if (!folders || !Array.isArray(folders) || folders.length === 0) {
    console.log('Invalid or empty folders array, returning empty array');
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

async function sortByActivity(folders) {
  // 检查folders是否有效
  if (!folders || !Array.isArray(folders) || folders.length === 0) {
    console.log('Invalid or empty folders array, returning empty array');
    return [];
  }

  try {
    // 为每个文件夹计算活跃度
    const foldersWithActivity = await Promise.all(
      folders.map(async (folder) => {
        if (!folder) return null;

        try {
          const activity = await window.SMART_BOOKMARK_API.calculateFolderActivity(folder);
          return { ...folder, activity: activity || 0 };
        } catch (error) {
          console.error('Error calculating activity for folder:', folder, error);
          return { ...folder, activity: 0 };
        }
      })
    );

    // 过滤掉null值并按活跃度降序排序
    return foldersWithActivity
      .filter(folder => folder !== null)
      .sort((a, b) => (b.activity || 0) - (a.activity || 0));
  } catch (error) {
    console.error('Error in sortByActivity:', error);
    return folders; // 出错时返回原始数组
  }
}

/**
 * 获取最近使用的文件夹
 * @param {Array} folders - 所有文件夹
 * @param {number} limit - 返回数量限制
 * @returns {Promise<Array>} 最近使用的文件夹
 */
async function getRecentFolders(folders, limit = 5) {
  // 按照浏览器原始顺序返回前N个
  const sortedFolders = await sortByBrowserOrder(folders);
  return sortedFolders.slice(0, limit);
}

// 将函数附加到全局window对象
window.SMART_BOOKMARK_SORTING = {
  sortByBrowserOrder,
  sortByActivity,
  getRecentFolders
};