const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TradeControl = sequelize.define('TradeControl', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    trade_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    username: { type: DataTypes.STRING },
    pair: { type: DataTypes.STRING },
    type: { type: DataTypes.STRING },
    price: { type: DataTypes.FLOAT },
    amount: { type: DataTypes.FLOAT },
    total: { type: DataTypes.FLOAT },
    result: { type: DataTypes.STRING, defaultValue: 'pending' },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'trade_controls',
    timestamps: false
});

module.exports = TradeControl;