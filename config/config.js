module.exports = {
    // 邮箱配置（Gmail）- 使用端口587
    email: {
        host: 'smtp.gmail.com',
        port: 587,                    // ⬅️ 改成587
        secure: false,                // ⬅️ 改成false
        auth: {
            user: 'phanhyom4455@gmail.com',
            pass: 'ptoqqzkbxogwrhsa'
        },
        from: 'phanhyom4455@gmail.com'
    },
    
    sms: {
        debug: true
    },
    
    site: {
        name: '数字货币交易平台',
        url: 'http://localhost:3000'
    }
};