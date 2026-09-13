// ============================================
// 实名认证修复（新建文件，不动 app.js）
// ============================================
const User = require('./models/User');

module.exports = (app) => {

    // ============================================
    // 修复1：注册时 verify_status 应该是 unverified
    // ============================================
    // 这个修复通过拦截注册接口来实现
    const originalRegisterHandler = app._router.stack.find(
        layer => layer.route && layer.route.path === '/api/register'
    );

    // 如果找到注册路由，改成先记录，再修改
    if (originalRegisterHandler) {
        const originalHandler = originalRegisterHandler.route.stack[0].handle;

        // 替换注册处理函数
        originalRegisterHandler.route.stack[0].handle = async function(req, res) {
            // 保存原始的 res.json
            const originalJson = res.json.bind(res);

            // 重写 res.json，在返回前修改用户状态
            res.json = function(data) {
                // 如果注册成功，把 verify_status 改成 unverified
                if (data.success && req.session.user) {
                    User.update(
                        { verify_status: 'unverified' },
                        { where: { id: req.session.user.id } }
                    ).then(() => {
                        req.session.user.verify_status = 'unverified';
                        console.log('✅ 已将新用户状态改为 unverified');
                    }).catch(err => {
                        console.error('修改用户状态失败：', err);
                    });
                }
                return originalJson(data);
            };

            // 调用原始注册逻辑
            return originalHandler(req, res);
        };

        console.log('✅ 注册接口已修复：新用户默认 unverified');
    }

    // ============================================
    // 修复2：提交实名认证后，状态变成 pending
    // ============================================
    app.post('/api/complete-profile-fix', async (req, res) => {
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

            if (req.session.user) {
                req.session.user.verify_status = 'pending';
            }

            res.json({ success: true, message: '提交成功，等待审核' });
        } catch (err) {
            console.error('提交实名认证失败：', err);
            res.json({ success: false, message: err.message });
        }
    });

    // ============================================
    // 修复3：提供一个接口，手动把用户状态改成 unverified
    // ============================================
    app.get('/api/fix-verify-status', async (req, res) => {
        try {
            if (!req.session.user) {
                return res.json({ success: false, message: '未登录' });
            }
            const user = await User.findByPk(req.session.user.id);
            if (!user) {
                return res.json({ success: false, message: '用户不存在' });
            }

            // 如果用户还没提交过实名信息，就改成 unverified
            if (!user.real_name || !user.id_card) {
                user.verify_status = 'unverified';
                await user.save();
                req.session.user.verify_status = 'unverified';
                return res.json({ success: true, message: '状态已修正为未认证', verify_status: 'unverified' });
            }

            res.json({ success: true, message: '用户已提交过实名信息', verify_status: user.verify_status });
        } catch (err) {
            res.json({ success: false, message: err.message });
        }
    });

};