// 验证码验证路由
module.exports = function(app, User) {
    
    // 验证邮箱验证码 API
    app.post('/api/verify-email', async (req, res) => {
        try {
            const { code, email, phone } = req.body;

            if (!code || code.length !== 6) {
                return res.json({ success: false, message: '请输入6位验证码' });
            }

            let user;
            if (email) {
                user = await User.findOne({ where: { email: email } });
            } else if (phone) {
                user = await User.findOne({ where: { phone: phone } });
            }

            if (!user) {
                return res.json({ success: false, message: '用户不存在' });
            }

            // 验证邮箱验证码
            if (email && user.email_verify_code === code) {
                await user.update({ email_verified: true, email_verify_code: null });
                return res.json({ success: true, message: '邮箱验证成功！' });
            }

            // 验证手机验证码
            if (phone && user.phone_verify_code === code) {
                await user.update({ phone_verified: true, phone_verify_code: null });
                return res.json({ success: true, message: '手机验证成功！' });
            }

            res.json({ success: false, message: '验证码错误' });
        } catch (error) {
            console.error('验证错误:', error);
            res.json({ success: false, message: '验证失败' });
        }
    });

    // 发送验证码 API
    app.post('/api/send-verification', async (req, res) => {
        try {
            const { email, phone } = req.body;

            if (!email && !phone) {
                return res.json({ success: false, message: '请输入邮箱或手机号' });
            }

            let user;
            if (email) {
                user = await User.findOne({ where: { email: email } });
            } else if (phone) {
                user = await User.findOne({ where: { phone: phone } });
            }

            if (!user) {
                return res.json({ success: false, message: '用户不存在' });
            }

            // 生成验证码
            const code = Math.floor(100000 + Math.random() * 900000).toString();

            if (email) {
                await user.update({
                    email_verify_code: code,
                    email_verify_code_expires: new Date(Date.now() + 10 * 60 * 1000)
                });
                console.log(`📧 邮箱验证码: ${code} (发送到 ${email})`);
            }

            if (phone) {
                await user.update({
                    phone_verify_code: code,
                    phone_verify_code_expires: new Date(Date.now() + 10 * 60 * 1000)
                });
                console.log(`📱 手机验证码: ${code} (发送到 ${phone})`);
            }

            res.json({
                success: true,
                message: '验证码已发送',
                devCode: code
            });
        } catch (error) {
            console.error('发送验证码错误:', error);
            res.json({ success: false, message: '发送失败' });
        }
    });
};