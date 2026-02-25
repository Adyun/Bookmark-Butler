# 书签标签功能实现方案（优化版 v2）

为 Smart Bookmark Extension 增加标签（Tags）系统，支持书签与文件夹打标签、标签搜索、标签筛选、右键编辑标签，并确保不破坏现有键盘交互与虚拟滚动稳定性。

## 目标与约束

1. 支持 `bookmark` + `folder` 两类对象的标签管理。
2. 搜索可命中标签，且保持现有排序体系（标题优先，标签次之，URL 最低）。
3. 类型筛选（`all/bookmark/folder`）与标签筛选并行叠加，不互相覆盖。
4. 保持 `Tab` 仅循环三种固定类型筛选，不把动态标签混进键盘循环。
5. 不改造为可变高度虚拟列表，避免滚动错位。

---

## 变更计划

### 1) 数据管理层

#### [NEW] `src/utils/tag-manager.js`

参考 `pin-manager.js` 的 IIFE + `chrome.storage.local` + `storage.onChanged` 同步模式。

**存储结构（避免类型冲突）：**
```javascript
{
  "smart_bookmark_tags_v1": {
    "bookmarks": {
      "123": ["工作", "设计"]
    },
    "folders": {
      "456": ["项目A"]
    }
  }
}
```

**核心 API（暴露到 `window.SMART_BOOKMARK_TAGS`）：**

| 方法 | 说明 |
|---|---|
| `loadTags()` | 从存储加载 |
| `saveTags(tagsState)` | 保存完整状态 |
| `getTagsForItem(type, id)` | 读取某项标签（`type: 'bookmarks' \| 'folders'`） |
| `setTagsForItem(type, id, tags[])` | 覆盖设置某项标签 |
| `removeAllTagsForItem(type, id)` | 删除某项全部标签 |
| `getAllTags(type?)` | 获取去重标签（可按类型或全部） |
| `getItemsByTag(type, tag)` | 获取命中标签的 ID 集合 |
| `pruneOrphanTags(validBookmarkIds, validFolderIds)` | 清理孤儿标签 |
| `generateTagColor(tag)` | 标签名 hash 生成稳定颜色 |
| `addChangeListener(cb)` | 订阅标签变化 |

**规范化规则：**

1. 标签 `trim` 后保存，空字符串丢弃。
2. 单项标签去重（大小写不敏感去重，展示保留首个原文）。
3. 限制单项标签数量（建议 20）与单标签长度（建议 24）防止 UI 撑爆。

---

### 2) 数据装载与清理链路

#### [MODIFY] `src/modal/modal-manager-data.js`

1. `loadBookmarks()` 后将 `tags` 合并进每个书签对象：`item.tags = getTagsForItem('bookmarks', item.id)`。
2. `loadFolders()` 后将 `tags` 合并进每个文件夹对象：`item.tags = getTagsForItem('folders', item.id)`。
3. 在数据加载后调用 `pruneOrphanTags(...)`，清理删除后残留标签。

#### [MODIFY] `src/modal/modal-manager-navigation.js`

在 `executeDeleteBookmark` 成功后，调用：
`removeAllTagsForItem('bookmarks', bookmarkId)`，避免脏标签残留。

---

### 3) 搜索引擎集成（修复标签搜索漏检）

#### [MODIFY] `src/utils/search-engine.js`

1. `indexBookmark` / `indexFolder` 将 `tags` 文本加入索引（倒排 + Trie）。
2. 回退路径 `fallbackSearch` 构造结果时保留 `tags` 字段，防止后续过滤/渲染丢失。
3. 书签评分：在 `calculateBookmarkScore` 中加入标签评分。
4. 文件夹评分：新增 `calculateFolderScore(folder, query)`（标题 + 标签），替代仅标题评分。
5. 多关键词语义保持“AND”：每个关键词至少命中 `title/url/tags` 之一，否则该项得分为 0。

**建议权重：**

