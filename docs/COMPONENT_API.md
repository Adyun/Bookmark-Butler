# 组件 API 参考文档

## 概览

Smart Bookmark Extension v2.0 采用组件化架构，将功能拆分为独立的、可复用的组件。本文档提供各组件的API参考。

## 🎯 组件关系图

```
ModalManager (主控制器)
├── UIManager (UI管理)
├── ThemeManager (主题管理)
├── KeyboardManager (键盘导航)
└── VirtualScroller (虚拟滚动)
```

---

## VirtualScroller

**文件:** `src/components/virtual-scroller.js`  
**职责:** 高性能大列表渲染

### 构造函数

```javascript
new VirtualScroller(container, itemHeight, totalItems, renderItem)
```

**参数:**
- `container` (Element) - 滚动容器DOM元素
- `itemHeight` (Number) - 固定项目高度（像素）
- `totalItems` (Number) - 总项目数量
- `renderItem` (Function) - 渲染函数 `(item, index) => Element`

### 主要方法

#### `updateData(items)`
更新列表数据并重新渲染
```javascript
scroller.updateData(newBookmarks);
```

#### `scrollToIndex(index)`
滚动到指定项目
```javascript
scroller.scrollToIndex(5); // 滚动到第6个项目
```

#### `forceUpdate()`
强制重新计算并渲染
```javascript
scroller.forceUpdate();
```

#### `destroy()`
清理资源，移除事件监听器
```javascript
scroller.destroy();
```

### 属性

- `containerHeight` (Number) - 容器高度
- `visibleItems` (Number) - 可见项目数量
- `items` (Array) - 当前数据项
- `totalItems` (Number) - 总项目数

---

## UIManager

**文件:** `src/components/ui-manager.js`  
**职责:** UI状态管理和布局控制

### 构造函数

```javascript
new UIManager()
```

### 主要方法

#### `createModal()`
创建Modal DOM结构
```javascript
uiManager.createModal();
```

#### `showModal(pageInfo)`
显示Modal
```javascript
uiManager.showModal({
  title: '页面标题',
  url: 'https://example.com'
});
```

#### `hideModal()`
隐藏Modal
```javascript
uiManager.hideModal();
```

#### `setMode(mode)`
设置操作模式
```javascript
// 书签搜索模式
uiManager.setMode(window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH);

// 文件夹选择模式
uiManager.setMode(window.SMART_BOOKMARK_CONSTANTS.MODE_FOLDER_SELECT);
```

#### `toggleMode()`
切换模式
```javascript
uiManager.toggleMode();
```

### 状态管理方法

#### `showLoadingState(type)`
显示加载状态
```javascript
uiManager.showLoadingState('folders'); // 或 'bookmarks'
```

#### `showEmptyState(type)`
显示空状态
```javascript
uiManager.showEmptyState('folders');
```

#### `showErrorState(type, message, showPermissionButton)`
显示错误状态
```javascript
uiManager.showErrorState('folders', '加载失败', true);
```

#### `showNoResultsState(type)`
显示无搜索结果状态
```javascript
uiManager.showNoResultsState('bookmarks');
```

### 事件管理

#### `addEventListener(element, event, handler)`
添加事件监听器（自动管理清理）
```javascript
uiManager.addEventListener(button, 'click', handleClick);
```

### 属性

- `currentMode` (String) - 当前模式
- `selectedIndex` (Number) - 选中索引
- `isModalVisible` (Boolean) - Modal可见状态

---

## ThemeManager

**文件:** `src/components/theme-manager.js`  
**职责:** 主题管理和深色模式控制

### 构造函数

```javascript
new ThemeManager()
```

### 主要方法

#### `init()`
初始化主题管理器
```javascript
themeManager.init();
```

#### `saveDarkModeSetting(mode)`
保存深色模式设置
```javascript
// 模式选项
themeManager.saveDarkModeSetting('auto');  // 跟随系统
themeManager.saveDarkModeSetting('light'); // 浅色模式
themeManager.saveDarkModeSetting('dark');  // 深色模式
```

#### `applyDarkMode()`
应用当前主题设置
```javascript
themeManager.applyDarkMode();
```

#### `toggleDarkModeDropdown()`
切换主题选择下拉菜单
```javascript
themeManager.toggleDarkModeDropdown();
```

#### `getCurrentThemeState()`
获取当前主题状态
```javascript
const state = themeManager.getCurrentThemeState();
// 返回: { mode, isDark, isAuto, systemDark }
```

### 事件绑定

#### `bindEvents(addEventListenerFn)`
绑定主题相关事件
```javascript
themeManager.bindEvents((element, event, handler) => {
  return uiManager.addEventListener(element, event, handler);
});
```

### 属性

- `darkMode` (String) - 当前深色模式设置
- `systemThemeListener` (Function) - 系统主题监听器

---

## KeyboardManager

**文件:** `src/components/keyboard-manager.js`  
**职责:** 键盘导航和快捷键处理

### 构造函数

```javascript
new KeyboardManager()
```

### 主要方法

#### `init()`
初始化键盘管理器
```javascript
keyboardManager.init();
```

#### `setCurrentItems(items)`
设置当前可导航的项目列表
```javascript
keyboardManager.setCurrentItems(filteredBookmarks);
```

#### `setVirtualScroller(virtualScroller)`
设置虚拟滚动器引用
```javascript
keyboardManager.setVirtualScroller(folderVirtualScroller);
```

#### `setModalVisible(visible)`
设置Modal可见状态
```javascript
keyboardManager.setModalVisible(true);
```

