// ============================================
// 币币兑换 API
// ============================================
const Asset = require('./models/Asset');
const Currency = require('./models/Currency');
const Exchange = require('./models/Exchange');

module.exports = (app) => {

    // 获取所有可兑换币种（从数据库读）
    app.get('/api/currencies', async (req, res) => {
        try {
            const currencies = await Currency.findAll({
                where: { enabled: true },
                order: [['sort_order', 'ASC']]
            });
            res.json({ success: true, currencies: currencies });
        } catch (e) {
            res.json({ success: false, message: e.message });
        }
    });

    // 获取实时汇率（从数据库的价格算）
    app.get('/api/exchange-rate', async (req, res) => {
        try {
            const { from, to } = req.query;
            if (!from || !to) {
                return res.json({ success: false, message: '缺少参数' });
            }

            const fromCur = await Currency.findOne({ where: { symbol: from } });
            const toCur = await Currency.findOne({ where: { symbol: to } });

            if (!fromCur || !toCur) {
                return res.json({ success: false, message: '币种不存在' });
            }

            // 汇率 = from价格 / to价格
            const rate = fromCur.price / toCur.price;

            res.json({ success: true, rate: rate, from: from, to: to });
        } catch (e) {
            res.json({ success: false, message: e.message });
        }
    });

    // 执行兑换
    app.post('/api/exchange', async (req, res) => {
        try {
            if (!req.session.user) {
                return res.json({ success: false, message: '请先登录' });
            }

            const { from, to, amount } = req.body;
            const userId = req.session.user.id;

            if (!from || !to || !amount) {
                return res.json({ success: false, message: '请填写完整信息' });
            }

            if (from === to) {
                return res.json({ success: false, message: '卖出和买入不能相同' });
            }

            const amountNum = parseFloat(amount);
            if (amountNum <= 0) {
                return res.json({ success: false, message: '数量必须大于0' });
            }

            const fromCur = await Currency.findOne({ where: { symbol: from, enabled: true } });
            const toCur = await Currency.findOne({ where: { symbol: to, enabled: true } });

            if (!fromCur || !toCur) {
                return res.json({ success: false, message: '币种不存在或已下架' });
            }

            // 检查用户余额
            let fromAsset = await Asset.findOne({ where: { user_id: userId, currency: from } });
            if (!fromAsset) {
                // 自动创建资产记录
                fromAsset = await Asset.create({
                    user_id: userId, currency: from, balance: 0, frozen: 0, total: 0
                });
            }

            const fromBalance = parseFloat(fromAsset.balance) || 0;
            if (fromBalance < amountNum) {
                return res.json({ success: false, message: '余额不足' });
            }

            // 计算兑换结果
            const rate = fromCur.price / toCur.price;
            const toAmount = amountNum * rate;

            // 手续费 0.1%
            const fee = toAmount * 0.001;
            const finalToAmount = toAmount - fee;

            // 执行兑换
            await fromAsset.decrement('balance', { by: amountNum });

            let toAsset = await Asset.findOne({ where: { user_id: userId, currency: to } });
            if (!toAsset) {
                toAsset = await Asset.create({
                    user_id: userId, currency: to, balance: 0, frozen: 0, total: 0
                });
            }
            await toAsset.increment('balance', { by: finalToAmount });

            // 记录兑换历史
            await Exchange.create({
                user_id: userId,
                username: req.session.user.username,
                from_currency: from,
                to_currency: to,
                from_amount: amountNum,
                to_amount: finalToAmount,
                rate: rate,
                status: 'completed'
            });

            res.json({
                success: true,
                message: '✅ 兑换成功',
                from: from,
                to: to,
                fromAmount: amountNum,
                toAmount: finalToAmount,
                rate: rate,
                fee: fee
            });
        } catch (e) {
            console.error('兑换失败:', e);
            res.json({ success: false, message: e.message });
        }
    });

    // 获取用户兑换记录
    app.get('/api/exchanges', async (req, res) => {
        try {
            if (!req.session.user) {
                return res.json({ success: false, message: '请先登录' });
            }
            const exchanges = await Exchange.findAll({
                where: { user_id: req.session.user.id },
                order: [['created_at', 'DESC']],
                limit: 50
            });
            res.json({ success: true, exchanges: exchanges });
        } catch (e) {
            res.json({ success: false, message: e.message });
        }
    });

};