1. 标题：exact 1.0 / prefix 0.8 / include 0.5
2. 标签：exact 0.7 / prefix 0.55 / include 0.4
3. URL：include 0.3（再乘低权重系数）

---

### 4) 标签筛选（与类型筛选解耦）

#### [MODIFY] `src/modal/modal-manager-core.js`

1. 保持 `filterTypes = ['all', 'bookmark', 'folder']` 不变。
2. 新增状态：`currentTagFilter = null`。

#### [MODIFY] `src/components/ui-manager.js`

新增 `updateTagFilterTabs(tags, activeTag)`：

1. 在固定三类 tab 后追加标签 tab。
2. 标签 tab 使用 `data-filter-tag`；类型 tab 保持 `data-filter` 或升级为 `data-filter-type`。
3. 激活中的标签 tab 有独立 `active` 样式。

#### [MODIFY] `src/modal/modal-manager-core.js`（点击委托）

筛选栏点击分流：

1. 点击类型 tab -> `setFilter(type)`。
2. 点击标签 tab -> `setTagFilter(tag)`。
3. 点击当前激活标签 -> `clearTagFilter()`（toggle 行为）。

#### [MODIFY] `src/modal/modal-manager-search.js`

新增：

1. `setTagFilter(tag)`
2. `clearTagFilter()`
3. `refreshFilterBarState()`（统一刷新 tab active 态）

#### [MODIFY] `src/modal/modal-manager-render.js`

`updateBookmarkList()` 过滤顺序：

1. 先按 `currentFilter`（类型）过滤。
2. 再按 `currentTagFilter`（标签）过滤。
3. `itemType === 'back'` 的返回项在文件夹视图下始终保留，不参与标签过滤。

---

### 5) 列表渲染与样式（兼容虚拟滚动固定高度）

#### [MODIFY] `src/modal/modal-manager-render.js`

1. 在 `renderBookmarkItem` / `renderFolderItem` 渲染标签区域。
2. 标签点击可直接触发 `setTagFilter(tag)`。
3. 搜索词命中标签时支持高亮文本（仅标签文案内高亮）。

#### [MODIFY] `src/styles/modal.css`

新增：

1. `.smart-bookmark-tags-container`
2. `.smart-bookmark-tag`
3. `.smart-bookmark-tag-more`（`+N`）

**关键约束：**

1. 列表内标签区使用单行展示（`no-wrap`），最多显示 2 个标签 + `+N`。
2. 不使用 `flex-wrap`，避免虚拟滚动固定行高失效。
3. 如需增加视觉空间，统一调高 `itemHeight`（例如 58 -> 68）并同步相关 CSS 最小高度。

---

### 6) 右键菜单与标签编辑

#### [MODIFY] `src/modal/modal-manager-navigation.js`

1. `showContextMenu` 支持书签与文件夹：
   - 书签菜单：`编辑标签` + `删除`
   - 文件夹菜单：仅 `编辑标签`
2. `handleContextMenuAction` 增加 `editTags` 分支。
3. 新增 `showTagEditor(item, itemType)`：
   - 输入框
   - 已选标签 chips
   - 自动补全下拉（来源 `getAllTags()`）
   - 保存/取消

**交互要求：**

1. 弹窗打开时拦截键盘事件并阻止穿透到主列表。
2. 保存成功后刷新：对象 tags、列表渲染、筛选栏标签 tabs。
3. 若保存后当前 `currentTagFilter` 已无任何项，自动清空 `currentTagFilter`，避免空白困惑。

---

### 7) 国际化

#### [MODIFY] `src/components/language-manager.js`

新增键：

| Key | 中文 | English |
|---|---|---|
| `editTags` | 编辑标签 | Edit Tags |
| `tagEditorTitle` | 管理标签 | Manage Tags |
| `tagPlaceholder` | 输入标签名称... | Enter tag name... |
| `tagSaved` | 标签已保存 | Tags saved |
| `tagSaveFailed` | 标签保存失败 | Failed to save tags |
| `noTags` | 暂无标签 | No tags |
| `tagFilterAll` | 全部标签 | All tags |
| `keyboardHintFilter` | Tab 切换筛选 | Tab Cycle Filter |

