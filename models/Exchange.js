const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Exchange = sequelize.define('Exchange', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    username: {
        type: DataTypes.STRING(100)
    },
    from_currency: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    to_currency: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    from_amount: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    to_amount: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    rate: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'completed'
    }
}, {
    tableName: 'exchanges',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Exchange;