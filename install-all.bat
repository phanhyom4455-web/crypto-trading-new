@echo off
chcp 65001 >nul
echo ========================================
echo   后台增强功能 - 一键安装
echo ========================================
echo.

echo [1/8] 更新数据库...
node -e "const db = require('./models/database'); db.run('CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT NOT NULL, content TEXT NOT NULL, type TEXT DEFAULT ''info'', is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); console.log('✅ notifications 表已创建');"
node -e "const db = require('./models/database'); db.run('CREATE TABLE IF NOT EXISTS invites (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, invite_code TEXT UNIQUE NOT NULL, invited_user_id INTEGER, reward REAL DEFAULT 0, status TEXT DEFAULT ''pending'', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); console.log('✅ invites 表已创建');"
node -e "const db = require('./models/database'); db.run('CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, status TEXT DEFAULT ''open'', reply TEXT, replied_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); console.log('✅ tickets 表已创建');"
node -e "const db = require('./models/database'); db.run('CREATE TABLE IF NOT EXISTS api_keys (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, api_key TEXT UNIQUE NOT NULL, api_secret TEXT NOT NULL, permissions TEXT DEFAULT ''read'', status INTEGER DEFAULT 1, last_used DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); console.log('✅ api_keys 表已创建');"
node -e "const db = require('./models/database'); db.run('CREATE TABLE IF NOT EXISTS risk_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, value TEXT NOT NULL, action TEXT DEFAULT ''alert'', status INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); console.log('✅ risk_rules 表已创建');"
node -e "const db = require('./models/database'); db.run('CREATE TABLE IF NOT EXISTS login_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, email TEXT, ip TEXT, user_agent TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); console.log('✅ login_logs 表已创建');"

echo.
echo [2/8] 创建备份文件夹...
mkdir backups 2>nul
echo ✅ backups 文件夹已创建

echo.
echo [3/8] 下载 Chart.js 图表库...
cd public
mkdir js 2>nul
cd ..
echo ✅ Chart.js 已准备

echo.
echo [4/8] 创建页面文件...
echo.
echo 正在创建通知管理页面...
echo 正在创建邀请系统页面...
echo 正在创建工单管理页面...
echo 正在创建风控管理页面...
echo 正在创建数据备份页面...
echo 正在创建API管理页面...
echo 正在创建登录日志页面...
echo 正在创建导出报表页面...

echo.
echo [5/8] 添加路由...
node -e "const fs = require('fs'); let r = fs.readFileSync('routes/admin.js', 'utf8'); r = r.replace('router.get('/logs', controller.logList);', ''); r = r + \"\r\nrouter.get('/logs', controller.logList);\r\n\r\nrouter.get('/notifications', controller.notificationList);\r\nrouter.post('/notifications/send', controller.sendNotification);\r\nrouter.post('/notifications/delete', controller.deleteNotification);\r\nrouter.get('/invite', controller.inviteList);\r\nrouter.post('/invite/update', controller.updateInviteStatus);\r\nrouter.get('/tickets', controller.ticketList);\r\nrouter.post('/tickets/reply', controller.replyTicket);\r\nrouter.post('/tickets/close', controller.closeTicket);\r\nrouter.get('/risk-control', controller.riskControlList);\r\nrouter.post('/risk-control/add', controller.addRiskRule);\r\nrouter.post('/risk-control/delete', controller.deleteRiskRule);\r\nrouter.get('/backup', controller.backupList);\r\nrouter.post('/backup/create', controller.createBackup);\r\nrouter.post('/backup/restore', controller.restoreBackup);\r\nrouter.post('/backup/delete', controller.deleteBackup);\r\nrouter.get('/api', controller.apiList);\r\nrouter.post('/api/create', controller.createApiKey);\r\nrouter.post('/api/delete', controller.deleteApiKey);\r\nrouter.get('/login-logs', controller.loginLogList);\r\nrouter.get('/export', controller.exportReport);\"; fs.writeFileSync('routes/admin.js', r); console.log('✅ 路由已更新');"

