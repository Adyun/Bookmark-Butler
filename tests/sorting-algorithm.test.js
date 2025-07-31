// Sorting Algorithm 测试文件

/**
 * 测试排序算法功能
 */
describe('Sorting Algorithm', () => {
  test('should sort folders by activity', async () => {
    // 模拟文件夹数据
    const folders = [
      { id: '1', title: 'Folder 1', bookmarkCount: 5 },
      { id: '2', title: 'Folder 2', bookmarkCount: 10 },
      { id: '3', title: 'Folder 3', bookmarkCount: 2 }
    ];
    
    // 模拟 calculateFolderActivity 函数
    global.calculateFolderActivity = jest.fn((folder) => folder.bookmarkCount);
    
    const sortedFolders = await sortByActivity(folders);
    
    // 验证排序结果是否正确（按bookmarkCount降序排列）
    expect(sortedFolders[0].title).toBe('Folder 2');
    expect(sortedFolders[1].title).toBe('Folder 1');
    expect(sortedFolders[2].title).toBe('Folder 3');
    
    // 验证每个文件夹都包含了activity属性
    expect(sortedFolders[0]).toHaveProperty('activity');
    expect(sortedFolders[1]).toHaveProperty('activity');
    expect(sortedFolders[2]).toHaveProperty('activity');
  });

  test('should get recent folders', async () => {
    // 模拟文件夹数据
    const folders = [
      { id: '1', title: 'Folder 1', bookmarkCount: 5 },
      { id: '2', title: 'Folder 2', bookmarkCount: 10 },
      { id: '3', title: 'Folder 3', bookmarkCount: 2 },
      { id: '4', title: 'Folder 4', bookmarkCount: 8 },
      { id: '5', title: 'Folder 5', bookmarkCount: 1 }
    ];
    
    // 模拟 calculateFolderActivity 函数
    global.calculateFolderActivity = jest.fn((folder) => folder.bookmarkCount);
    
    const recentFolders = await getRecentFolders(folders, 3);
    
    // 验证返回的文件夹数量是否正确
    expect(recentFolders.length).toBe(3);
    
    // 验证返回的是否是活跃度最高的3个文件夹
    expect(recentFolders[0].title).toBe('Folder 2');
    expect(recentFolders[1].title).toBe('Folder 4');
    expect(recentFolders[2].title).toBe('Folder 1');
  });
});