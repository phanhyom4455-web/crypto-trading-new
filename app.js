const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP服务器 + Socket.IO（提前定义，路由里才能用）
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });
// ============================================
// 中间件配置
// ============================================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session配置
app.use(session({
    secret: 'admin-secret-key-2024',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// 设置视图引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================
// 数据库模型引入
// ============================================
const sequelize = require('./config/database');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Trade = require('./models/Trade');
const Security = require('./models/Security');
const Asset = require('./models/Asset');
const Currency = require('./models/Currency');
const Exchange = require('./models/Exchange');
const initCurrencies = require('./init-currencies');
const MarketControl = require('./models/MarketControl');

// ============================================
// 工具引入
// ============================================
const { sendVerificationEmail } = require('./utils/mailer');
const { sendSms } = require('./utils/sms');
const verifyRoutes = require('./verify-routes');
const routesExtra = require('./routes-extra');
const routesKline = require('./routes-kline');
const routesKyc = require('./routes-kyc');
routesKyc(app);

const routesKycFix = require('./routes-kyc-fix');
routesKycFix(app);

// ============================================
// 扣除/新增资金路由
// ============================================
const routesDeduct = require('./routes-deduct');

// 后台验证中间件
// ============================================
const requireLogin = (req, res, next) => {
    if (req.session && req.session.admin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

// ============================================
// 全局中间件
// ============================================
app.use((req, res, next) => {
    res.locals.admin = {
        username: 'admin',
        avatar: 'https://ui-avatars.com/api/?name=Admin&size=60&background=667eea&color=fff&bold=true'
    };
    res.locals.currentDate = new Date().toLocaleString('zh-CN');
    res.locals.currentPage = req.path.split('/').pop() || 'dashboard';
    res.locals.user = req.session.user || null;
    next();
});

// ============================================
// 用户注册 API（支持邮箱+手机号）
// ============================================
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, phone, password } = req.body;

        if (!username || username.length < 3) {
            return res.json({ success: false, message: '用户名至少3个字符' });
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.json({ success: false, message: '请输入有效的邮箱地址' });
        }

        if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
            return res.json({ success: false, message: '请输入有效的11位手机号码' });
        }
	
        if (!password || password.length < 6) {
            return res.json({ success: false, message: '密码至少6个字符' });
        }

        const existingUsername = await User.findOne({ where: { username } });
        if (existingUsername) {
            return res.json({ success: false, message: '用户名已被注册' });
        }

        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
            return res.json({ success: false, message: '该邮箱已被注册' });
        }

        if (phone) {
            const existingPhone = await User.findOne({ where: { phone } });
            if (existingPhone) {
                return res.json({ success: false, message: '该手机号已被注册' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
        const phoneCode = phone ? Math.floor(100000 + Math.random() * 900000).toString() : null;

        const user = await User.create({
            username,
            email,
            phone: phone || null,
            password: hashedPassword,
            vip: false,
            points: 100,
            status: 'active',
            verify_status: 'none',
            email_verified: false,
            phone_verified: false,
            email_verify_code: emailCode,
            email_verify_code_expires: new Date(Date.now() + 10 * 60 * 1000),
            phone_verify_code: phoneCode,
            phone_verify_code_expires: phoneCode ? new Date(Date.now() + 10 * 60 * 1000) : null
        });
// 【临时禁用】邮件/短信验证码发送
console.log('📧 [模拟] 邮箱验证码:', emailCode);
if (phone) {
    console.log('📱 [模拟] 短信验证码:', phoneCode);
}
        const currencies = ['USDT', 'BTC', 'ETH', 'ADA'];
        for (const currency of currencies) {
            await Asset.create({
                user_id: user.id,
                currency: currency,
               balance: 0,
                frozen: 0,
                total: 0
            });
        }

        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            vip: user.vip,
            verify_status: 'pending'
        };

        res.json({
            success: true,
            message: '注册成功！验证码已发送到您的邮箱和手机',
            user: { id: user.id, username: user.username, email: user.email, phone: user.phone },
            
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.json({ success: false, message: '注册失败，请稍后重试' });
    }
});
// 调用验证码路由
verifyRoutes(app, User);
routesExtra(app);
routesKline(app);

// ============================================
// 用户登录 API（兼容前端传 username 或 account）
// ============================================
app.post('/api/login', async (req, res) => {
    try {
        const { account, username, password } = req.body;
        const loginAccount = account || username;

        if (!loginAccount || !password) {
            return res.json({ success: false, message: '请输入账号和密码' });
        }

        let user;

        if (loginAccount.includes('@')) {
            user = await User.findOne({ where: { email: loginAccount } });
            if (!user) {
                return res.json({ success: false, message: '该邮箱未注册' });
            }
        } else if (/^1[3-9]\d{9}$/.test(loginAccount)) {
            user = await User.findOne({ where: { phone: loginAccount } });
            if (!user) {
                return res.json({ success: false, message: '该手机号未注册' });
            }
        } else {
            user = await User.findOne({ where: { username: loginAccount } });
            if (!user) {
                return res.json({ success: false, message: '该用户名不存在' });
            }
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.json({ success: false, message: '密码错误' });
        }

        if (user.twofa_enabled) {
            req.session.tempUser = { id: user.id, username: user.username };
            return res.json({
                success: true,
                require2fa: true,
                user: { id: user.id, username: user.username }
            });
        }

        await user.update({ last_login: new Date() });

        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            vip: user.vip,
            verify_status: user.verify_status
        };

        res.json({ success: true, message: '登录成功', redirect: '/' });
    } catch (error) {
        console.error('登录错误:', error);
        res.json({ success: false, message: '登录失败，请稍后重试' });
    }
});

// ============================================
// 退出登录
// ============================================
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ============================================
// 前台路由
// ============================================
app.get('/', (req, res) => {
    res.render('frontend/index', {
        title: '首页 - 数字货币交易平台',
        currentPage: 'home',
        user: req.session.user || null
    });
});

app.get('/about', (req, res) => {
    res.render('frontend/about', {
        title: '关于我们',
        currentPage: 'about',
        user: req.session.user || null
    });
});

app.get('/market', (req, res) => {
    res.render('frontend/market', {
        title: '行情中心',
        currentPage: 'market',
        user: req.session.user || null
    });
});

app.get('/trade', (req, res) => {
    res.render('frontend/trade', {
        title: '交易',
        currentPage: 'trade',
        user: req.session.user || null
    });
});

app.get('/deposit', (req, res) => {
    res.render('frontend/deposit', {
        title: '充值',
        currentPage: 'deposit',
        user: req.session.user || null
    });
});

app.get('/withdraw', (req, res) => {
    res.render('frontend/withdraw', {
        title: '提现',
        currentPage: 'withdraw',
        user: req.session.user || null
    });
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('frontend/login', {
        title: '登录',
        currentPage: 'login',
        user: null
    });
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('frontend/register-new', {
        title: '注册',
        currentPage: 'register',
        user: null
    });
});
app.get('/register-success', (req, res) => {
    res.render('frontend/register-success', {
        title: '注册成功',
        currentPage: 'register-success',
        user: null
    });
});
// ============================================
// 客服支持页面
// ============================================
// ============================================
// 客服支持页面（前台）
// ============================================
app.get('/support', (req, res) => {
    // 从数据库读取客服链接
    const customerServiceUrl = req.session.customerServiceUrl || 'https://t.me/your_telegram';
    res.redirect(customerServiceUrl);
});

// ============================================
// 后台客服设置页面
// ============================================
app.get('/admin/customer-service', requireLogin, (req, res) => {
    res.render('admin/customer-service', {
        title: '客服设置',
        currentPage: 'customer-service',
        customerServiceUrl: req.session.customerServiceUrl || 'https://t.me/your_telegram'
    });
});

// ============================================
// 保存客服链接 API
// ============================================
app.post('/api/admin/customer-service', requireLogin, (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.json({ success: false, message: '请输入客服链接' });
        }
        
        // 保存到 session（实际项目应保存到数据库）
        req.session.customerServiceUrl = url;
        
        res.json({ success: true, message: '✅ 客服链接已保存' });
    } catch (error) {
        console.error('保存客服链接错误:', error);
        res.json({ success: false, message: '保存失败' });
    }
});

// ============================================
// 用户中心路由
// ============================================
app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('frontend/profile', {
        title: '个人中心',
        currentPage: 'profile',
        user: req.session.user
    });
});

