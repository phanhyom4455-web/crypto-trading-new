const { Sequelize } = require('sequelize');

// 数据库配置
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false,
    define: {
        timestamps: true,
        underscored: true
    }
});

// 测试连接
sequelize.authenticate()
    .then(() => console.log('✅ 数据库连接成功'))
    .catch(err => console.error('❌ 数据库连接失败:', err));

module.exports = sequelize;