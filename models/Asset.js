const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Asset = sequelize.define('Asset', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USDT' },
    balance: { type: DataTypes.DECIMAL(20, 8), defaultValue: 0 },
    frozen: { type: DataTypes.DECIMAL(20, 8), defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(20, 8), defaultValue: 0 },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'assets',
    timestamps: false,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = Asset;
// ====== 调试代码开始 ======
Asset.addHook('beforeCreate', (asset) => {
    if (parseFloat(asset.balance) > 0) {
        console.log('\n🚨🚨🚨 抓到！有人在创建带钱的资产！');
        console.log('user_id=' + asset.user_id, 'currency=' + asset.currency, 'balance=' + asset.balance);
        console.log(new Error().stack);
    }
});
Asset.addHook('beforeUpdate', (asset) => {
    if (asset.changed('balance')) {
        console.log('\n🚨🚨🚨 抓到！有人在改余额！');
        console.log('id=' + asset.id, 'user_id=' + asset.user_id, 'balance=' + asset.balance);
        console.log(new Error().stack);
    }
});
// ====== 调试代码结束 ======