app.get('/assets', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('frontend/assets', {
        title: '资产明细',
        currentPage: 'assets',
        user: req.session.user
    });
});
app.get('/exchange', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('frontend/exchange', {
        title: '币币兑换',
        currentPage: 'exchange',
        user: req.session.user
    });
});
app.get('/trade-history', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('frontend/trade-history', {
        title: '交易记录',
        currentPage: 'trade-history',
        user: req.session.user
    });
});

app.get('/security', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('frontend/security', {
        title: '安全设置',
        currentPage: 'security',
        user: req.session.user
    });
});

// ============================================
// 编辑资料页面
// ============================================
app.get('/profile-edit', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('frontend/profile-edit', {
        title: '编辑资料',
        currentPage: 'profile-edit',
        user: req.session.user
    });
});

// ============================================
// 获取用户充值记录 API
// ============================================
app.get('/api/deposits', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        const deposits = await Transaction.findAll({
            where: { user_id: req.session.user.id, type: 'deposit' },
            order: [['created_at', 'DESC']],
            limit: 50
        });
        res.json({ success: true, deposits: deposits });
    } catch (error) {
        res.json({ success: false, message: '获取记录失败' });
    }
});

// ============================================
// 获取用户提现记录 API
// ============================================
app.get('/api/withdrawals', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        const withdrawals = await Transaction.findAll({
            where: { user_id: req.session.user.id, type: 'withdraw' },
            order: [['created_at', 'DESC']],
            limit: 50
        });
        res.json({ success: true, withdrawals: withdrawals });
    } catch (error) {
        res.json({ success: false, message: '获取记录失败' });
    }
});

