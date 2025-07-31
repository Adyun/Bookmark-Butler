// 集成测试文件

/**
 * 集成测试 - 完整流程测试
 */
describe('Integration Tests', () => {
  beforeEach(() => {
    // 模拟DOM环境
    document.body.innerHTML = `
      <div id="smart-bookmark-modal" class="smart-bookmark-modal">
        <div class="smart-bookmark-modal-header">
          <h2 class="smart-bookmark-modal-title">添加书签到文件夹</h2>
        </div>
        <div class="smart-bookmark-modal-body">
          <input type="text" id="smart-bookmark-search" class="smart-bookmark-search" placeholder="搜索文件夹...">
          <ul id="smart-bookmark-folder-list" class="smart-bookmark-folder-list"></ul>
        </div>
        <div class="smart-bookmark-modal-footer">
          <button class="smart-bookmark-btn smart-bookmark-btn-secondary" id="smart-bookmark-cancel">取消</button>
          <button class="smart-bookmark-btn smart-bookmark-btn-primary" id="smart-bookmark-confirm" disabled>添加书签</button>
        </div>
      </div>
      <div id="smart-bookmark-toast" class="smart-bookmark-toast"></div>
    `;
  });

  test('should show modal when Ctrl+Shift+D is pressed', () => {
    // 模拟按键事件
    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      shiftKey: true,
      key: 'D'
    });
    
    document.dispatchEvent(event);
    
    // 验证Modal是否显示
    const modal = document.getElementById('smart-bookmark-modal');
    // 注意：由于content-script中的实际实现，这里可能需要更复杂的模拟
  });

  test('should search folders when typing in search box', () => {
    const searchInput = document.getElementById('smart-bookmark-search');
    
    // 模拟输入
    searchInput.value = 'test';
    searchInput.dispatchEvent(new Event('input'));
    
    // 验证搜索功能是否被触发
    // 注意：实际测试需要更复杂的设置来验证搜索结果
  });

  test('should select folder and enable confirm button', () => {
    // 添加模拟文件夹列表
    const folderList = document.getElementById('smart-bookmark-folder-list');
    folderList.innerHTML = `
      <li class="smart-bookmark-folder-item" data-folder-id="1">
        <span class="smart-bookmark-folder-name">测试文件夹</span>
        <span class="smart-bookmark-folder-count">5</span>
      </li>
    `;
    
    // 模拟点击文件夹
    const folderItem = document.querySelector('.smart-bookmark-folder-item');
    folderItem.click();
    
    // 验证文件夹是否被选中
    expect(folderItem.classList.contains('active')).toBe(true);
    
    // 验证确认按钮是否启用
    const confirmBtn = document.getElementById('smart-bookmark-confirm');
    expect(confirmBtn.disabled).toBe(false);
  });
});