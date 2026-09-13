const db = require('../models/database');
const bcrypt = require('bcryptjs');

// ===== 管理员登录 =====
const adminLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE email = ? AND is_admin = 1', [email]);
        if (!user) {
            return res.render('admin/login', { title: '后台登录', error: '账号不存在' });
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.render('admin/login', { title: '后台登录', error: '密码错误' });
        }
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            is_admin: user.is_admin,
            status: user.status
        };
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error(error);
        res.render('admin/login', { title: '后台登录', error: '登录失败' });
    }
};

// ===== 管理员退出 =====
const adminLogout = (req, res) => {
    req.session.destroy();
    res.redirect('/admin');
};

// ===== 后台控制台 =====
const dashboard = async (req, res) => {
    try {
        const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
        const totalDeposits = await db.get('SELECT SUM(amount) as total FROM deposits WHERE status = "completed"');
        const totalWithdrawals = await db.get('SELECT SUM(amount) as total FROM withdrawals WHERE status = "completed"');
        const pendingDeposits = await db.get('SELECT COUNT(*) as count FROM deposits WHERE status = "pending"');
        const pendingWithdrawals = await db.get('SELECT COUNT(*) as count FROM withdrawals WHERE status = "pending"');
        res.render('admin/dashboard', {
            title: '管理后台',
            user: req.session.user,
            stats: {
                totalUsers: totalUsers.count || 0,
                totalDeposits: totalDeposits.total || 0,
                totalWithdrawals: totalWithdrawals.total || 0,
                pendingDeposits: pendingDeposits.count || 0,
                pendingWithdrawals: pendingWithdrawals.count || 0
            }
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin');
    }
};

// ===== 用户管理 =====
const userList = async (req, res) => {
    try {
        const users = await db.all('SELECT * FROM users ORDER BY created_at DESC');
        res.render('admin/users', {
            title: '用户管理',
            user: req.session.user,
            users: users
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const updateUserStatus = async (req, res) => {
    const { user_id, status } = req.body;
    try {
        await db.run('UPDATE users SET status = ? WHERE id = ?', [status, user_id]);
        res.json({ success: true, message: '状态更新成功' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '状态更新失败' });
    }
};

const deleteUser = async (req, res) => {
    const { user_id } = req.body;
    try {
        await db.run('DELETE FROM users WHERE id = ? AND is_admin = 0', [user_id]);
        res.json({ success: true, message: '用户删除成功' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '删除失败' });
    }
};

const addUser = async (req, res) => {
    const { username, email, password, balance } = req.body;
    try {
        const hashed = await bcrypt.hash(password, 10);
        await db.run(
            'INSERT INTO users (username, email, password, balance) VALUES (?, ?, ?, ?)',
            [username, email, hashed, balance || 0]
        );
        res.json({ success: true, message: '用户添加成功' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '添加失败' });
    }
};

const updateUserBalance = async (req, res) => {
    const { user_id, amount, action, remark } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE id = ?', [user_id]);
        if (!user) {
            return res.json({ success: false, message: '用户不存在' });
        }
        let newBalance = user.balance;
        let actionText = '';
        if (action === 'add') {
            newBalance = user.balance + amount;
            actionText = '加款';
        } else if (action === 'subtract') {
            if (user.balance < amount) {
                return res.json({ success: false, message: '用户余额不足，当前余额：' + user.balance });
            }
            newBalance = user.balance - amount;
            actionText = '扣款';
        } else {
            return res.json({ success: false, message: '无效的操作类型' });
        }
        await db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, user_id]);
        await db.run(
            'INSERT INTO logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)',
            [user_id, actionText, actionText + ' ' + amount + ' USDT，备注：' + (remark || '无'), req.ip]
        );
        res.json({
            success: true,
            message: actionText + '成功！新余额：' + newBalance + ' USDT',
            newBalance: newBalance
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '操作失败：' + error.message });
    }
};

// ===== 充值管理 =====
const depositList = async (req, res) => {
    try {
        const deposits = await db.all(`
            SELECT d.*, u.username, u.email 
            FROM deposits d 
            JOIN users u ON d.user_id = u.id 
            ORDER BY d.created_at DESC
        `);
        res.render('admin/deposits', {
            title: '充值管理',
            user: req.session.user,
            deposits: deposits
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const updateDepositStatus = async (req, res) => {
    const { deposit_id, status, user_id, amount } = req.body;
    try {
        await db.run('UPDATE deposits SET status = ? WHERE id = ?', [status, deposit_id]);
        if (status === 'completed') {
            await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, user_id]);
        }
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '更新失败' });
    }
};

// ===== 取款管理 =====
const withdrawalList = async (req, res) => {
    try {
        const withdrawals = await db.all(`
            SELECT w.*, u.username, u.email 
            FROM withdrawals w 
            JOIN users u ON w.user_id = u.id 
            ORDER BY w.created_at DESC
        `);
        res.render('admin/withdrawals', {
            title: '取款管理',
            user: req.session.user,
            withdrawals: withdrawals
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const updateWithdrawalStatus = async (req, res) => {
    const { withdrawal_id, status, user_id, amount } = req.body;
    try {
        await db.run('UPDATE withdrawals SET status = ? WHERE id = ?', [status, withdrawal_id]);
        if (status === 'rejected') {
            await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, user_id]);
        }
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '更新失败' });
    }
};

// ===== 交易管理 =====
const tradeList = async (req, res) => {
    try {
        const trades = await db.all(`
            SELECT t.*, u.username 
            FROM trades t 
            JOIN users u ON t.user_id = u.id 
            ORDER BY t.created_at DESC
        `);
        const stats = await db.get(`
            SELECT 
                COUNT(*) as totalTrades,
                SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as winCount,
                SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as lossCount
            FROM trades
        `);
        const total = stats.totalTrades || 0;
        const win = stats.winCount || 0;
        const loss = stats.lossCount || 0;
        const winRate = total > 0 ? Math.round((win / total) * 100) : 0;
        res.render('admin/trades', {
            title: '交易管理',
            user: req.session.user,
            trades: trades || [],
            stats: {
                totalTrades: total,
                winCount: win,
                lossCount: loss,
                winRate: winRate
            }
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const updateTradeResult = async (req, res) => {
    const { trade_id, result, profit } = req.body;
    try {
        const trade = await db.get('SELECT * FROM trades WHERE id = ?', [trade_id]);
        if (!trade) {
            return res.json({ success: false, message: '交易不存在' });
        }
        if (trade.result && trade.result !== 'pending') {
            return res.json({ success: false, message: '该订单已处理，不可修改' });
        }
        await db.run(
            'UPDATE trades SET result = ?, profit = ?, admin_control = 1 WHERE id = ?',
            [result, profit, trade_id]
        );
        const userId = trade.user_id;
        const currentUser = await db.get('SELECT balance FROM users WHERE id = ?', [userId]);
        const newBalance = currentUser.balance + parseFloat(profit);
        await db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId]);
        await db.run(
            'INSERT INTO logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)',
            [userId, 'admin_trade_control', '管理员修改交易 #' + trade_id + ' 为 ' + result + '，盈亏 ' + profit + ' USDT', req.ip]
        );
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '更新失败：' + error.message });
    }
};

const batchUpdateTradeResult = async (req, res) => {
    const { trade_ids, result, profit } = req.body;
    try {
        if (!trade_ids || trade_ids.length === 0) {
            return res.json({ success: false, message: '请选择至少一笔订单' });
        }
        let successCount = 0;
        for (const id of trade_ids) {
            const trade = await db.get('SELECT * FROM trades WHERE id = ?', [id]);
            if (!trade || (trade.result && trade.result !== 'pending')) continue;
            await db.run(
                'UPDATE trades SET result = ?, profit = ?, admin_control = 1 WHERE id = ?',
                [result, profit, id]
            );
            const userId = trade.user_id;
            const currentUser = await db.get('SELECT balance FROM users WHERE id = ?', [userId]);
            const newBalance = currentUser.balance + parseFloat(profit);
            await db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId]);
            successCount++;
        }
        await db.run(
            'INSERT INTO logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)',
            [req.session.user.id, 'admin_batch_trade_control', '批量修改 ' + successCount + ' 笔交易为 ' + result + '，盈亏 ' + profit + ' USDT', req.ip]
        );
        res.json({ success: true, message: '批量更新成功', count: successCount });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '批量更新失败：' + error.message });
    }
};

