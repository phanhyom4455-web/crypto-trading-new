const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TradeOrder2 = sequelize.define('TradeOrder2', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    username: { type: DataTypes.STRING },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    direction: { type: DataTypes.STRING, allowNull: false },
    duration: { type: DataTypes.INTEGER, allowNull: false },
    profit_rate: { type: DataTypes.FLOAT, allowNull: false },
    result: { type: DataTypes.STRING, defaultValue: 'pending' },
    profit: { type: DataTypes.FLOAT, defaultValue: 0 },
    status: { type: DataTypes.STRING, defaultValue: 'running' },
    end_time: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'trade_orders_2',
    timestamps: false
});

module.exports = TradeOrder2;