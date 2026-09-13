// ============================================
// 自动创建 trade_controls 表
// ============================================
const sequelize = require('./config/database');

module.exports = async (app) => {
    try {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS trade_controls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trade_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                username VARCHAR(255),
                pair VARCHAR(50),
                type VARCHAR(20),
                price FLOAT,
                amount FLOAT,
                total FLOAT,
                result VARCHAR(20) DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ trade_controls 表已就绪');
    } catch (err) {
        console.error('❌ 创建 trade_controls 表失败：', err.message);
    }
};