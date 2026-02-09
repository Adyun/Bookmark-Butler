// Virtual Scroller Component for the Smart Bookmark Extension

/**
 * 虚拟滚动类 - 用于优化大量DOM元素的渲染性能
 */
function VirtualScroller(container, itemHeight, totalItems, renderItem) {
  this.container = container;
  this.itemHeight = itemHeight; // 固定项目高度
  this.totalItems = totalItems;
  this.renderItem = renderItem; // 渲染单个项目的函数
  this.visibleItems = 0;
  this.startIndex = 0;
  this.endIndex = 0;
  this.items = [];
  this.containerHeight = 0;
  this.scrollTop = 0;
  this.contentContainer = null;
  this.scrollHandler = null;
  this.hasMeasuredItemHeight = false; // 是否已自动测量真实高度
  this.shouldAnimateOnNextRender = true; // 仅在首次或数据更新后为true
  this.isRenderScheduled = false; // rAF合帧标记
  this.lastStartIndex = -1; // 上一次渲染的起始索引
  this.lastEndIndex = -1;   // 上一次渲染的结束索引
  this.selectedIndex = -1;  // 当前选中项的索引，用于渲染时添加 active 状态

  this.init();
}

/**
 * 更新渲染函数（用于复用实例时切换不同渲染逻辑/闭包参数）
 * @param {Function} renderItem
 */
VirtualScroller.prototype.setRenderItem = function (renderItem) {
  if (typeof renderItem === 'function') {
    this.renderItem = renderItem;
    // 下一次渲染启用动画，且立即渲染
    this.shouldAnimateOnNextRender = true;
    this.render();
  }
};

/**
 * 初始化虚拟滚动器
 */
VirtualScroller.prototype.init = function () {
  // 确保容器有正确的样式
  this.container.style.position = 'relative';
  this.container.style.overflowY = 'auto';
  this.container.style.overflowX = 'hidden';

  // 计算容器高度 - 修复高度计算问题
  this.updateContainerHeight();

  // 创建内容容器
  this.contentContainer = document.createElement('div');
  this.contentContainer.style.position = 'relative';
  this.contentContainer.style.width = '100%';

  // 清空容器并添加内容容器
  this.container.innerHTML = '';
  this.container.appendChild(this.contentContainer);

  // 绑定滚动事件
  var self = this;
  this.scrollHandler = function () {
    self.handleScroll();
  };
  // 使用被动监听与兼容处理
  try {
    this.container.addEventListener('scroll', this.scrollHandler, { passive: true });
  } catch (e) {
    this.container.addEventListener('scroll', this.scrollHandler);
  }

  // 监听容器大小变化
  if (window.ResizeObserver) {
    this.resizeObserver = new ResizeObserver(function () {
      self.updateContainerHeight();
      self.render();
    });
    this.resizeObserver.observe(this.container);
  }

  // 初始渲染
  this.render();
};

/**
 * 更新容器高度 - 修复高度计算问题
 */
VirtualScroller.prototype.updateContainerHeight = function () {
  // 获取容器的实际可用高度
  var containerRect = this.container.getBoundingClientRect();
  this.containerHeight = containerRect.height;

  // 如果高度为0，使用默认值
  if (this.containerHeight <= 0) {
    this.containerHeight = 400; // 默认高度
  }

  // 计算可见项目数量，添加缓冲区（考虑间距）
  var itemTotalHeight = this.itemHeight + 8; // 项目高度 + 间距
  this.visibleItems = Math.ceil(this.containerHeight / itemTotalHeight) + 4; // 增加缓冲区

  // 移除高频日志，避免阻塞主线程
};

/**
 * 处理滚动事件
 */
VirtualScroller.prototype.handleScroll = function () {
  var self = this;
  this.scrollTop = this.container.scrollTop;
  if (this.isRenderScheduled) return;
  this.isRenderScheduled = true;
  requestAnimationFrame(function () {
    self.isRenderScheduled = false;
    self.updateVisibleRange();
    self.render();
  });
};

/**
 * 更新可见范围
 */
