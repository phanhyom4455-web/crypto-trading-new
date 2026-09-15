const bcrypt = require('bcrypt');
const sequelize = require('./config/database');
const User = require('./models/User');

(async () => {
    try {
        const hashedPwd = await bcrypt.hash('password', 10);

        const admins = await User.findAll({ where: { username: 'admin' } });

        if (admins.length === 0) {
            await User.create({
                username: 'admin',
                email: 'admin@example.com',
                password: hashedPwd,
                status: 'active'
            });
            console.log('✅ 已创建 admin，密码为 password');
        } else {
            for (const admin of admins) {
                await admin.update({ password: hashedPwd });
                console.log(`✅ 已重置 id=${admin.id} 的 admin 密码为 password`);
            }
            console.log(`✅ 共重置了 ${admins.length} 个 admin 账号`);
        }
        process.exit(0);
    } catch (e) {
        console.error('❌ 出错:', e.message);
        process.exit(1);
    }
})();