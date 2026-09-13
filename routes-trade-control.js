const TradeControl = require('./models/TradeControl');
const Trade = require('./models/Trade');

module.exports = (app) => {

    // ============================================
    // 页面路由
    // ============================================
    app.get('/admin/trade-control', async (req, res) => {
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }
        try {
            const controls = await TradeControl.findAll({
                order: [['id', 'DESC']],
                limit: 100
            });
            res.render('admin/trade-control', {
                title: '交易控制',
                currentPage: 'trade-control',
                controls: controls
            });
        } catch (err) {
            console.error('加载交易控制失败：', err);
            res.status(500).send('服务器错误');
        }
    });

    // ============================================
    // API：获取所有待处理的交易
    // ============================================
    app.get('/api/admin/trade-controls', async (req, res) => {
        try {
            if (!req.session.admin) {
                return res.json({ success: false, message: '未登录' });
            }
            const controls = await TradeControl.findAll({
                order: [['id', 'DESC']],
                limit: 200
            });
            res.json({ success: true, controls: controls });
        } catch (err) {
            res.json({ success: false, message: err.message });
        }
    });

    // ============================================
    // API：设置输赢
    // ============================================
    app.post('/api/admin/set-trade-result', async (req, res) => {
        try {
            if (!req.session.admin) {
                return res.json({ success: false, message: '未登录' });
            }
            const { tradeId, result } = req.body;
            if (!tradeId || !result) {
                return res.json({ success: false, message: '参数错误' });
            }
            if (!['win', 'lose', 'pending'].includes(result)) {
                return res.json({ success: false, message: '结果只能是 win/lose/pending' });
            }

            const control = await TradeControl.findByPk(tradeId);
            if (!control) {
                return res.json({ success: false, message: '记录不存在' });
            }

            control.result = result;
            await control.save();

            res.json({ success: true, message: '已设为 ' + (result === 'win' ? '赢' : result === 'lose' ? '输' : '待定') });
        } catch (err) {
            console.error('设置输赢失败：', err);
            res.json({ success: false, message: err.message });
        }
    });

    // ============================================
    // API：前台查询自己的交易结果
    // ============================================
    app.get('/api/my-trade-results', async (req, res) => {
        try {
            if (!req.session.user) {
                return res.json({ success: false, message: '未登录' });
            }
            const results = await TradeControl.findAll({
                where: { user_id: req.session.user.id },
                order: [['id', 'DESC']],
                limit: 50
            });
            res.json({ success: true, results: results });
        } catch (err) {
            res.json({ success: false, message: err.message });
        }
    });

    // ============================================
    // API：自动同步交易记录（把 Trade 表同步到 TradeControl）
    // ============================================
    app.post('/api/admin/sync-trades', async (req, res) => {
        try {
            if (!req.session.admin) {
                return res.json({ success: false, message: '未登录' });
            }

            const trades = await Trade.findAll({
                order: [['id', 'DESC']],
                limit: 100
            });

            let created = 0;
            for (const t of trades) {
                const exists = await TradeControl.findOne({ where: { trade_id: t.id } });
                if (!exists) {
                    await TradeControl.create({
                        trade_id: t.id,
                        user_id: t.user_id,
                        username: t.username,
                        pair: t.pair,
                        type: t.type,
                        price: t.price,
                        amount: t.amount,
                        total: t.total,
                        result: 'pending'
                    });
                    created++;
                }
            }

            res.json({ success: true, message: '同步完成，新增 ' + created + ' 条' });
        } catch (err) {
            console.error('同步失败：', err);
            res.json({ success: false, message: err.message });
        }
    });

};