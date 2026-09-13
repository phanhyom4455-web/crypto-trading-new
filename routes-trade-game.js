const TradeOrder = require('./models/TradeOrder');
const Asset = require('./models/Asset');
const User = require('./models/User');

module.exports = (app, io) => {

    // ============================================
    // 前台：交易游戏页面
    // ============================================
    app.get('/trade-game', (req, res) => {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        res.render('frontend/trade-game', {
            title: '猜涨跌 - 交易游戏',
            currentPage: 'trade-game',
            user: req.session.user
        });
    });

    // ============================================
    // 前台：下单
    // ============================================
    app.post('/api/trade-game/order', async (req, res) => {
        try {
            if (!req.session.user) {
                return res.json({ success: false, message: '请先登录' });
            }

            const { amount, duration, direction } = req.body;
            if (!amount || amount <= 0) {
                return res.json({ success: false, message: '请输入有效金额' });
            }
            if (!duration || ![30, 60, 120].includes(parseInt(duration))) {
                return res.json({ success: false, message: '请选择有效时间' });
            }
            if (!direction || !['up', 'down'].includes(direction)) {
                return res.json({ success: false, message: '请选择买涨或买跌' });
            }

            const user = await User.findByPk(req.session.user.id);
            if (!user) {
                return res.json({ success: false, message: '用户不存在' });
            }

            let asset = await Asset.findOne({ where: { user_id: user.id, currency: 'USDT' } });
            if (!asset) {
                return res.json({ success: false, message: '无 USDT 资产' });
            }
            if (parseFloat(asset.balance) < parseFloat(amount)) {
                return res.json({ success: false, message: '余额不足，当前余额：' + asset.balance });
            }

            await asset.decrement('balance', { by: parseFloat(amount) });
            await asset.decrement('total', { by: parseFloat(amount) });

            const rates = { 30: 0.30, 60: 0.45, 120: 0.50 };
            const profitRate = rates[parseInt(duration)];

            const endTime = new Date(Date.now() + parseInt(duration) * 1000);

            const order = await TradeOrder.create({
                user_id: user.id,
                username: user.username,
                amount: parseFloat(amount),
                direction: direction,
                duration: parseInt(duration),
                profit_rate: profitRate,
                result: 'pending',
                status: 'running',
                end_time: endTime
            });
            // 🔔 通知后台（响铃）
            io.emit('new-notification', {
                type: 'trade',
                title: '📈 新交易订单',
                message: user.username + ' ' + (direction === 'up' ? '买涨' : '买跌') + ' ' + amount + ' USDT (' + duration + '秒)'
            });

            res.json({
                success: true,
                message: '下单成功',
                order: {
                    id: order.id,
                    amount: order.amount,
                    direction: order.direction,
                    duration: order.duration,
                    profitRate: order.profit_rate,
                    endTime: order.end_time
                }
            });
        } catch (err) {
            console.error('下单失败：', err);
            res.json({ success: false, message: err.message });
        }
    });

    // ============================================
    // 前台：查询订单结果
    // ============================================
    app.get('/api/trade-game/result/:id', async (req, res) => {
        try {
            if (!req.session.user) {
                return res.json({ success: false, message: '请先登录' });
            }

            const order = await TradeOrder.findByPk(req.params.id);
            if (!order) {
                return res.json({ success: false, message: '订单不存在' });
            }

            // 到时间了自动结算
            if (order.status === 'running') {
                const now = new Date();
                const endTime = new Date(order.end_time);
                if (now >= endTime) {
                    await autoSettle(order);
                    await order.reload();
                }
            }

            res.json({
                success: true,
                order: {
                    id: order.id,
                    amount: order.amount,
                    direction: order.direction,
                    duration: order.duration,
                    profitRate: order.profit_rate,
                    result: order.result,
                    profit: order.profit,
                    status: order.status,
                    endTime: order.end_time
                }
            });
        } catch (err) {
            res.json({ success: false, message: err.message });
        }
    });

    // ============================================
    // 自动结算（随机输赢）
    // ============================================
    async function autoSettle(order) {
        const isWin = Math.random() < 0.5;
        const result = isWin ? 'win' : 'lose';
        const profit = isWin ? order.amount * order.profit_rate : -order.amount;

        await order.update({
            result: result,
            profit: profit,
            status: 'settled'
        });

        if (isWin) {
            let asset = await Asset.findOne({ where: { user_id: order.user_id, currency: 'USDT' } });
            if (asset) {
                const totalReturn = order.amount + profit;
                await asset.increment('balance', { by: totalReturn });
                await asset.increment('total', { by: totalReturn });
            }
        }

        console.log('订单 ' + order.id + ' 自动结算：' + result);
    }

    // ============================================
    // 后台：交易控制页面
    // ============================================
    app.get('/admin/trade-game', async (req, res) => {
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }
        try {
            const orders = await TradeOrder.findAll({
                order: [['id', 'DESC']],
                limit: 100
            });
            res.render('admin/trade-game', {
                title: '交易控制',
                currentPage: 'trade-game',
                orders: orders
            });
        } catch (err) {
            console.error('加载交易控制失败：', err);
            res.status(500).send('服务器错误');
        }
    });

    // ============================================
    // 后台：获取所有订单
    // ============================================
    app.get('/api/admin/trade-game/orders', async (req, res) => {
        try {
            if (!req.session.admin) {
                return res.json({ success: false, message: '未登录' });
            }
            const orders = await TradeOrder.findAll({
                order: [['id', 'DESC']],
                limit: 200
            });
            res.json({ success: true, orders: orders });
        } catch (err) {
            res.json({ success: false, message: err.message });
        }
    });

    // ============================================
    // 后台：设置输赢
    // ============================================
    app.post('/api/admin/trade-game/set-result', async (req, res) => {
        try {
            if (!req.session.admin) {
                return res.json({ success: false, message: '未登录' });
            }
            const { orderId, result } = req.body;
            if (!orderId || !result) {
                return res.json({ success: false, message: '参数错误' });
            }
            if (!['win', 'lose'].includes(result)) {
                return res.json({ success: false, message: '结果只能是 win 或 lose' });
            }

            const order = await TradeOrder.findByPk(orderId);
            if (!order) {
                return res.json({ success: false, message: '订单不存在' });
            }
            if (order.status === 'settled') {
                return res.json({ success: false, message: '订单已结算' });
            }

            const isWin = result === 'win';
            const profit = isWin ? order.amount * order.profit_rate : -order.amount;

            await order.update({
                result: result,
                profit: profit,
                status: 'settled'
            });

            if (isWin) {
                let asset = await Asset.findOne({ where: { user_id: order.user_id, currency: 'USDT' } });
                if (asset) {
                    const totalReturn = order.amount + profit;
                    await asset.increment('balance', { by: totalReturn });
                    await asset.increment('total', { by: totalReturn });
                }
            }

            res.json({ success: true, message: '已设为 ' + (isWin ? '赢' : '输') });
        } catch (err) {
            console.error('设置输赢失败：', err);
            res.json({ success: false, message: err.message });
        }
    });

};