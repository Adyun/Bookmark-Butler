// Theme Manager for the Smart Bookmark Extension
var DEBUG_THEME = false;

/**
 * 主题管理器 - 处理深色模式切换和系统主题监听
 * 重写版本 - 更简洁可靠的实现
 */
function ThemeManager() {
  this.darkMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO; // 当前深色模式设置
  this.themeColor = 'gray'; // 当前主题色设置，默认为灰色
  this.systemThemeListener = null; // 系统主题变化监听器
  this.eventListeners = []; // 事件监听器列表
  this.isInitialized = false; // 初始化状态
  this.dropdownElement = null; // 下拉菜单元素引用
}

/**
 * 获取 Shadow Root（辅助方法）
 * @returns {ShadowRoot|Document}
 */
ThemeManager.prototype.getRoot = function () {
  return window.getSmartBookmarkRoot();
};

/**
 * 初始化主题管理器 - 重写版本
 */
ThemeManager.prototype.init = function () {
  var self = this;

  if (DEBUG_THEME) console.log('ThemeManager.init called, isInitialized:', this.isInitialized);

  if (this.isInitialized) {
    if (DEBUG_THEME) console.log('ThemeManager already initialized, skipping');
    return;
  }

  // 同步加载设置，避免异步问题
  this.loadDarkModeSetting();
  this.loadThemeColorSetting();

  // 与 chrome.storage 同步（确保各上下文共享设置）
  this.setupStorageChangeListener();
  this.syncFromChromeStorage();

  // 设置系统主题监听
  this.setupSystemThemeListener();

  // 标记初始化完成
  this.isInitialized = true;
  if (DEBUG_THEME) console.log('ThemeManager initialization completed');
};

/**
 * 从存储中加载深色模式设置 - 同步版本
 */
ThemeManager.prototype.loadDarkModeSetting = function () {
  var self = this;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY], function (result) {
      var mode = result && result[window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY];
      if (mode) {
        self.darkMode = mode;
        self.applyDarkMode();
        self.updateToggleButtonDisplay();
      }
    });
    return;
  }
  this.darkMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO;
};

/**
 * 保存深色模式设置 - 简化版本
 * @param {string} mode - 深色模式设置
 */
ThemeManager.prototype.saveDarkModeSetting = function (mode) {
  try {
    this.darkMode = mode;

    // 同步到 chrome.storage，作为跨上下文的单一事实来源
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY]: mode });
    }

    // 立即应用主题
    this.applyDarkMode();

    // 更新切换按钮显示
    this.updateToggleButtonDisplay();

    // 处理系统主题监听
    this.handleSystemThemeListening(mode);

  } catch (e) {
    console.warn('Failed to save theme setting:', e);
  }
};

/**
 * 从存储中加载主题色设置
 */
ThemeManager.prototype.loadThemeColorSetting = function () {
  var self = this;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['smart-bookmark-theme-color'], function (result) {
      var themeColor = result && result['smart-bookmark-theme-color'];
      if (typeof themeColor === 'string') {
        self.themeColor = themeColor;
        self.applyThemeColor();
        self.updateDropdownSelection();
      }
    });
    return;
  }
  this.themeColor = 'gray';
};

/**
 * 保存主题色设置
 * @param {string} themeColor - 主题色名称
 */
ThemeManager.prototype.saveThemeColorSetting = function (themeColor) {
  try {
    this.themeColor = themeColor;

    // 同步到 chrome.storage，保持与新tab/弹窗一致
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ 'smart-bookmark-theme-color': themeColor });
    }

    // 立即应用主题色
    this.applyThemeColor();

    // 更新下拉菜单选中状态
    this.updateDropdownSelection();

  } catch (e) {
    console.warn('Failed to save theme color setting:', e);
  }
};

/**
 * 从 chrome.storage 同步设置（异步修正不同上下文的差异）
 */
ThemeManager.prototype.syncFromChromeStorage = function () {
  if (!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)) {
    return;
  }
  var self = this;
  chrome.storage.local.get([
    window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY,
    'smart-bookmark-theme-color'
  ], function (result) {
    var updated = false;
    if (result && result[window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY] &&
      result[window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY] !== self.darkMode) {
      self.darkMode = result[window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY];
      updated = true;
    }
    if (result && typeof result['smart-bookmark-theme-color'] === 'string' &&
      result['smart-bookmark-theme-color'] !== self.themeColor) {
      self.themeColor = result['smart-bookmark-theme-color'];
      updated = true;
    }
    if (updated) {
      self.applyDarkMode();
      self.applyThemeColor();
      self.updateToggleButtonDisplay();
      self.updateDropdownSelection();
    }
  });
};

/**
 * 监听 chrome.storage 变化，实时应用到当前页面
 */
