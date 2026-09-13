const db = require('../models/database');
const bcrypt = require('bcryptjs');

// ===== 主页 =====
exports.home = (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('frontend/index', { title: '数字货币交易平台' });
};

// ===== 登录页面 =====
exports.loginPage = (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('frontend/login', { 
        title: '登录', 
        error: req.query.msg || null 
    });
};

// ===== 登录处理 =====
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        
        if (!user) {
            return res.render('frontend/login', { title: '登录', error: '邮箱或密码错误' });
        }
        
        const now = new Date();
        if (user.locked_until) {
            const lockTime = new Date(user.locked_until);
            if (now < lockTime) {
                const remaining = Math.ceil((lockTime - now) / 1000 / 60);
                return res.render('frontend/login', { 
                    title: '登录', 
                    error: '账户已被冻结，请 ' + remaining + ' 分钟后重试' 
                });
            } else {
                await db.run('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);
            }
        }
        
        if (user.status === 0) {
            return res.render('frontend/login', { title: '登录', error: '账号已被禁用' });
        }
        if (user.status === -1) {
            return res.render('frontend/login', { title: '登录', error: '账号已被拉黑' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            const attempts = (user.login_attempts || 0) + 1;
            await db.run('UPDATE users SET login_attempts = ?, last_login_attempt = ? WHERE id = ?', 
                [attempts, now.toISOString(), user.id]);
            
            const remaining = 3 - attempts;
            if (attempts >= 3) {
                const lockUntil = new Date(now.getTime() + 30 * 60 * 1000);
                await db.run('UPDATE users SET locked_until = ? WHERE id = ?', 
                    [lockUntil.toISOString(), user.id]);
                return res.render('frontend/login', { 
                    title: '登录', 
                    error: '连续登录失败3次，账户已被冻结30分钟' 
                });
            }
            
            return res.render('frontend/login', { 
                title: '登录', 
                error: '密码错误，还剩 ' + remaining + ' 次尝试机会' 
            });
        }

        await db.run('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);

        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            balance: user.balance,
            is_admin: user.is_admin,
            status: user.status
        };

        await db.run(
            'INSERT INTO logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)',
            [user.id, 'login', '用户登录成功', req.ip]
        );

        if (user.is_admin === 1) {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/dashboard');
        }
    } catch (error) {
        console.error(error);
        res.render('frontend/login', { title: '登录', error: '登录失败，请重试' });
    }
};

// ===== 注册页面 =====
exports.registerPage = (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('frontend/register', { 
        title: '注册', 
        error: null,
        success: null
    });
};

// ===== 注册处理 =====
exports.register = async (req, res) => {
    const { username, email, password, confirm_password } = req.body;
    
    if (password !== confirm_password) {
        return res.render('frontend/register', { 
            title: '注册', 
            error: '两次密码输入不一致',
            success: null
        });
    }

    try {
        const existing = await db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existing) {
            return res.render('frontend/register', { 
                title: '注册', 
                error: '用户名或邮箱已被注册',
                success: null
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );

        res.render('frontend/register-success', { 
            title: '注册成功',
            username: username,
            email: email
        });
    } catch (error) {
        console.error(error);
        res.render('frontend/register', { 
            title: '注册', 
            error: '注册失败，请重试',
            success: null
        });
    }
};

// ===== 退出登录 =====
exports.logout = (req, res) => {
    if (req.session.user) {
        db.run(
            'INSERT INTO logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)',
            [req.session.user.id, 'logout', '用户退出', req.ip]
        );
    }
    req.session.destroy();
    res.redirect('/login');
};

// ===== 控制台首页 =====
exports.dashboard = async (req, res) => {
    const userId = req.session.user.id;
    try {
        const balance = await db.get('SELECT balance FROM users WHERE id = ?', [userId]);
        const totalDeposits = await db.get(
            'SELECT SUM(amount) as total FROM deposits WHERE user_id = ? AND status = "completed"',
            [userId]
        );
        const totalWithdraws = await db.get(
            'SELECT SUM(amount) as total FROM withdrawals WHERE user_id = ? AND status = "completed"',
            [userId]
        );
        const recentTrades = await db.all(
            'SELECT * FROM trades WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
            [userId]
        );

        res.render('frontend/dashboard', {
            title: '控制台',
            user: req.session.user,
            balance: balance.balance || 0,
            totalDeposits: totalDeposits.total || 0,
            totalWithdraws: totalWithdraws.total || 0,
            recentTrades: recentTrades || []
        });
    } catch (error) {
        console.error(error);
        res.redirect('/login');
    }
};

// ===== 交易页面 =====
exports.trade = async (req, res) => {
    const userId = req.session.user.id;
    try {
        const user = await db.get('SELECT balance FROM users WHERE id = ?', [userId]);
        res.render('frontend/trade', {
            title: '交易',
            user: req.session.user,
            balance: user.balance || 0
        });
    } catch (error) {
        console.error(error);
        res.redirect('/dashboard');
    }
};

// ===== 下单处理 =====
exports.placeOrder = async (req, res) => {
    const { type, symbol, price, amount } = req.body;
    const userId = req.session.user.id;
    
    try {
        const user = await db.get('SELECT balance FROM users WHERE id = ?', [userId]);
        const total = parseFloat(price) * parseFloat(amount);
        
        const winRateSetting = await db.get("SELECT value FROM settings WHERE key = 'win_rate'");
        const winRate = winRateSetting ? parseFloat(winRateSetting.value) : 50;
        
        const randomNum = Math.random() * 100;
        const isWin = randomNum < winRate;
        
        let profit = 0;
        let result = 'pending';
        
        if (type === 'buy') {
            if (user.balance < total) {
                return res.json({ success: false, message: '余额不足' });
            }
            
            if (isWin) {
                const profitRate = 0.05 + Math.random() * 0.15;
                profit = total * profitRate;
                result = 'win';
            } else {
                const lossRate = 0.05 + Math.random() * 0.15;
                profit = -total * lossRate;
                result = 'loss';
            }
            
            await db.run('UPDATE users SET balance = balance - ? + ? WHERE id = ?', [total, profit, userId]);
            
        } else if (type === 'sell') {
            if (isWin) {
                const profitRate = 0.05 + Math.random() * 0.15;
                profit = total * profitRate;
                result = 'win';
            } else {
                const lossRate = 0.05 + Math.random() * 0.15;
                profit = -total * lossRate;
                result = 'loss';
            }
            
            await db.run('UPDATE users SET balance = balance + ? + ? WHERE id = ?', [total, profit, userId]);
        }

        await db.run(
            'INSERT INTO trades (user_id, type, symbol, price, amount, total, result, profit, admin_control) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, type, symbol, price, amount, total, result, profit, 1]
        );

        await db.run(
            'INSERT INTO logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)',
            [userId, 'trade', (type === 'buy' ? '买入' : '卖出') + ' ' + symbol + ' ' + amount + ' @ ' + price + '，' + (result === 'win' ? '盈利' : '亏损') + ' ' + Math.abs(profit).toFixed(2) + ' USDT', req.ip]
        );

        const message = result === 'win' ? '🎉 恭喜！交易盈利 ' + profit.toFixed(2) + ' USDT' : '😅 交易亏损 ' + Math.abs(profit).toFixed(2) + ' USDT';
        res.json({ success: true, message: message, result: result, profit: profit });
        
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '下单失败：' + error.message });
    }
};

