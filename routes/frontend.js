const express = require('express');
const router = express.Router();
const controller = require('../controllers/frontendController');
const { isAuthenticated, checkUserStatus } = require('../middleware/auth');

// 公开路由
router.get('/', controller.home);
router.get('/login', controller.loginPage);
router.post('/login', controller.login);
router.get('/register', controller.registerPage);
router.post('/register', controller.register);
router.get('/logout', controller.logout);

// 需要登录的路由
router.use(isAuthenticated);
router.use(checkUserStatus);

router.get('/dashboard', controller.dashboard);
router.get('/trade', controller.trade);
router.post('/trade/order', controller.placeOrder);
router.get('/deposit', controller.depositPage);
router.post('/deposit', controller.deposit);
router.get('/withdraw', controller.withdrawPage);
router.post('/withdraw', controller.withdraw);
router.get('/deposit-records', controller.depositRecords);
router.get('/withdraw-records', controller.withdrawRecords);
router.get('/settings', controller.settingsPage);
router.post('/settings/password', controller.changePassword);
router.post('/settings/trade-password', controller.changeTradePassword);
router.get('/contact', controller.contactPage);

module.exports = router;