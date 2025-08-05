// Keyboard Manager for the Smart Bookmark Extension

/**
 * 键盘管理器 - 处理键盘导航和快捷键
 */
function KeyboardManager() {
  this.selectedIndex = -1;
  this.currentItems = [];
  this.currentMode = window.SMART_BOOKMARK_CONSTANTS.DEFAULT_MODE;
  this.isModalVisible = false;
  this.virtualScroller = null;
  this.eventListeners = [];
  
  // 防抖相关
  this.navigationTimeout = null;
  this.isNavigating = false;
  this.lastNavigationTime = 0;
  
  // 回调函数
  this.onConfirm = null;
  this.onModeToggle = null;
  this.onModalClose = null;
}

/**
 * 初始化键盘管理器
 */
KeyboardManager.prototype.init = function () {
  this.bindKeyboardEvents();
};

/**
 * 绑定键盘事件
 */
KeyboardManager.prototype.bindKeyboardEvents = function () {
  var self = this;
  
  var handleKeyDown = function (e) {
    self.handleKeyDown(e);
  };

  document.addEventListener('keydown', handleKeyDown);
  this.eventListeners.push({ element: document, event: 'keydown', handler: handleKeyDown });
};

/**
 * 处理键盘事件
 * @param {KeyboardEvent} e - 键盘事件
 */
KeyboardManager.prototype.handleKeyDown = function (e) {
  // 如果模态框不可见，不处理键盘事件
  if (!this.isModalVisible) return;

  var searchInput = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.SEARCH_INPUT_ID);
  
  // 如果焦点在搜索框中，且按下了Escape键，关闭模态框
  if (document.activeElement === searchInput && e.key === 'Escape') {
    if (this.onModalClose) {
      this.onModalClose();
    }
    return;
  }

  // 处理不同的按键
  switch (e.key) {
    case 'Escape':
      if (this.onModalClose) {
        this.onModalClose();
      }
      break;

    case ' ': // 空格键
      // 如果搜索框为空，切换模式
      if (searchInput && searchInput.value.trim() === '') {
        e.preventDefault();
        if (this.onModeToggle) {
          this.onModeToggle();
        }
      }
      break;

    case 'Enter':
      e.preventDefault();
      if (this.selectedIndex >= 0 && this.onConfirm) {
        this.onConfirm();
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      this.navigateSelection(-1);
      break;

    case 'ArrowDown':
      e.preventDefault();
      this.navigateSelection(1);
      break;

    case 'Home':
      e.preventDefault();
      this.navigateToFirst();
      break;

    case 'End':
      e.preventDefault();
      this.navigateToLast();
      break;

    case 'PageUp':
      e.preventDefault();
      this.navigateByPage(-1);
      break;

    case 'PageDown':
      e.preventDefault();
      this.navigateByPage(1);
      break;

    default:
      // 其他按键不处理
      break;
  }
};

/**
 * 导航选择
 * @param {number} direction - 方向（1为向下，-1为向上）
 */
KeyboardManager.prototype.navigateSelection = function (direction) {
  if (this.currentItems.length === 0) return;

  // 防抖处理：防止快速按键时出现双重选择
  var now = Date.now();
  var debounceDelay = 50; // 50ms防抖
  
  if (this.isNavigating && (now - this.lastNavigationTime) < debounceDelay) {
    // 如果正在导航且时间间隔太短，重置定时器
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }
  }
  
  this.isNavigating = true;
  this.lastNavigationTime = now;

  // 如果没有选中项，选择第一个或最后一个
  if (this.selectedIndex < 0) {
    this.selectedIndex = direction > 0 ? 0 : this.currentItems.length - 1;
  } else {
    // 计算新的选中索引
    this.selectedIndex = (this.selectedIndex + direction + this.currentItems.length) % this.currentItems.length;
  }

  // 立即更新选择，但延迟结束导航状态
  this.updateSelection();
  
  var self = this;
  this.navigationTimeout = setTimeout(function() {
    self.isNavigating = false;
  }, debounceDelay);
};

