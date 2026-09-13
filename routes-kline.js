module.exports = (app) => {
    // K线图页面
    app.get('/kline', (req, res) => {
        res.render('frontend/kline', {
            title: 'K线图 - 数字货币交易平台',
            currentPage: 'kline',
            user: req.session.user || null
        });
    });

    // 交易记录页面
    app.get('/history', (req, res) => {
        res.render('frontend/history', {
            title: '交易记录 - 数字货币交易平台',
            currentPage: 'history',
            user: req.session.user || null
        });
    });
};