const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.serialize(() => {
    db.run("ALTER TABLE trades ADD COLUMN result TEXT DEFAULT 'pending'", (err) => {
        if (err) {
            console.log('result列:', err.message);
        } else {
            console.log('✅ result 列已添加');
        }
    });
    
    db.run("ALTER TABLE trades ADD COLUMN profit REAL DEFAULT 0", (err) => {
        if (err) {
            console.log('profit列:', err.message);
        } else {
            console.log('✅ profit 列已添加');
        }
    });
    
    db.run("ALTER TABLE trades ADD COLUMN admin_control INTEGER DEFAULT 0", (err) => {
        if (err) {
            console.log('admin_control列:', err.message);
        } else {
            console.log('✅ admin_control 列已添加');
        }
    });
});

db.close(() => {
    console.log('✅ 数据库更新完成！');
    console.log('请重新启动服务器: node app.js');
});