/**
 * 导航到第一项
 */
KeyboardManager.prototype.navigateToFirst = function () {
  if (this.currentItems.length === 0) return;
  
  this.selectedIndex = 0;
  this.updateSelection();
};

/**
 * 导航到最后一项
 */
KeyboardManager.prototype.navigateToLast = function () {
  if (this.currentItems.length === 0) return;
  
  this.selectedIndex = this.currentItems.length - 1;
  this.updateSelection();
};

/**
 * 按页导航
 * @param {number} direction - 方向（1为向下一页，-1为向上一页）
 */
KeyboardManager.prototype.navigateByPage = function (direction) {
  if (this.currentItems.length === 0) return;

  // 计算每页的项目数（基于虚拟滚动器的可见项目数）
  var pageSize = this.virtualScroller ? 
    Math.floor(this.virtualScroller.visibleItems * 0.8) : 10; // 默认10项
  
  var newIndex = this.selectedIndex + (direction * pageSize);
  
  // 确保索引在有效范围内
  newIndex = Math.max(0, Math.min(newIndex, this.currentItems.length - 1));
  
  this.selectedIndex = newIndex;
  this.updateSelection();
};

/**
 * 更新选择状态
 */
KeyboardManager.prototype.updateSelection = function () {
  // 移除所有选中状态
  var activeItems = document.querySelectorAll('.smart-bookmark-bookmark-item.active, .smart-bookmark-folder-item.active');
  for (var i = 0; i < activeItems.length; i++) {
    activeItems[i].classList.remove('active');
  }

  // 如果有有效的选中项
  if (this.selectedIndex >= 0 && this.selectedIndex < this.currentItems.length) {
    var selectedItem = this.currentItems[this.selectedIndex];
    
    // 使用虚拟滚动器滚动到选中项，添加边界检查
    if (this.virtualScroller && selectedItem) {
      // 确保索引在虚拟滚动器的有效范围内
      if (this.selectedIndex < this.virtualScroller.totalItems) {
        this.virtualScroller.scrollToIndex(this.selectedIndex);
      } else {
        console.warn('Selected index out of virtual scroller range:', this.selectedIndex, 'total:', this.virtualScroller.totalItems);
      }
    }

    // 延迟添加选中状态，确保虚拟滚动器已渲染且没有其他选中项
    var self = this;
    setTimeout(function() {
      // 再次清除所有选中状态，确保唯一性
      var allActiveItems = document.querySelectorAll('.smart-bookmark-bookmark-item.active, .smart-bookmark-folder-item.active');
      for (var j = 0; j < allActiveItems.length; j++) {
        allActiveItems[j].classList.remove('active');
      }
      
      var currentItem = document.querySelector(
        '[data-folder-id="' + selectedItem.id + '"], [data-bookmark-id="' + selectedItem.id + '"]'
      );
      if (currentItem) {
        currentItem.classList.add('active');
        
        // 确保选中项在视口中可见
        self.ensureItemVisible(currentItem);
      }
    }, 20); // 缩短延迟时间

    // 如果是文件夹选择模式，启用确认按钮
    if (this.currentMode === window.SMART_BOOKMARK_CONSTANTS.MODE_FOLDER_SELECT) {
      var confirmBtn = document.getElementById('smart-bookmark-confirm');
      if (confirmBtn) {
        confirmBtn.disabled = false;
      }
    }
  }
};

/**
 * 确保项目在视口中可见
 * @param {Element} item - 项目元素
 */
KeyboardManager.prototype.ensureItemVisible = function (item) {
  if (!item) return;

  var container = item.closest('.smart-bookmark-folder-list, .smart-bookmark-bookmark-list');
  if (!container) return;

  var containerRect = container.getBoundingClientRect();
  var itemRect = item.getBoundingClientRect();

  // 计算项目相对于容器的位置
  var itemTop = itemRect.top - containerRect.top;
  var itemBottom = itemRect.bottom - containerRect.top;

  // 如果项目不完全可见，滚动容器
  if (itemTop < 0) {
    // 项目在视口上方
    container.scrollTop += itemTop - 10; // 添加一些边距
  } else if (itemBottom > containerRect.height) {
    // 项目在视口下方
    container.scrollTop += itemBottom - containerRect.height + 10; // 添加一些边距
  }
};