说明：`keyboardHintFilter` 需补进现有键盘提示更新逻辑，避免第 4 个提示仍是硬编码。

---

### 8) 模块注册

#### [MODIFY] `manifest.json`

在 `content_scripts.js` 中 `pin-manager.js` 之后加入：
`src/utils/tag-manager.js`

---

## 实施顺序（建议）

1. 先实现 `tag-manager.js`（含存储同步与 API）。
2. 再打通数据装载（`loadBookmarks/loadFolders` 附着 tags）。
3. 修改 `search-engine.js`（索引 + fallback + score）。
4. 接入筛选状态与 UI（类型筛选/标签筛选解耦）。
5. 增加右键编辑标签弹窗。
6. 最后完善样式与 i18n。

---

## 实施注意事项（代码核对结论）

1. 筛选栏事件委托需要扩展  
当前 `bindEvents` 仅处理 `tab.dataset.filter`。接入标签 tab 后需同时处理 `data-filter-tag`（或统一改为 `data-filter-type` + `data-filter-tag` 两路分发），否则标签按钮点击无效。

2. 文件夹分支需要补 `contextmenu` 绑定  
当前右键菜单监听只在书签分支。若文件夹也支持编辑标签，需在文件夹渲染分支补充右键监听并调用同一菜单入口。

3. `showContextMenu` 参数建议重命名  
现有 `isSpecialUrl` 守卫对文件夹不会误拦截（文件夹无 `url`），逻辑可复用；但参数名 `bookmark` 建议改为 `item`，避免语义混淆。

4. `enterFolder` 需补标签注入  
`enterFolder` 内部直接组装 `combinedItems`，不会经过 `loadBookmarks/loadFolders` 的 tags 注入链路。需在该函数中对 `subFolders` 与 `bookmarks` 同步附着 `tags`。

5. `pruneOrphanTags` 不能单侧触发  
`loadBookmarks` 与 `loadFolders` 分别异步执行，孤儿清理必须在“书签 ID + 文件夹 ID”都可用时触发，否则有误删风险。建议使用“双侧就绪标记”后再执行。

6. 标签保存后的刷新策略按视图分流  
在搜索视图可走 `handleSearch` 重算；在文件夹视图（`isInFolderView=true`）不要直接走 `handleSearch`，应走 `enterFolder` 重新拉取，或就地更新当前 `filteredBookmarks` 后 `updateBookmarkList`。

---

## 实施状态（2026-02-25）

### 已闭环（本轮新增）

| 项 | 结果 | 代码落点 |
|---|---|---|
| `enterFolder` 标签注入链路补齐 | 已完成：进入文件夹时先等待 `SMART_BOOKMARK_TAGS.loadTags()`，再给子文件夹/书签附着 `tags` | `src/modal/modal-manager-navigation.js` |
| 文件夹视图刷新策略 | 已完成：标签保存后若在文件夹视图，走 `enterFolder(currentFolderId, ..., { skipHistoryPush: true })` 刷新，避免误走全局搜索 | `src/modal/modal-manager-navigation.js` |
| 导航栈污染问题 | 已完成：`enterFolder` 增加 `skipHistoryPush`，用于“就地刷新”不入栈 | `src/modal/modal-manager-navigation.js` |
| `pruneOrphanTags` 触发时机 | 已完成：新增 `maybePruneOrphanTags()`，仅在书签与文件夹数据都就绪后清理 | `src/modal/modal-manager-data.js` + `src/modal/modal-manager-core.js` |
| 标签保存后的 UI/状态同步顺序 | 已完成：先判断并清理失效 `currentTagFilter`，再更新标签 tabs，再 `refreshFilterBarState()` | `src/modal/modal-manager-navigation.js` |
| 标签保存后的数据一致性 | 已完成：保存后同步更新 `allBookmarks/allFolders/filteredBookmarks/filteredFolders/navigationStack` 中同 ID 项的 `tags` | `src/modal/modal-manager-navigation.js` |
| 模式/关闭时筛选残留 | 已完成：`setMode(bookmark)` 与 `hide()` 均统一重置 `currentFilter/currentTagFilter` 并刷新筛选栏状态 | `src/modal/modal-manager-navigation.js` + `src/modal/modal-manager-core.js` |
| 标签筛选大小写一致性 | 已完成：tab 激活与点击 toggle 改为大小写不敏感比较 | `src/modal/modal-manager-core.js` + `src/modal/modal-manager-search.js` + `src/components/ui-manager.js` |

