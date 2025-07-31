# Smart Bookmark Extension

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)
![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Approved-brightgreen.svg)

## 简介

Smart Bookmark Extension 是一款智能书签管理 Chrome 扩展，旨在提升您的书签组织和访问效率。通过智能排序和快速搜索功能，您可以轻松将网页收藏到最相关的文件夹中。

## 功能特性

- **智能排序**: 根据活跃度自动排序书签文件夹
- **快速搜索**: 实时模糊搜索，快速定位目标文件夹
- **快捷操作**: 使用 Ctrl+Shift+B 快捷键快速收藏当前页面
- **自定义快捷键**: 支持用户自定义快捷键组合
- **性能优化**: 响应迅速，内存占用低
- **简洁界面**: 直观易用的用户界面设计
- **隐私保护**: 不收集任何个人数据

## 安装方式

### 从 Chrome Web Store 安装（推荐）

1. 访问 [Chrome Web Store](https://chrome.google.com/webstore)
2. 搜索 "Smart Bookmark Extension"
3. 点击 "添加到 Chrome"

### 开发者模式安装

1. 克隆或下载本仓库
2. 打开 Chrome 浏览器
3. 访问 `chrome://extensions/`
4. 启用"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择项目根目录

## 使用方法

1. 在任何网页上按下 `Ctrl+Shift+B`（Windows/Linux）或 `Cmd+Shift+B`（Mac）
2. 在弹出的对话框中搜索或浏览文件夹
3. 选择目标文件夹
4. 点击"添加书签"完成操作

### 自定义快捷键

用户可以通过以下步骤自定义快捷键：

1. 在浏览器地址栏输入 `chrome://extensions/` 并回车
2. 在页面右上角开启"开发者模式"
3. 点击页面底部的"键盘快捷键"链接
4. 找到本扩展的快捷键设置并修改

## 技术架构

- **核心技术**: 原生 JavaScript 和 Chrome Extension API
- **样式框架**: 原生 CSS（包含响应式设计）
- **架构模式**: 模块化设计，易于维护和扩展
- **兼容性**: 支持 Chrome 88+ 和 Edge 88+

## 项目结构

```
smart-bookmark-extension/
├── manifest.json              # 扩展配置文件
├── src/
│   ├── background.js          # 后台脚本
│   ├── content-script.js      # 内容脚本入口
│   ├── modal/                 # Modal组件
│   │   └── modal-manager.js   # Modal管理器
│   ├── utils/                 # 工具函数
│   │   ├── bookmark-api.js    # 书签API封装
│   │   ├── constants.js       # 常量定义
│   │   ├── helpers.js         # 辅助函数
│   │   ├── search-engine.js   # 搜索引擎
│   │   └── sorting-algorithm.js # 排序算法
│   └── styles/
│       └── modal.css          # 样式文件
├── icons/                     # 扩展图标
├── docs/                      # 文档
│   ├── user-guide.md          # 用户指南
│   └── chrome-store-description.md # 商店描述
└── tests/                     # 测试文件
    ├── bookmark-api.test.js   # API测试
    ├── integration.test.js    # 集成测试
    ├── performance.test.js    # 性能测试
    ├── compatibility.test.js  # 兼容性测试
    └── sorting-algorithm.test.js # 排序算法测试
```

## 开发指南

### 项目设置

```bash
# 克隆项目
git clone https://github.com/your-repo/smart-bookmark-extension.git

# 进入项目目录
cd smart-bookmark-extension
```

### 本地测试

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录

### 运行测试

```bash
# 运行单元测试
npm test

# 运行特定测试
npm test bookmark-api.test.js
```

## 性能指标

- Modal 打开时间: < 200ms
- 搜索响应时间: < 100ms
- 内存占用: < 50MB
- 支持文件夹数量: 1000+

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

### 提交 Issue

请使用清晰的标题和详细的描述来提交 Issue。

### 提交 Pull Request

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 支持

如有任何问题，请提交 Issue 或联系项目维护者。