// ============================================
// 实名认证路由（独立文件，不修改 app.js）
// ============================================
const User = require('./models/User');

module.exports = (app) => {

    // ============================================
    // 1. 获取当前登录用户信息
    // ============================================
    app.get('/api/me', async (req, res) => {
        try {
            if (!req.session.user) {
                return res.json({ success: false, message: '未登录' });
            }
            const user = await User.findByPk(req.session.user.id);
            if (!user) {
                return res.json({ success: false, message: '用户不存在' });
            }
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    phone: user.phone,
                    vip: user.vip,
                    points: user.points,
                    verify_status: user.verify_status,
                    real_name: user.real_name,
                    id_card: user.id_card
                }
            });
        } catch (err) {
            console.error('获取用户信息失败：', err);
            res.json({ success: false, message: err.message });
        }
    });

    // ============================================
    // 2. 提交实名认证
    // ============================================
    app.post('/api/complete-profile', async (req, res) => {
        try {
            if (!req.session.user) {
                return res.json({ success: false, message: '未登录' });
            }
            const { real_name, id_card, phone } = req.body;
            if (!real_name || !id_card || !phone) {
                return res.json({ success: false, message: '请填写完整信息' });
            }

            const user = await User.findByPk(req.session.user.id);
            if (!user) {
                return res.json({ success: false, message: '用户不存在' });
            }

            user.real_name = real_name;
            user.id_card = id_card;
            user.phone = phone;
            user.verify_status = 'pending';
            await user.save();

            res.json({ success: true, message: '提交成功，等待审核' });
        } catch (err) {
            console.error('提交实名认证失败：', err);
            res.json({ success: false, message: err.message });
        }
    });

    // ============================================
    // 3. 实名认证页面
    // ============================================
    app.get('/kyc', async (req, res) => {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        try {
            const user = await User.findByPk(req.session.user.id);
            res.render('frontend/kyc', {
                user: user,
                title: '实名认证 - 数字货币交易平台'
            });
        } catch (err) {
            console.error('加载实名认证页面失败：', err);
            res.redirect('/');
        }
    });

    // ============================================
    // 4. 中间件：检查是否实名
    // ============================================
    app.use((req, res, next) => {
        // 这些路径需要检查实名
        const needKYC = ['/deposit', '/withdraw', '/trade'];
        const needCheck = needKYC.some(path => req.path.startsWith(path));

        if (needCheck && req.session.user) {
            User.findByPk(req.session.user.id).then(user => {
                if (!user || user.verify_status !== 'approved') {
                    return res.redirect('/kyc');
                }
                next();
            }).catch(err => {
                console.error('KYC 检查失败：', err);
                res.redirect('/kyc');
            });
        } else {
            next();
        }
    });

};