ThemeManager.prototype.setupStorageChangeListener = function () {
  if (!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged)) {
    return;
  }
  var self = this;
  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== 'local') return;
    var dmKey = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY;
    if (changes && changes[dmKey] && typeof changes[dmKey].newValue !== 'undefined') {
      self.darkMode = changes[dmKey].newValue;
      self.applyDarkMode();
      self.updateToggleButtonDisplay();
    }
    if (changes && changes['smart-bookmark-theme-color'] && typeof changes['smart-bookmark-theme-color'].newValue !== 'undefined') {
      self.themeColor = changes['smart-bookmark-theme-color'].newValue;
      self.applyThemeColor();
      self.updateDropdownSelection();
    }
  });
};

/**
 * 应用主题色
 */
ThemeManager.prototype.applyThemeColor = function () {
  var modalElement = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (!modalElement) return;

  // 移除所有主题色类
  modalElement.classList.remove('theme-red', 'theme-green', 'theme-pink', 'theme-purple', 'theme-gray', 'theme-blue');

  // 添加当前主题色类
  if (this.themeColor && this.themeColor !== 'default') {
    modalElement.classList.add('theme-' + this.themeColor);
  }
};

/**
 * 处理系统主题监听 - 新方法
 * @param {string} mode - 主题模式
 */
ThemeManager.prototype.handleSystemThemeListening = function (mode) {
  // 清除现有监听器
  this.stopSystemThemeListener();

  // 如果是自动模式，添加系统主题监听
  if (mode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO) {
    this.setupSystemThemeListener();
  }
};

/**
 * 设置系统主题监听器 - 重写版本
 */
ThemeManager.prototype.setupSystemThemeListener = function () {
  if (!window.matchMedia) {
    return;
  }

  var self = this;
  var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  this.systemThemeListener = function (e) {
    if (self.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO) {
      self.applyDarkMode();
    }
  };

  // 添加监听器
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', this.systemThemeListener);
  } else {
    // 兼容旧版本浏览器
    mediaQuery.addListener(this.systemThemeListener);
  }
};

/**
 * 停止系统主题监听器
 */
ThemeManager.prototype.stopSystemThemeListener = function () {
  if (!this.systemThemeListener || !window.matchMedia) {
    return;
  }

  var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  if (mediaQuery.removeEventListener) {
    mediaQuery.removeEventListener('change', this.systemThemeListener);
  } else {
    // 兼容旧版本浏览器
    mediaQuery.removeListener(this.systemThemeListener);
  }

  this.systemThemeListener = null;
};

/**
 * 检测系统是否使用深色模式
 * @returns {boolean} 是否使用深色模式
 */
