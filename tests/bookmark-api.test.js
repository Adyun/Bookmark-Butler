// Bookmark API 测试文件

/**
 * 测试 Bookmark API 功能
 */
describe('Bookmark API', () => {
  test('should fetch all folders', async () => {
    // 模拟 chrome.bookmarks.getTree API
    chrome.bookmarks.getTree = jest.fn((callback) => {
      callback([{
        id: '0',
        title: '',
        children: [
          {
            id: '1',
            title: '书签栏',
            children: [
              {
                id: '2',
                title: '文件夹1',
                children: [
                  { id: '3', title: '书签1', url: 'https://example.com' }
                ]
              }
            ]
          }
        ]
      }]);
    });
    
    const folders = await getAllFolders();
    expect(Array.isArray(folders)).toBe(true);
    expect(folders.length).toBe(2); // 根节点和文件夹1
    expect(folders[1].title).toBe('文件夹1');
  });

  test('should create bookmark correctly', async () => {
    // 模拟 chrome.bookmarks.create API
    chrome.bookmarks.create = jest.fn((bookmark, callback) => {
      callback({
        id: '4',
        title: 'Test Bookmark',
        url: 'https://test.com',
        parentId: '2'
      });
    });
    
    const bookmark = await createBookmark('2', 'Test Bookmark', 'https://test.com');
    expect(bookmark.title).toBe('Test Bookmark');
    expect(bookmark.url).toBe('https://test.com');
    expect(bookmark.parentId).toBe('2');
  });
});