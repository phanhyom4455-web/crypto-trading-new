const sequelize = require('./config/database');
const Security = require('./models/Security');

(async () => {
    try {
        await Security.update(
            { google_enabled: false, google_secret: null },
            { where: {} }
        );
        console.log('✅ 2FA已重置，请重启服务器');
    } catch (err) {
        console.error('❌ 重置失败:', err.message);
    }
    process.exit();
})();