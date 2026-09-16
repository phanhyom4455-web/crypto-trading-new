// ============================================
// 后台用户余额接口（总资产 = 所有币种折算 USDT）
// ============================================
const User = require('./models/User');
const Asset = require('./models/Asset');

// ✅ 币价（必须和 routes-price.js 里保持一致）
const COIN_PRICES = {
    'USDT': 1,
    'BTC': 62450,
    'ETH': 2450,
    'ADA': 0.452,
    'DOT': 6.25,
    'SOL': 25.80,
    'AVAX': 14.20
};

module.exports = (app) => {

    // ============================================
    // 获取所有用户 + 总资产（USDT 计价）
    // ============================================
    app.get('/api/admin/users-with-balance', async (req, res) => {
        try {
            if (!req.session.admin) {
                return res.json({ success: false, message: '未登录' });
            }

            const users = await User.findAll({
                order: [['id', 'DESC']]
            });

            const usersWithBalance = [];

            for (const user of users) {
                let totalValue = 0;      // 总资产（USDT计价）
                let frozenValue = 0;     // 冻结资产（USDT计价）
                let usdtBalance = 0;     // USDT 余额
                const assetsDetail = []; // 明细（用于悬停显示）

                try {
                    // ✅ 查该用户【所有币种】
                    const assets = await Asset.findAll({
                        where: { user_id: user.id }
                    });

                    for (const asset of assets) {
                        const balance = parseFloat(asset.balance) || 0;
                        const frozen = parseFloat(asset.frozen) || 0;
                        const price = COIN_PRICES[asset.currency] || 0;

                        totalValue += balance * price;
                        frozenValue += frozen * price;

                        if (asset.currency === 'USDT') {
                           usdtBalance += balance;
                       }

                        assetsDetail.push({
                            currency: asset.currency,
                            balance: balance,
                            price: price,
                            value: balance * price
                        });
                    }
                } catch (e) {
                    console.error('查询资产失败:', e);
                }

                usersWithBalance.push({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    phone: user.phone,
                    vip: user.vip,
                    points: user.points,
                    orders: user.orders,
                    spent: user.spent,
                    status: user.status,
                    // ✅ 总资产（所有币种折算USDT）= 和前台一致
                    balance: parseFloat(totalValue.toFixed(2)),
                    frozen: parseFloat(frozenValue.toFixed(2)),
                    total: parseFloat((totalValue + frozenValue).toFixed(2)),
                    usdtBalance: usdtBalance,
                    assetsDetail: assetsDetail
                });
            }

            res.json({ success: true, users: usersWithBalance });
        } catch (err) {
            console.error('获取用户余额失败：', err);
            res.json({ success: false, message: err.message });
        }
    });

};