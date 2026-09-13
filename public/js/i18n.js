// ============================================
// 多语言切换逻辑
// ============================================
(function() {

    // 获取当前语言（默认中文）
    function getCurrentLang() {
        return localStorage.getItem('lang') || 'zh';
    }

    // 应用翻译到页面所有 [data-i18n] 元素
    function applyTranslations(lang) {
        if (!window.translations || !window.translations[lang]) {
            console.warn('翻译文件不存在：', lang);
            return;
        }

        var t = window.translations[lang];

        document.querySelectorAll('[data-i18n]').forEach(function(el) {
            var key = el.getAttribute('data-i18n');
            if (t[key]) {
                el.textContent = t[key];
            }
        });

        // 如果有 data-i18n-placeholder 属性（输入框提示文字）
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
            var key = el.getAttribute('data-i18n-placeholder');
            if (t[key]) {
                el.setAttribute('placeholder', t[key]);
            }
        });

        // 更新 <html lang="xx">
        document.documentElement.setAttribute('lang', lang);

        // 更新语言切换按钮的选中状态
        document.querySelectorAll('[data-lang-btn]').forEach(function(btn) {
            if (btn.getAttribute('data-lang-btn') === lang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // 切换语言（全局函数）
    window.setLang = function(lang) {
        localStorage.setItem('lang', lang);
        applyTranslations(lang);
    };

    // 页面加载时自动应用
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            applyTranslations(getCurrentLang());
        });
    } else {
        applyTranslations(getCurrentLang());
    }

})();