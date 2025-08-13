// Fallback page script for Smart Bookmark Extension

function openNewTab() {
    // 通过消息传递与background script通信，打开浏览器默认新标签页
    chrome.runtime.sendMessage({
        action: "openNewTab",
        url: "chrome://newtab/"
    }, function(response) {
        if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError);
            // 如果消息传递失败，尝试其他方式
            fallbackOpenTab();
        } else {
            console.log("New tab request sent successfully");
            // 延迟关闭，确保新标签页已打开
            setTimeout(function() {
                closeCurrentTab();
            }, 100);
        }
    });
}

function fallbackOpenTab() {
    // 备用方案：尝试直接打开浏览器默认新标签页
    try {
        // 尝试打开chrome://newtab/，如果失败则使用about:blank
        var newTabUrl = 'chrome://newtab/';
        try {
            window.open(newTabUrl, '_blank');
        } catch (e) {
            // 如果chrome://newtab/失败，使用about:blank作为备选
            window.open('about:blank', '_blank');
        }
        closeCurrentTab();
    } catch (error) {
        console.error("Failed to open new tab:", error);
        alert("无法打开新标签页，请手动打开");
    }
}

function closeCurrentTab() {
    // 尝试多种方式关闭标签页
    try {
        // 首先尝试通过background script关闭
        chrome.runtime.sendMessage({
            action: "closeCurrentTab"
        }, function(response) {
            if (chrome.runtime.lastError) {
                // 如果background script方式失败，尝试window.close()
                fallbackClose();
            }
        });
    } catch (error) {
        fallbackClose();
    }
}

function fallbackClose() {
    try {
        window.close();
    } catch (error) {
        console.log("Cannot close window programmatically");
        // 如果无法关闭，显示提示
        document.body.innerHTML = `
            <div class="fallback-container">
                <div class="fallback-icon">✅</div>
                <h1 class="fallback-title">操作完成</h1>
                <p class="fallback-message">请手动关闭此标签页</p>
            </div>
        `;
    }
}

// DOM加载完成后绑定事件
document.addEventListener('DOMContentLoaded', function() {
    // 绑定按钮事件
    const openTabButton = document.querySelector('.fallback-button.primary');
    const closeButton = document.querySelector('.fallback-button.secondary');
    
    if (openTabButton) {
        openTabButton.addEventListener('click', openNewTab);
    }
    
    if (closeButton) {
        closeButton.addEventListener('click', closeCurrentTab);
    }
    
    // 如果是从受限页面打开的，显示更详细的信息
    const urlParams = new URLSearchParams(window.location.search);
    const restrictedUrl = urlParams.get('from');
    if (restrictedUrl) {
        const message = document.querySelector('.fallback-message');
        if (message) {
            message.innerHTML = `
                当前页面 <code>${restrictedUrl}</code> 不支持内容脚本。<br>
                浏览器内部页面（如设置页、扩展管理页等）出于安全考虑不允许扩展注入脚本。<br>
                请在普通网页中使用书签管理器功能。
            `;
        }
    }
});