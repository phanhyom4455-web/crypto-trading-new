const mod = require('./controllers/adminController.js');
console.log('adminLogin 类型:', typeof mod.adminLogin);
console.log('adminLogin 函数:', mod.adminLogin);
console.log('所有导出:', Object.keys(mod));