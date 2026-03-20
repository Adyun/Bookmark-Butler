// Language Manager for the Smart Bookmark Extension

/**
 * 语言管理器 - 处理多语言切换和本地化
 */
function LanguageManager() {
  this.currentLanguage = 'en'; // Default to English
  this.translations = {
    zh: {
      // 模态框标题和按钮
      modalTitle: '打开书签',
      addBookmarkTitle: '添加书签',
      searchPlaceholder: '搜索书签...',
      searchFolderPlaceholder: '搜索文件夹...',
      cancelBtn: '取消',
      confirmBtn: '添加书签',

      // 键盘提示
      keyboardHintSelect: '↑↓ 选择',
      keyboardHintConfirm: 'Enter 确认',
      keyboardHintToggle: 'Space 切换模式',
      keyboardHintFilterCycle: 'Tab 切换筛选',

      // 状态提示
      loadingText: '加载中...',
      emptyBookmarks: '暂无书签',
      emptyFolders: '暂无文件夹',
      noResults: '无搜索结果',
      errorText: '加载失败',
      loadingFolders: '正在加载书签文件夹...',
      loadingBookmarks: '正在加载书签...',
      emptyBookmarksDetailed: '没有书签，请先创建一些书签',
      emptyFoldersDetailed: '没有书签文件夹，请先创建一些书签',
      noResultsBookmarks: '未找到匹配的书签，请尝试其他关键词',
      noResultsFolders: '未找到匹配的文件夹，请尝试其他关键词',

      // Toast消息
      bookmarkAdded: '书签添加成功！',
      bookmarkAddFailed: '添加书签失败，请重试',
      specialUrlWarning: '无法打开特殊URL，请手动在浏览器中访问',
      permissionFailed: '权限获取失败，请手动在扩展管理页面授予权限',
      permissionRequestFailed: '权限请求失败，请手动在扩展管理页面授予权限',
      permissionReloading: '权限获取成功，正在重新加载书签...',
      bookmarkFeatureUnavailable: '书签功能不可用，请检查扩展权限',
      bookmarksPermissionRequiredMessage: '缺少书签权限，请点击下方按钮授予权限',
      loadFoldersFailed: '加载书签文件夹失败',
      loadBookmarksFailed: '加载书签失败',
      noFoldersFound: '没有找到书签文件夹，请先创建一些书签',
      noBookmarksFound: '没有找到书签，请先创建一些书签',
      bookmarkDataInvalid: '书签数据格式错误，请重试',

      // 删除书签
      deleteConfirmTitle: '确认删除',
      deleteConfirmMessage: '确定要删除书签「{title}」吗？此操作不可撤销。',
      deleteConfirmBtn: '删除',
      deleteCancelBtn: '取消',
      bookmarkDeleted: '书签已删除',
      bookmarkDeleteFailed: '删除书签失败，请重试',

      // 重复检测
      duplicateFound: '发现重复书签',
      duplicatesFound: '发现 {count} 个重复书签',
      duplicateMessage: '以下位置已存在相同的书签：',
      duplicateCancel: '取消',
      duplicateStillAdd: '仍然添加',
      duplicateJumpTo: '跳转到已有书签',

      // 主题和语言设置
      themeSettings: '主题设置',
      themeColorSettings: '主题颜色',
      languageSettings: '语言设置',
      followSystem: '跟随系统',
      lightMode: '浅色模式',
      darkMode: '深色模式',
      defaultBlue: '默认蓝色',
      classicBlue: '经典蓝色',
      classicRed: '经典红色',
      freshGreen: '清新绿色',
      warmPink: '温馨粉色',
      elegantPurple: '优雅紫色',
      neutralGray: '中性灰色',

      // 权限相关
      permissionTitle: '需要书签权限',
      permissionDescription: '请授予书签访问权限以使用此功能',
      grantPermission: '授予权限',

      // 面包屑
      rootDirectory: '根目录',
      searchResultsLabel: '搜索结果',
      backToParentTitle: '返回上一级',
      backToParentHint: '点击或按回车键返回',
      currentLocationPrefix: '当前：',
      untitledFolder: '未命名文件夹',
      untitledBookmark: '未命名书签',
      bookmarksBar: '书签栏',
      otherBookmarks: '其他书签',
      mobileBookmarks: '移动设备书签',
      folderSummaryContains: '内含 {parts}',
      folderSummaryPartFolders: '{count} 个文件夹',
      folderSummaryPartBookmarks: '{count} 个书签',
      folderSummaryJoiner: '，',
      folderSummaryEmpty: '空文件夹',

      // 标签功能
      editTags: '编辑标签',
      tagEditorTitle: '管理标签',
      tagEditorTitleWithTarget: '{title} · {type}：{target}',
      tagPlaceholder: '输入标签名称...',
      tagSaved: '标签已保存',
      tagSaveFailed: '标签保存失败',
      tagSaveBtn: '保存',
      noTags: '暂无标签',
      tagEditorHint: '↑↓ 选建议 · Enter 添加 · Ctrl+Enter 保存 · Esc 取消',
      tagEditorFolderLabel: '文件夹',
      tagEditorBookmarkLabel: '链接',

      // 筛选分组
      filterTypeLabel: '类型',
      filterTagLabel: '标签',
      filterAllTab: '全部',
      filterBookmarkTab: '链接',
      filterFolderTab: '文件夹',
      filterTagEmpty: '未选择',
      filterSummaryPrefix: '筛选',
      filterSummaryType: '类型',
      filterSummaryTag: '标签',
      moreTags: '更多标签',
      tagFilterSearchPlaceholder: '搜索标签...',
      noMatchingTags: '没有匹配标签',

      // 数据管理
      dataManagement: '数据管理',
      exportData: '导出数据',
      importData: '导入数据'
    },
    en: {
      // Modal titles and buttons
      modalTitle: 'Search Bookmarks',
      addBookmarkTitle: 'Add Bookmark',
      searchPlaceholder: 'Search bookmarks...',
      searchFolderPlaceholder: 'Search folders...',
      cancelBtn: 'Cancel',
      confirmBtn: 'Add Bookmark',

      // Keyboard hints
      keyboardHintSelect: '↑↓ Select',
      keyboardHintConfirm: 'Enter Confirm',
      keyboardHintToggle: 'Space Toggle Mode',
      keyboardHintFilterCycle: 'Tab Cycle Filter',

      // Status messages
      loadingText: 'Loading...',
      emptyBookmarks: 'No bookmarks',
      emptyFolders: 'No folders',
      noResults: 'No search results',
      errorText: 'Failed to load',
      loadingFolders: 'Loading bookmark folders...',
      loadingBookmarks: 'Loading bookmarks...',
      emptyBookmarksDetailed: 'No bookmarks yet. Create some bookmarks first.',
      emptyFoldersDetailed: 'No bookmark folders yet. Create some bookmarks first.',
      noResultsBookmarks: 'No matching bookmarks found. Try another keyword.',
      noResultsFolders: 'No matching folders found. Try another keyword.',

      // Toast messages
      bookmarkAdded: 'Bookmark added successfully!',
      bookmarkAddFailed: 'Failed to add bookmark, please try again',
      specialUrlWarning: 'Cannot open special URL, please visit manually in browser',
      permissionFailed: 'Permission request failed, please grant manually in extension management page',
      permissionRequestFailed: 'Permission request failed, please grant manually in extension management page',
      permissionReloading: 'Permission granted. Reloading bookmarks...',
      bookmarkFeatureUnavailable: 'Bookmarks are unavailable. Please check extension permissions.',
      bookmarksPermissionRequiredMessage: 'Bookmark permission is required. Click the button below to grant access.',
      loadFoldersFailed: 'Failed to load bookmark folders.',
      loadBookmarksFailed: 'Failed to load bookmarks.',
      noFoldersFound: 'No bookmark folders found. Create some bookmarks first.',
      noBookmarksFound: 'No bookmarks found. Create some bookmarks first.',
      bookmarkDataInvalid: 'Bookmark data is invalid. Please try again.',

      // Delete bookmark
      deleteConfirmTitle: 'Confirm Delete',
      deleteConfirmMessage: 'Are you sure you want to delete bookmark "{title}"? This action cannot be undone.',
      deleteConfirmBtn: 'Delete',
      deleteCancelBtn: 'Cancel',
      bookmarkDeleted: 'Bookmark deleted',
      bookmarkDeleteFailed: 'Failed to delete bookmark, please try again',

      // Duplicate detection
      duplicateFound: 'Duplicate Bookmark Found',
      duplicatesFound: '{count} Duplicate Bookmarks Found',
      duplicateMessage: 'This bookmark already exists in:',
      duplicateCancel: 'Cancel',
      duplicateStillAdd: 'Add Anyway',
      duplicateJumpTo: 'Jump to Existing',

      // Theme and language settings
      themeSettings: 'Theme Settings',
      themeColorSettings: 'Theme Colors',
      languageSettings: 'Language Settings',
      followSystem: 'Follow System',
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
      defaultBlue: 'Default Blue',
      classicRed: 'Classic Red',
      freshGreen: 'Fresh Green',
      warmPink: 'Warm Pink',
      elegantPurple: 'Elegant Purple',
      classicBlue: 'Classic Blue',
      neutralGray: 'Neutral Gray',

      // Permission related
      permissionTitle: 'Bookmark Permission Required',
      permissionDescription: 'Please grant bookmark access permission to use this feature',
      grantPermission: 'Grant Permission',

      // Breadcrumbs
      rootDirectory: 'Root Directory',
      searchResultsLabel: 'Search Results',
      backToParentTitle: 'Back to Parent',
      backToParentHint: 'Click or press Enter to go back',
      currentLocationPrefix: 'Current: ',
      untitledFolder: 'Untitled Folder',
      untitledBookmark: 'Untitled Bookmark',
      bookmarksBar: 'Bookmarks Bar',
      otherBookmarks: 'Other Bookmarks',
      mobileBookmarks: 'Mobile Bookmarks',
      folderSummaryContains: 'Contains {parts}',
      folderSummaryPartFolders: '{count} folder{suffix}',
      folderSummaryPartBookmarks: '{count} bookmark{suffix}',
      folderSummaryJoiner: ', ',
      folderSummaryEmpty: 'Empty folder',

      // Tags
      editTags: 'Edit Tags',
      tagEditorTitle: 'Manage Tags',
      tagEditorTitleWithTarget: '{title} · {type}: {target}',
      tagPlaceholder: 'Enter tag name...',
      tagSaved: 'Tags saved',
      tagSaveFailed: 'Failed to save tags',
      tagSaveBtn: 'Save',
      noTags: 'No tags',
      tagEditorHint: '↑↓ choose · Enter add · Ctrl+Enter save · Esc cancel',
      tagEditorFolderLabel: 'Folder',
      tagEditorBookmarkLabel: 'Link',

      // Filter groups
      filterTypeLabel: 'Type',
      filterTagLabel: 'Tag',
      filterAllTab: 'All',
      filterBookmarkTab: 'Links',
      filterFolderTab: 'Folders',
      filterTagEmpty: 'Not selected',
      filterSummaryPrefix: 'Filter',
      filterSummaryType: 'Type',
      filterSummaryTag: 'Tag',
      moreTags: 'More Tags',
      tagFilterSearchPlaceholder: 'Search tags...',
      noMatchingTags: 'No matching tags',

      // Data management
      dataManagement: 'Data Management',
      exportData: 'Export Data',
      importData: 'Import Data'
    }
  };

  this.init();
}