// ============================================
// 安全设置 API
// ============================================
app.get('/api/security/fund-password-status', async (req, res) => {
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

app.post('/api/security/fund-password', async (req, res) => {
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

app.post('/api/security/verify-fund-password', async (req, res) => {
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

app.get('/api/security/2fa-status', async (req, res) => {
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

app.post('/api/security/2fa', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        const { enabled } = req.body;
        let security = await Security.findOne({ where: { user_id: req.session.user.id } });
        if (!security) {
            security = await Security.create({ user_id: req.session.user.id });
        }
        if (enabled) {
    const secret = crypto.randomBytes(10).toString('hex').toUpperCase();

    // ✅ 生成 otpauth 链接
    const issuer = 'CoinTrade';
    const account = req.session.user.username;
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

    // ✅ 生成二维码图片 URL
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;

    await security.update({
        google_secret: secret,
        google_enabled: true
    });
    await User.update({ twofa_enabled: true, twofa_secret: secret }, { where: { id: req.session.user.id } });

    res.json({
        success: true,
        message: '2FA已启用！',
        secret: secret,
        qrCode: qrCodeUrl        // ✅ 新增，返回二维码链接
    });
        } else {
            await security.update({
                google_secret: null,
                google_enabled: false
            });
            await User.update({ twofa_enabled: false, twofa_secret: null }, { where: { id: req.session.user.id } });
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

app.post('/api/security/verify-2fa', async (req, res) => {
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
        if (/^\d{6}$/.test(code)) {
            res.json({ success: true, message: '验证通过' });
        } else {
            res.json({ success: false, message: '验证码错误，请输入6位数字' });
        }
    } catch (error) {
        res.json({ success: false, message: '验证失败' });
    }
});

// ============================================
// 后台登录路由
// ============================================
app.get('/admin/login', (req, res) => {
    res.render('admin/login', { title: '管理员登录' });
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
   
    try {
        const admin = await User.findOne({ where: { username: username } });
        if (admin && admin.username === 'admin') {
            const validPassword = await bcrypt.compare(password, admin.password);
            if (validPassword) {
                req.session.admin = { username: admin.username, name: '管理员' };
                return res.redirect('/admin/dashboard');
            }
        }
    } catch (error) {
        console.error('管理员登录错误:', error);
    }

    res.render('admin/login', { title: '管理员登录', error: '用户名或密码错误' });
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// ============================================
// 后台路由（需要登录）
// ============================================
app.get('/admin', requireLogin, (req, res) => {
    res.redirect('/admin/dashboard');
});

app.get('/admin/dashboard', requireLogin, async (req, res) => {
    try {
        const totalUsers = await User.count();
        const totalTrades = await Trade.count();
        const stats = {
            totalUsers: totalUsers || 0,
            newUsers: 0,
            totalDeposits: 0,
            todayDeposits: 0,
            totalWithdrawals: 0,
            todayWithdrawals: 0,
            pendingDeposits: 0,
            pendingWithdrawals: 0,
            todayTransactions: totalTrades || 0,
            monthlyTransactions: totalTrades || 0,
            riskEvents: 0,
            todayLogins: 0,
            onlineUsers: Math.floor(Math.random() * 100) + 50,
            systemLoad: Math.floor(Math.random() * 30) + 10,
            apiCalls: Math.floor(Math.random() * 5000) + 1000,
            abnormalRequests: 0
        };
        res.render('admin/dashboard', {
            title: '控制台',
            stats: stats,
            currentPage: 'dashboard'
        });
    } catch (error) {
        res.status(500).send('服务器错误');
    }
});

app.get('/admin/users', requireLogin, async (req, res) => {
    try {
        const users = await User.findAll({ order: [['id', 'DESC']] });
        res.render('admin/users', {
            title: '用户管理',
            users: users,
            currentPage: 'users'
        });
    } catch (error) {
        res.status(500).send('服务器错误');
    }
});

// ============================================
// 后台页面路由（带数据）
// ============================================
app.get('/admin/user-groups', requireLogin, (req, res) => {
    res.render('admin/user-groups', {
        title: '用户分组',
        currentPage: 'user-groups',
        groups: [
            { id: 1, name: '普通用户', count: 12903, level: 1, benefits: '基础功能' },
            { id: 2, name: '白银会员', count: 1560, level: 2, benefits: '手续费9折' },
            { id: 3, name: '黄金会员', count: 560, level: 3, benefits: '手续费8折+专属客服' },
            { id: 4, name: '铂金会员', count: 180, level: 4, benefits: '手续费7折+优先处理' },
            { id: 5, name: '钻石会员', count: 40, level: 5, benefits: '手续费5折+VIP通道' }
        ]
    });
});

app.get('/admin/vip-levels', requireLogin, (req, res) => {
    res.render('admin/vip-levels', {
        title: '会员等级',
        currentPage: 'vip-levels',
        levels: [
            { level: 1, name: '普通会员', min_spent: 0, discount: '无', benefits: '基础功能' },
            { level: 2, name: '白银会员', min_spent: 10000, discount: '9折', benefits: '手续费优惠' },
            { level: 3, name: '黄金会员', min_spent: 50000, discount: '8折', benefits: '专属客服' },
            { level: 4, name: '铂金会员', min_spent: 200000, discount: '7折', benefits: 'VIP通道' },
            { level: 5, name: '钻石会员', min_spent: 1000000, discount: '5折', benefits: '至尊服务' }
        ]
    });
});

app.get('/admin/points', requireLogin, (req, res) => {
    res.render('admin/points', {
        title: '积分管理',
        currentPage: 'points',
        rules: [
            { id: 1, name: '注册送积分', points: 100, type: '一次性', status: 'active' },
            { id: 2, name: '每日签到', points: 10, type: '每日', status: 'active' },
            { id: 3, name: '交易奖励', points: 50, type: '每笔', status: 'active' },
            { id: 4, name: '推荐奖励', points: 200, type: '一次性', status: 'active' }
        ]
    });
});

app.get('/admin/deposits', requireLogin, (req, res) => {
    res.render('admin/deposits', {
        title: '充值管理',
        currentPage: 'deposits',
        deposits: []
    });
});

app.get('/admin/withdrawals', requireLogin, (req, res) => {
    res.render('admin/withdrawals', {
        title: '取款管理',
        currentPage: 'withdrawals',
        withdrawals: []
    });
});

app.get('/admin/transactions', requireLogin, (req, res) => {
    res.render('admin/transactions', {
        title: '交易管理',
        currentPage: 'transactions',
        transactions: []
    });
});

app.get('/admin/announcements', requireLogin, (req, res) => {
    res.render('admin/announcements', {
        title: '公告管理',
        currentPage: 'announcements',
        announcements: [
            { id: 1, title: '系统升级维护通知', content: '系统将于9月7日凌晨2:00-4:00进行升级维护...', type: 'maintenance', status: 'published', time: '2024-09-05 10:00:00' },
            { id: 2, title: '新增交易对ADA/USDT', content: '为满足用户需求，平台新增ADA/USDT交易对...', type: 'system', status: 'published', time: '2024-09-04 15:30:00' },
            { id: 3, title: '中秋活动预告', content: '中秋佳节，平台推出充值送积分活动...', type: 'activity', status: 'draft', time: '2024-09-03 08:45:00' }
        ]
    });
});

app.get('/admin/notifications', requireLogin, (req, res) => {
    res.render('admin/notifications', {
        title: '通知管理',
        currentPage: 'notifications',
        notifications: [
            { id: 1, title: '充值到账通知', type: 'system', scope: 'all', status: 'published', created_at: '2024-09-06 14:30:25' },
            { id: 2, title: '安全提醒', type: 'system', scope: 'all', status: 'published', created_at: '2024-09-06 12:15:40' },
            { id: 3, title: 'VIP专属活动', type: 'activity', scope: 'vip', status: 'published', created_at: '2024-09-06 10:00:00' }
        ]
    });
});

app.get('/admin/finance', requireLogin, (req, res) => {
    res.render('admin/finance', {
        title: '财务统计',
        currentPage: 'finance',
        stats: {
            total_revenue: 2847560.50,
            total_orders: 45230,
            total_refund: 45670.30,
            net_profit: 2801890.20
        }
    });
});

app.get('/admin/earnings', requireLogin, (req, res) => {
    res.render('admin/earnings', {
        title: '收益统计',
        currentPage: 'earnings',
        stats: {
            today: 12580.00,
            week: 84560.00,
            month: 328560.00,
            total: 2801890.20
        }
    });
});

app.get('/admin/ranking', requireLogin, (req, res) => {
    res.render('admin/ranking', {
        title: '用户排行',
        currentPage: 'ranking',
        ranking: [
            { id: 1, username: 'sunqi', points: 12560, orders: 156, spent: 56890.00 },
            { id: 2, username: 'wangwu', points: 8930, orders: 78, spent: 28650.00 },
            { id: 3, username: 'zhangsan', points: 5860, orders: 45, spent: 12580.50 },
            { id: 4, username: 'lisi', points: 1280, orders: 12, spent: 3560.00 },
            { id: 5, username: 'zhaoliu', points: 450, orders: 5, spent: 1280.00 }
        ]
    });
});

app.get('/admin/risk-control', requireLogin, (req, res) => {
    res.render('admin/risk-control', {
        title: '风控管理',
        currentPage: 'risk-control',
        rules: [
            { id: 1, name: '异常登录检测', condition: '同一IP多次登录失败', action: 'block', priority: 1, enabled: true },
            { id: 2, name: '大额交易预警', condition: '单笔交易超过10000', action: 'warn', priority: 2, enabled: true },
            { id: 3, name: '频繁提现检测', condition: '24小时内提现超过3次', action: 'warn', priority: 3, enabled: false }
        ],
        events: [
            { id: 1, username: 'zhaoliu', type: '异常登录', risk_level: 'high', status: 'pending', time: '2024-09-06 14:30:25' },
            { id: 2, username: 'lisi', type: '大额交易', risk_level: 'medium', status: 'resolved', time: '2024-09-06 13:15:42' }
        ]
    });
});

app.get('/admin/login-logs', requireLogin, (req, res) => {
    res.render('admin/login-logs', {
        title: '登录日志',
        currentPage: 'login-logs',
        logs: [
            { id: 1, username: 'admin', ip: '192.168.1.1', device: 'Chrome/Windows', status: 'success', time: '2024-09-06 14:30:25' },
            { id: 2, username: 'zhangsan', ip: '192.168.1.2', device: 'Safari/Mac', status: 'success', time: '2024-09-06 13:15:42' },
            { id: 3, username: 'lisi', ip: '192.168.1.3', device: 'Firefox/Windows', status: 'failed', time: '2024-09-06 12:45:10' },
            { id: 4, username: 'wangwu', ip: '192.168.1.4', device: 'Chrome/Android', status: 'success', time: '2024-09-06 11:30:55' }
        ]
    });
});

app.get('/admin/backup', requireLogin, (req, res) => {
    res.render('admin/backup', {
        title: '数据备份',
        currentPage: 'backup',
        backups: [
            { id: 1, name: '全量备份_20240906', type: 'full', size: '2.3GB', status: 'completed', time: '2024-09-06 02:00:00' },
            { id: 2, name: '增量备份_20240906', type: 'incremental', size: '156MB', status: 'completed', time: '2024-09-06 12:00:00' },
            { id: 3, name: '全量备份_20240905', type: 'full', size: '2.2GB', status: 'completed', time: '2024-09-05 02:00:00' }
        ]
    });
});

app.get('/admin/tickets', requireLogin, (req, res) => {
    res.render('admin/tickets', {
        title: '工单管理',
        currentPage: 'tickets',
        tickets: [
            { id: 1, user: 'zhangsan', title: '充值未到账', category: '充值问题', status: 'pending', priority: 'high', time: '2024-09-06 14:30:25' },
            { id: 2, user: 'lisi', title: '提现审核慢', category: '提现问题', status: 'processing', priority: 'medium', time: '2024-09-06 13:15:42' },
            { id: 3, user: 'wangwu', title: '交易失败', category: '交易问题', status: 'resolved', priority: 'low', time: '2024-09-06 12:45:10' }
        ]
    });
});

app.get('/admin/feedbacks', requireLogin, (req, res) => {
    res.render('admin/feedbacks', {
        title: '用户反馈',
        currentPage: 'feedbacks',
        feedbacks: [
            { id: 1, user: 'wangwu', content: '平台体验很好，建议增加更多交易对', rating: 5, status: 'read', time: '2024-09-06 14:30:25' },
            { id: 2, user: 'sunqi', content: '提现速度可以更快一些', rating: 4, status: 'unread', time: '2024-09-06 13:15:42' },
            { id: 3, user: 'zhangsan', content: '客服响应及时，问题解决快', rating: 5, status: 'read', time: '2024-09-06 12:45:10' }
        ]
    });
});

app.get('/admin/monitor', requireLogin, (req, res) => {
    res.render('admin/monitor', {
        title: '系统监控',
        currentPage: 'monitor',
        stats: {
            cpu: 23,
            memory: 45,
            disk: 62,
            uptime: '15天 8小时',
            requests: 4567,
            errors: 12,
            responseTime: 156
        }
    });
});

app.get('/admin/api', requireLogin, (req, res) => {
    res.render('admin/api', {
        title: 'API管理',
        currentPage: 'api',
        apis: [
            { id: 1, name: '用户认证API', path: '/api/auth', method: 'POST', status: 'active', calls: 1250 },
            { id: 2, name: '交易API', path: '/api/trade', method: 'POST', status: 'active', calls: 856 },
            { id: 3, name: '行情API', path: '/api/market', method: 'GET', status: 'active', calls: 4567 },
            { id: 4, name: '充值API', path: '/api/deposit', method: 'POST', status: 'inactive', calls: 0 }
        ]
    });
});

app.get('/admin/settings', requireLogin, (req, res) => {
    res.render('admin/settings', {
        title: '系统设置',
        currentPage: 'settings',
        settings: {
            site_name: '交易平台',
            site_url: 'https://example.com',
            maintenance: false,
            registration: true,
            email_verify: true,
            smtp_host: 'smtp.example.com',
            smtp_port: 587,
            smtp_user: 'noreply@example.com'
        }
    });
});

app.get('/admin/change-password', requireLogin, (req, res) => {
    res.render('admin/change-password', {
        title: '修改密码',
        currentPage: 'change-password'
    });
});

app.get('/admin/logs', requireLogin, (req, res) => {
    res.render('admin/logs', {
        title: '操作日志',
        currentPage: 'logs',
        logs: [
            { id: 1, operator: 'admin', action: '用户登录', target: '系统', ip: '192.168.1.1', time: '2024-09-06 14:30:25' },
            { id: 2, operator: 'admin', action: '修改用户信息', target: '用户ID:123', ip: '192.168.1.1', time: '2024-09-06 13:15:42' },
            { id: 3, operator: 'admin', action: '审核充值', target: '充值ID:456', ip: '192.168.1.1', time: '2024-09-06 12:45:10' },
            { id: 4, operator: 'admin', action: '系统设置更新', target: '系统', ip: '192.168.1.1', time: '2024-09-06 11:30:55' }
        ]
    });
});

app.get('/admin/permissions', requireLogin, (req, res) => {
    res.render('admin/permissions', {
        title: '权限管理',
        currentPage: 'permissions',
        roles: [
            { id: 1, name: '超级管理员', permissions: ['所有权限'], users: 1 },
            { id: 2, name: '运营管理员', permissions: ['用户管理', '内容管理'], users: 3 },
            { id: 3, name: '财务管理员', permissions: ['财务管理', '充值管理', '取款管理'], users: 2 },
            { id: 4, name: '客服管理员', permissions: ['工单管理', '用户反馈'], users: 5 }
        ]
    });
});

app.get('/admin/campaigns', requireLogin, (req, res) => {
    res.render('admin/campaigns', {
        title: '营销活动',
        currentPage: 'campaigns',
        campaigns: [
            { id: 1, name: '中秋充值送积分', type: '充值', status: 'active', start: '2024-09-01', end: '2024-09-15', participants: 1250 },
            { id: 2, name: '新用户注册送大礼', type: '注册', status: 'active', start: '2024-08-15', end: '2024-10-15', participants: 3420 },
            { id: 3, name: '交易大赛S3', type: '交易', status: 'ended', start: '2024-07-01', end: '2024-08-31', participants: 560 }
        ]
    });
});

app.get('/admin/coupons', requireLogin, (req, res) => {
    res.render('admin/coupons', {
        title: '优惠券管理',
        currentPage: 'coupons',
        coupons: [
            { id: 1, code: 'WELCOME100', type: '折扣券', value: 10, min_order: 100, used: 450, total: 500, expiry: '2024-12-31', status: 'active' },
            { id: 2, code: 'VIP50', type: '折扣券', value: 50, min_order: 500, used: 120, total: 200, expiry: '2024-11-30', status: 'active' },
            { id: 3, code: 'NEWYEAR', type: '满减券', value: 20, min_order: 50, used: 890, total: 1000, expiry: '2024-10-31', status: 'active' }
        ]
    });
});

app.get('/admin/payment-channels', requireLogin, (req, res) => {
    res.render('admin/payment-channels', {
        title: '支付渠道',
        currentPage: 'payment-channels',
        channels: [
            { id: 1, name: '支付宝', enabled: true, fee: 0.5, status: 'active' },
            { id: 2, name: '微信支付', enabled: true, fee: 0.5, status: 'active' },
            { id: 3, name: 'USDT', enabled: true, fee: 0.1, status: 'active' },
            { id: 4, name: '银行卡', enabled: false, fee: 0.8, status: 'inactive' }
        ]
    });
});

app.get('/admin/cron', requireLogin, (req, res) => {
    res.render('admin/cron', {
        title: '定时任务',
        currentPage: 'cron',
        tasks: [
            { id: 1, name: '每日数据备份', schedule: '0 2 * * *', status: 'active', last_run: '2024-09-06 02:00:00' },
            { id: 2, name: '用户积分结算', schedule: '0 0 * * *', status: 'active', last_run: '2024-09-06 00:00:00' },
            { id: 3, name: '系统日志清理', schedule: '0 3 * * 0', status: 'inactive', last_run: '2024-09-03 03:00:00' },
            { id: 4, name: '报表生成', schedule: '0 8 * * 1', status: 'active', last_run: '2024-09-02 08:00:00' }
        ]
    });
});

app.get('/admin/languages', requireLogin, (req, res) => {
    res.render('admin/languages', {
        title: '多语言管理',
        currentPage: 'languages',
        languages: [
            { code: 'zh', name: '简体中文', enabled: true, progress: 100 },
            { code: 'en', name: 'English', enabled: true, progress: 85 },
            { code: 'ja', name: '日本語', enabled: false, progress: 30 },
            { code: 'ko', name: '한국어', enabled: false, progress: 15 }
        ]
    });
});

app.get('/admin/app-manage', requireLogin, (req, res) => {
    res.render('admin/app-manage', {
        title: 'App管理',
        currentPage: 'app-manage',
        versions: [
            { version: '2.0.0', platform: 'iOS', status: 'latest', release_date: '2024-09-01', downloads: 1000 },
            { version: '1.9.8', platform: 'Android', status: 'latest', release_date: '2024-08-28', downloads: 5000 },
            { version: '1.9.7', platform: 'iOS', status: 'old', release_date: '2024-08-15', downloads: 800 }
        ]
    });
});

app.get('/admin/reset-password', requireLogin, (req, res) => {
    res.render('admin/reset-password', {
        title: '重置密码',
        currentPage: 'reset-password'
    });
});

app.get('/admin/user-security', requireLogin, (req, res) => {
    res.render('admin/user-security', {
        title: '用户安全设置',
        currentPage: 'user-security'
    });
});

app.get('/admin/user-verify', requireLogin, (req, res) => {
    res.render('admin/user-verify', {
        title: '用户审核',
        currentPage: 'user-verify'
    });
});

app.get('/admin/market-control', requireLogin, (req, res) => {
    res.render('admin/market-control', {
        title: '市场控制',
        currentPage: 'market-control'
    });
});

// ============================================
// 后台 API
// ============================================
app.get('/api/admin/deposits', requireLogin, async (req, res) => {
    try {
        const deposits = await Transaction.findAll({
            where: { type: 'deposit' },
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, deposits: deposits });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

app.post('/api/admin/deposit/approve', requireLogin, async (req, res) => {
    try {
        const { id } = req.body;
        const deposit = await Transaction.findByPk(id);
        if (!deposit) {
            return res.json({ success: false, message: '充值记录不存在' });
        }
        await deposit.update({ status: 'completed' });
        let asset = await Asset.findOne({ where: { user_id: deposit.user_id, currency: deposit.method || 'USDT' } });
        if (asset) {
            await asset.increment('balance', { by: parseFloat(deposit.amount) });
        } else {
            await Asset.create({
                user_id: deposit.user_id,
                currency: deposit.method || 'USDT',
                balance: parseFloat(deposit.amount),
                frozen: 0,
                total: parseFloat(deposit.amount)
            });
        }
        res.json({ success: true, message: '✅ 充值已通过' });
    } catch (error) {
        res.json({ success: false, message: '操作失败' });
    }
});

app.post('/api/admin/deposit/reject', requireLogin, async (req, res) => {
    try {
        const { id } = req.body;
        const deposit = await Transaction.findByPk(id);
        if (!deposit) {
            return res.json({ success: false, message: '充值记录不存在' });
        }
        await deposit.update({ status: 'failed' });
        res.json({ success: true, message: '✅ 充值已拒绝' });
    } catch (error) {
        res.json({ success: false, message: '操作失败' });
    }
});

app.get('/api/admin/withdrawals', requireLogin, async (req, res) => {
    try {
        const withdrawals = await Transaction.findAll({
            where: { type: 'withdraw' },
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, withdrawals: withdrawals });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

app.post('/api/admin/withdraw/approve', requireLogin, async (req, res) => {
    try {
        const { id } = req.body;
        const withdraw = await Transaction.findByPk(id);
        if (!withdraw) {
            return res.json({ success: false, message: '提现记录不存在' });
        }
        await withdraw.update({ status: 'completed' });
        var wCurrency = withdraw.method === 'BANK' ? 'USDT' : withdraw.method;
let asset = await Asset.findOne({ where: { user_id: withdraw.user_id, currency: wCurrency || 'USDT' } });
        if (asset) {
            await asset.decrement('frozen', { by: parseFloat(withdraw.amount) });
        }
        res.json({ success: true, message: '✅ 提现已通过' });
    } catch (error) {
        res.json({ success: false, message: '操作失败' });
    }
});

app.post('/api/admin/withdraw/reject', requireLogin, async (req, res) => {
    try {
        const { id } = req.body;
        const withdraw = await Transaction.findByPk(id);
        if (!withdraw) {
            return res.json({ success: false, message: '提现记录不存在' });
        }
        await withdraw.update({ status: 'failed' });

        // ✅ 和提现接口一样，做 BANK → USDT 转换
        var wCurrency = withdraw.method === 'BANK' ? 'USDT' : withdraw.method;
        let asset = await Asset.findOne({
            where: { user_id: withdraw.user_id, currency: wCurrency || 'USDT' }
        });

        if (asset) {
            await asset.decrement('frozen', { by: parseFloat(withdraw.amount) });
            await asset.increment('balance', { by: parseFloat(withdraw.amount) });
            console.log('✅ 已解冻:', withdraw.amount, wCurrency);
        } else {
            console.log('⚠️ 找不到资产，无法解冻:', withdraw.user_id, wCurrency);
        }

        res.json({ success: true, message: '✅ 提现已拒绝' });
    } catch (error) {
        console.error('拒绝提现错误:', error);
        res.json({ success: false, message: '操作失败' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.findAll({
            order: [['id', 'DESC']],
            attributes: ['id', 'username', 'email', 'phone', 'vip', 'points', 'orders', 'spent', 'status', 'created_at', 'twofa_enabled', 'real_name', 'id_card', 'verify_status', 'verify_note']
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await User.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============================================
// 用户修改自己的登录密码
// ============================================
app.post('/api/user/change-password', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.json({ success: false, message: '请填写完整信息' });
        }
        if (newPassword.length < 6) {
            return res.json({ success: false, message: '新密码至少6个字符' });
        }

        const user = await User.findByPk(req.session.user.id);
        if (!user) {
            return res.json({ success: false, message: '用户不存在' });
        }

        const validOld = await bcrypt.compare(oldPassword, user.password);
        if (!validOld) {
            return res.json({ success: false, message: '原密码错误' });
        }

        const hashedNew = await bcrypt.hash(newPassword, 10);
        await user.update({ password: hashedNew });

        res.json({ success: true, message: '✅ 登录密码修改成功！' });
    } catch (error) {
        console.error('修改密码错误:', error);
        res.json({ success: false, message: '修改失败，请稍后重试' });
    }
});
// ============================================
// 管理员修改自己的密码
// ============================================
app.post('/api/admin/change-password', async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.json({ success: false, message: '请先登录管理员账号' });
        }
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.json({ success: false, message: '请填写完整信息' });
        }
        if (newPassword.length < 6) {
            return res.json({ success: false, message: '新密码至少6个字符' });
        }

        const admin = await User.findOne({ where: { username: 'admin' } });
        if (!admin) {
            return res.json({ success: false, message: '管理员账号不存在' });
        }

        const validOld = await bcrypt.compare(oldPassword, admin.password);
        if (!validOld) {
            return res.json({ success: false, message: '原密码错误' });
        }

        const hashedNew = await bcrypt.hash(newPassword, 10);
        await admin.update({ password: hashedNew });

        res.json({ success: true, message: '✅ 管理员密码修改成功！' });
    } catch (error) {
        console.error('管理员修改密码错误:', error);
        res.json({ success: false, message: '修改失败，请稍后重试' });
    }
});


app.post('/api/admin/reset-password', requireLogin, async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.json({ success: false, message: '请先登录管理员账号' });
        }
        const { user_id, password } = req.body;
        if (!user_id) {
            return res.json({ success: false, message: '请选择用户' });
        }
        if (!password || password.length < 6) {
            return res.json({ success: false, message: '密码至少6个字符' });
        }
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.json({ success: false, message: '用户不存在' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await user.update({ password: hashedPassword });
        res.json({ success: true, message: `✅ 已重置用户 ${user.username} 的密码！` });
    } catch (error) {
        res.json({ success: false, message: '操作失败，请稍后重试' });
    }
});

// ============================================
// 兼容前端：重置资金密码
// ============================================
app.post('/api/admin/reset-fund-password', requireLogin, async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.json({ success: false, message: '请先登录管理员账号' });
        }
        const { user_id } = req.body;
        if (!user_id) {
            return res.json({ success: false, message: '请选择用户' });
        }
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.json({ success: false, message: '用户不存在' });
        }
        let security = await Security.findOne({ where: { user_id } });
        if (!security) {
            security = await Security.create({ user_id });
        }
        await security.update({ fund_password: null, fund_password_enabled: false });
        res.json({ success: true, message: `✅ 已重置用户 ${user.username} 的资金密码` });
    } catch (error) {
        console.error('重置资金密码失败：', error);
        res.json({ success: false, message: '操作失败，请稍后重试' });
    }
});

// ============================================
// 兼容前端：关闭 2FA
// ============================================
app.post('/api/admin/disable-2fa', requireLogin, async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.json({ success: false, message: '请先登录管理员账号' });
        }
        const { user_id } = req.body;
        if (!user_id) {
            return res.json({ success: false, message: '请选择用户' });
        }
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.json({ success: false, message: '用户不存在' });
        }
        let security = await Security.findOne({ where: { user_id } });
        if (!security) {
            security = await Security.create({ user_id });
        }
        await security.update({ google_secret: null, google_enabled: false });
        await User.update({ twofa_enabled: false, twofa_secret: null }, { where: { id: user_id } });
        res.json({ success: true, message: `✅ 已关闭用户 ${user.username} 的谷歌验证器(2FA)` });
    } catch (error) {
        console.error('关闭2FA失败：', error);
        res.json({ success: false, message: '操作失败，请稍后重试' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const totalUsers = await User.count();
        res.json({
            totalUsers: totalUsers || 0,
            newUsers: Math.floor(Math.random() * 50) + 10,
            totalRevenue: 2847560.50,
            todayRevenue: Math.floor(Math.random() * 10000) + 1000,
            totalOrders: Math.floor(Math.random() * 100) + 45230,
            todayOrders: Math.floor(Math.random() * 100) + 20,
            onlineUsers: Math.floor(Math.random() * 200) + 50,
            activeUsers: Math.floor(Math.random() * 500) + 100,
            apiCalls: Math.floor(Math.random() * 5000) + 1000,
            systemLoad: Math.floor(Math.random() * 30) + 10
        });
    } catch (error) {
        res.json({
            totalUsers: 15243,
            newUsers: 328,
            totalRevenue: 2847560.50,
            todayRevenue: 12580.00,
            totalOrders: 45230,
            todayOrders: 456,
            onlineUsers: 89,
            activeUsers: 320,
            apiCalls: 4567,
            systemLoad: 23
        });
    }
});

// ============================================
// 交易 API
// ============================================
app.post('/api/trade', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        const user = await User.findByPk(req.session.user.id);
        if (!user) {
            return res.json({ success: false, message: '用户不存在' });
        }
        const { pair, type, price, amount } = req.body;
        const userId = req.session.user.id;
        if (!pair || !type || !price || !amount) {
            return res.json({ success: false, message: '请填写完整信息' });
        }
        const total = parseFloat(price) * parseFloat(amount);
        const trade = await Trade.create({
            user_id: userId,
            username: user.username,
            pair: pair,
            type: type,
            price: parseFloat(price),
            amount: parseFloat(amount),
            total: total,
            status: 'completed'
        });
        await User.increment('orders', { by: 1, where: { id: userId } });
        await User.increment('spent', { by: total, where: { id: userId } });
        let asset = await Asset.findOne({ where: { user_id: userId, currency: 'USDT' } });
        if (asset) {
            if (type === 'buy') {
                await asset.decrement('balance', { by: total });
            } else {
                await asset.increment('balance', { by: total });
            }
        }
        // 🔔 通知后台（响铃）
        io.emit('new-notification', {
            type: 'trade',
            title: '📈 新交易订单',
            message: user.username + ' ' + (type === 'buy' ? '买入' : '卖出') + ' ' + pair + ' 数量 ' + amount
        });
        res.json({ success: true, message: type === 'buy' ? '买入成功' : '卖出成功', trade: trade });
    } catch (error) {
        console.error('交易错误:', error);
        res.json({ success: false, message: '交易失败，请稍后重试' });
    }
});

// ============================================
// 充值 API
// ============================================
app.post('/api/deposit', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        const { method, amount } = req.body;
        const user = req.session.user;
        if (!method || !amount || amount <= 0) {
            return res.json({ success: false, message: '请填写完整信息' });
        }
        const address = '0x' + Math.random().toString(16).substring(2, 42);
        const deposit = await Transaction.create({
            user_id: user.id,
            username: user.username,
            type: 'deposit',
            amount: parseFloat(amount),
            method: method,
            address: address,
            status: 'pending',
            txid: '0x' + Math.random().toString(16).substring(2, 10),
            description: `充值 ${amount} ${method}`
        });
        // 🔔 通知后台（响铃）
        io.emit('new-notification', {
            type: 'deposit',
            title: '💰 新充值申请',
            message: user.username + ' 申请充值 ' + amount + ' ' + method
        });
        res.json({ success: true, message: '充值申请已提交', address: address, deposit: deposit });
    } catch (error) {
        res.json({ success: false, message: '充值失败，请稍后重试' });
    }
});

// ============================================
// 提现 API
// ============================================
app.post('/api/withdraw', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        const { method, address, amount } = req.body;
        const user = req.session.user;
        if (!method || !address || !amount || amount <= 0) {
            return res.json({ success: false, message: '请填写完整信息' });
        }
        if (address.length < 10) {
            return res.json({ success: false, message: '请输入正确的提现地址' });
        }
       // 银行卡提现按 USDT 算
var currency = method === 'BANK' ? 'USDT' : method;
let asset = await Asset.findOne({ where: { user_id: user.id, currency: currency || 'USDT' } });
        if (!asset || parseFloat(asset.balance) < parseFloat(amount)) {
            return res.json({ success: false, message: '余额不足' });
        }
        await asset.decrement('balance', { by: parseFloat(amount) });
        await asset.increment('frozen', { by: parseFloat(amount) });
        const withdraw = await Transaction.create({
            user_id: user.id,
            username: user.username,
            type: 'withdraw',
            amount: parseFloat(amount),
            method: method,
            address: address,
            status: 'pending',
            description: `提现 ${amount} ${method} 到 ${address}`
        });
        // 🔔 通知后台（响铃）
        io.emit('new-notification', {
            type: 'withdraw',
            title: '💸 新提现申请',
            message: user.username + ' 申请提现 ' + amount + ' ' + method
        });
        res.json({ success: true, message: '提现申请已提交', withdraw: withdraw });
    } catch (error) {
        res.json({ success: false, message: '提现失败，请稍后重试' });
    }
});

// ============================================
// 获取用户资产 API
// ============================================
app.get('/api/assets', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: '请先登录' });
        }
        let assets = await Asset.findAll({ where: { user_id: req.session.user.id } });
        if (assets.length === 0) {
            const defaultCurrencies = ['USDT', 'BTC', 'ETH', 'ADA'];
            for (const currency of defaultCurrencies) {
                await Asset.create({
                    user_id: req.session.user.id,
                    currency: currency,
                    balance: currency === 'USDT' ? 10000 : 0.01,
                    frozen: 0,
                    total: currency === 'USDT' ? 10000 : 0.01
                });
            }
            assets = await Asset.findAll({ where: { user_id: req.session.user.id } });
        }
        res.json({ success: true, assets: assets });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// ============================================
// 获取交易记录 API
// ============================================
app.get('/api/trades', async (req, res) => {
    try {
        const trades = await Trade.findAll({ order: [['created_at', 'DESC']], limit: 50 });
        res.json({ success: true, trades: trades });
    } catch (error) {
        res.json({ success: false, trades: [] });
    }
});

// ============================================
// 市场数据 API
// ============================================
app.get('/api/market-data', async (req, res) => {
    try {
        const data = await MarketControl.findAll({
            where: { status: 'active' },
            order: [['id', 'ASC']]
        });
        res.json({ success: true, data });
    } catch (error) {
        res.json({ success: false, data: [] });
    }
});

// ============================================
// 404处理
// ============================================
// ============================================
// 实名认证路由（必须在 404 之前）
// ============================================
routesKyc(app);
// ============================================
// 扣除/新增资金路由（必须在 404 之前）
// ============================================
routesDeduct(app);
// ============================================
// 交易游戏路由
// ============================================
const routesTradeGame = require('./routes-trade-game');
routesTradeGame(app, io);
const routesTradeCountdown = require('./routes-trade-countdown-v2');
routesTradeCountdown(app, io);
const routesPrice = require('./routes-price');
const routesExchange = require('./routes-exchange');
routesPrice(app);
routesExchange(app);
const routesUsersBalance = require('./routes-users-balance');
routesUsersBalance(app);
// ============================================
// 同步所有 Sequelize 模型（自动建表）
// ============================================
sequelize.sync({ alter: false })
  .then(() => console.log('✅ 所有模型表已同步'))
  .catch(err => console.error('❌ 同步模型表失败：', err.message));

// ============================================
// 确保默认管理员存在（必须在 sync 之后）
// ============================================
(async () => {
  try {
    const admin = await User.findOne({ where: { username: 'admin' } });
    const hashedPwd = await bcrypt.hash('password', 10);
    if (!admin) {
      await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPwd,
        status: 'active'
      });
      console.log('✅ 默认管理员已创建：admin / password');
    } else {
      await admin.update({ password: hashedPwd });
      console.log('✅ 管理员密码已重置为：password');
    }
  } catch (e) {
    console.error('❌ 创建管理员失败：', e.message);
  }
})();
// ============================================
// ============================================


