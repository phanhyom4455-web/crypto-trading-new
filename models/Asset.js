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