/**
 * 获取 Shadow Root（辅助方法）
 * @returns {ShadowRoot|Document}
 */
LanguageManager.prototype.getRoot = function () {
  return window.getSmartBookmarkRoot();
};

/**
 * 初始化语言管理器
 */
LanguageManager.prototype.init = function () {
  // 从存储中恢复语言设置
  this.loadLanguageFromStorage();
  // 与其他上下文同步
  this.setupStorageChangeListener();
  this.syncFromChromeStorage && this.syncFromChromeStorage();
};

/**
 * 从存储中加载语言设置
 */
LanguageManager.prototype.loadLanguageFromStorage = function () {
  var self = this;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['smartBookmarkLanguage'], function (result) {
      if (result.smartBookmarkLanguage) {
        self.currentLanguage = result.smartBookmarkLanguage;
      }
      self.updateUI();
    });
  } else {
    this.updateUI();
  }
};

/**
 * 保存语言设置到存储
 * @param {string} language - 语言代码
 */
LanguageManager.prototype.saveLanguageToStorage = function (language) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ smartBookmarkLanguage: language });
  } else {
    // 无可用存储时保持内存状态
  }
};

/**
 * 监听 chrome.storage 变化，跨上下文实时同步
 */
LanguageManager.prototype.setupStorageChangeListener = function () {
  if (!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged)) return;
  var self = this;
  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== 'local') return;
    if (changes && changes.smartBookmarkLanguage && typeof changes.smartBookmarkLanguage.newValue !== 'undefined') {
      var newLang = changes.smartBookmarkLanguage.newValue;
      if (newLang && newLang !== self.currentLanguage) {
        self.currentLanguage = newLang;
        self.updateUI();
      }
    }
  });
};

