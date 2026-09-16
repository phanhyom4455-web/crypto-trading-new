const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    phone: { type: DataTypes.STRING, unique: true, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: false },
        short_id: { type: DataTypes.STRING },
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
    tableName: 'users',
    hooks: {
        // ✅ 创建用户前，自动生成唯一的 4 位 short_id
        beforeCreate: async (user) => {
            if (!user.short_id) {
                let shortId;
                let isUnique = false;
                let attempts = 0;
                while (!isUnique && attempts < 100) {
                    shortId = Math.floor(1000 + Math.random() * 9000).toString();
                    const exist = await User.findOne({ where: { short_id: shortId } });
                    if (!exist) isUnique = true;
                    attempts++;
                }
                if (isUnique) {
                    user.short_id = shortId;
                } else {
                    throw new Error('无法生成唯一的 short_id');
                }
            }
        }
    }
});

module.exports = User;