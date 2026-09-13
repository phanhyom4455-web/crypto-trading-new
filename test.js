const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
    res.send('服务器运行正常！访问 http://localhost:3000');
});

app.listen(PORT, () => {
    console.log('✅ 测试服务器启动成功！');
    console.log('📱 访问: http://localhost:' + PORT);
});