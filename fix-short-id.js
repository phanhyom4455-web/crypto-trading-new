const sequelize = require('./config/database');
const User = require('./models/User');

(async () => {
    try {
        await sequelize.sync({ alter: true });
        console.log('✅ 表结构已更新');

        const users = await User.findAll();
        let count = 0;

        for (const user of users) {
            if (!user.short_id) {
                let shortId;
                let isUnique = false;
                let attempts = 0;
                while (!isUnique && attempts < 100) {
                    shortId = Math.floor(1000 + Math.random() * 9000).toString();
                    const exist = await User.findOne({ where: { short_id: shortId } });
                    if (!exist) isUnique = true;
                    attempts++;
                }
                if (isUnique) {
                    await user.update({ short_id: shortId });
                    console.log(`✅ 用户 ${user.username} (id=${user.id}) → ${shortId}`);
                    count++;
                }
            }
        }
        console.log(`✅ 共补全 ${count} 个用户`);
        process.exit(0);
    } catch (e) {
        console.error('❌ 出错:', e.message);
        process.exit(1);
    }
})();