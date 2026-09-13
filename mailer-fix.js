// 邮件发送修复模块
const nodemailer = require('nodemailer');
const config = require('./config/config');

const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
        user: config.email.auth.user,
        pass: config.email.auth.pass
    }
});

async function sendVerificationEmail(to, code) {
    try {
        const mailOptions = {
            from: `"${config.site.name}" <${config.email.from}>`,
            to: to,
            subject: '【' + config.site.name + '】邮箱验证码',
            html: `
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
                    <h2 style="color: #333; text-align: center;">${config.site.name}</h2>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center;">
                        <p style="font-size: 16px; color: #666;">您的验证码是：</p>
                        <h1 style="color: #667eea; font-size: 36px; letter-spacing: 10px; margin: 20px 0;">${code}</h1>
                        <p style="font-size: 14px; color: #999;">验证码10分钟内有效，请尽快验证</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ 邮件已发送到: ${to}`);
        return { success: true };
    } catch (error) {
        console.error('❌ 邮件发送失败:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { sendVerificationEmail };