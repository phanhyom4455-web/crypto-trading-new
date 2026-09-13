const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MarketControl = sequelize.define('MarketControl', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    pair: {
        type: DataTypes.STRING,
        allowNull: false
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    change: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    direction: {
        type: DataTypes.STRING,
        defaultValue: 'up' // up, down
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'active'
    },
    updated_by: {
        type: DataTypes.STRING,
        allowNull: true
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'market_controls',
    timestamps: false,
    updatedAt: 'updated_at'
});

module.exports = MarketControl;