const sequelize = require('../config/database');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const Trade = require('../models/Trade');
const Security = require('../models/Security');
const Asset = require('../models/Asset');
const bcrypt = require('bcrypt');

async function initDatabase() {
    try {
        console.log('🔄 开始初始化数据库...');

        // 删除所有表并重新创建
        await sequelize.sync({ force: true });
        console.log('✅ 数据库表创建成功');
        console.log('📊 创建的表: users, transactions, orders, trades, securities, assets');

        // ===== 创建管理员 =====
        const hashedPassword = await bcrypt.hash('password', 10);
        const admin = await User.create({
            username: 'admin',
            email: 'admin@example.com',
            password: hashedPassword,
            vip: true,
            points: 9999,
            status: 'active'
        });
        console.log('✅ 管理员账号创建成功 (admin/password)');

        // ===== 创建管理员安全设置 =====
        await Security.create({
            user_id: admin.id,
            fund_password_enabled: false,
            google_enabled: false,
            ip_whitelist: '[]'
        });
        console.log('✅ 管理员安全设置创建成功');

        // ===== 创建管理员资产 =====
        const adminCurrencies = ['USDT', 'BTC', 'ETH', 'ADA'];
        for (const currency of adminCurrencies) {
            await Asset.create({
                user_id: admin.id,
                currency: currency,
                balance: currency === 'USDT' ? 100000 : 10,
                frozen: 0,
                total: 0
            });
        }
        console.log('✅ 管理员资产创建成功');

        // ===== 创建50个测试用户 =====
        const users = [];
        for (let i = 1; i <= 50; i++) {
            const user = await User.create({
                username: `user${i}`,
                email: `user${i}@example.com`,
                password: await bcrypt.hash('123456', 10),
                vip: i % 3 === 0,
                points: Math.floor(Math.random() * 5000),
                orders: Math.floor(Math.random() * 100),
                spent: Math.round((Math.random() * 50000 + 1000) * 100) / 100,
                status: i % 5 === 0 ? 'inactive' : 'active'
            });
            users.push(user);

            // 为用户创建资产
            const currencies = ['USDT', 'BTC', 'ETH', 'ADA'];
            for (const currency of currencies) {
                await Asset.create({
                    user_id: user.id,
                    currency: currency,
                    balance: 0,
                    frozen: 0,
                    total: 0
                });
            }
        }
        console.log('✅ 创建了 50 个测试用户和资产');

        // ===== 创建100条交易记录 =====
        for (let i = 1; i <= 100; i++) {
            const userId = Math.floor(Math.random() * 50) + 1;
            const user = await User.findByPk(userId);
            await Transaction.create({
                user_id: userId,
                username: user ? user.username : 'unknown',
                type: ['deposit', 'withdraw', 'trade'][Math.floor(Math.random() * 3)],
                amount: Math.round((Math.random() * 10000 + 100) * 100) / 100,
                method: ['USDT', 'BTC', 'ETH', '支付宝'][Math.floor(Math.random() * 4)],
                status: ['pending', 'completed', 'failed'][Math.floor(Math.random() * 3)],
                txid: `0x${Math.random().toString(16).substring(2, 10)}`,
                description: `测试交易 ${i}`
            });
        }
        console.log('✅ 创建了 100 条测试交易记录');

        // ===== 创建80条订单 =====
        for (let i = 1; i <= 80; i++) {
            const userId = Math.floor(Math.random() * 50) + 1;
            await Order.create({
                user_id: userId,
                order_no: `ORD${Date.now()}${String(i).padStart(4, '0')}`,
                pair: ['BTC/USDT', 'ETH/USDT', 'ADA/USDT', 'DOT/USDT'][Math.floor(Math.random() * 4)],
                type: ['buy', 'sell'][Math.floor(Math.random() * 2)],
                amount: Math.round((Math.random() * 10 + 0.1) * 1000) / 1000,
                price: Math.round((Math.random() * 50000 + 10000) * 100) / 100,
                total: Math.round((Math.random() * 50000 + 10000) * 100) / 100,
                status: ['pending', 'completed'][Math.floor(Math.random() * 2)]
            });
        }
        console.log('✅ 创建了 80 条测试订单');

        // ===== 创建50条交易记录(Trade) =====
        for (let i = 1; i <= 50; i++) {
            const userId = Math.floor(Math.random() * 50) + 1;
            const user = await User.findByPk(userId);
            const pairs = ['BTC/USDT', 'ETH/USDT', 'ADA/USDT', 'DOT/USDT'];
            const types = ['buy', 'sell'];
            const prices = [62450, 2450, 0.45, 6.25];
            const amounts = [0.5, 2, 100, 10];
            const idx = Math.floor(Math.random() * 4);
            await Trade.create({
                user_id: userId,
                username: user ? user.username : 'unknown',
                pair: pairs[idx],
                type: types[Math.floor(Math.random() * 2)],
                price: prices[idx],
                amount: amounts[idx],
                total: prices[idx] * amounts[idx],
                status: 'completed'
            });
        }
        console.log('✅ 创建了 50 条测试交易记录(Trade)');

        console.log('🎉 数据库初始化完成！');
        console.log('');
        console.log('📊 数据统计:');
        console.log(`  👤 用户: 51 个 (1 管理员 + 50 测试用户)`);
        console.log(`  💰 资产: ${51 * 4} 条`);
        console.log(`  📋 交易记录: 100 条`);
        console.log(`  📦 订单: 80 条`);
        console.log(`  📈 交易记录(Trade): 50 条`);
        console.log('');
        console.log('🔑 登录账号: admin / password');
        process.exit(0);
    } catch (error) {
        console.error('❌ 初始化失败:', error);
        process.exit(1);
    }
}

initDatabase();