VirtualScroller.prototype.updateVisibleRange = function () {
  var itemTotalHeight = this.itemHeight + 8; // 项目高度 + 间距
  this.startIndex = Math.max(0, Math.floor(this.scrollTop / itemTotalHeight) - 2);
  this.endIndex = Math.min(this.totalItems - 1, this.startIndex + this.visibleItems);
};

/**
 * 渲染可见项目
 */
VirtualScroller.prototype.render = function () {
  // 如果没有内容容器，直接返回
  if (!this.contentContainer) {
    return;
  }

  // 如果没有数据，清空内容容器并返回（让外部显示 "无结果" 消息）
  if (!this.items || this.items.length === 0) {
    this.contentContainer.innerHTML = '';
    this.contentContainer.style.height = '0px';
    return;
  }

  // 检查内容容器是否被外部移除（用于显示 "无结果" 等消息）
  // 注意：这里不自动重新挂载，让 updateData() 时重新挂载
  if (!this.contentContainer.parentNode) {
    return;
  }

  // 如果可见范围未变化且不需要动画，跳过渲染
  if (this.startIndex === this.lastStartIndex && this.endIndex === this.lastEndIndex && !this.shouldAnimateOnNextRender) {
    return;
  }

  // 清空内容容器
  this.contentContainer.innerHTML = '';

  // 设置内容容器的总高度，确保滚动条正确（包含间距）
  var itemTotalHeight = this.itemHeight + 8; // 项目高度 + 间距
  var totalHeight = this.totalItems * itemTotalHeight;
  this.contentContainer.style.height = totalHeight + 'px';

  // 渲染可见项目
  var measuredMax = 0;

  for (var i = this.startIndex; i <= this.endIndex && i < this.items.length; i++) {
    var item = this.items[i];
    if (!item) continue;

    var itemElement = this.renderItem(item, i);
    if (itemElement) {
      // 设置项目位置和样式，正确计算间距
      var itemMarginBottom = 8; // 底部间距
      var itemMarginRight = 8; // 右边距

      itemElement.style.position = 'absolute';
      // 正确计算top位置：每个项目的位置 = (索引 * (项目高度 + 间距))
      itemElement.style.top = (i * (this.itemHeight + itemMarginBottom)) + 'px';
      itemElement.style.width = 'calc(100% - ' + itemMarginRight + 'px)';
      // 在未测量真实高度前，不强制设置高度，避免测量被干扰
      if (this.hasMeasuredItemHeight) {
        itemElement.style.height = this.itemHeight + 'px';
      } else {
        itemElement.style.height = '';
      }
      itemElement.style.boxSizing = 'border-box';
      itemElement.style.left = '0';

      // 添加出现动画：仅在允许动画时触发
      if (this.shouldAnimateOnNextRender) {
        this.addItemAnimation(itemElement, i - this.startIndex);
      }

      // 追加到DOM
      this.contentContainer.appendChild(itemElement);

      // 首次渲染时，自动测量真实高度（取可见窗口中的最大值，处理不同类型项高度差异）
      if (!this.hasMeasuredItemHeight) {
        var measured = itemElement.offsetHeight;
        if (measured > measuredMax) measuredMax = measured;
      }

      // 确保项目有正确的ID属性，以便键盘导航时能够找到
      if (item.id) {
        if (item.url) {
          itemElement.setAttribute('data-bookmark-id', item.id);
        } else {
          itemElement.setAttribute('data-folder-id', item.id);
        }
      }

      // 已在上方 append
    }
  }

  // 渲染后统一更新测量高度，避免只测到第一项过小的问题
  if (!this.hasMeasuredItemHeight) {
    this.hasMeasuredItemHeight = true;
    if (measuredMax && Math.abs(measuredMax - this.itemHeight) > 1) {
      this.setItemHeight(measuredMax);
    }
  }

  // 本轮渲染后，关闭自动动画
  this.shouldAnimateOnNextRender = false;

  // 使用 selectedIndex 添加选中状态（不再依赖 DOM 查询，避免时序问题）
  if (this.selectedIndex >= 0 && this.selectedIndex >= this.startIndex && this.selectedIndex <= this.endIndex && this.items[this.selectedIndex]) {
    var selectedItem = this.items[this.selectedIndex];
    var selector = '[data-folder-id="' + selectedItem.id + '"], [data-bookmark-id="' + selectedItem.id + '"]';
    var selectedElement = this.contentContainer.querySelector(selector);
    if (selectedElement) {
      selectedElement.classList.add('active');
    }
  }
  // 记录本次渲染范围
  this.lastStartIndex = this.startIndex;
  this.lastEndIndex = this.endIndex;
};