#### `setCallbacks(callbacks)`
设置回调函数
```javascript
keyboardManager.setCallbacks({
  onConfirm: () => modalManager.handleConfirm(),
  onModeToggle: () => modalManager.toggleMode(),
  onModalClose: () => modalManager.hide()
});
```

#### `setSelectedIndex(index)`
设置选中索引
```javascript
keyboardManager.setSelectedIndex(3);
```

#### `getSelectedItem()`
获取当前选中项目
```javascript
const selectedItem = keyboardManager.getSelectedItem();
```

### 导航方法

#### `navigateSelection(direction)`
导航选择（内部方法）
```javascript
keyboardManager.navigateSelection(1);  // 向下
keyboardManager.navigateSelection(-1); // 向上
```

#### `navigateToFirst()`
导航到第一项
```javascript
keyboardManager.navigateToFirst();
```

#### `navigateToLast()`
导航到最后一项
```javascript
keyboardManager.navigateToLast();
```

### 支持的快捷键

| 快捷键 | 功能 |
|--------|------|
| `Escape` | 关闭Modal |
| `Space` | 切换模式（搜索框为空时） |
| `Enter` | 确认当前选择 |
| `ArrowUp` | 向上选择 |
| `ArrowDown` | 向下选择 |
| `Home` | 选择第一项 |
| `End` | 选择最后一项 |
| `PageUp` | 向上翻页 |
| `PageDown` | 向下翻页 |

### 属性

- `selectedIndex` (Number) - 当前选中索引
- `currentItems` (Array) - 当前项目列表
- `currentMode` (String) - 当前模式
- `isModalVisible` (Boolean) - Modal可见状态

---

## ModalManager

**文件:** `src/modal/modal-manager.js`  
**职责:** 主控制器，协调各组件工作

### 构造函数

```javascript
new ModalManager()
```

### 主要方法

#### `show(pageInfo)`
显示Modal
```javascript
modalManager.show({
  title: '当前页面标题',
  url: 'https://current-page.com'
});
```

#### `hide()`
隐藏Modal
```javascript
modalManager.hide();
```

#### `setMode(mode)`
设置模式并加载对应数据
```javascript
modalManager.setMode(window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH);
```

#### `toggleMode()`
切换模式
```javascript
modalManager.toggleMode();
```

### 数据加载方法

#### `loadFolders()`
加载文件夹数据
```javascript
modalManager.loadFolders();
```

#### `loadBookmarks()`
加载书签数据
```javascript
modalManager.loadBookmarks();
```

#### `handleSearch(query)`
处理搜索
```javascript
modalManager.handleSearch('搜索关键词');
```

### 清理方法

#### `cleanup()`
清理所有组件和资源
```javascript
modalManager.cleanup();
```

### 属性

- `currentPageInfo` (Object) - 当前页面信息
- `allFolders` (Array) - 所有文件夹
- `filteredFolders` (Array) - 过滤后的文件夹
- `allBookmarks` (Array) - 所有书签
- `filteredBookmarks` (Array) - 过滤后的书签

---

## 使用示例

### 基本使用

```javascript
// 创建Modal管理器
const modalManager = new ModalManager();

// 显示Modal
modalManager.show({
  title: document.title,
  url: window.location.href
});

// 隐藏Modal
modalManager.hide();
```

### 组件独立使用

```javascript
// 独立使用虚拟滚动器
const container = document.getElementById('list-container');
const scroller = new VirtualScroller(
  container,
  48, // 项目高度
  1000, // 总项目数
  (item, index) => {
    const div = document.createElement('div');
    div.textContent = item.title;
    return div;
  }
);

scroller.updateData(myDataArray);
```

### 主题管理

```javascript
// 独立使用主题管理器
const themeManager = new ThemeManager();
themeManager.init();

// 切换到深色模式
themeManager.saveDarkModeSetting('dark');

// 检查当前主题
const themeState = themeManager.getCurrentThemeState();
console.log('当前是深色模式:', themeState.isDark);
```

---

## 最佳实践

### 1. 内存管理
始终调用cleanup方法清理资源：
```javascript
// 在页面卸载或组件销毁时
modalManager.cleanup();
```

### 2. 事件处理
使用组件提供的事件管理方法：
```javascript
// 好的做法
uiManager.addEventListener(button, 'click', handler);

// 避免直接添加事件监听器
// button.addEventListener('click', handler); // 可能导致内存泄漏
```

### 3. 错误处理
处理组件可能的错误状态：
```javascript
try {
  modalManager.loadBookmarks();
} catch (error) {
  uiManager.showErrorState('bookmarks', '加载失败');
}
```

### 4. 性能优化
合理使用虚拟滚动器的更新方法：
```javascript
// 数据变化时
scroller.updateData(newData);

// 容器尺寸变化时
scroller.forceUpdate();
```

---

## 常见问题

**Q: 如何添加新的键盘快捷键？**

A: 在KeyboardManager的handleKeyDown方法中添加新的case：
```javascript
case 'F1':
  e.preventDefault();
  if (this.onShowHelp) {
    this.onShowHelp();
  }
  break;
```

**Q: 如何自定义虚拟滚动的渲染？**

A: 传入自定义的renderItem函数：
```javascript
const customRender = (item, index) => {
  const element = document.createElement('div');
  element.className = 'custom-item';
  element.innerHTML = `<strong>${item.title}</strong>`;
  return element;
};

new VirtualScroller(container, 48, items.length, customRender);
```

**Q: 如何添加新的主题？**

A: 在ThemeManager中扩展主题选项，并在CSS中添加对应的样式类。

---

**版本**: v2.0  
**最后更新**: 2024年12月  
**相关文档**: [重构架构指南](REFACTORING_GUIDE.md)