// ============================================
// 资金管理接口（扣除 + 新增）
// 扣除规则：优先扣 USDT，不够再按顺序扣其他币种
// 币种顺序：USDT → BTC → ETH → ADA → DOT → SOL → AVAX
// ============================================
const User = require('./models/User');
const Asset = require('./models/Asset');

// ✅ 币价（必须和 routes-price.js、routes-users-balance.js 保持一致）
const COIN_PRICES = {
    'USDT': 1,
    'BTC': 62450,
    'ETH': 2450,
    'ADA': 0.452,
    'DOT': 6.25,
    'SOL': 25.80,
    'AVAX': 14.20
};

// ✅ 扣款顺序
const DEDUCT_ORDER = ['USDT', 'BTC', 'ETH', 'ADA', 'DOT', 'SOL', 'AVAX'];

module.exports = (app) => {

    // ============================================
    // 扣除用户资金（按总资产估值扣）
    // ============================================
    app.post('/api/admin/deduct-balance', async (req, res) => {
        try {
            if (!req.session.admin) {
                return res.json({ success: false, message: '请先登录管理员账号' });
            }

            const { userId, amount } = req.body;
            const deductAmount = parseFloat(amount);

            if (!userId || !deductAmount || deductAmount <= 0) {
                return res.json({ success: false, message: '参数错误' });
            }

            const user = await User.findByPk(userId);
            if (!user) {
                return res.json({ success: false, message: '用户不存在' });
            }

            // 1. 查该用户所有资产
            const assets = await Asset.findAll({ where: { user_id: userId } });

            if (!assets || assets.length === 0) {
                return res.json({ success: false, message: '该用户没有任何资产' });
            }

            // 2. 计算总资产（USDT 估值）
            let totalValue = 0;
            const assetMap = {};
            for (const a of assets) {
                const bal = parseFloat(a.balance) || 0;
                const price = COIN_PRICES[a.currency] || 0;
                totalValue += bal * price;
                assetMap[a.currency] = a;
            }

            if (totalValue < deductAmount) {
                return res.json({
                    success: false,
                    message: '余额不足，总资产（USDT估值）：$' + totalValue.toFixed(2)
                });
            }

            // 3. 按顺序扣款
            let remaining = deductAmount;   // 还需要扣多少 USDT
            const deductDetail = [];        // 记录扣款明细

            for (const currency of DEDUCT_ORDER) {
                if (remaining <= 0) break;

                const asset = assetMap[currency];
                if (!asset) continue;

                const price = COIN_PRICES[currency] || 0;
                if (price <= 0) continue;

                const balance = parseFloat(asset.balance) || 0;
                if (balance <= 0) continue;

                const balanceValue = balance * price; // 该币种值多少 USDT

                if (balanceValue <= remaining) {
                    // 该币种全部扣光
                    await asset.update({ balance: 0, total: 0 });
                    remaining -= balanceValue;
                    deductDetail.push(`${currency}: -${balance}`);
                } else {
                    // 扣一部分
                    const needCoin = remaining / price;
                    const newBalance = balance - needCoin;
                    const newTotal = Math.max(0, (parseFloat(asset.total) || 0) - needCoin);

                    await asset.update({
                        balance: parseFloat(newBalance.toFixed(8)),
                        total: parseFloat(newTotal.toFixed(8))
                    });

                    deductDetail.push(`${currency}: -${needCoin.toFixed(8)}`);
                    remaining = 0;
                }
            }

            // 4. 记录交易日志（可选，如果你有 Transaction 模型）
            try {
                const Transaction = require('./models/Transaction');
                await Transaction.create({
                    user_id: userId,
                    username: user.username,
                    type: 'deduct',
                    amount: deductAmount,
                    method: 'MIXED',
                    status: 'completed',
                    description: '管理员扣除 ' + deductAmount + ' USDT（' + deductDetail.join(', ') + '）'
                });
            } catch (e) {
                console.warn('记录扣款日志失败（可忽略）：', e.message);
            }

            res.json({
                success: true,
                message: '✅ 已扣除 ' + deductAmount + ' USDT\n明细：' + deductDetail.join('，')
            });

        } catch (error) {
            console.error('扣除资金失败：', error);
            res.json({ success: false, message: error.message });
        }
    });

    // ============================================
    // 新增用户资金（只加 USDT，逻辑不变）
    // ============================================
    app.post('/api/admin/add-balance', async (req, res) => {
        try {
            if (!req.session.admin) {
                return res.json({ success: false, message: '请先登录管理员账号' });
            }
            const { userId, amount } = req.body;
            if (!userId || !amount || amount <= 0) {
                return res.json({ success: false, message: '参数错误' });
            }

            const user = await User.findByPk(userId);
            if (!user) {
                return res.json({ success: false, message: '用户不存在' });
            }

            let asset = await Asset.findOne({ where: { user_id: userId, currency: 'USDT' } });
            if (!asset) {
                asset = await Asset.create({
                    user_id: userId,
                    currency: 'USDT',
                    balance: parseFloat(amount),
                    frozen: 0,
                    total: parseFloat(amount)
                });
            } else {
                await asset.increment('balance', { by: parseFloat(amount) });
                await asset.increment('total', { by: parseFloat(amount) });
            }

            res.json({ success: true, message: '已新增 ' + amount + ' USDT' });
        } catch (error) {
            console.error('新增资金失败：', error);
            res.json({ success: false, message: error.message });
        }
    });

};