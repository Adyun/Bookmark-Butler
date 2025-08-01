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

  this.init();
}

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
  this.container.addEventListener('scroll', this.scrollHandler);

  // 监听容器大小变化
  if (window.ResizeObserver) {
    this.resizeObserver = new ResizeObserver(function() {
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
  
  console.log('Virtual scroller container height:', this.containerHeight, 'visible items:', this.visibleItems);
};

/**
 * 处理滚动事件
 */
VirtualScroller.prototype.handleScroll = function () {
  this.scrollTop = this.container.scrollTop;
  this.updateVisibleRange();
  this.render();
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
  if (!this.contentContainer || !this.items || this.items.length === 0) {
    return;
  }

  // 清空内容容器
  this.contentContainer.innerHTML = '';

  // 设置内容容器的总高度，确保滚动条正确（包含间距）
  var itemTotalHeight = this.itemHeight + 8; // 项目高度 + 间距
  var totalHeight = this.totalItems * itemTotalHeight;
  this.contentContainer.style.height = totalHeight + 'px';

  // 渲染可见项目
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
      itemElement.style.height = this.itemHeight + 'px'; // 使用完整高度
      itemElement.style.boxSizing = 'border-box';
      itemElement.style.left = '0';
      


      // 确保项目有正确的ID属性，以便键盘导航时能够找到
      if (item.id) {
        if (item.url) {
          itemElement.setAttribute('data-bookmark-id', item.id);
        } else {
          itemElement.setAttribute('data-folder-id', item.id);
        }
      }

      this.contentContainer.appendChild(itemElement);
    }
  }
};

/**
 * 更新数据
 * @param {Array} items - 新的项目数据
 */
VirtualScroller.prototype.updateData = function (items) {
  this.items = items || [];
  this.totalItems = this.items.length;
  
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
    // 如果项目已经在视口内且有足够缓冲区，不需要滚动
  }
};

/**
 * 获取当前第一个可见项目的索引
 */
VirtualScroller.prototype.getFirstVisibleIndex = function () {
  return Math.floor(this.container.scrollTop / this.itemHeight);
};

/**
 * 获取当前最后一个可见项目的索引
 */
VirtualScroller.prototype.getLastVisibleIndex = function () {
  var firstVisible = this.getFirstVisibleIndex();
  var visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
  return Math.min(firstVisible + visibleCount - 1, this.totalItems - 1);
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
 * 销毁虚拟滚动器
 */
VirtualScroller.prototype.destroy = function () {
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