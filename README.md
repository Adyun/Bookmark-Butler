> 本项目基于 Vibe Coding 生成。正式发布或上架商店前，建议你自行完成代码审查、测试和商店素材打磨。

# Bookmark Butler

![License](https://img.shields.io/badge/license-GPLv3-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)
![Chrome Web Store](https://img.shields.io/badge/Google%20Chrome-Available-4285F4.svg)
![Microsoft Edge Add-ons](https://img.shields.io/badge/Microsoft%20Edge-Available-0A7ACD.svg)

Bookmark Butler 是一款面向 Chrome 与 Edge 等兼容浏览器的书签管理扩展，主打快速收藏、即时搜索和轻量整理。它会直接在当前页面内打开管理界面，让你搜索书签或文件夹，并在不把数据发送到外部服务的前提下，更高效地管理大量书签。

> 已正式上架：
> - Google Chrome 商店：https://chromewebstore.google.com/detail/bookmark-butler/nbhlidmjiphicgnojapojbbjknfhpiib
> - Microsoft Edge 商店：https://microsoftedge.microsoft.com/addons/detail/bookmark-butler/nceipfijlhmmemjdhjhdclafbaffjaad

## 功能特性

- 快速将当前页面保存到任意书签文件夹。
- 在同一个界面中搜索书签和文件夹。
- 基于书签元数据和本地使用信号，对文件夹进行更智能的排序。
- 支持置顶重要的书签或文件夹，方便优先访问。
- 支持为书签和文件夹添加自定义标签。
- 支持按类型和标签筛选结果。
- 支持导出和导入本地扩展元数据，包括标签、置顶和搜索历史。
- 支持切换主题模式、主题颜色和界面语言。
- 支持键盘快捷操作和虚拟列表，适合大量数据场景。

## 安装方式

### 从官方商店安装

- Google Chrome 商店：https://chromewebstore.google.com/detail/bookmark-butler/nbhlidmjiphicgnojapojbbjknfhpiib
- Microsoft Edge 商店：https://microsoftedge.microsoft.com/addons/detail/bookmark-butler/nceipfijlhmmemjdhjhdclafbaffjaad

### 开发者模式加载

1. 下载或克隆本仓库。
2. 打开 Chrome 的 `chrome://extensions/`，或 Edge 的 `edge://extensions/`。
3. 开启 `Developer mode`。
4. 点击 `Load unpacked`。
5. 选择当前项目目录。

### 本地打包

1. 准备好品牌素材、截图和商店文案。
2. 打开 `chrome://extensions/`。
3. 使用 `Pack extension` 生成可分发安装包。
4. 将安装包用于本地分发或手动测试。
5. 如需再次提交商店，请同步更新权限用途说明和隐私说明。

## 使用方式

1. 打开任意普通网页。
2. 点击扩展图标，或者在 `chrome://extensions/shortcuts` 中为它设置快捷键。
3. 在弹出的管理面板中搜索文件夹或书签。
4. 选择目标文件夹来保存当前页面，或者浏览已有书签。
5. 借助标签、置顶、筛选和键盘导航更高效地管理内容。

## 权限说明

- `bookmarks`：读取、创建、搜索和删除书签与书签文件夹。
- `activeTab`：在用户主动打开扩展时读取当前标签页的标题和 URL。
- `storage`：保存主题、语言、标签、置顶、缓存和查询历史等本地元数据。
- `scripting`：在用户触发扩展后，将弹窗界面注入到当前页面。
- `notifications`：在浏览器受限页面无法注入时，展示备用提示。

## 隐私说明

Bookmark Butler 采用本地优先设计，主要在浏览器本地运行。

- 不需要注册账号。
- 不包含统计分析、追踪像素或广告 SDK。
- 不会将书签数据、页面 URL、标签、置顶信息或搜索历史发送到我们的服务器。
- 不会出售或与第三方共享个人信息。

扩展只会通过浏览器存储 API 在用户设备本地保存数据：

- 书签访问依赖浏览器提供的 `chrome.bookmarks` API。
- 本地偏好设置和扩展元数据保存在 `chrome.storage.local`。
- 只有当用户主动执行导出时，才会生成备份文件。

当前可能保存在本地的数据包括：

- 语言偏好
- 主题模式和主题颜色
- 书签缓存数据
- 置顶的书签和文件夹
- 自定义标签及标签筛选统计
- 用于优化排序和搜索结果的本地查询历史

如果扩展在 `chrome://` 等浏览器内部受限页面被触发，它不会读取这些页面的内容，而是走本地备用流程，因为浏览器本身不允许内容脚本在这些页面运行。

用于商店提交的独立隐私政策文件见 [PRIVACY_POLICY.md](PRIVACY_POLICY.md)。

## 项目结构

```text
Bookmark-Butler/
├── manifest.json
├── src/
│   ├── background.js
│   ├── content-script.js
│   ├── components/
│   │   ├── keyboard-manager.js
│   │   ├── language-manager.js
│   │   ├── theme-manager.js
│   │   ├── ui-manager.js
│   │   └── virtual-scroller.js
│   ├── modal/
│   │   ├── modal-manager-core.js
│   │   ├── modal-manager-data.js
│   │   ├── modal-manager-export.js
│   │   ├── modal-manager-navigation.js
│   │   ├── modal-manager-render.js
│   │   └── modal-manager-search.js
│   ├── styles/
│   │   └── modal.css
│   └── utils/
│       ├── bookmark-api.js
│       ├── constants.js
│       ├── data-export-import.js
│       ├── helpers.js
│       ├── pin-manager.js
│       ├── query-history.js
│       ├── search-engine.js
│       ├── sorting-algorithm.js
│       └── tag-manager.js
├── icons/
└── docs/
```

## 开发说明

更详细的技术文档可参考 [docs/REFACTORING_GUIDE.md](docs/REFACTORING_GUIDE.md)、[docs/COMPONENT_API.md](docs/COMPONENT_API.md) 和 [docs/user-guide.md](docs/user-guide.md)。

### 本地开发

```bash
git clone https://github.com/Adyun/Bookmark-Butler.git
cd Bookmark-Butler
```

### 可用脚本

```bash
npm run lint
```

## 商店上架说明

当前项目已经完成 Google Chrome 商店与 Microsoft Edge 商店上架，常用入口如下：

- Google Chrome 商店：https://chromewebstore.google.com/detail/bookmark-butler/nbhlidmjiphicgnojapojbbjknfhpiib
- Microsoft Edge 商店：https://microsoftedge.microsoft.com/addons/detail/bookmark-butler/nceipfijlhmmemjdhjhdclafbaffjaad

仓库内同时保留了商店审核与文案材料，方便后续迭代版本继续复用：

- `manifest.json` 中的英文产品名和英文描述
- 默认英文界面
- 明确的权限用途说明
- 说明“数据仅保存在本地”的隐私声明
- 可直接复用的商店文案草稿，见 `docs/chrome-store-description.md`

## 许可证

本项目基于 GNU GPL v3 协议发布，详见 [LICENSE](LICENSE)。
