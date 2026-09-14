const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    phone: { type: DataTypes.STRING, unique: true, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: false },
    vip: { type: DataTypes.BOOLEAN, defaultValue: false },
    points: { type: DataTypes.INTEGER, defaultValue: 0 },
    orders: { type: DataTypes.INTEGER, defaultValue: 0 },
    spent: { type: DataTypes.FLOAT, defaultValue: 0 },
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    real_name: { type: DataTypes.STRING },
    id_card: { type: DataTypes.STRING },
    verify_status: { type: DataTypes.STRING, defaultValue: 'none' },
    verify_note: { type: DataTypes.STRING },
    twofa_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    twofa_secret: { type: DataTypes.STRING },
    last_login: { type: DataTypes.DATE },
    email_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    email_verify_code: { type: DataTypes.STRING },
    email_verify_code_expires: { type: DataTypes.DATE },
    phone_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    phone_verify_code: { type: DataTypes.STRING },
    phone_verify_code_expires: { type: DataTypes.DATE },
    reset_password_token: { type: DataTypes.STRING },
    reset_password_expires: { type: DataTypes.DATE }
}, {
    tableName: 'users'
});

module.exports = User;