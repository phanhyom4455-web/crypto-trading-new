// 额外路由 - 不修改 app.js 原有代码

module.exports = function(app) {
    
    // ============================================
    // 帮助中心页面
    // ============================================
    app.get('/help', (req, res) => {
        res.render('frontend/help', {
            title: '帮助中心 - 数字货币交易平台',
            currentPage: 'help',
            user: req.session.user || null
        });
    });

    // ============================================
    // 常见问题页面
    // ============================================
    app.get('/faq', (req, res) => {
        res.render('frontend/faq', {
            title: '常见问题 - 数字货币交易平台',
            currentPage: 'faq',
            user: req.session.user || null
        });
    });

    // ============================================
    // 实名认证页面
    // ============================================
    app.get('/kyc', (req, res) => {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        res.render('frontend/kyc', {
            title: '实名认证 - 数字货币交易平台',
            currentPage: 'kyc',
            user: req.session.user
        });
    });
};