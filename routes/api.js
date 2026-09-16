const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Trade = require('../models/Trade');
const Transaction = require('../models/Transaction');
const Security = require('../models/Security');
const Asset = require('../models/Asset');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const speakeasy = require('speakeasy');

// ============================================
// 用户资料更新
// ============================================
router.post('/profile/update', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        const { email, nickname } = req.body;
        const user = await User.findByPk(req.session.user.id);
        if (!user) {
            return res.json({ success: false, message: '用户不存在' });
        }
        await user.update({ email: email || user.email });
        req.session.user.email = email || user.email;
        res.json({ success: true, message: '资料更新成功' });
    } catch (error) {
        res.json({ success: false, message: '更新失败: ' + error.message });
    }
});

// ============================================
// 获取资产
// ============================================
router.get('/assets', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        let assets = await Asset.findAll({
            where: { user_id: req.session.user.id }
        });
        if (assets.length === 0) {
          
            assets = await Asset.findAll({
                where: { user_id: req.session.user.id }
            });
        }
        res.json({ success: true, assets: assets });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// ============================================
// 资金密码
// ============================================
router.post('/security/fund-password', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }

        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.json({ success: false, message: '资金密码至少6个字符' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let security = await Security.findOne({ where: { user_id: req.session.user.id } });
        if (!security) {
            security = await Security.create({
                user_id: req.session.user.id,
                fund_password: hashedPassword,
                fund_password_enabled: true
            });
        } else {
            await security.update({
                fund_password: hashedPassword,
                fund_password_enabled: true
            });
        }

        res.json({ success: true, message: '资金密码设置成功！' });
    } catch (error) {
        console.error('设置资金密码错误:', error);
        res.json({ success: false, message: '设置失败，请稍后重试' });
    }
});

router.post('/security/verify-fund-password', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }

        const { password } = req.body;

        if (!password) {
            return res.json({ success: false, message: '请输入资金密码' });
        }

        const security = await Security.findOne({ where: { user_id: req.session.user.id } });
        if (!security || !security.fund_password_enabled) {
            return res.json({ success: false, message: '未设置资金密码' });
        }

        const isValid = await bcrypt.compare(password, security.fund_password);
        if (!isValid) {
            return res.json({ success: false, message: '资金密码错误' });
        }

        res.json({ success: true, message: '验证通过' });
    } catch (error) {
        res.json({ success: false, message: '验证失败，请稍后重试' });
    }
});

router.get('/security/fund-password-status', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }

        const security = await Security.findOne({ where: { user_id: req.session.user.id } });
        res.json({
            success: true,
            enabled: security ? security.fund_password_enabled : false
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// ============================================
// 谷歌验证器 (2FA) - 使用 speakeasy
// ============================================
router.post('/security/2fa', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }

        const { enabled } = req.body;

        let security = await Security.findOne({ where: { user_id: req.session.user.id } });
        if (!security) {
            security = await Security.create({
                user_id: req.session.user.id
            });
        }

        if (enabled) {
            // 使用 speakeasy 生成标准密钥 (base32格式)
            const secret = speakeasy.generateSecret({
                length: 20,
                name: 'CoinTrade',
                issuer: 'CoinTrade'
            });

            const base32Secret = secret.base32;

            // 生成二维码
            const otpauth_url = secret.otpauth_url;
            const qrCodeDataURL = await QRCode.toDataURL(otpauth_url, {
                errorCorrectionLevel: 'H',
                margin: 1,
                width: 250
            });

            await security.update({
                google_secret: base32Secret,
                google_enabled: true
            });

            res.json({
                success: true,
                message: '2FA已启用！请使用Google Authenticator扫描二维码',
                secret: base32Secret,
                qrCode: qrCodeDataURL,
                otpauth: otpauth_url
            });
        } else {
            await security.update({
                google_secret: null,
                google_enabled: false
            });
            res.json({
                success: true,
                message: '2FA已禁用'
            });
        }
    } catch (error) {
        console.error('2FA错误:', error);
        res.json({ success: false, message: '操作失败，请稍后重试' });
    }
});

router.get('/security/2fa-status', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }

        const security = await Security.findOne({ where: { user_id: req.session.user.id } });
        res.json({
            success: true,
            enabled: security ? security.google_enabled : false
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

router.post('/security/verify-2fa', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }

        const { code } = req.body;

        if (!code || code.length < 6) {
            return res.json({ success: false, message: '请输入6位验证码' });
        }

        const security = await Security.findOne({ where: { user_id: req.session.user.id } });
        if (!security || !security.google_enabled) {
            return res.json({ success: false, message: '未启用2FA' });
        }

        // 使用 speakeasy 验证
        const verified = speakeasy.totp.verify({
            secret: security.google_secret,
            encoding: 'base32',
            token: code,
            window: 1
        });

        if (verified) {
            res.json({ success: true, message: '验证通过' });
        } else {
            res.json({ success: false, message: '验证码错误，请重试' });
        }
    } catch (error) {
        console.error('验证2FA错误:', error);
        res.json({ success: false, message: '验证失败' });
    }
});

// ============================================
// IP白名单
// ============================================
router.get('/security/ip-whitelist', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        let security = await Security.findOne({ where: { user_id: req.session.user.id } });
        const ips = security && security.ip_whitelist ? JSON.parse(security.ip_whitelist) : [];
        res.json({ success: true, ips: ips });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

router.post('/security/ip-whitelist', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        const { action, ip } = req.body;
        let security = await Security.findOne({ where: { user_id: req.session.user.id } });
        if (!security) {
            security = await Security.create({
                user_id: req.session.user.id,
                ip_whitelist: JSON.stringify([])
            });
        }
        let ips = security.ip_whitelist ? JSON.parse(security.ip_whitelist) : [];
        if (action === 'add') {
            if (!ips.includes(ip)) {
                ips.push(ip);
            }
        } else if (action === 'remove') {
            ips = ips.filter(i => i !== ip);
        }
        await security.update({ ip_whitelist: JSON.stringify(ips) });
        res.json({ success: true, message: 'IP白名单更新成功', ips: ips });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

module.exports = router;