/**
 * 主动从 chrome.storage 拉取一次，修正可能的差异
 */
LanguageManager.prototype.syncFromChromeStorage = function () {
  if (!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)) return;
  var self = this;
  chrome.storage.local.get(['smartBookmarkLanguage'], function (result) {
    if (result && result.smartBookmarkLanguage && result.smartBookmarkLanguage !== self.currentLanguage) {
      self.currentLanguage = result.smartBookmarkLanguage;
      self.updateUI();
    }
  });
};

/**
 * 切换语言
 * @param {string} language - 语言代码 ('zh' 或 'en')
 */
LanguageManager.prototype.setLanguage = function (language) {
  // console.log('切换语言到:', language);
  if (this.translations[language]) {
    this.currentLanguage = language;
    this.saveLanguageToStorage(language);
    this.updateUI();
    // console.log('语言切换完成');
  } else {
    console.warn('不支持的语言:', language);
  }
};

/**
 * 获取翻译文本
 * @param {string} key - 翻译键
 * @returns {string} 翻译文本
 */
LanguageManager.prototype.t = function (key) {
  var translations = this.translations[this.currentLanguage];
  return translations && translations[key] ? translations[key] : key;
};

LanguageManager.prototype.format = function (key, vars) {
  var text = this.t(key);
  var values = vars || {};
  for (var name in values) {
    if (!Object.prototype.hasOwnProperty.call(values, name)) continue;
    text = text.replace(new RegExp('\\{' + name + '\\}', 'g'), String(values[name]));
  }
  return text;
};

