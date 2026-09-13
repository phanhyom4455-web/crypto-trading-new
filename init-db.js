const sequelize = require('./config/database');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Order = require('./models/Order');
const Trade = require('./models/Trade');
const Security = require('./models/Security');
const Asset = require('./models/Asset');
const MarketControl = require('./models/MarketControl');
const bcrypt = require('bcrypt');

async function init() {
    try {
        console.log('🔄 开始初始化数据库...');
        
        // 同步所有模型
        await sequelize.sync({ force: true });
        console.log('✅ 所有表创建成功');

        // 创建管理员
        const hashedPassword = await bcrypt.hash('password', 10);
        const admin = await User.create({
            username: 'admin',
            email: 'admin@example.com',
            password: hashedPassword,
            vip: true,
            points: 9999,
            status: 'active',
            verify_status: 'approved',
            twofa_enabled: false,
            real_name: '管理员',
            id_card: '110101199001011234',
            phone: '13800138000'
        });
        console.log('✅ 管理员创建成功 (admin/password)');

        // 安全设置
        await Security.create({
            user_id: admin.id,
            fund_password_enabled: false,
            google_enabled: false,
            ip_whitelist: '[]'
        });
        console.log('✅ 安全设置创建成功');

        // 资产
        const currencies = ['USDT', 'BTC', 'ETH', 'ADA'];
        for (const c of currencies) {
            await Asset.create({
                user_id: admin.id,
                currency: c,
                balance: c === 'USDT' ? 100000 : 10,
                frozen: 0,
                total: 0
            });
        }
        console.log('✅ 资产创建成功');

        // 市场数据
        const pairs = [
            { pair: 'BTC/USDT', price: 62450, change: 2.35, direction: 'up' },
            { pair: 'ETH/USDT', price: 2450, change: -1.20, direction: 'down' },
            { pair: 'ADA/USDT', price: 0.452, change: 5.60, direction: 'up' },
            { pair: 'DOT/USDT', price: 6.25, change: 3.80, direction: 'up' }
        ];
        for (const p of pairs) {
            await MarketControl.create({
                pair: p.pair,
                price: p.price,
                change: p.change,
                direction: p.direction,
                status: 'active',
                updated_by: 'system'
            });
        }
        console.log('✅ 市场数据创建成功');

        console.log('🎉 数据库初始化完成！');
        console.log('🔑 登录账号: admin');
        console.log('🔑 登录密码: password');
        process.exit(0);
    } catch (err) {
        console.error('❌ 错误:', err.message);
        process.exit(1);
    }
}

init();