/**
 * 更新数据
 * @param {Array} items - 新的项目数据
 */
VirtualScroller.prototype.updateData = function (items) {
  this.items = items || [];
  this.totalItems = this.items.length;
  // 数据变化后允许再次自动测量高度
  this.hasMeasuredItemHeight = false;
  // 高度归一化：在搜索清空或返回初始状态时，重置到默认高度，避免因上次测量残留
  if (this.totalItems === 0) {
    this.itemHeight = this.itemHeight || 58;
  }

  // 数据更新：标记下一次渲染需要动画，并重置动画状态
  this.shouldAnimateOnNextRender = true;
  this.resetAnimations();

  // 如果有数据且内容容器未挂载，重新挂载
  if (this.totalItems > 0 && this.contentContainer && !this.contentContainer.parentNode) {
    try {
      this.container.innerHTML = '';
      this.container.appendChild(this.contentContainer);
    } catch (e) { }
  }

  // 重新计算可见范围
  this.updateVisibleRange();

  // 重新渲染
  this.render();
};

/**
 * 滚动到指定项目
 * @param {number} index - 项目索引
 */
VirtualScroller.prototype.scrollToIndex = function (index) {
  if (index >= 0 && index < this.totalItems) {
    var itemTotalHeight = this.itemHeight + 8; // 项目高度 + 间距
    var targetScrollTop = index * itemTotalHeight;

    // 确保目标项目在可视区域内，并添加一些缓冲区
    var viewportTop = this.container.scrollTop;
    var viewportBottom = viewportTop + this.containerHeight;
    var itemTop = targetScrollTop;
    var itemBottom = itemTop + this.itemHeight;

    // 添加缓冲区，确保项目完全可见
    var buffer = this.itemHeight * 0.5; // 半个项目高度的缓冲区

    if (itemTop < viewportTop + buffer) {
      // 项目在视口上方或太接近顶部，滚动到项目顶部有缓冲区
      this.container.scrollTop = Math.max(0, itemTop - buffer);
    } else if (itemBottom > viewportBottom - buffer) {
      // 项目在视口下方或太接近底部，滚动到项目底部可见有缓冲区
      this.container.scrollTop = itemBottom - this.containerHeight + buffer;
    }

    // 滚动后立即更新可见范围
    this.scrollTop = this.container.scrollTop;
    this.updateVisibleRange();

    // 强制绕过渲染优化，确保目标元素一定会被渲染出来
    // 重置 lastStartIndex 和 lastEndIndex 使 render 函数不会跳过
    this.lastStartIndex = -1;
    this.lastEndIndex = -1;
    this.render();
  }
};

/**
 * 获取当前第一个可见项目的索引
 */
VirtualScroller.prototype.getFirstVisibleIndex = function () {
  return Math.floor(this.container.scrollTop / (this.itemHeight + 8));
};

/**
 * 获取当前最后一个可见项目的索引
 */
VirtualScroller.prototype.getLastVisibleIndex = function () {
  var firstVisible = this.getFirstVisibleIndex();
  var visibleCount = Math.ceil(this.containerHeight / (this.itemHeight + 8));
  return Math.min(firstVisible + visibleCount - 1, this.totalItems - 1);
};

/**
 * 设置当前选中项的索引
 * @param {number} index - 选中项的索引，-1 表示无选中
 */
VirtualScroller.prototype.setSelectedIndex = function (index) {
  var oldIndex = this.selectedIndex;
  this.selectedIndex = index;

  // 如果索引变化了，更新 DOM 中的 active 状态
  if (oldIndex !== index) {
    // 移除所有现有的 active 状态
    var activeItems = this.contentContainer.querySelectorAll('.smart-bookmark-folder-item.active, .smart-bookmark-bookmark-item.active');
    for (var i = 0; i < activeItems.length; i++) {
      activeItems[i].classList.remove('active');
    }

    // 如果新索引有效且在当前渲染范围内，添加 active 状态
    if (index >= 0 && index >= this.startIndex && index <= this.endIndex && this.items[index]) {
      var item = this.items[index];
      var selector = '[data-folder-id="' + item.id + '"], [data-bookmark-id="' + item.id + '"]';
      var element = this.contentContainer.querySelector(selector);
      if (element) {
        element.classList.add('active');
      }
    }
  }
};

