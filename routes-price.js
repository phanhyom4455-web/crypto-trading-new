// ============================================
// 价格接口（独立文件）
// ============================================
const TradeOrder2 = require('./models/TradeOrder2');

module.exports = (app) => {

    // ============================================
    // 获取实时价格
    // ============================================
    app.get('/api/coin-prices', (req, res) => {
        // 可以从数据库或外部 API 读取
        // 这里先写死，以后可以改成实时数据
        const prices = {
            'USDT': 1,
            'BTC': 62450,
            'ETH': 2450,
            'ADA': 0.452,
            'DOT': 6.25,
            'SOL': 25.80,
            'AVAX': 14.20
        };

        res.json({
            success: true,
            prices: prices,
            updatedAt: new Date().toISOString()
        });
    });

};