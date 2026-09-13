// ============================================
// 初始化币种数据（建表 + 插入默认币种）
// ============================================
const sequelize = require('./config/database');
const Currency = require('./models/Currency');
const Exchange = require('./models/Exchange');

async function initCurrencies() {
    try {
        // ✅ 强制建表（如果表不存在）
        await Currency.sync({ alter: false });
        await Exchange.sync({ alter: false });
        console.log('✅ currencies 和 exchanges 表已就绪');

        const count = await Currency.count();

        if (count === 0) {
            const defaultCurrencies = [
                { symbol: 'USDT', name: 'Tether', price: 1, sort_order: 1 },
                { symbol: 'BTC', name: 'Bitcoin', price: 62450, sort_order: 2 },
                { symbol: 'ETH', name: 'Ethereum', price: 2450, sort_order: 3 },
                { symbol: 'ADA', name: 'Cardano', price: 0.452, sort_order: 4 },
                { symbol: 'DOT', name: 'Polkadot', price: 6.25, sort_order: 5 },
                { symbol: 'SOL', name: 'Solana', price: 25.80, sort_order: 6 },
                { symbol: 'AVAX', name: 'Avalanche', price: 14.20, sort_order: 7 }
            ];

            for (const c of defaultCurrencies) {
                await Currency.create(c);
            }
            console.log('✅ 币种数据已初始化（7 个币种）');
        } else {
            console.log('✅ 币种数据已存在（' + count + ' 个币种）');
        }
    } catch (e) {
        console.error('❌ 初始化币种失败:', e.message);
    }
}

module.exports = initCurrencies;