// ============================================
// 资金管理接口（扣除 + 新增）
// ============================================
const User = require('./models/User');
const Asset = require('./models/Asset');

module.exports = (app) => {

    // ============================================
    // 扣除用户资金
    // ============================================
    app.post('/api/admin/deduct-balance', async (req, res) => {
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
                return res.json({ success: false, message: '该用户没有 USDT 资产' });
            }

            if (parseFloat(asset.balance) < parseFloat(amount)) {
                return res.json({ success: false, message: '余额不足，当前余额：' + asset.balance });
            }

            await asset.decrement('balance', { by: parseFloat(amount) });
            await asset.decrement('total', { by: parseFloat(amount) });

            res.json({ success: true, message: '已扣除 ' + amount + ' USDT' });
        } catch (error) {
            console.error('扣除资金失败：', error);
            res.json({ success: false, message: error.message });
        }
    });

    // ============================================
    // 新增用户资金
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
                // 如果没资产，创建一个
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