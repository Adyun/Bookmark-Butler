// Theme Manager for the Smart Bookmark Extension

/**
 * 主题管理器 - 处理深色模式切换和系统主题监听
 * 重写版本 - 更简洁可靠的实现
 */
function ThemeManager() {
  this.darkMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO; // 当前深色模式设置
  this.systemThemeListener = null; // 系统主题变化监听器
  this.eventListeners = []; // 事件监听器列表
  this.isInitialized = false; // 初始化状态
  this.dropdownElement = null; // 下拉菜单元素引用
}

/**
 * 初始化主题管理器 - 重写版本
 */
ThemeManager.prototype.init = function () {
  var self = this;
  
  console.log('ThemeManager.init called, isInitialized:', this.isInitialized);
  
  if (this.isInitialized) {
    console.log('ThemeManager already initialized, skipping');
    return;
  }

  // 同步加载设置，避免异步问题
  console.log('Loading dark mode setting...');
  this.loadDarkModeSetting();
  console.log('Dark mode loaded:', this.darkMode);
  
  // 应用当前主题
  console.log('Applying dark mode...');
  this.applyDarkMode();
  
  // 设置系统主题监听
  console.log('Setting up system theme listener...');
  this.setupSystemThemeListener();
  
  // 标记初始化完成
  this.isInitialized = true;
  console.log('ThemeManager initialization completed');
};

/**
 * 从存储中加载深色模式设置 - 同步版本
 */
ThemeManager.prototype.loadDarkModeSetting = function () {
  try {
    // 优先使用localStorage，更可靠
    var mode = localStorage.getItem(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY);
    this.darkMode = mode || window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO;
  } catch (e) {
    // 如果localStorage失败，使用默认设置
    this.darkMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO;
  }
};

/**
 * 保存深色模式设置 - 简化版本
 * @param {string} mode - 深色模式设置
 */