ThemeManager.prototype.isSystemDarkMode = function () {
  // 检查浏览器是否支持 prefers-color-scheme
  if (window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
};



/**
 * 应用深色模式
 */
ThemeManager.prototype.applyDarkMode = function () {
  var modal = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  var backdrop = this.getRoot().querySelector('.smart-bookmark-modal-backdrop');
  if (!modal) return;

  var isDark = false;

  if (this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK) {
    isDark = true;
  } else if (this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO) {
    isDark = this.isSystemDarkMode();
  }

  if (isDark) {
    modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
    if (backdrop) {
      backdrop.classList.add(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
    }
  } else {
    modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
    if (backdrop) {
      backdrop.classList.remove(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
    }
  }

  // 更新深色模式下拉菜单中的选中状态
  this.updateDarkModeDropdownSelection();

  // 更新深色模式切换按钮图标
  this.updateDarkModeToggleIcon();

  // 应用主题色
  this.applyThemeColor();
};

/**
 * 更新下拉菜单中的选中状态（包括深色模式和主题色）
 */
ThemeManager.prototype.updateDropdownSelection = function () {
  var options = this.getRoot().querySelectorAll('.smart-bookmark-dark-mode-option');
  var currentMode = this.darkMode;
  var currentTheme = this.themeColor;

  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var optionMode = option.getAttribute('data-mode');
    var optionTheme = option.getAttribute('data-theme');

    // 移除所有active类
    option.classList.remove('active');

    // 检查深色模式选项
    if (optionMode) {
      if ((currentMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO && optionMode === 'auto') ||
        (currentMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_LIGHT && optionMode === 'light') ||
        (currentMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK && optionMode === 'dark')) {
        option.classList.add('active');
      }
    }

    // 检查主题色选项
    if (optionTheme && optionTheme === currentTheme) {
      option.classList.add('active');
    }
  }
};

/**
 * 更新深色模式下拉菜单中的选中状态（向后兼容）
 */
ThemeManager.prototype.updateDarkModeDropdownSelection = function () {
  this.updateDropdownSelection();
};

/**
 * 更新深色模式切换按钮图标
 */
ThemeManager.prototype.updateDarkModeToggleIcon = function () {
  var toggle = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID);
  if (!toggle) return;

  var currentMode = this.darkMode;

  if (currentMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK) {
    toggle.textContent = '🌙'; // 深色模式图标
    toggle.title = '深色模式';
  } else if (currentMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_LIGHT) {
    toggle.textContent = '☀️'; // 浅色模式图标
    toggle.title = '浅色模式';
  } else {
    toggle.textContent = '🌗'; // 自动模式图标
    toggle.title = '跟随系统';
  }
};

/**
 * 确保下拉菜单初始状态正确
 */
ThemeManager.prototype.ensureDropdownInitialState = function () {
  var dropdown = this.getRoot().getElementById('smart-bookmark-dark-mode-dropdown');
  if (!dropdown) return;

  // 强制移除show类，确保初始状态是隐藏的
  dropdown.classList.remove('show');
  console.log('Dropdown initial state ensured - show class removed');
};

/**
 * 切换深色模式下拉菜单
 */
ThemeManager.prototype.toggleDarkModeDropdown = function () {
  console.log('ThemeManager.toggleDarkModeDropdown called');

  var dropdown = this.getRoot().getElementById('smart-bookmark-dark-mode-dropdown');

  if (!dropdown) {
    console.error('Dropdown element not found!');
    return;
  }

  // 首先确保下拉菜单初始状态正确
  this.ensureDropdownInitialState();

  var isVisible = dropdown.classList.contains('show');
  console.log('Dropdown current state - isVisible:', isVisible);
  console.log('Dropdown computed styles:', {
    display: window.getComputedStyle(dropdown).display,
    opacity: window.getComputedStyle(dropdown).opacity,
    visibility: window.getComputedStyle(dropdown).visibility,
    transform: window.getComputedStyle(dropdown).transform,
    zIndex: window.getComputedStyle(dropdown).zIndex
  });

  if (isVisible) {
    console.log('Hiding dropdown...');
    dropdown.classList.remove('show');
  } else {
    console.log('Showing dropdown...');
    dropdown.classList.add('show');

    // 强制重新计算样式
    dropdown.offsetHeight;

    // 更新选中状态
    this.updateDarkModeDropdownSelection();

    // 调试信息
    console.log('Dropdown after show:', {
      classList: dropdown.classList.toString(),
      display: window.getComputedStyle(dropdown).display,
      opacity: window.getComputedStyle(dropdown).opacity,
      visibility: window.getComputedStyle(dropdown).visibility,
      transform: window.getComputedStyle(dropdown).transform,
      zIndex: window.getComputedStyle(dropdown).zIndex
    });

    // 点击其他地方时关闭下拉菜单
    var self = this;
    var closeDropdown = function (e) {
      // 检查点击是否在下拉菜单或切换按钮内
      var toggle = self.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID);
      if (!dropdown.contains(e.target) && e.target !== toggle) {
        console.log('Closing dropdown due to outside click');
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeDropdown);
      }
    };

    setTimeout(function () {
      document.addEventListener('click', closeDropdown);
      console.log('Outside click handler registered');
    }, 0);
  }
};

/**
 * 处理深色模式选择
 * @param {string} mode - 选择的模式 ('auto', 'light', 'dark')
 */
ThemeManager.prototype.handleDarkModeSelect = function (mode) {
  var mappedMode;

  if (mode === 'auto') {
    mappedMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO;
  } else if (mode === 'light') {
    mappedMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_LIGHT;
  } else if (mode === 'dark') {
    mappedMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK;
  }

  if (mappedMode) {
    this.saveDarkModeSetting(mappedMode);
  }

  // 关闭下拉菜单
  var dropdown = this.getRoot().getElementById('smart-bookmark-dark-mode-dropdown');
  if (dropdown) {
    dropdown.classList.remove('show');
  }
};

/**
 * 处理主题色选择
 * @param {string} themeColor - 主题色名称
 */
ThemeManager.prototype.handleThemeColorSelect = function (themeColor) {
  this.saveThemeColorSetting(themeColor);

  // 关闭下拉菜单
  var dropdown = this.getRoot().getElementById('smart-bookmark-dark-mode-dropdown');
  if (dropdown) {
    dropdown.classList.remove('show');
  }
};

/**
 * 设置深色模式（新方法）
 * @param {string} mode - 深色模式设置 ('auto', 'light', 'dark')
 */
ThemeManager.prototype.setDarkMode = function (mode) {
  console.log('设置深色模式:', mode);
  this.saveDarkModeSetting(mode);
};

/**
 * 设置主题颜色（新方法）
 * @param {string} theme - 主题名称 ('default', 'red', 'green', 'pink', 'purple')
 */
ThemeManager.prototype.setTheme = function (theme) {
  console.log('设置主题颜色:', theme);
  this.saveThemeColorSetting(theme);
};

