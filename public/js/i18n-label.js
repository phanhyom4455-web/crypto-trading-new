// ============================================
// 补丁：更新语言按钮上的文字（中文/EN/ລາວ/ไทย）
// ============================================
(function() {
    // 保存原函数
    var originalSetLang = window.setLang;

    // 重写 setLang
    window.setLang = function(lang) {
        // 先调用原函数（应用翻译）
        if (typeof originalSetLang === 'function') {
            originalSetLang(lang);
        }

        // 然后更新按钮上的文字
        var langLabel = document.getElementById('currentLangLabel');
        if (langLabel) {
            var labels = {
                zh: '中文',
                en: 'EN',
                lo: 'ລາວ',
                th: 'ไทย'
            };
            langLabel.textContent = labels[lang] || lang;
        }
    };

    // 页面加载时也更新一次（根据 localStorage 里的语言）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateLabel);
    } else {
        updateLabel();
    }

    function updateLabel() {
        var lang = localStorage.getItem('lang') || 'zh';
        var langLabel = document.getElementById('currentLangLabel');
        if (langLabel) {
            var labels = {
                zh: '中文',
                en: 'EN',
                lo: 'ລາວ',
                th: 'ไทย'
            };
            langLabel.textContent = labels[lang] || lang;
        }
    }
})();