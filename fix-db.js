const sequelize = require('./config/database');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Order = require('./models/Order');
const Trade = require('./models/Trade');

async function fixDatabase() {
    try {
        console.log('🔄 正在同步数据库...');
        await sequelize.sync({ alter: true });
        console.log('✅ 数据库同步成功！所有表已创建/更新');
        console.log('');
        console.log('📊 已创建的表:');
        console.log('  ✅ users');
        console.log('  ✅ transactions');
        console.log('  ✅ orders');
        console.log('  ✅ trades');
        console.log('');
        console.log('🎉 修复完成！请重启服务器: node app.js');
        process.exit(0);
    } catch (error) {
        console.error('❌ 同步失败:', error.message);
        console.log('');
        console.log('请检查:');
        console.log('1. database.sqlite 文件是否存在');
        console.log('2. 是否有写入权限');
        process.exit(1);
    }
}

fixDatabase();