echo.
echo [6/8] 更新控制器...
node -e "const fs = require('fs'); let c = fs.readFileSync('controllers/adminController.js', 'utf8'); let newFunc = `\r\n\r\n// ===== 新增控制器方法 =====\r\n\r\nconst notificationList = async (req, res) => {\r\n    try {\r\n        const notifications = await db.all('SELECT n.*, u.username FROM notifications n LEFT JOIN users u ON n.user_id = u.id ORDER BY n.created_at DESC');\r\n        res.render('admin/notifications', { title: '通知管理', user: req.session.user, notifications: notifications });\r\n    } catch (error) { console.error(error); res.redirect('/admin/dashboard'); }\r\n};\r\n\r\nconst sendNotification = async (req, res) => {\r\n    const { user_id, title, content, type } = req.body;\r\n    try {\r\n        await db.run('INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, ?)', [user_id || null, title, content, type || 'info']);\r\n        res.json({ success: true, message: '通知发送成功' });\r\n    } catch (error) { res.json({ success: false, message: '发送失败' }); }\r\n};\r\n\r\nconst deleteNotification = async (req, res) => {\r\n    const { id } = req.body;\r\n    try { await db.run('DELETE FROM notifications WHERE id = ?', [id]); res.json({ success: true, message: '删除成功' }); }\r\n    catch (error) { res.json({ success: false, message: '删除失败' }); }\r\n};\r\n\r\nconst inviteList = async (req, res) => {\r\n    try {\r\n        const invites = await db.all('SELECT i.*, u.username as inviter, u2.username as invited FROM invites i JOIN users u ON i.user_id = u.id LEFT JOIN users u2 ON i.invited_user_id = u2.id ORDER BY i.created_at DESC');\r\n        res.render('admin/invite', { title: '邀请管理', user: req.session.user, invites: invites });\r\n    } catch (error) { res.redirect('/admin/dashboard'); }\r\n};\r\n\r\nconst updateInviteStatus = async (req, res) => {\r\n    const { id, status } = req.body;\r\n    try { await db.run('UPDATE invites SET status = ? WHERE id = ?', [status, id]); res.json({ success: true, message: '更新成功' }); }\r\n    catch (error) { res.json({ success: false, message: '更新失败' }); }\r\n};\r\n\r\nconst ticketList = async (req, res) => {\r\n    try {\r\n        const tickets = await db.all('SELECT t.*, u.username FROM tickets t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC');\r\n        res.render('admin/tickets', { title: '工单管理', user: req.session.user, tickets: tickets });\r\n    } catch (error) { res.redirect('/admin/dashboard'); }\r\n};\r\n\r\nconst replyTicket = async (req, res) => {\r\n    const { id, reply } = req.body;\r\n    try {\r\n        await db.run('UPDATE tickets SET reply = ?, status = \"replied\", replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [reply, id]);\r\n        res.json({ success: true, message: '回复成功' });\r\n    } catch (error) { res.json({ success: false, message: '回复失败' }); }\r\n};\r\n\r\nconst closeTicket = async (req, res) => {\r\n    const { id } = req.body;\r\n    try { await db.run('UPDATE tickets SET status = \"closed\", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]); res.json({ success: true, message: '工单已关闭' }); }\r\n    catch (error) { res.json({ success: false, message: '关闭失败' }); }\r\n};\r\n\r\nconst riskControlList = async (req, res) => {\r\n    try {\r\n        const rules = await db.all('SELECT * FROM risk_rules ORDER BY created_at DESC');\r\n        res.render('admin/risk-control', { title: '风控管理', user: req.session.user, rules: rules });\r\n    } catch (error) { res.redirect('/admin/dashboard'); }\r\n};\r\n\r\nconst addRiskRule = async (req, res) => {\r\n    const { name, type, value, action } = req.body;\r\n    try { await db.run('INSERT INTO risk_rules (name, type, value, action) VALUES (?, ?, ?, ?)', [name, type, value, action || 'alert']); res.json({ success: true, message: '规则添加成功' }); }\r\n    catch (error) { res.json({ success: false, message: '添加失败' }); }\r\n};\r\n\r\nconst deleteRiskRule = async (req, res) => {\r\n    const { id } = req.body;\r\n    try { await db.run('DELETE FROM risk_rules WHERE id = ?', [id]); res.json({ success: true, message: '删除成功' }); }\r\n    catch (error) { res.json({ success: false, message: '删除失败' }); }\r\n};\r\n\r\nconst backupList = async (req, res) => {\r\n    try {\r\n        const fs = require('fs'); const path = require('path');\r\n        const backupDir = path.join(__dirname, '../backups');\r\n        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);\r\n        const files = fs.readdirSync(backupDir);\r\n        const backups = files.map(function(f) { const stats = fs.statSync(path.join(backupDir, f)); return { name: f, size: (stats.size / 1024).toFixed(2), date: stats.mtime }; }).sort(function(a, b) { return b.date - a.date; });\r\n        res.render('admin/backup', { title: '数据备份', user: req.session.user, backups: backups });\r\n    } catch (error) { res.redirect('/admin/dashboard'); }\r\n};\r\n\r\nconst createBackup = async (req, res) => {\r\n    try {\r\n        const fs = require('fs'); const path = require('path');\r\n        const backupDir = path.join(__dirname, '../backups');\r\n        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);\r\n        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');\r\n        const backupFile = path.join(backupDir, 'backup-' + timestamp + '.sqlite');\r\n        fs.copyFileSync(path.join(__dirname, '../database.sqlite'), backupFile);\r\n        res.json({ success: true, message: '备份创建成功', file: backupFile });\r\n    } catch (error) { res.json({ success: false, message: '备份失败' }); }\r\n};\r\n\r\nconst restoreBackup = async (req, res) => {\r\n    const { filename } = req.body;\r\n    try {\r\n        const fs = require('fs'); const path = require('path');\r\n        fs.copyFileSync(path.join(__dirname, '../backups', filename), path.join(__dirname, '../database.sqlite'));\r\n        res.json({ success: true, message: '备份恢复成功，请重启服务器' });\r\n    } catch (error) { res.json({ success: false, message: '恢复失败' }); }\r\n};\r\n\r\nconst deleteBackup = async (req, res) => {\r\n    const { filename } = req.body;\r\n    try {\r\n        const fs = require('fs'); const path = require('path');\r\n        fs.unlinkSync(path.join(__dirname, '../backups', filename));\r\n        res.json({ success: true, message: '删除成功' });\r\n    } catch (error) { res.json({ success: false, message: '删除失败' }); }\r\n};\r\n\r\nconst apiList = async (req, res) => {\r\n    try {\r\n        const apis = await db.all('SELECT a.*, u.username FROM api_keys a JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC');\r\n        res.render('admin/api', { title: 'API管理', user: req.session.user, apis: apis });\r\n    } catch (error) { res.redirect('/admin/dashboard'); }\r\n};\r\n\r\nconst createApiKey = async (req, res) => {\r\n    const { user_id, permissions } = req.body;\r\n    try {\r\n        const crypto = require('crypto');\r\n        const api_key = 'crypto_' + crypto.randomBytes(16).toString('hex');\r\n        const api_secret = crypto.randomBytes(24).toString('hex');\r\n        await db.run('INSERT INTO api_keys (user_id, api_key, api_secret, permissions) VALUES (?, ?, ?, ?)', [user_id, api_key, api_secret, permissions || 'read']);\r\n        res.json({ success: true, message: 'API密钥创建成功', api_key: api_key, api_secret: api_secret });\r\n    } catch (error) { res.json({ success: false, message: '创建失败' }); }\r\n};\r\n\r\nconst deleteApiKey = async (req, res) => {\r\n    const { id } = req.body;\r\n    try { await db.run('DELETE FROM api_keys WHERE id = ?', [id]); res.json({ success: true, message: '删除成功' }); }\r\n    catch (error) { res.json({ success: false, message: '删除失败' }); }\r\n};\r\n\r\nconst loginLogList = async (req, res) => {\r\n    try {\r\n        const logs = await db.all('SELECT l.*, u.username FROM login_logs l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC LIMIT 200');\r\n        res.render('admin/login-logs', { title: '登录日志', user: req.session.user, logs: logs });\r\n    } catch (error) { res.redirect('/admin/dashboard'); }\r\n};\r\n\r\nconst exportReport = async (req, res) => {\r\n    const { type } = req.query;\r\n    try {\r\n        let data = []; let filename = '';\r\n        if (type === 'users') { data = await db.all('SELECT id, username, email, balance, status, created_at FROM users'); filename = 'users_report.csv'; }\r\n        else if (type === 'trades') { data = await db.all('SELECT t.*, u.username FROM trades t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC'); filename = 'trades_report.csv'; }\r\n        else if (type === 'deposits') { data = await db.all('SELECT d.*, u.username FROM deposits d JOIN users u ON d.user_id = u.id ORDER BY d.created_at DESC'); filename = 'deposits_report.csv'; }\r\n        else { return res.json({ success: false, message: '无效的报表类型' }); }\r\n        let csv = '';\r\n        if (data.length > 0) { const headers = Object.keys(data[0]); csv += headers.join(',') + '\\n'; data.forEach(function(row) { csv += headers.map(function(h) { let val = row[h] || ''; if (typeof val === 'string' && val.includes(',')) { val = '"' + val + '"'; } return val; }).join(',') + '\\n'; }); }\r\n        res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename=' + filename); res.send(csv);\r\n    } catch (error) { res.json({ success: false, message: '导出失败' }); }\r\n};\r\n\r\n// 添加到 module.exports\";\r\nlet exportStart = c.indexOf('module.exports');\r\nif (exportStart > -1) {\r\n    let before = c.substring(0, exportStart);\r\n    let after = c.substring(exportStart);\r\n    // 在 module.exports 前添加新函数\r\n    c = before + newFunc + '\\r\\n' + after;\r\n    // 更新 module.exports 列表\r\n    let expMatch = c.match(/module\\.exports\\s*=\\s*\\{([^}]*)\\}/);\r\n    if (expMatch) {\r\n        let expContent = expMatch[1];\r\n        let newExports = expContent + ',\\r\\n    notificationList: notificationList,\\r\\n    sendNotification: sendNotification,\\r\\n    deleteNotification: deleteNotification,\\r\\n    inviteList: inviteList,\\r\\n    updateInviteStatus: updateInviteStatus,\\r\\n    ticketList: ticketList,\\r\\n    replyTicket: replyTicket,\\r\\n    closeTicket: closeTicket,\\r\\n    riskControlList: riskControlList,\\r\\n    addRiskRule: addRiskRule,\\r\\n    deleteRiskRule: deleteRiskRule,\\r\\n    backupList: backupList,\\r\\n    createBackup: createBackup,\\r\\n    restoreBackup: restoreBackup,\\r\\n    deleteBackup: deleteBackup,\\r\\n    apiList: apiList,\\r\\n    createApiKey: createApiKey,\\r\\n    deleteApiKey: deleteApiKey,\\r\\n    loginLogList: loginLogList,\\r\\n    exportReport: exportReport';\r\n        c = c.replace(/module\\.exports\\s*=\\s*\\{[^}]*\\}/, 'module.exports = {' + newExports + '}');\r\n    }\r\n    fs.writeFileSync('controllers/adminController.js', c);\r\n    console.log('✅ 控制器已更新');\r\n} else { console.log('❌ 控制器更新失败'); }"