/**
 * 更新界面文本
 */
LanguageManager.prototype.updateUI = function () {
  // console.log('更新界面语言文本');

  // 更新模态框标题
  var modalTitle = this.getRoot().querySelector('.smart-bookmark-modal-title');
  if (modalTitle) {
    // 获取当前模式状态
    var currentMode = window.modalManager && window.modalManager.uiManager ?
      window.modalManager.uiManager.currentMode :
      window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH;

    // console.log('当前模式:', currentMode);

    if (currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_FOLDER_SELECT) {
      modalTitle.textContent = this.t('addBookmarkTitle');
      // console.log('设置为文件夹模式标题:', this.t('addBookmarkTitle'));
    } else {
      modalTitle.textContent = this.t('modalTitle');
      // console.log('设置为书签模式标题:', this.t('modalTitle'));
    }
    // console.log('模态框标题已更新:', modalTitle.textContent);
  } else {
    console.warn('找不到模态框标题元素');
  }

  // 更新搜索框占位符
  var searchInput = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  if (searchInput) {
    // 获取当前模式状态
    var currentMode = window.modalManager && window.modalManager.uiManager ?
      window.modalManager.uiManager.currentMode :
      window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH;

    if (currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_FOLDER_SELECT) {
      searchInput.placeholder = this.t('searchFolderPlaceholder');
      // console.log('设置为文件夹模式搜索占位符:', this.t('searchFolderPlaceholder'));
    } else {
      searchInput.placeholder = this.t('searchPlaceholder');
      // console.log('设置为书签模式搜索占位符:', this.t('searchPlaceholder'));
    }
  }

  // 更新按钮文本
  var cancelBtn = this.getRoot().getElementById('smart-bookmark-cancel');
  if (cancelBtn) {
    cancelBtn.textContent = this.t('cancelBtn');
  }

  var confirmBtn = this.getRoot().getElementById('smart-bookmark-confirm');
  if (confirmBtn) {
    confirmBtn.textContent = this.t('confirmBtn');
  }

  // 更新键盘提示
  var hints = this.getRoot().querySelectorAll('.smart-bookmark-keyboard-hint');
  if (hints.length >= 3) {
    hints[0].textContent = this.t('keyboardHintSelect');
    hints[1].textContent = this.t('keyboardHintConfirm');
    hints[2].textContent = this.t('keyboardHintToggle');
    if (hints.length >= 4) {
      hints[3].textContent = this.t('keyboardHintFilterCycle');
    }
  }

  // 更新顶部类型筛选 tabs
  var allFilterTab = this.getRoot().querySelector('#smart-bookmark-filter-type-tabs [data-filter="all"]');
  if (allFilterTab) allFilterTab.textContent = this.t('filterAllTab');

  var bookmarkFilterTab = this.getRoot().querySelector('#smart-bookmark-filter-type-tabs [data-filter="bookmark"]');
  if (bookmarkFilterTab) bookmarkFilterTab.innerHTML = '🔗 ' + this.t('filterBookmarkTab');

  var folderFilterTab = this.getRoot().querySelector('#smart-bookmark-filter-type-tabs [data-filter="folder"]');
  if (folderFilterTab) folderFilterTab.innerHTML = '📁 ' + this.t('filterFolderTab');

  var filterTypeLabel = this.getRoot().getElementById('smart-bookmark-filter-type-label');
  if (filterTypeLabel) filterTypeLabel.textContent = this.t('filterTypeLabel');

  var filterTagLabel = this.getRoot().getElementById('smart-bookmark-filter-tag-label');
  if (filterTagLabel) filterTagLabel.textContent = this.t('filterTagLabel');

  var filterTagEmpty = this.getRoot().getElementById('smart-bookmark-filter-tag-empty');
  if (filterTagEmpty) filterTagEmpty.textContent = this.t('filterTagEmpty');

  var moreTagsBtn = this.getRoot().getElementById('smart-bookmark-more-tags-btn');
  if (moreTagsBtn) {
    var baseMoreText = this.t('moreTags');
    moreTagsBtn.setAttribute('data-base-label', baseMoreText);
    moreTagsBtn.textContent = baseMoreText;
  }

  var tagPopoverSearch = this.getRoot().getElementById('smart-bookmark-tag-popover-search');
  if (tagPopoverSearch) {
    tagPopoverSearch.placeholder = this.t('tagFilterSearchPlaceholder');
  }

  // 更新主题下拉菜单
  this.updateThemeDropdown();

  var languageToggle = this.getRoot().getElementById('smart-bookmark-language-toggle');
  if (languageToggle) languageToggle.title = this.t('languageSettings');

  var modeToggle = this.getRoot().getElementById('smart-bookmark-mode-toggle');
  if (modeToggle) modeToggle.title = this.t('themeSettings');

  var themeToggle = this.getRoot().getElementById('smart-bookmark-theme-toggle');
  if (themeToggle) themeToggle.title = this.t('themeColorSettings');

  // 更新数据管理按钮标题和下拉选项文案
  var dataToggle = this.getRoot().getElementById('smart-bookmark-data-toggle');
  if (dataToggle) dataToggle.title = this.t('dataManagement');
  var exportOption = this.getRoot().querySelector('[data-action="export"] [data-i18n="exportData"]');
  if (exportOption) exportOption.textContent = this.t('exportData');
  var importOption = this.getRoot().querySelector('[data-action="import"] [data-i18n="importData"]');
  if (importOption) importOption.textContent = this.t('importData');

  if (window.modalManager && typeof window.modalManager.refreshFilterBarState === 'function') {
    window.modalManager.refreshFilterBarState();
  }
  if (window.modalManager && window.modalManager.uiManager &&
    typeof window.modalManager.uiManager.updateTagFilterTabs === 'function' &&
    window.SMART_BOOKMARK_TAGS) {
    var visibleTags = (typeof window.modalManager.getAvailableFilterTags === 'function')
      ? window.modalManager.getAvailableFilterTags()
      : window.SMART_BOOKMARK_TAGS.getAllTags();
    window.modalManager.uiManager.updateTagFilterTabs(
      visibleTags,
      window.modalManager.currentTagFilter
    );
  }

  // 语言切换后立即重绘当前列表，确保列表项文案实时同步
  if (window.modalManager) {
    var modalEl = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
    var isModalActive = !!(modalEl && modalEl.classList.contains(window.SMART_BOOKMARK_CONSTANTS.MODAL_ACTIVE_CLASS));
    if (isModalActive) {
      if (window.modalManager.uiManager &&
        window.modalManager.uiManager.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_FOLDER_SELECT) {
        if (typeof window.modalManager.updateFolderList === 'function') {
          window.modalManager.updateFolderList();
        }
      } else if (typeof window.modalManager.updateBookmarkList === 'function') {
        window.modalManager.updateBookmarkList();
      }
    }
  }

  if (window.modalManager &&
    window.modalManager.themeManager &&
    typeof window.modalManager.themeManager.updateDarkModeToggleIcon === 'function') {
    window.modalManager.themeManager.updateDarkModeToggleIcon();
  }
};