// ===== 充值页面 =====
exports.depositPage = (req, res) => {
    res.render('frontend/deposit', {
        title: '充值',
        user: req.session.user
    });
};

// ===== 充值处理 =====
exports.deposit = async (req, res) => {
    const { amount, method } = req.body;
    const userId = req.session.user.id;
    
    try {
        await db.run(
            'INSERT INTO deposits (user_id, amount, method, status) VALUES (?, ?, ?, ?)',
            [userId, amount, method, 'pending']
        );
        res.json({ success: true, message: '充值申请已提交' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '充值申请失败' });
    }
};

// ===== 取款页面 =====
exports.withdrawPage = (req, res) => {
    res.render('frontend/withdraw', {
        title: '取款',
        user: req.session.user
    });
};

// ===== 取款处理 =====
exports.withdraw = async (req, res) => {
    const { amount, address, trade_password } = req.body;
    const userId = req.session.user.id;
    
    try {
        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user.trade_password) {
            return res.json({ success: false, message: '请先设置交易密码' });
        }
        const valid = await bcrypt.compare(trade_password, user.trade_password);
        if (!valid) {
            return res.json({ success: false, message: '交易密码错误' });
        }

        if (user.balance < amount) {
            return res.json({ success: false, message: '余额不足' });
        }

        await db.run(
            'INSERT INTO withdrawals (user_id, amount, address, status) VALUES (?, ?, ?, ?)',
            [userId, amount, address, 'pending']
        );
        await db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);
        
        res.json({ success: true, message: '取款申请已提交' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '取款申请失败' });
    }
};

// ===== 充值记录 =====
exports.depositRecords = async (req, res) => {
    const userId = req.session.user.id;
    try {
        const records = await db.all(
            'SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        res.render('frontend/records', {
            title: '充值记录',
            user: req.session.user,
            records: records,
            type: 'deposit'
        });
    } catch (error) {
        console.error(error);
        res.redirect('/dashboard');
    }
};

// ===== 取款记录 =====
exports.withdrawRecords = async (req, res) => {
    const userId = req.session.user.id;
    try {
        const records = await db.all(
            'SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        res.render('frontend/records', {
            title: '取款记录',
            user: req.session.user,
            records: records,
            type: 'withdraw'
        });
    } catch (error) {
        console.error(error);
        res.redirect('/dashboard');
    }
};

// ===== 设置页面 =====
exports.settingsPage = (req, res) => {
    res.render('frontend/settings', {
        title: '设置',
        user: req.session.user,
        message: null
    });
};

// ===== 修改登录密码 =====
exports.changePassword = async (req, res) => {
    const { old_password, new_password, confirm_password } = req.body;
    const userId = req.session.user.id;
    
    if (new_password !== confirm_password) {
        return res.json({ success: false, message: '两次密码输入不一致' });
    }

    try {
        const user = await db.get('SELECT password FROM users WHERE id = ?', [userId]);
        const valid = await bcrypt.compare(old_password, user.password);
        if (!valid) {
            return res.json({ success: false, message: '原密码错误' });
        }

        const hashed = await bcrypt.hash(new_password, 10);
        await db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
        
        res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '修改失败' });
    }
};

// ===== 修改交易密码 =====
exports.changeTradePassword = async (req, res) => {
    const { trade_password } = req.body;
    const userId = req.session.user.id;
    
    if (!trade_password || trade_password.length < 6) {
        return res.json({ success: false, message: '交易密码至少6位' });
    }

    try {
        const hashed = await bcrypt.hash(trade_password, 10);
        await db.run('UPDATE users SET trade_password = ? WHERE id = ?', [hashed, userId]);
        res.json({ success: true, message: '交易密码设置成功' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '设置失败' });
    }
};

// ===== 联系客服 =====
exports.contactPage = (req, res) => {
    res.render('frontend/contact', {
        title: '联系客服',
        user: req.session.user
    });
};