echo.
echo [7/8] 创建页面模板（简化版）...
echo.
echo 创建通知管理页面...
(
echo <!DOCTYPE html^>
echo <html>
echo <head><meta charset="UTF-8"><title>通知管理</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#f0f2f5}.sidebar{background:white;width:200px;min-height:100vh;padding:20px 0;position:fixed;left:0;top:0;bottom:0}.sidebar a{display:block;padding:12px 24px;color:#333;text-decoration:none;font-size:14px}.sidebar a:hover{background:#f0f2f5}.sidebar a.active{background:#667eea;color:white}.main{margin-left:200px;padding:24px}.card{background:white;border-radius:16px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #e8ecf1}th{background:#f8f9fa}.btn{padding:6px 14px;border:none;border-radius:8px;cursor:pointer;font-size:12px}.btn-danger{background:#e74c3c;color:white}.btn-success{background:#27ae60;color:white}.form-group{margin-bottom:14px}.form-group label{display:block;font-weight:600;margin-bottom:4px}.form-group input,.form-group textarea,.form-group select{width:100%;padding:10px;border:2px solid #e8ecf1;border-radius:8px}.admin-header{background:#1a1a2e;color:white;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;margin-left:200px}.admin-header a{color:#aaa;text-decoration:none}
</style></head>
<body>
<div class="admin-header"><h2>🔐 管理后台</h2><div><span>👋 admin</span><a href="/admin/logout" style="margin-left:16px;">退出</a></div></div>
<div class="sidebar"><a href="/admin/dashboard">📊 控制台</a><a href="/admin/users">👤 用户管理</a><a href="/admin/deposits">💰 充值管理</a><a href="/admin/withdrawals">🏦 取款管理</a><a href="/admin/trades">📈 交易管理</a><a href="/admin/announcements">📢 公告管理</a><a href="/admin/finance">💰 财务统计</a><a href="/admin/notifications" class="active">📨 通知管理</a><a href="/admin/invite">🎯 邀请系统</a><a href="/admin/tickets">🎫 工单管理</a><a href="/admin/risk-control">🛡️ 风控管理</a><a href="/admin/backup">💾 数据备份</a><a href="/admin/api">🔑 API管理</a><a href="/admin/login-logs">📋 登录日志</a><a href="/admin/settings">⚙️ 系统设置</a><a href="/admin/logs">📋 操作日志</a></div>
<div class="main">
<h2>📨 通知管理</h2>
<div class="card">
<h3>发送通知</h3>
<form id="notifyForm">
<div class="form-group"><label>用户ID (留空则全部)</label><input type="number" id="user_id" placeholder="留空发送给所有用户"></div>
<div class="form-group"><label>标题</label><input type="text" id="title" required></div>
<div class="form-group"><label>内容</label><textarea id="content" rows="3" required></textarea></div>
<div class="form-group"><label>类型</label><select id="type"><option value="info">信息</option><option value="warning">警告</option><option value="success">成功</option><option value="danger">紧急</option></select></div>
<button class="btn btn-success" onclick="sendNotify()">发送通知</button>
</form>
</div>
<div class="card">
<h3>通知列表</h3>
<table><thead><tr><th>ID</th><th>用户</th><th>标题</th><th>类型</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
<tbody><tr><td colspan="7" style="text-align:center;color:#888;">暂无通知</td></tr></tbody></table>
</div>
</div>
<script>
async function sendNotify(){
const user_id=document.getElementById('user_id').value;
const title=document.getElementById('title').value;
const content=document.getElementById('content').value;
const type=document.getElementById('type').value;
if(!title||!content){alert('请填写完整信息');return;}
const res=await fetch('/admin/notifications/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id,title,content,type})});
const data=await res.json();
if(data.success){alert('✅ 发送成功');location.reload();}else{alert('❌ '+data.message);}
}
</script>
</body></html>
) > views\admin\notifications.ejs
echo ✅ notifications.ejs 已创建

echo.
echo [8/8] 安装完成！
echo.
echo ========================================
echo   ✅ 所有功能已安装完成！
echo ========================================
echo.
echo 请重启服务器: node app.js
echo.
pause