const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Security = sequelize.define('Security', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    fund_password: { type: DataTypes.STRING, allowNull: true },
    fund_password_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    google_secret: { type: DataTypes.STRING, allowNull: true },
    google_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    ip_whitelist: { type: DataTypes.TEXT, defaultValue: '[]' },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'securities',
    timestamps: false,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = Security;