/**
 * 设置当前模式
 * @param {string} mode - 模式类型
 */
KeyboardManager.prototype.setMode = function (mode) {
  this.currentMode = mode;
  this.selectedIndex = -1; // 重置选中索引
};

/**
 * 设置当前项目列表
 * @param {Array} items - 项目列表
 */
KeyboardManager.prototype.setCurrentItems = function (items) {
  this.currentItems = items || [];
  this.selectedIndex = -1; // 重置选中索引
};

/**
 * 设置虚拟滚动器引用
 * @param {VirtualScroller} virtualScroller - 虚拟滚动器实例
 */
KeyboardManager.prototype.setVirtualScroller = function (virtualScroller) {
  this.virtualScroller = virtualScroller;
};

/**
 * 设置模态框可见状态
 * @param {boolean} visible - 是否可见
 */
KeyboardManager.prototype.setModalVisible = function (visible) {
  this.isModalVisible = visible;
  if (!visible) {
    this.selectedIndex = -1; // 重置选中索引
  }
};

/**
 * 获取当前选中的项目
 * @returns {Object|null} 当前选中的项目
 */
KeyboardManager.prototype.getSelectedItem = function () {
  if (this.selectedIndex >= 0 && this.selectedIndex < this.currentItems.length) {
    return this.currentItems[this.selectedIndex];
  }
  return null;
};

/**
 * 获取当前选中的索引
 * @returns {number} 当前选中的索引
 */
KeyboardManager.prototype.getSelectedIndex = function () {
  return this.selectedIndex;
};

/**
 * 设置选中索引
 * @param {number} index - 选中索引
 */
KeyboardManager.prototype.setSelectedIndex = function (index) {
  // 添加额外的验证和调试信息
  if (typeof index !== 'number') {
    console.warn('Invalid index type:', typeof index, index);
    this.selectedIndex = -1;
    return;
  }
  
  if (index >= 0 && index < this.currentItems.length) {
    this.selectedIndex = index;
    this.updateSelection();
  } else if (index === -1) {
    this.selectedIndex = -1;
  } else {
    console.warn('Index out of range:', index, 'total items:', this.currentItems.length);
    this.selectedIndex = -1;
  }
};

/**
 * 设置回调函数
 * @param {Object} callbacks - 回调函数对象
 */
KeyboardManager.prototype.setCallbacks = function (callbacks) {
  this.onConfirm = callbacks.onConfirm || null;
  this.onModeToggle = callbacks.onModeToggle || null;
  this.onModalClose = callbacks.onModalClose || null;
};

/**
 * 重置键盘导航状态
 */
KeyboardManager.prototype.reset = function () {
  this.selectedIndex = -1;
  this.currentItems = [];
  
  // 移除所有选中状态
  var activeItems = document.querySelectorAll('.smart-bookmark-bookmark-item.active, .smart-bookmark-folder-item.active');
  for (var i = 0; i < activeItems.length; i++) {
    activeItems[i].classList.remove('active');
  }
};

/**
 * 清理键盘管理器
 */
KeyboardManager.prototype.cleanup = function () {
  // 移除所有事件监听器
  for (var i = 0; i < this.eventListeners.length; i++) {
    var listener = this.eventListeners[i];
    try {
      listener.element.removeEventListener(listener.event, listener.handler);
    } catch (e) {
      // 忽略移除失败的监听器
    }
  }

  this.eventListeners = [];
  
  // 重置状态
  this.reset();
  this.virtualScroller = null;
  this.isModalVisible = false;
  
  // 清除回调函数
  this.onConfirm = null;
  this.onModeToggle = null;
  this.onModalClose = null;
};

// 将类附加到全局window对象
window.KeyboardManager = KeyboardManager;