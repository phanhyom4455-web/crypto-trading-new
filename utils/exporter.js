const ExcelJS = require('exceljs');

class ExcelExporter {
    static async exportUsers(users) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('用户列表');

        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: '用户名', key: 'username', width: 15 },
            { header: '邮箱', key: 'email', width: 25 },
            { header: 'VIP', key: 'vip', width: 10 },
            { header: '积分', key: 'points', width: 12 },
            { header: '订单数', key: 'orders', width: 12 },
            { header: '消费金额', key: 'spent', width: 15 },
            { header: '状态', key: 'status', width: 12 },
            { header: '注册时间', key: 'created_at', width: 20 }
        ];

        users.forEach(user => {
            worksheet.addRow({
                id: user.id,
                username: user.username,
                email: user.email,
                vip: user.vip ? '是' : '否',
                points: user.points,
                orders: user.orders || 0,
                spent: user.spent || 0,
                status: user.status === 'active' ? '正常' : '禁用',
                created_at: new Date(user.created_at).toLocaleString()
            });
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F81BD' }
        };
        worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' } };

        return workbook;
    }

    static async exportTransactions(transactions) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('交易记录');

        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: '用户ID', key: 'user_id', width: 12 },
            { header: '类型', key: 'type', width: 12 },
            { header: '金额', key: 'amount', width: 15 },
            { header: '方式', key: 'method', width: 15 },
            { header: '状态', key: 'status', width: 12 },
            { header: '时间', key: 'created_at', width: 20 }
        ];

        transactions.forEach(t => {
            worksheet.addRow({
                id: t.id,
                user_id: t.user_id,
                type: t.type === 'deposit' ? '充值' : t.type === 'withdraw' ? '取款' : '交易',
                amount: t.amount,
                method: t.method,
                status: t.status === 'completed' ? '已完成' : t.status === 'pending' ? '待处理' : '失败',
                created_at: new Date(t.created_at).toLocaleString()
            });
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F81BD' }
        };
        worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' } };

        return workbook;
    }
}

module.exports = ExcelExporter;