// ===== 解锁用户 =====
const unlockUser = async (req, res) => {
    const { user_id } = req.body;
    try {
        await db.run('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?', [user_id]);
        await db.run(
            'INSERT INTO logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)',
            [req.session.user.id, 'unlock_user', '解锁用户 ID: ' + user_id, req.ip]
        );
        res.json({ success: true, message: '用户已解锁' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '解锁失败：' + error.message });
    }
};

// ===== 公告管理 =====
const announcementList = async (req, res) => {
    try {
        const announcements = await db.all('SELECT * FROM announcements ORDER BY created_at DESC');
        res.render('admin/announcements', {
            title: '公告管理',
            user: req.session.user,
            announcements: announcements || []
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const addAnnouncement = async (req, res) => {
    const { title, content, type, is_published } = req.body;
    try {
        await db.run(
            'INSERT INTO announcements (title, content, type, is_published) VALUES (?, ?, ?, ?)',
            [title, content, type, is_published || 1]
        );
        res.json({ success: true, message: '公告添加成功' });
    } catch (error) {
        res.json({ success: false, message: '添加失败：' + error.message });
    }
};

const updateAnnouncement = async (req, res) => {
    const { id, title, content, type, is_published } = req.body;
    try {
        await db.run(
            'UPDATE announcements SET title = ?, content = ?, type = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [title, content, type, is_published, id]
        );
        res.json({ success: true, message: '公告更新成功' });
    } catch (error) {
        res.json({ success: false, message: '更新失败：' + error.message });
    }
};

const deleteAnnouncement = async (req, res) => {
    const { id } = req.body;
    try {
        await db.run('DELETE FROM announcements WHERE id = ?', [id]);
        res.json({ success: true, message: '公告删除成功' });
    } catch (error) {
        res.json({ success: false, message: '删除失败' });
    }
};

// ===== 财务统计 =====
const financeStats = async (req, res) => {
    try {
        const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
        const totalBalance = await db.get('SELECT SUM(balance) as total FROM users');
        const totalDeposits = await db.get('SELECT SUM(amount) as total FROM deposits WHERE status = "completed"');
        const totalWithdrawals = await db.get('SELECT SUM(amount) as total FROM withdrawals WHERE status = "completed"');
        const totalTrades = await db.get('SELECT COUNT(*) as count FROM trades');
        const totalProfit = await db.get('SELECT SUM(profit) as total FROM trades WHERE profit > 0');
        const totalLoss = await db.get('SELECT SUM(profit) as total FROM trades WHERE profit < 0');
        const winCount = await db.get('SELECT COUNT(*) as count FROM trades WHERE result = "win"');
        const total = (totalTrades.count || 0);
        const win = (winCount.count || 0);
        const winRate = total > 0 ? Math.round((win / total) * 100) : 0;
        res.render('admin/finance', {
            title: '财务统计',
            user: req.session.user,
            stats: {
                totalUsers: totalUsers.count || 0,
                totalBalance: totalBalance.total || 0,
                totalDeposits: totalDeposits.total || 0,
                totalWithdrawals: totalWithdrawals.total || 0,
                totalTrades: total,
                totalProfit: totalProfit.total || 0,
                totalLoss: totalLoss.total || 0,
                winRate: winRate
            }
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

// ===== 收益统计 =====
const earningStats = async (req, res) => {
    try {
        const totalTradeFee = await db.get('SELECT SUM(profit) as total FROM trades WHERE profit > 0');
        const totalWithdrawFee = await db.get('SELECT SUM(amount * 0.005) as total FROM withdrawals WHERE status = "completed"');
        
        const today = new Date().toISOString().slice(0,10);
        const todayTrades = await db.get(`
            SELECT SUM(profit) as total FROM trades 
            WHERE profit > 0 AND date(created_at) = date(?)
        `, [today]);
        
        const dailyEarnings = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0,10);
            const dayData = await db.get(`
                SELECT SUM(profit) as total FROM trades 
                WHERE profit > 0 AND date(created_at) = date(?)
            `, [dateStr]);
            dailyEarnings.push({
                date: dateStr,
                amount: dayData.total || 0
            });
        }

        res.render('admin/earnings', {
            title: '收益统计',
            user: req.session.user,
            stats: {
                totalTradeFee: totalTradeFee.total || 0,
                totalWithdrawFee: totalWithdrawFee.total || 0,
                totalEarning: (totalTradeFee.total || 0) + (totalWithdrawFee.total || 0),
                todayEarning: todayTrades.total || 0,
                dailyEarnings: dailyEarnings
            }
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

// ===== 用户资产排行 =====
const userRanking = async (req, res) => {
    try {
        const users = await db.all(`
            SELECT id, username, email, balance, status, created_at 
            FROM users 
            WHERE is_admin = 0 
            ORDER BY balance DESC 
            LIMIT 100
        `);
        res.render('admin/ranking', {
            title: '用户资产排行',
            user: req.session.user,
            users: users
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

// ===== 系统监控 =====
const systemMonitor = async (req, res) => {
    try {
        const onlineUsers = await db.get(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM logs 
            WHERE action = 'login' AND created_at > datetime('now', '-5 minutes')
        `);
        
        const todayRequests = await db.get(`
            SELECT COUNT(*) as count 
            FROM logs 
            WHERE date(created_at) = date('now')
        `);
        
        const os = require('os');
        const cpuUsage = os.loadavg()[0];
        const totalMem = os.totalmem() / 1024 / 1024 / 1024;
        const freeMem = os.freemem() / 1024 / 1024 / 1024;
        const memUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
        const usedMem = (totalMem - freeMem).toFixed(2);
        
        const requestTrend = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0,10);
            const count = await db.get(`
                SELECT COUNT(*) as count FROM logs 
                WHERE date(created_at) = date(?)
            `, [dateStr]);
            requestTrend.push({
                date: dateStr,
                count: count.count || 0
            });
        }

        res.render('admin/monitor', {
            title: '系统监控',
            user: req.session.user,
            stats: {
                onlineUsers: onlineUsers.count || 0,
                todayRequests: todayRequests.count || 0,
                cpuUsage: cpuUsage.toFixed(2),
                memUsage: memUsage,
                totalMem: totalMem.toFixed(2),
                freeMem: freeMem.toFixed(2),
                usedMem: usedMem,
                requestTrend: requestTrend
            }
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

// ===== 前台反馈管理 =====
const feedbackList = async (req, res) => {
    try {
        const feedbacks = await db.all(`
            SELECT f.*, u.username 
            FROM feedbacks f 
            JOIN users u ON f.user_id = u.id 
            ORDER BY f.created_at DESC
        `);
        res.render('admin/feedbacks', {
            title: '用户反馈',
            user: req.session.user,
            feedbacks: feedbacks
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const replyFeedback = async (req, res) => {
    const { id, reply } = req.body;
    try {
        await db.run(
            'UPDATE feedbacks SET reply = ?, status = "replied", replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [reply, id]
        );
        await db.run(
            'INSERT INTO logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)',
            [req.session.user.id, 'reply_feedback', '回复反馈 ID:' + id, req.ip]
        );
        res.json({ success: true, message: '回复成功' });
    } catch (error) {
        res.json({ success: false, message: '回复失败' });
    }
};

const closeFeedback = async (req, res) => {
    const { id } = req.body;
    try {
        await db.run('UPDATE feedbacks SET status = "closed", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        res.json({ success: true, message: '已关闭' });
    } catch (error) {
        res.json({ success: false, message: '关闭失败' });
    }
};

// ===== 批量操作 =====
const batchOperation = async (req, res) => {
    const { action, user_ids, value } = req.body;
    try {
        let ids = user_ids;
        if (typeof ids === 'string') {
            ids = ids.split(',').map(Number);
        }
        if (!ids || ids.length === 0) {
            return res.json({ success: false, message: '请选择至少一个用户' });
        }

        let result = 0;
        const placeholders = ids.map(() => '?').join(',');
        
        if (action === 'freeze') {
            await db.run(`UPDATE users SET status = 0 WHERE id IN (${placeholders})`, ids);
            result = ids.length;
        } else if (action === 'unfreeze') {
            await db.run(`UPDATE users SET status = 1 WHERE id IN (${placeholders})`, ids);
            result = ids.length;
        } else if (action === 'delete') {
            await db.run(`DELETE FROM users WHERE id IN (${placeholders}) AND is_admin = 0`, ids);
            result = ids.length;
        } else if (action === 'add_balance') {
            const amount = parseFloat(value) || 0;
            for (const id of ids) {
                await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, id]);
            }
            result = ids.length;
        } else {
            return res.json({ success: false, message: '无效的操作类型' });
        }

        await db.run(
            'INSERT INTO logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)',
            [req.session.user.id, 'batch_operation', '批量操作: ' + action + ', 影响 ' + result + ' 个用户', req.ip]
        );

        res.json({ success: true, message: '批量操作成功，影响 ' + result + ' 个用户' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '操作失败：' + error.message });
    }
};

// ===== 通知管理 =====
const notificationList = async (req, res) => {
    try {
        const notifications = await db.all(`
            SELECT n.*, u.username 
            FROM notifications n 
            LEFT JOIN users u ON n.user_id = u.id 
            ORDER BY n.created_at DESC
        `);
        res.render('admin/notifications', {
            title: '通知管理',
            user: req.session.user,
            notifications: notifications || []
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const sendNotification = async (req, res) => {
    const { user_id, title, content, type } = req.body;
    try {
        await db.run(
            'INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, ?)',
            [user_id || null, title, content, type || 'info']
        );
        res.json({ success: true, message: '通知发送成功' });
    } catch (error) {
        res.json({ success: false, message: '发送失败：' + error.message });
    }
};

const deleteNotification = async (req, res) => {
    const { id } = req.body;
    try {
        await db.run('DELETE FROM notifications WHERE id = ?', [id]);
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        res.json({ success: false, message: '删除失败' });
    }
};

// ===== 邀请系统 =====
const inviteList = async (req, res) => {
    try {
        const invites = await db.all(`
            SELECT i.*, u.username as inviter, u2.username as invited 
            FROM invites i 
            JOIN users u ON i.user_id = u.id 
            LEFT JOIN users u2 ON i.invited_user_id = u2.id 
            ORDER BY i.created_at DESC
        `);
        const stats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(reward) as total_reward
            FROM invites
        `);
        res.render('admin/invite', {
            title: '邀请管理',
            user: req.session.user,
            invites: invites || [],
            stats: stats || { total: 0, completed: 0, total_reward: 0 }
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const updateInviteStatus = async (req, res) => {
    const { id, status } = req.body;
    try {
        await db.run('UPDATE invites SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        res.json({ success: false, message: '更新失败' });
    }
};

// ===== 工单系统 =====
const ticketList = async (req, res) => {
    try {
        const tickets = await db.all(`
            SELECT t.*, u.username 
            FROM tickets t 
            JOIN users u ON t.user_id = u.id 
            ORDER BY t.created_at DESC
        `);
        res.render('admin/tickets', {
            title: '工单管理',
            user: req.session.user,
            tickets: tickets || []
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const replyTicket = async (req, res) => {
    const { id, reply } = req.body;
    try {
        await db.run(
            'UPDATE tickets SET reply = ?, status = "replied", replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [reply, id]
        );
        res.json({ success: true, message: '回复成功' });
    } catch (error) {
        res.json({ success: false, message: '回复失败' });
    }
};

const closeTicket = async (req, res) => {
    const { id } = req.body;
    try {
        await db.run('UPDATE tickets SET status = "closed", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        res.json({ success: true, message: '工单已关闭' });
    } catch (error) {
        res.json({ success: false, message: '关闭失败' });
    }
};

// ===== 风控管理 =====
const riskControlList = async (req, res) => {
    try {
        const rules = await db.all('SELECT * FROM risk_rules ORDER BY created_at DESC');
        res.render('admin/risk-control', {
            title: '风控管理',
            user: req.session.user,
            rules: rules || []
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const addRiskRule = async (req, res) => {
    const { name, type, value, action } = req.body;
    try {
        await db.run(
            'INSERT INTO risk_rules (name, type, value, action) VALUES (?, ?, ?, ?)',
            [name, type, value, action || 'alert']
        );
        res.json({ success: true, message: '规则添加成功' });
    } catch (error) {
        res.json({ success: false, message: '添加失败' });
    }
};

const deleteRiskRule = async (req, res) => {
    const { id } = req.body;
    try {
        await db.run('DELETE FROM risk_rules WHERE id = ?', [id]);
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        res.json({ success: false, message: '删除失败' });
    }
};

// ===== 数据备份 =====
const backupList = async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const backupDir = path.join(__dirname, '../backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
        const files = fs.readdirSync(backupDir);
        const backups = files.map(function(f) {
            const stats = fs.statSync(path.join(backupDir, f));
            return { name: f, size: (stats.size / 1024).toFixed(2), date: stats.mtime };
        }).sort(function(a, b) { return b.date - a.date; });
        res.render('admin/backup', {
            title: '数据备份',
            user: req.session.user,
            backups: backups || []
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const createBackup = async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const backupDir = path.join(__dirname, '../backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, 'backup-' + timestamp + '.sqlite');
        fs.copyFileSync(path.join(__dirname, '../database.sqlite'), backupFile);
        res.json({ success: true, message: '备份创建成功' });
    } catch (error) {
        res.json({ success: false, message: '备份失败' });
    }
};

const restoreBackup = async (req, res) => {
    const { filename } = req.body;
    try {
        const fs = require('fs');
        const path = require('path');
        const backupFile = path.join(__dirname, '../backups', filename);
        if (!fs.existsSync(backupFile)) {
            return res.json({ success: false, message: '备份文件不存在' });
        }
        fs.copyFileSync(backupFile, path.join(__dirname, '../database.sqlite'));
        res.json({ success: true, message: '备份恢复成功，请重启服务器' });
    } catch (error) {
        res.json({ success: false, message: '恢复失败：' + error.message });
    }
};

const deleteBackup = async (req, res) => {
    const { filename } = req.body;
    try {
        const fs = require('fs');
        const path = require('path');
        fs.unlinkSync(path.join(__dirname, '../backups', filename));
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        res.json({ success: false, message: '删除失败' });
    }
};

// ===== API管理 =====
const apiList = async (req, res) => {
    try {
        const apis = await db.all(`
            SELECT a.*, u.username 
            FROM api_keys a 
            JOIN users u ON a.user_id = u.id 
            ORDER BY a.created_at DESC
        `);
        res.render('admin/api', {
            title: 'API管理',
            user: req.session.user,
            apis: apis || []
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const createApiKey = async (req, res) => {
    const { user_id, permissions } = req.body;
    try {
        const crypto = require('crypto');
        const api_key = 'crypto_' + crypto.randomBytes(16).toString('hex');
        const api_secret = crypto.randomBytes(24).toString('hex');
        await db.run(
            'INSERT INTO api_keys (user_id, api_key, api_secret, permissions) VALUES (?, ?, ?, ?)',
            [user_id, api_key, api_secret, permissions || 'read']
        );
        res.json({ 
            success: true, 
            message: 'API密钥创建成功',
            api_key: api_key,
            api_secret: api_secret
        });
    } catch (error) {
        res.json({ success: false, message: '创建失败：' + error.message });
    }
};

const deleteApiKey = async (req, res) => {
    const { id } = req.body;
    try {
        await db.run('DELETE FROM api_keys WHERE id = ?', [id]);
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        res.json({ success: false, message: '删除失败' });
    }
};

// ===== 登录日志 =====
const loginLogList = async (req, res) => {
    try {
        const logs = await db.all(`
            SELECT l.*, u.username 
            FROM login_logs l 
            LEFT JOIN users u ON l.user_id = u.id 
            ORDER BY l.created_at DESC 
            LIMIT 200
        `);
        res.render('admin/login-logs', {
            title: '登录日志',
            user: req.session.user,
            logs: logs || []
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

// ===== 导出报表 =====
const exportReport = async (req, res) => {
    const { type } = req.query;
    try {
        let data = [];
        let filename = '';
        let headers = [];
        
        if (type === 'users') {
            data = await db.all('SELECT id, username, email, balance, status, created_at FROM users ORDER BY id DESC');
            filename = 'users_report_' + new Date().toISOString().slice(0,10) + '.csv';
            headers = ['id', 'username', 'email', 'balance', 'status', 'created_at'];
        } else if (type === 'trades') {
            data = await db.all(`
                SELECT t.id, t.user_id, u.username, t.type, t.symbol, t.price, t.amount, t.total, t.result, t.profit, t.created_at 
                FROM trades t 
                JOIN users u ON t.user_id = u.id 
                ORDER BY t.created_at DESC
            `);
            filename = 'trades_report_' + new Date().toISOString().slice(0,10) + '.csv';
            headers = ['id', 'user_id', 'username', 'type', 'symbol', 'price', 'amount', 'total', 'result', 'profit', 'created_at'];
        } else if (type === 'deposits') {
            data = await db.all(`
                SELECT d.id, d.user_id, u.username, d.amount, d.method, d.status, d.created_at 
                FROM deposits d 
                JOIN users u ON d.user_id = u.id 
                ORDER BY d.created_at DESC
            `);
            filename = 'deposits_report_' + new Date().toISOString().slice(0,10) + '.csv';
            headers = ['id', 'user_id', 'username', 'amount', 'method', 'status', 'created_at'];
        } else if (type === 'withdrawals') {
            data = await db.all(`
                SELECT w.id, w.user_id, u.username, w.amount, w.address, w.status, w.created_at 
                FROM withdrawals w 
                JOIN users u ON w.user_id = u.id 
                ORDER BY w.created_at DESC
            `);
            filename = 'withdrawals_report_' + new Date().toISOString().slice(0,10) + '.csv';
            headers = ['id', 'user_id', 'username', 'amount', 'address', 'status', 'created_at'];
        } else {
            return res.json({ success: false, message: '无效的报表类型，请使用: users, trades, deposits, withdrawals' });
        }

        if (!data || data.length === 0) {
            return res.json({ success: false, message: '没有数据可导出' });
        }

        let csv = headers.join(',') + '\n';
        data.forEach(function(row) {
            const values = headers.map(function(h) {
                let val = row[h] !== undefined && row[h] !== null ? row[h] : '';
                if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                    val = '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            csv += values.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(filename));
        res.send(csv);

    } catch (error) {
        console.error('导出错误:', error);
        res.json({ success: false, message: '导出失败：' + error.message });
    }
};

// ===== 系统设置 =====
const settingsPage = async (req, res) => {
    try {
        const settings = await db.all('SELECT * FROM settings');
        const settingsObj = {};
        settings.forEach(function(s) {
            settingsObj[s.key] = s.value;
        });
        res.render('admin/settings', {
            title: '系统设置',
            user: req.session.user,
            settings: settingsObj
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

const updateSettings = async (req, res) => {
    const settings = req.body;
    try {
        for (const [key, value] of Object.entries(settings)) {
            await db.run(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
                [value, key]
            );
        }
        res.json({ success: true, message: '设置保存成功' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: '设置保存失败' });
    }
};

const changeAdminPassword = async (req, res) => {
    const { old_password, new_password } = req.body;
    const userId = req.session.user.id;
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

// ===== 操作日志 =====
const logList = async (req, res) => {
    try {
        const logs = await db.all(`
            SELECT l.*, u.username 
            FROM logs l 
            LEFT JOIN users u ON l.user_id = u.id 
            ORDER BY l.created_at DESC 
            LIMIT 100
        `);
        res.render('admin/logs', {
            title: '操作日志',
            user: req.session.user,
            logs: logs
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/dashboard');
    }
};

// ===== 导出所有函数 =====
module.exports = {
    adminLogin: adminLogin,
    adminLogout: adminLogout,
    dashboard: dashboard,
    userList: userList,
    updateUserStatus: updateUserStatus,
    deleteUser: deleteUser,
    addUser: addUser,
    updateUserBalance: updateUserBalance,
    depositList: depositList,
    updateDepositStatus: updateDepositStatus,
    withdrawalList: withdrawalList,
    updateWithdrawalStatus: updateWithdrawalStatus,
    tradeList: tradeList,
    updateTradeResult: updateTradeResult,
    batchUpdateTradeResult: batchUpdateTradeResult,
    unlockUser: unlockUser,
    announcementList: announcementList,
    addAnnouncement: addAnnouncement,
    updateAnnouncement: updateAnnouncement,
    deleteAnnouncement: deleteAnnouncement,
    financeStats: financeStats,
    earningStats: earningStats,
    userRanking: userRanking,
    systemMonitor: systemMonitor,
    feedbackList: feedbackList,
    replyFeedback: replyFeedback,
    closeFeedback: closeFeedback,
    batchOperation: batchOperation,
    notificationList: notificationList,
    sendNotification: sendNotification,
    deleteNotification: deleteNotification,
    inviteList: inviteList,
    updateInviteStatus: updateInviteStatus,
    ticketList: ticketList,
    replyTicket: replyTicket,
    closeTicket: closeTicket,
    riskControlList: riskControlList,
    addRiskRule: addRiskRule,
    deleteRiskRule: deleteRiskRule,
    backupList: backupList,
    createBackup: createBackup,
    restoreBackup: restoreBackup,
    deleteBackup: deleteBackup,
    apiList: apiList,
    createApiKey: createApiKey,
    deleteApiKey: deleteApiKey,
    loginLogList: loginLogList,
    exportReport: exportReport,
    settingsPage: settingsPage,
    updateSettings: updateSettings,
    changeAdminPassword: changeAdminPassword,
    logList: logList
};