/**
 * 强制重新渲染
 */
VirtualScroller.prototype.forceUpdate = function () {
  this.updateContainerHeight();
  this.updateVisibleRange();
  this.render();
};

/**
 * 外部更新项目高度并重算
 * @param {number} newHeight
 */
VirtualScroller.prototype.setItemHeight = function (newHeight) {
  if (typeof newHeight === 'number' && newHeight > 0) {
    this.itemHeight = newHeight;
    this.updateContainerHeight();
    this.updateVisibleRange();
    this.render();
  }
};

/**
 * 为列表项添加出现动画
 * @param {HTMLElement} itemElement - 列表项元素
 * @param {number} relativeIndex - 在当前可见区域的相对索引
 */
VirtualScroller.prototype.addItemAnimation = function (itemElement, relativeIndex) {
  // 列表很大时关闭动画，避免首屏卡顿
  if (this.totalItems && this.totalItems > 200) {
    itemElement.style.opacity = '1';
    itemElement.style.transform = 'none';
    return;
  }

  // 如果用户设置了减少动画，跳过动画
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    itemElement.style.opacity = '1';
    itemElement.style.transform = 'none';
    return;
  }

  // 检查元素是否已经有动画类，避免重复添加
  var hasAnimation = itemElement.classList.contains('animate-in') ||
    itemElement.classList.contains('animate-slide') ||
    itemElement.classList.contains('animate-scale');

  if (hasAnimation) {
    return;
  }

  // 根据列表项类型选择不同的动画效果
  var animationType = 'animate-in'; // 默认向上淡入动画

  // 文件夹和书签都使用相同的从下到上动画
  if (itemElement.classList.contains('smart-bookmark-folder-item')) {
    animationType = 'animate-in'; // 文件夹也用向上淡入
  } else if (itemElement.classList.contains('smart-bookmark-bookmark-item')) {
    animationType = 'animate-in'; // 书签向上淡入
  }

  // 限制同一帧内动画的项目数量，避免过多重绘
  if (typeof relativeIndex === 'number' && relativeIndex > 20) {
    itemElement.style.opacity = '1';
    itemElement.style.transform = 'none';
    return;
  }

  // 添加动画类
  itemElement.classList.add(animationType);

  // 设置动画延迟，创建交错效果
  var baseDelay = Math.min(relativeIndex * 30, 300); // 最大延迟不超过300ms
  itemElement.style.animationDelay = baseDelay + 'ms';

  // 动画完成后清理
  var self = this;
  itemElement.addEventListener('animationend', function () {
    itemElement.classList.remove(animationType);
    itemElement.style.animationDelay = '';
    // 确保最终状态正确
    itemElement.style.opacity = '1';
    itemElement.style.transform = 'none';
  }, { once: true });
};

/**
 * 重置所有动画状态
 */
VirtualScroller.prototype.resetAnimations = function () {
  if (!this.contentContainer) return;

  var items = this.contentContainer.querySelectorAll('.smart-bookmark-folder-item, .smart-bookmark-bookmark-item');
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    item.classList.remove('animate-in', 'animate-slide', 'animate-scale');
    item.style.animationDelay = '';
    item.style.opacity = '1';
    item.style.transform = 'none';
  }
};

/**
 * 销毁虚拟滚动器
 */
VirtualScroller.prototype.destroy = function () {
  // 清理动画
  this.resetAnimations();

  if (this.scrollHandler) {
    this.container.removeEventListener('scroll', this.scrollHandler);
    this.scrollHandler = null;
  }

  if (this.resizeObserver) {
    this.resizeObserver.disconnect();
    this.resizeObserver = null;
  }

  if (this.container) {
    this.container.innerHTML = '';
  }

  this.contentContainer = null;
  this.items = [];
};

// 将类附加到全局window对象
window.VirtualScroller = VirtualScroller;