ThemeManager.prototype.saveDarkModeSetting = function (mode) {
  try {
    // 直接使用localStorage，简化逻辑
    localStorage.setItem(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_STORAGE_KEY, mode);
    this.darkMode = mode;
    
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
  
  this.systemThemeListener = function(e) {
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
 * 监听系统主题变化
 */
ThemeManager.prototype.listenForSystemThemeChange = function () {
  var self = this;

  // 先停止之前的监听器
  this.stopListeningForSystemThemeChange();

  if (window.matchMedia) {
    var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    this.systemThemeListener = function (e) {
      if (self.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO) {
        self.applyDarkMode();
      }
    };

    // 添加监听器
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', this.systemThemeListener);
    } else if (mediaQuery.addListener) {
      // 兼容旧版浏览器
      mediaQuery.addListener(this.systemThemeListener);
    }
  }
};

/**
 * 停止监听系统主题变化
 */
ThemeManager.prototype.stopListeningForSystemThemeChange = function () {
  if (this.systemThemeListener && window.matchMedia) {
    var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', this.systemThemeListener);
    } else if (mediaQuery.removeListener) {
      // 兼容旧版浏览器
      mediaQuery.removeListener(this.systemThemeListener);
    }
    
    this.systemThemeListener = null;
  }
};

/**
 * 应用深色模式
 */
ThemeManager.prototype.applyDarkMode = function () {
  var modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
  if (!modal) return;

  var isDark = false;

  if (this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK) {
    isDark = true;
  } else if (this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO) {
    isDark = this.isSystemDarkMode();
  }

  if (isDark) {
    modal.classList.add(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
  } else {
    modal.classList.remove(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
  }

  // 更新深色模式下拉菜单中的选中状态
  this.updateDarkModeDropdownSelection();
  
  // 更新深色模式切换按钮图标
  this.updateDarkModeToggleIcon();
};

/**
 * 更新深色模式下拉菜单中的选中状态
 */
ThemeManager.prototype.updateDarkModeDropdownSelection = function () {
  var options = document.querySelectorAll('.smart-bookmark-dark-mode-option');
  var self = this;

  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    option.classList.remove('active');

    var mode = option.getAttribute('data-mode');
    if (
      (self.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO && mode === 'auto') ||
      (self.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_LIGHT && mode === 'light') ||
      (self.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK && mode === 'dark')
    ) {
      option.classList.add('active');
    }
  }
};

/**
 * 更新深色模式切换按钮图标
 */
ThemeManager.prototype.updateDarkModeToggleIcon = function () {
  var toggle = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID);
  if (!toggle) return;

  if (this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK) {
    toggle.textContent = '🌙'; // 深色模式图标
    toggle.title = '深色模式';
  } else if (this.darkMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_LIGHT) {
    toggle.textContent = '☀️'; // 浅色模式图标
    toggle.title = '浅色模式';
  } else {
    toggle.textContent = '🌗'; // 自动模式图标
    toggle.title = '跟随系统';
  }
};

/**
 * 切换深色模式下拉菜单
 */
ThemeManager.prototype.toggleDarkModeDropdown = function () {
  var dropdown = document.getElementById('smart-bookmark-dark-mode-dropdown');
  
  if (!dropdown) {
    return;
  }

  var isVisible = dropdown.classList.contains('show');

  if (isVisible) {
    dropdown.classList.remove('show');
  } else {
    dropdown.classList.add('show');
    
    // 更新选中状态
    this.updateDarkModeDropdownSelection();
    
    // 点击其他地方时关闭下拉菜单
    var self = this;
    var closeDropdown = function (e) {
      // 检查点击是否在下拉菜单或切换按钮内
      var toggle = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID);
      if (!dropdown.contains(e.target) && e.target !== toggle) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeDropdown);
      }
    };
    
    setTimeout(function() {
      document.addEventListener('click', closeDropdown);
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
  var dropdown = document.getElementById('smart-bookmark-dark-mode-dropdown');
  if (dropdown) {
    dropdown.classList.remove('show');
  }
};

/**
 * 绑定主题相关的事件监听器 - 重写版本
 * @param {Function} addEventListenerFn - 添加事件监听器的函数
 */
ThemeManager.prototype.bindEvents = function (addEventListenerFn) {
  var self = this;

  // 立即尝试绑定，如果失败则延迟重试
  this.tryBindEvents(addEventListenerFn, 0);
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
  var toggleButton = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID);
  var dropdown = document.getElementById('smart-bookmark-dark-mode-dropdown');
  var options = document.querySelectorAll('.smart-bookmark-dark-mode-option');
  
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
    setTimeout(function() {
      self.tryBindEvents(addEventListenerFn, retryCount + 1);
    }, 50);
    return;
  }
  
  // 绑定切换按钮事件
  if (toggleButton) {
    console.log('Binding click event to toggle button');
    addEventListenerFn(toggleButton, 'click', function (e) {
      console.log('Toggle button clicked!');
      e.preventDefault();
      e.stopPropagation();
      self.toggleDropdown();
    });
  } else {
    console.warn('Toggle button not found after retries');
  }
  
  // 绑定选项点击事件
  if (options.length > 0) {
    console.log('Binding click events to', options.length, 'options');
    for (var i = 0; i < options.length; i++) {
      var option = options[i];
      addEventListenerFn(option, 'click', function (e) {
        console.log('Option clicked:', this.getAttribute('data-mode'));
        e.preventDefault();
        e.stopPropagation();
        var mode = this.getAttribute('data-mode');
        self.selectThemeMode(mode);
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
 * 切换下拉菜单 - 重写版本
 */
ThemeManager.prototype.toggleDropdown = function () {
  console.log('ThemeManager.toggleDropdown called');
  
  if (!this.dropdownElement) {
    console.log('Dropdown element not cached, searching...');
    this.dropdownElement = document.getElementById('smart-bookmark-dark-mode-dropdown');
  }
  
  if (!this.dropdownElement) {
    console.error('Dropdown element not found!');
    return;
  }
  
  var isVisible = this.dropdownElement.classList.contains('show');
  console.log('Dropdown current state - isVisible:', isVisible);
  
  if (isVisible) {
    console.log('Hiding dropdown...');
    this.hideDropdown();
  } else {
    console.log('Showing dropdown...');
    this.showDropdown();
  }
};

/**
 * 显示下拉菜单
 */
ThemeManager.prototype.showDropdown = function () {
  console.log('ThemeManager.showDropdown called');
  
  if (!this.dropdownElement) {
    console.error('Cannot show dropdown - element is null');
    return;
  }
  
  console.log('Adding show class to dropdown');
  this.dropdownElement.classList.add('show');
  
  console.log('Updating dropdown selection...');
  this.updateDropdownSelection();
  
  console.log('Dropdown classes after show:', this.dropdownElement.classList.toString());
  console.log('Dropdown computed style:', window.getComputedStyle(this.dropdownElement).display);
  
  // 添加详细的调试信息
  var computedStyle = window.getComputedStyle(this.dropdownElement);
  console.log('Dropdown detailed styles:', {
    display: computedStyle.display,
    visibility: computedStyle.visibility,
    opacity: computedStyle.opacity,
    transform: computedStyle.transform,
    zIndex: computedStyle.zIndex,
    position: computedStyle.position,
    top: computedStyle.top,
    right: computedStyle.right,
    width: this.dropdownElement.offsetWidth,
    height: this.dropdownElement.offsetHeight,
    boundingRect: this.dropdownElement.getBoundingClientRect()
  });
  
  // 点击外部关闭下拉菜单
  var self = this;
  var closeHandler = function(e) {
    var toggle = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID);
    if (!self.dropdownElement.contains(e.target) && e.target !== toggle) {
      console.log('Closing dropdown due to outside click');
      self.hideDropdown();
      document.removeEventListener('click', closeHandler);
    }
  };
  
  setTimeout(function() {
    document.addEventListener('click', closeHandler);
    console.log('Outside click handler registered');
  }, 0);
};

/**
 * 隐藏下拉菜单
 */
ThemeManager.prototype.hideDropdown = function () {
  console.log('ThemeManager.hideDropdown called');
  
  if (this.dropdownElement) {
    console.log('Removing show class from dropdown');
    this.dropdownElement.classList.remove('show');
    console.log('Dropdown classes after hide:', this.dropdownElement.classList.toString());
  } else {
    console.warn('Cannot hide dropdown - element is null');
  }
};

/**
 * 选择主题模式 - 重写版本
 * @param {string} mode - 选择的模式 ('auto', 'light', 'dark')
 */
ThemeManager.prototype.selectThemeMode = function (mode) {
  var mappedMode;
  
  switch(mode) {
    case 'auto':
      mappedMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO;
      break;
    case 'light':
      mappedMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_LIGHT;
      break;
    case 'dark':
      mappedMode = window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK;
      break;
    default:
      return;
  }
  
  // 保存设置
  this.saveDarkModeSetting(mappedMode);
  
  // 隐藏下拉菜单
  this.hideDropdown();
};

/**
 * 更新下拉菜单选中状态
 */
ThemeManager.prototype.updateDropdownSelection = function () {
  var options = document.querySelectorAll('.smart-bookmark-dark-mode-option');
  var currentMode = this.darkMode;
  
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var optionMode = option.getAttribute('data-mode');
    
    // 移除所有active类
    option.classList.remove('active');
    
    // 添加对应的active类
    if ((currentMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_AUTO && optionMode === 'auto') ||
        (currentMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_LIGHT && optionMode === 'light') ||
        (currentMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK && optionMode === 'dark')) {
      option.classList.add('active');
    }
  }
};

/**
 * 更新切换按钮显示
 */
ThemeManager.prototype.updateToggleButtonDisplay = function () {
  var toggle = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_TOGGLE_ID);
  if (!toggle) {
    return;
  }
  
  var currentMode = this.darkMode;
  
  if (currentMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_DARK) {
    toggle.textContent = '🌙';
    toggle.title = '深色模式';
  } else if (currentMode === window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_LIGHT) {
    toggle.textContent = '☀️';
    toggle.title = '浅色模式';
  } else {
    toggle.textContent = '🌗';
    toggle.title = '跟随系统';
  }
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
  this.stopListeningForSystemThemeChange();
  
  // 清理事件监听器
  this.eventListeners = [];
  
  // 重置状态
  this.darkMode = null;
};

// 将类附加到全局window对象
window.ThemeManager = ThemeManager;