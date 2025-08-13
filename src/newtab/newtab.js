// newtab.js - 直接复用现有功能

class NewTabPage {
    constructor() {
        this.modalManager = null;
        this.init();
    }
    
    async init() {
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    async setup() {
        try {
            // 直接使用现有的modal管理器，它会自动创建 Modal DOM
            this.modalManager = new ModalManager();
            // 暴露到全局，保证语言管理模块能正确读取当前模式等状态
            window.modalManager = this.modalManager;
            
            // 移动自动创建的 Modal 到锚点位置
            const backdrop = document.querySelector('.smart-bookmark-modal-backdrop');
            const anchor = document.getElementById('newtab-modal-anchor');
            if (backdrop && anchor && anchor.parentNode) {
                anchor.parentNode.insertBefore(backdrop, anchor);
            }
            
            // 显示 Modal（页面内展示）
            this.modalManager.show({ title: '', url: '' });
            
            // 让 modal 在新标签页环境下运行（仅覆盖必要行为）
            this.adaptForNewTab();
            
            // 自动聚焦搜索框
            setTimeout(() => {
                const searchInput = document.getElementById('smart-bookmark-search');
                if (searchInput) {
                    // 自动聚焦（打开 newtab 时）
                    searchInput.focus();
                    // 聚焦时如果没有输入，也默认展开书签列表（显示全部或最近）
                    if (!searchInput.value.trim()) {
                        // 触发一次空查询，让现有逻辑渲染默认列表
                        try {
                            if (this.modalManager && this.modalManager.handleSearch) {
                                this.modalManager.handleSearch('');
                            }
                        } catch (e) {
                            console.warn('Default open list failed:', e);
                        }
                    }
                }
            }, 300);
            
            console.log('NewTab page initialized successfully');
        } catch (error) {
            console.error('Failed to initialize NewTab page:', error);
        }
    }
    
    adaptForNewTab() {
        // 隐藏不需要的按钮
        const confirmButton = document.getElementById('smart-bookmark-confirm');
        const cancelButton = document.getElementById('smart-bookmark-cancel');
        if (confirmButton) confirmButton.style.display = 'none';
        if (cancelButton) cancelButton.style.display = 'none';
        
        // 在 newtab 中：书签在当前标签页打开（点击与回车都一致）
        if (this.modalManager) {
            const mm = this.modalManager;
            // 覆盖点击行为
            if (mm.selectBookmark) {
                mm.selectBookmark = function(bookmarkItem) {
                    var url = bookmarkItem && bookmarkItem.getAttribute ? bookmarkItem.getAttribute('data-bookmark-url') : (bookmarkItem && bookmarkItem.url);
                    if (url) {
                        if (!mm.isSpecialUrl || !mm.isSpecialUrl(url)) {
                            window.location.href = url;
                        } else if (mm.languageManager && window.SMART_BOOKMARK_HELPERS) {
                            window.SMART_BOOKMARK_HELPERS.showToast(mm.languageManager.t('specialUrlWarning'), true);
                        }
                    }
                };
            }
            // 覆盖回车确认行为
            if (mm.handleConfirm && mm.keyboardManager) {
                mm.handleConfirm = function() {
                    var selectedItem = mm.keyboardManager.getSelectedItem && mm.keyboardManager.getSelectedItem();
                    if (selectedItem && selectedItem.url) {
                        if (!mm.isSpecialUrl || !mm.isSpecialUrl(selectedItem.url)) {
                            window.location.href = selectedItem.url;
                        } else if (mm.languageManager && window.SMART_BOOKMARK_HELPERS) {
                            window.SMART_BOOKMARK_HELPERS.showToast(mm.languageManager.t('specialUrlWarning'), true);
                        }
                    }
                };
            }
            // 兜底：若其他路径调用 openBookmark
            if (mm.openBookmark) {
                mm.openBookmark = function(bookmark) {
                    if (bookmark && bookmark.url) {
                        window.location.href = bookmark.url;
                    }
                };
            }
        }
        
        // 重写hide方法，避免隐藏整个页面
        if (this.modalManager && this.modalManager.hide) {
            this.modalManager.hide = function() {
                // 只清空搜索内容，不隐藏页面
                const searchInput = document.getElementById('smart-bookmark-search');
                if (searchInput) {
                    searchInput.value = '';
                }
                // 清空搜索结果
                const bookmarkList = document.getElementById('smart-bookmark-bookmark-list');
                const folderList = document.getElementById('smart-bookmark-folder-list');
                if (bookmarkList) bookmarkList.innerHTML = '';
                if (folderList) folderList.innerHTML = '';
                if (folderList) folderList.style.display = 'none';
            };
        }

        // 禁用“切换模式”（空格键）与“进入文件夹选择模式”的入口，newtab只用于打开书签
        if (this.modalManager && this.modalManager.keyboardManager) {
            // 取消模式切换回调
            this.modalManager.keyboardManager.setCallbacks({
                onConfirm: this.modalManager.handleConfirm ? this.modalManager.handleConfirm.bind(this.modalManager) : null,
                onModeToggle: null, // 禁用切换模式
                onModalClose: null
            });
        }

        // 强制保持书签搜索模式
        if (this.modalManager && this.modalManager.uiManager) {
            this.modalManager.uiManager.currentMode = window.SMART_BOOKMARK_CONSTANTS.MODE_BOOKMARK_SEARCH;
        }

        // 同步页面 body 的深色模式：仅作用于 newtab 实例，不影响弹窗
        if (this.modalManager && this.modalManager.themeManager) {
            const tm = this.modalManager.themeManager;
            const originalApplyDarkMode = tm.applyDarkMode.bind(tm);
            tm.applyDarkMode = function() {
                originalApplyDarkMode();
                try {
                    const modal = document.getElementById(window.SMART_BOOKMARK_CONSTANTS.MODAL_ID);
                    const backdrop = document.querySelector('.smart-bookmark-modal-backdrop');
                    const isDarkOnModal = modal && modal.classList.contains(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
                    const isDarkOnBackdrop = backdrop && backdrop.classList.contains(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
                    if (isDarkOnModal || isDarkOnBackdrop) {
                        document.body.classList.add(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
                    } else {
                        document.body.classList.remove(window.SMART_BOOKMARK_CONSTANTS.DARK_MODE_CLASS);
                    }
                } catch (e) {
                    console.warn('Failed to sync body dark mode:', e);
                }
            };

            // 首次进入时立即同步一次
            if (tm.forceReapplyTheme) {
                tm.forceReapplyTheme();
            } else if (tm.applyDarkMode) {
                tm.applyDarkMode();
            }
        }
    }


}

// 全局变量，方便调试
let newTabPage;

// 初始化新标签页
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        newTabPage = new NewTabPage();
    });
} else {
    newTabPage = new NewTabPage();
}