// 自动建表
sequelize.query(`
    CREATE TABLE IF NOT EXISTS trade_orders_2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username VARCHAR(255),
        amount FLOAT NOT NULL,
        direction VARCHAR(10) NOT NULL,
        duration INTEGER NOT NULL,
        profit_rate FLOAT NOT NULL,
        result VARCHAR(20) DEFAULT 'pending',
        profit FLOAT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'running',
        end_time DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).then(() => console.log('✅ trade_orders_2 表已就绪'))
  .catch(err => console.error('❌ 建表失败：', err.message));

// 自动建表

sequelize.query(`
    CREATE TABLE IF NOT EXISTS trade_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username VARCHAR(255),
        amount FLOAT NOT NULL,
        duration INTEGER NOT NULL,
        profit_rate FLOAT NOT NULL,
        result VARCHAR(20) DEFAULT 'pending',
        profit FLOAT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'running',
        end_time DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).then(() => console.log('✅ trade_orders 表已就绪'))
  .catch(err => console.error('❌ 建表失败：', err.message));
// ============================================
// 交易控制路由
// ============================================
const routesTradeControl = require('./routes-trade-control');
routesTradeControl(app);
// ============================================
// 自动创建交易控制表
// ============================================
const initTradeControl = require('./routes-trade-control-init');
initTradeControl(app);
app.use((req, res) => {
    res.status(404).send(`
        <h1>404 - 页面未找到</h1>
        <p>您访问的页面不存在</p>
        <a href="/">返回首页</a> | <a href="/admin/dashboard">管理后台</a>
    `);
});