/**
 * 绑定主题相关的事件监听器 - 重写版本（已禁用）
 * @param {Function} addEventListenerFn - 添加事件监听器的函数
 */
ThemeManager.prototype.bindEvents = function (addEventListenerFn) {
  // 已禁用旧版事件绑定，由ModalManager统一管理
  console.log('ThemeManager.bindEvents called (已禁用)');
};

/**
 * 尝试绑定事件 - 带重试机制
 * @param {Function} addEventListenerFn - 添加事件监听器的函数
 * @param {number} retryCount - 重试次数
 */
ThemeManager.prototype.tryBindEvents = function (addEventListenerFn, retryCount) {
  var self = this;

  console.log('ThemeManager.tryBindEvents called, retryCount:', retryCount);

  // 查找元素
  var toggleButton = this.getRoot().getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID);
  var dropdown = this.getRoot().getElementById('smart-bookmark-dark-mode-dropdown');
  var options = this.getRoot().querySelectorAll('.smart-bookmark-dark-mode-option');

  console.log('DOM elements found:', {
    toggleButton: !!toggleButton,
    dropdown: !!dropdown,
    optionsCount: options.length,
    toggleId: window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID
  });

  console.log('Constants check:', {
    constants: !!window.SMART_BOOKMARK_CONSTANTS,
    darkModeToggleId: window.SMART_BOOKMARK_CONSTANTS ? window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID : 'undefined'
  });

  // 如果元素还没有创建且重试次数小于10，延迟重试
  if ((!toggleButton || !dropdown || options.length === 0) && retryCount < 10) {
    console.log('Some elements not found, retrying in 50ms...');
    setTimeout(function () {
      self.tryBindEvents(addEventListenerFn, retryCount + 1);
    }, 50);
    return;
  }

  // 绑定切换按钮事件
  if (toggleButton) {
    console.log('Binding click event to toggle button');
    var clickHandler = function (e) {
      console.log('Toggle button clicked!');
      e.preventDefault();
      e.stopPropagation();
      self.toggleDarkModeDropdown();
    };
    addEventListenerFn(toggleButton, 'click', clickHandler);

    // 同时保存事件监听器引用，便于调试
    this.eventListeners.push({
      element: toggleButton,
      event: 'click',
      handler: clickHandler
    });
  } else {
    console.warn('Toggle button not found after retries');
  }

  // 绑定选项点击事件
  if (options.length > 0) {
    console.log('Binding click events to', options.length, 'options');
    for (var i = 0; i < options.length; i++) {
      var option = options[i];
      var optionClickHandler = (function (opt) {
        return function (e) {
          e.preventDefault();
          e.stopPropagation();

          var mode = opt.getAttribute('data-mode');
          var theme = opt.getAttribute('data-theme');

          if (mode) {
            console.log('Mode option clicked:', mode);
            self.handleDarkModeSelect(mode);
          } else if (theme) {
            console.log('Theme option clicked:', theme);
            self.handleThemeColorSelect(theme);
          }
        };
      })(option);

      addEventListenerFn(option, 'click', optionClickHandler);

      // 保存事件监听器引用
      this.eventListeners.push({
        element: option,
        event: 'click',
        handler: optionClickHandler
      });
    }
  } else {
    console.warn('No theme options found after retries');
  }

  // 保存下拉菜单元素引用
  this.dropdownElement = dropdown;
  console.log('Dropdown element cached:', !!this.dropdownElement);

  // 更新按钮显示
  console.log('Updating toggle button display...');
  this.updateToggleButtonDisplay();
};



/**
 * 更新切换按钮显示
 */
ThemeManager.prototype.updateToggleButtonDisplay = function () {
  this.updateDarkModeToggleIcon();
  // 确保下拉菜单初始状态正确
  this.ensureDropdownInitialState();
};

/**
 * 获取当前主题状态
 * @returns {Object} 主题状态信息
 */
ThemeManager.prototype.getCurrentThemeState = function () {
  return {
    mode: this.darkMode,
    isDark: this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK ||
      (this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO && this.isSystemDarkMode()),
    isAuto: this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO,
    systemDark: this.isSystemDarkMode()
  };
};

/**
 * 强制重新应用主题
 */
ThemeManager.prototype.forceReapplyTheme = function () {
  // 延迟一帧确保DOM已更新
  requestAnimationFrame(() => {
    this.applyDarkMode();
  });
};

/**
 * 清理主题管理器
 */
ThemeManager.prototype.cleanup = function () {
  // 停止监听系统主题变化
  this.stopSystemThemeListener();

  // 清理事件监听器
  this.eventListeners = [];

  // 重置状态
  this.darkMode = null;
  this.isInitialized = false;
  this.dropdownElement = null;
};

// 将类附加到全局window对象
window.ThemeManager = ThemeManager;
