// Fallback page script for Bookmark Butler
const FALLBACK_TRANSLATIONS = {
    zh: {
        fallbackTitle: '书签管家',
        fallbackMessage: '当前页面不支持书签管理器扩展。<br>请在普通网页中使用此功能，或者使用下面的快捷操作。',
        fallbackOpenBing: '打开 Bing',
        fallbackClose: '关闭',
        fallbackOpenBingFailed: '无法打开 Bing 搜索，请手动打开',
        fallbackDoneTitle: '操作完成',
        fallbackCloseTabHint: '请手动关闭此标签页',
        fallbackRestrictedMessage: '当前页面 <code>{url}</code> 不支持内容脚本。<br>浏览器内部页面（如设置页、扩展管理页等）出于安全考虑不允许扩展注入脚本。<br>请在普通网页中使用书签管理器功能。'
    },
    en: {
        fallbackTitle: 'Bookmark Butler',
        fallbackMessage: 'This page does not support Bookmark Butler.<br>Use this feature on a regular webpage, or use one of the fallback actions below.',
        fallbackOpenBing: 'Open Bing',
        fallbackClose: 'Close',
        fallbackOpenBingFailed: 'Failed to open Bing. Please open it manually.',
        fallbackDoneTitle: 'Done',
        fallbackCloseTabHint: 'Please close this tab manually.',
        fallbackRestrictedMessage: 'The page <code>{url}</code> does not allow content scripts.<br>Browser-internal pages such as settings and extension pages do not allow script injection for security reasons.<br>Use Bookmark Butler on a regular webpage instead.'
    }
};

function getCurrentLanguage(callback) {
    try {
        chrome.storage.local.get(['smartBookmarkLanguage'], function (result) {
            callback(result && result.smartBookmarkLanguage === 'zh' ? 'zh' : 'en');
        });
    } catch (error) {
        callback('en');
    }
}

function getText(language, key) {
    var table = FALLBACK_TRANSLATIONS[language] || FALLBACK_TRANSLATIONS.en;
    return table[key] || key;
}

function formatText(language, key, vars) {
    var text = getText(language, key);
    var values = vars || {};
    Object.keys(values).forEach(function (name) {
        text = text.replace(new RegExp('\\{' + name + '\\}', 'g'), String(values[name]));
    });
    return text;
}

function applyTranslations(language) {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = getText(language, 'fallbackTitle');

    document.querySelectorAll('[data-i18n]').forEach(function (element) {
        var key = element.getAttribute('data-i18n');
        element.textContent = getText(language, key);
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (element) {
        var key = element.getAttribute('data-i18n-html');
        element.innerHTML = getText(language, key);
    });
}

function openNewTab() {
    // 通过消息传递与background script通信，打开Bing搜索
    chrome.runtime.sendMessage({
        action: "openNewTab",
        url: "https://www.bing.com"
    }, function(response) {
        if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError);
            // 如果消息传递失败，尝试其他方式
            fallbackOpenTab();
        } else {
            console.log("Bing tab request sent successfully");
            // 延迟关闭，确保Bing页面已打开
            setTimeout(function() {
                closeCurrentTab();
            }, 100);
        }
    });
}

function fallbackOpenTab() {
    // 备用方案：尝试直接打开Bing搜索
    try {
        // 尝试打开Bing搜索，如果失败则使用about:blank
        var newTabUrl = 'https://www.bing.com';
        try {
            window.open(newTabUrl, '_blank');
        } catch (e) {
            // 如果Bing失败，使用about:blank作为备选
            window.open('about:blank', '_blank');
        }
        closeCurrentTab();
    } catch (error) {
        console.error("Failed to open Bing:", error);
        getCurrentLanguage(function(language) {
            alert(getText(language, 'fallbackOpenBingFailed'));
        });
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
        getCurrentLanguage(function(language) {
            document.body.innerHTML = `
                <div class="fallback-container">
                    <div class="fallback-icon">✅</div>
                    <h1 class="fallback-title">${getText(language, 'fallbackDoneTitle')}</h1>
                    <p class="fallback-message">${getText(language, 'fallbackCloseTabHint')}</p>
                </div>
            `;
        });
    }
}

// DOM加载完成后绑定事件
document.addEventListener('DOMContentLoaded', function() {
    getCurrentLanguage(function(language) {
        applyTranslations(language);

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
                message.innerHTML = formatText(language, 'fallbackRestrictedMessage', {
                    url: restrictedUrl
                });
            }
        }
    });
});