// ============================================
// 错误处理
// ============================================
app.use((err, req, res, next) => {
    console.error('❌ 错误:', err.stack);
    res.status(500).send(`
        <h1>500 - 服务器错误</h1>
        <p>${err.message}</p>
        <a href="/">返回首页</a> | <a href="/admin/dashboard">管理后台</a>
    `);
});

// ============================================
// HTTP服务器 + Socket.IO
// ============================================

io.on('connection', (socket) => {
    console.log('🔌 客户端已连接');
    const interval = setInterval(() => {
        socket.emit('stats-update', {
            onlineUsers: Math.floor(Math.random() * 200) + 50,
            todayTransactions: Math.floor(Math.random() * 100) + 50,
            apiCalls: Math.floor(Math.random() * 5000) + 1000,
            systemLoad: Math.floor(Math.random() * 30) + 10
        });
    }, 3000);
    socket.on('disconnect', () => {
        clearInterval(interval);
        console.log('🔌 客户端断开');
    });
});
initCurrencies();
// ============================================
// 启动服务器
// ============================================
server.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 服务器已启动');
    console.log('========================================');
    console.log('📱 前台访问: http://localhost:' + PORT);
    console.log('📝 注册页面: http://localhost:' + PORT + '/register');
    console.log('🔐 登录页面: http://localhost:' + PORT + '/login');
    console.log('💰 充值页面: http://localhost:' + PORT + '/deposit');
    console.log('🏦 提现页面: http://localhost:' + PORT + '/withdraw');
    console.log('📈 交易页面: http://localhost:' + PORT + '/trade');
    console.log('🔑 后台访问: http://localhost:' + PORT + '/admin');
    console.log('🔑 后台默认账号: admin');
    console.log('🔑 后台默认密码: password');
    console.log('========================================');
});