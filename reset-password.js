const bcrypt = require('bcrypt');
const db = require('./config/database');
const User = require('./models/User');

async function reset() {
    try {
        // 重置 test123 的密码
        const hashedPassword = await bcrypt.hash('123456', 10);
        await User.update({ password: hashedPassword }, { where: { username: 'test123' } });
        console.log('✅ test123 密码已重置为 123456');
        
        // 重置 admin 的密码
        const adminPassword = await bcrypt.hash('password', 10);
        await User.update({ password: adminPassword }, { where: { username: 'admin' } });
        console.log('✅ admin 密码已重置为 password');
        
        // 重置 keo 的密码
        const keoPassword = await bcrypt.hash('123456', 10);
        await User.update({ password: keoPassword }, { where: { username: 'keo' } });
        console.log('✅ keo 密码已重置为 123456');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

reset();