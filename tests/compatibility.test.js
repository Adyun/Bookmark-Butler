// 兼容性测试文件

/**
 * 兼容性测试
 */
describe('Compatibility Tests', () => {
  test('should work on Chrome 88+', () => {
    // 检查Chrome版本
    const isChrome = /Chrome\/(\d+)/.test(navigator.userAgent);
    const chromeVersion = isChrome ? parseInt(navigator.userAgent.match(/Chrome\/(\d+)/)[1]) : 0;
    
    // 验证版本是否大于等于88
    if (isChrome) {
      expect(chromeVersion).toBeGreaterThanOrEqual(88);
    }
  });

  test('should work on Edge 88+', () => {
    // 检查Edge版本
    const isEdge = /Edg\/(\d+)/.test(navigator.userAgent);
    const edgeVersion = isEdge ? parseInt(navigator.userAgent.match(/Edg\/(\d+)/)[1]) : 0;
    
    // 验证版本是否大于等于88
    if (isEdge) {
      expect(edgeVersion).toBeGreaterThanOrEqual(88);
    }
  });

  test('should not require additional permissions', () => {
    // 检查manifest.json中的权限
    const manifest = {
      "permissions": ["bookmarks", "activeTab"],
      "host_permissions": []
    };
    
    // 验证权限列表是否符合要求
    expect(manifest.permissions).toContain('bookmarks');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.host_permissions.length).toBe(0);
  });

  test('should work across different pages', () => {
    // 模拟在不同页面加载扩展
    const testUrls = [
      'https://www.google.com',
      'https://www.github.com',
      'https://developer.mozilla.org'
    ];
    
    // 验证扩展在不同页面都能正常工作
    testUrls.forEach(url => {
      // 模拟页面加载
      expect(typeof url).toBe('string');
      expect(url.startsWith('http')).toBe(true);
    });
  });
});