/**
 * 更新主题下拉菜单文本
 */
LanguageManager.prototype.updateThemeDropdown = function () {
  // 更新深浅色模式选项
  var modeOptions = this.getRoot().querySelectorAll('[data-mode]');
  modeOptions.forEach(function (option) {
    var mode = option.getAttribute('data-mode');
    var iconHtml = '';
    var text = '';

    if (mode === 'auto') {
      iconHtml = '<span class="smart-bookmark-option-icon">🔄</span>';
      text = this.t('followSystem');
    } else if (mode === 'light') {
      iconHtml = '<span class="smart-bookmark-option-icon">☀️</span>';
      text = this.t('lightMode');
    } else if (mode === 'dark') {
      iconHtml = '<span class="smart-bookmark-option-icon">🌙</span>';
      text = this.t('darkMode');
    }

    if (iconHtml && text) {
      option.innerHTML = iconHtml + text;
    }
  }.bind(this));

  // 更新主题颜色选项
  var themeOptions = this.getRoot().querySelectorAll('[data-theme]');
  themeOptions.forEach(function (option) {
    var theme = option.getAttribute('data-theme');
    var iconHtml = '';
    var text = '';

    if (theme === 'gray') {
      iconHtml = '<span class="smart-bookmark-option-icon">🩶</span>';
      text = this.t('neutralGray');
    } else if (theme === 'red') {
      iconHtml = '<span class="smart-bookmark-option-icon">❤️</span>';
      text = this.t('classicRed');
    } else if (theme === 'green') {
      iconHtml = '<span class="smart-bookmark-option-icon">💚</span>';
      text = this.t('freshGreen');
    } else if (theme === 'pink') {
      iconHtml = '<span class="smart-bookmark-option-icon">🩷</span>';
      text = this.t('warmPink');
    } else if (theme === 'purple') {
      iconHtml = '<span class="smart-bookmark-option-icon">💜</span>';
      text = this.t('elegantPurple');
    } else if (theme === 'blue') {
      iconHtml = '<span class="smart-bookmark-option-icon">💙</span>';
      text = this.t('classicBlue');
    }

    if (iconHtml && text) {
      option.innerHTML = iconHtml + text;
    }
  }.bind(this));

  // 更新语言选项
  var languageOptions = this.getRoot().querySelectorAll('[data-language]');
  languageOptions.forEach(function (option) {
    var language = option.getAttribute('data-language');
    var iconHtml = '';
    var text = '';

    if (language === 'zh') {
      iconHtml = '<span class="smart-bookmark-option-icon">🇨🇳</span>';
      text = '中文';
    } else if (language === 'en') {
      iconHtml = '<span class="smart-bookmark-option-icon">🇺🇸</span>';
      text = 'English';
    }

    if (iconHtml && text) {
      option.innerHTML = iconHtml + text;
    }
  }.bind(this));

  // 兼容旧版下拉菜单
  var legacyDropdown = this.getRoot().getElementById('smart-bookmark-dark-mode-dropdown');
  if (legacyDropdown) {
    var legacyOptions = legacyDropdown.querySelectorAll('.smart-bookmark-dark-mode-option');
    legacyOptions.forEach(function (option) {
      var mode = option.getAttribute('data-mode');
      var theme = option.getAttribute('data-theme');
      var language = option.getAttribute('data-language');
      var iconHtml = '';
      var text = '';

      if (mode === 'auto') {
        iconHtml = '<span class="smart-bookmark-option-icon">🔄</span>';
        text = this.t('followSystem');
      } else if (mode === 'light') {
        iconHtml = '<span class="smart-bookmark-option-icon">☀️</span>';
        text = this.t('lightMode');
      } else if (mode === 'dark') {
        iconHtml = '<span class="smart-bookmark-option-icon">🌙</span>';
        text = this.t('darkMode');
      } else if (theme === 'gray') {
        iconHtml = '<span class="smart-bookmark-option-icon">🩶</span>';
        text = this.t('neutralGray');
      } else if (theme === 'red') {
        iconHtml = '<span class="smart-bookmark-option-icon">❤️</span>';
        text = this.t('classicRed');
      } else if (theme === 'green') {
        iconHtml = '<span class="smart-bookmark-option-icon">💚</span>';
        text = this.t('freshGreen');
      } else if (theme === 'pink') {
        iconHtml = '<span class="smart-bookmark-option-icon">🩷</span>';
        text = this.t('warmPink');
      } else if (theme === 'purple') {
        iconHtml = '<span class="smart-bookmark-option-icon">💜</span>';
        text = this.t('elegantPurple');
      } else if (theme === 'blue') {
        iconHtml = '<span class="smart-bookmark-option-icon">💙</span>';
        text = this.t('classicBlue');
      } else if (language === 'zh') {
        iconHtml = '<span class="smart-bookmark-option-icon">🇨🇳</span>';
        text = '中文';
      } else if (language === 'en') {
        iconHtml = '<span class="smart-bookmark-option-icon">🇺🇸</span>';
        text = 'English';
      }

      if (iconHtml && text) {
        option.innerHTML = iconHtml + text;
      }
    }.bind(this));
  }
};

/**
 * 获取当前语言
 * @returns {string} 当前语言代码
 */
LanguageManager.prototype.getCurrentLanguage = function () {
  return this.currentLanguage;
};

// 将类附加到全局window对象
window.LanguageManager = LanguageManager;