### 已闭环（前序修复，已在代码中）

| 项 | 结果 | 代码落点 |
|---|---|---|
| 标签渲染 XSS | 已完成：标签文本在 `innerHTML` 前做 `escapeHtml` | `src/modal/modal-manager-render.js` |
| 右键菜单 Enter 分支变量错误 | 已完成：统一走 `handleContextMenuAction(action, item, itemType)` | `src/modal/modal-manager-navigation.js` |
| 筛选栏事件委托扩展 | 已完成：支持 `data-filter` + `data-filter-tag` 双路分发 | `src/modal/modal-manager-core.js` |
| 文件夹右键菜单绑定 | 已完成：文件夹项新增 `contextmenu` 监听 | `src/modal/modal-manager-render.js` |
| 列表内标签点击筛选 | 已完成：`bookmarkList` 事件委托处理 `.smart-bookmark-tag` 点击 | `src/modal/modal-manager-core.js` + `src/modal/modal-manager-render.js` |
| `showContextMenu` 语义修正 | 已完成：参数语义从 `bookmark` 扩展为 `item`（兼容文件夹） | `src/modal/modal-manager-navigation.js` |
| 删除书签后标签清理 | 已完成：`executeDeleteBookmark` 成功后清理该书签标签 | `src/modal/modal-manager-navigation.js` |
| 标签加载竞态 | 已完成：`loadBookmarks/loadFolders/enterFolder/showTagEditor` 在需要时先确保 `loadTags` | `src/modal/modal-manager-data.js` + `src/modal/modal-manager-navigation.js` |

### 待补（文档与实现仍有差异）

| 项 | 当前状态 | 备注 |
|---|---|---|
| `keyboardHintFilter` 文案接入 | 未落地 | 目前 `language-manager` 仍只更新 3 条键盘提示，第 4 条（Tab 筛选）仍是结构中硬编码文本 |
| `tagFilterAll` 使用场景 | 未落地 | 当前筛选栏未使用该键；可作为后续“标签总览/全部标签”入口文案预留 |

---

## 验证计划（含回归）

1. 书签标签编辑：右键书签 -> 编辑标签 -> 保存 -> 列表即时更新。
2. 文件夹标签编辑：右键文件夹 -> 编辑标签 -> 保存 -> 列表即时更新。
3. 标签搜索（索引路径）：输入标签关键词可命中书签/文件夹。
4. 标签搜索（fallback 路径）：索引未完成时仍可命中标签。
5. 类型筛选 + 标签筛选叠加：`bookmark + 某标签`、`folder + 某标签` 均正确。
6. 文件夹视图返回项：开启标签筛选后 `back` 项仍可见、可返回。
7. Tab 键行为：仅循环 `all/bookmark/folder`，不进入动态标签 tab。
8. 删除回收：删除书签后标签被清理，不再出现在标签筛选栏。
9. 主题/语言切换：标签颜色、文案、弹窗文本、提示文本正常。
10. 虚拟滚动稳定性：长标签/多标签下无重叠、无跳动、无错位。
11. 持久化：关闭重开标签不丢失，跨页面更新可同步。
