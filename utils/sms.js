const config = require('../config/config');

function sendSmsDev(phone, code) {
    console.log('========================================');
    console.log('📱 【模拟短信】');
    console.log(`📞 发送到: ${phone}`);
    console.log(`🔢 验证码: ${code}`);
    console.log('========================================');
    return { success: true };
}

async function sendSms(phone, code) {
    if (config.sms.debug) {
        return sendSmsDev(phone, code);
    }
    return { success: false, error: '短信服务未配置' };
}

module.exports = { sendSms };