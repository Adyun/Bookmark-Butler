# 简化版智能收藏夹扩展项目规划

## 项目概述（更新版）

一个极简的浏览器扩展，直接调用 Edge/Chrome 原生书签 API，无需后端存储，实现智能收藏夹功能。

## 核心需求（简化版）

- **主要功能**：使用 Edge/Chrome 原生书签 API，无需数据存储
- **智能排序**：基于书签访问频率排序文件夹
- **实时搜索**：使用原生书签搜索功能
- **界面形式**：浮动 Modal，直接操作现有书签

## 技术架构（极简版）

### 技术栈

- **Chrome Extension Manifest V3**
- **TypeScript**（可选，简化开发）
- **原生 JavaScript**（推荐，减少复杂度）
- **TailwindCSS**（轻量级样式）
- **Chrome Bookmarks API**（直接调用）

### 架构简化

- ❌ 移除 IndexedDB 存储
- ❌ 移除后台脚本
- ❌ 移除数据同步
- ✅ 直接使用 chrome.bookmarks API
- ✅ 实时读取现有书签结构

## 极简目录结构

```
smart-bookmark-extension/
├── manifest.json              # 扩展配置
├── src/
│   ├── content-script.js      # 内容脚本（唯一脚本）
│   ├── modal/                 # Modal组件
│   │   ├── bookmark-modal.js
│   │   ├── search-bar.js
│   │   └── folder-list.js
│   └── utils/
│       └── bookmark-api.js    # 书签API封装
├── styles/
│   └── modal.css              # 样式文件
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── popup.html                 # 简单设置页面
```

## 核心 API 使用

### 1. 获取所有书签文件夹

```javascript
chrome.bookmarks.getTree((bookmarkTree) => {
  const folders = extractFolders(bookmarkTree[0]);
});
```

### 2. 创建书签

```javascript
chrome.bookmarks.create({
  parentId: folderId,
  title: pageTitle,
  url: pageUrl,
});
```

### 3. 搜索书签文件夹

```javascript
chrome.bookmarks.search(searchTerm, (results) => {
  const folders = results.filter((item) => !item.url);
});
```

## 最近使用算法

使用书签访问频率作为排序依据：

1. 获取文件夹内书签的访问次数
2. 计算文件夹的活跃度 = 总访问次数 / 书签数量
3. 按活跃度降序排列
4. 缓存最近 5 个使用过的文件夹

## 开发计划（极简版）

### 阶段 1：基础搭建（1 天）

- [ ] 创建 manifest.json
- [ ] 实现基础 Modal 框架
- [ ] 集成 chrome.bookmarks API

### 阶段 2：核心功能（1-2 天）

- [ ] 读取书签文件夹列表
- [ ] 实现文件夹搜索
- [ ] 添加收藏功能
- [ ] 实现最近使用排序

### 阶段 3：优化体验（1 天）

- [ ] 添加键盘快捷键
- [ ] 优化搜索响应
- [ ] 美化界面样式

### 总开发时间：2-4 天

## 浏览器兼容性

- Edge 88+
- Chrome 88+
- 无需额外权限，只需`bookmarks`权限

## 所需权限（最小化）

```json
{
  "permissions": ["bookmarks", "activeTab"],
  "host_permissions": []
}
```

## 部署步骤

1. 启用开发者模式
2. 加载解压的扩展
3. 测试书签功能
4. 打包发布（可选）

## 代码示例（核心逻辑）

### Modal 触发

```javascript
// content-script.js
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === "D") {
    showBookmarkModal();
  }
});
```

### 获取文件夹

```javascript
async function getBookmarkFolders() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((tree) => {
      const folders = [];
      function traverse(nodes) {
        nodes.forEach((node) => {
          if (!node.url) {
            // 是文件夹
            folders.push({
              id: node.id,
              title: node.title,
              children: node.children || [],
            });
          }
          if (node.children) traverse(node.children);
        });
      }
      traverse(tree);
      resolve(folders);
    });
  });
}
```

### 添加书签

```javascript
async function addBookmark(folderId, title, url) {
  return chrome.bookmarks.create({
    parentId: folderId,
    title: title,
    url: url,
  });
}
```

## 优势

- **零存储**：不占用额外存储空间
- **零配置**：直接使用现有书签
- **零维护**：无需数据同步和备份
- **兼容性**：完美兼容所有 Chrome 内核浏览器
- **轻量级**：代码量<100KB，加载极快

## 注意事项

- 无法保存自定义排序（依赖原生书签结构）
- 无法记录使用历史（每次重新计算）
- 依赖浏览器书签 API 的稳定性
