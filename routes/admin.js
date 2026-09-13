const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// 后台登录
router.get('/', (req, res) => {
    if (req.session.user && req.session.user.is_admin === 1) {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', { title: '后台登录', error: null });
});
router.post('/login', controller.adminLogin);
router.get('/logout', controller.adminLogout);

// 后台管理路由（需要管理员权限）
router.use(isAuthenticated);
router.use(isAdmin);

// ===== 核心功能 =====
router.get('/dashboard', controller.dashboard);
router.get('/users', controller.userList);
router.post('/users/status', controller.updateUserStatus);
router.post('/users/delete', controller.deleteUser);
router.post('/users/unlock', controller.unlockUser);
router.post('/users/add', controller.addUser);
router.post('/users/balance', controller.updateUserBalance);
router.post('/users/batch', controller.batchOperation);
router.get('/deposits', controller.depositList);
router.post('/deposits/status', controller.updateDepositStatus);
router.get('/withdrawals', controller.withdrawalList);
router.post('/withdrawals/status', controller.updateWithdrawalStatus);
router.get('/trades', controller.tradeList);
router.post('/trades/result', controller.updateTradeResult);
router.post('/trades/batch-result', controller.batchUpdateTradeResult);

// ===== 内容管理 =====
router.get('/announcements', controller.announcementList);
router.post('/announcements/add', controller.addAnnouncement);
router.post('/announcements/update', controller.updateAnnouncement);
router.post('/announcements/delete', controller.deleteAnnouncement);
router.get('/notifications', controller.notificationList);
router.post('/notifications/send', controller.sendNotification);
router.post('/notifications/delete', controller.deleteNotification);

// ===== 数据统计 =====
router.get('/finance', controller.financeStats);
router.get('/earnings', controller.earningStats);
router.get('/ranking', controller.userRanking);
router.get('/export', controller.exportReport);

// ===== 安全与风控 =====
router.get('/risk-control', controller.riskControlList);
router.post('/risk-control/add', controller.addRiskRule);
router.post('/risk-control/delete', controller.deleteRiskRule);
router.get('/login-logs', controller.loginLogList);
router.get('/backup', controller.backupList);
router.post('/backup/create', controller.createBackup);
router.post('/backup/restore', controller.restoreBackup);
router.post('/backup/delete', controller.deleteBackup);

// ===== 客服支持 =====
router.get('/tickets', controller.ticketList);
router.post('/tickets/reply', controller.replyTicket);
router.post('/tickets/close', controller.closeTicket);
router.get('/feedbacks', controller.feedbackList);
router.post('/feedbacks/reply', controller.replyFeedback);
router.post('/feedbacks/close', controller.closeFeedback);

// ===== 系统管理 =====
router.get('/api', controller.apiList);
router.post('/api/create', controller.createApiKey);
router.post('/api/delete', controller.deleteApiKey);
router.get('/monitor', controller.systemMonitor);
router.get('/settings', controller.settingsPage);
router.post('/settings', controller.updateSettings);
router.post('/settings/password', controller.changeAdminPassword);
router.get('/logs', controller.logList);

module.exports = router;