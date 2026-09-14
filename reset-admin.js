const bcrypt = require('bcrypt');
const sequelize = require('./config/database');
const User = require('./models/User');

(async () => {
    try {
        const hashedPwd = await bcrypt.hash('password', 10);
        const admin = await User.findOne({ where: { username: 'admin' } });

        if (!admin) {
            await User.create({
                username: 'admin',
                email: 'admin@example.com',
                password: hashedPwd,
                status: 'active'
            });
            console.log('✅ 已创建 admin，密码重置为 password');
        } else {
            await admin.update({ password: hashedPwd });
            console.log('✅ 已把 admin 的密码重置为 password');
        }
        process.exit(0);
    } catch (e) {
        console.error('❌ 出错:', e.message);
        process.exit(1);
    }
})();