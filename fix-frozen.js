// ============================================
// 临时脚本：修复历史冻结数据
// ============================================
const sequelize = require('./config/database');
const Asset = require('./models/Asset');
const Transaction = require('./models/Transaction');

async function fixFrozen() {
    try {
        // 查找所有 failed 状态的提现
        const failedWithdrawals = await Transaction.findAll({
            where: { type: 'withdraw', status: 'failed' }
        });

        console.log('找到', failedWithdrawals.length, '条失败的提现记录');

        // 按用户+币种统计应退回的金额
        const refundMap = {};
        for (const w of failedWithdrawals) {
            const currency = w.method === 'BANK' ? 'USDT' : (w.method || 'USDT');
            const key = w.user_id + '_' + currency;
            if (!refundMap[key]) {
                refundMap[key] = { user_id: w.user_id, currency: currency, amount: 0 };
            }
            refundMap[key].amount += parseFloat(w.amount);
        }

        console.log('需要退回的汇总:');
        for (const key in refundMap) {
            const item = refundMap[key];
            console.log('  用户ID:', item.user_id, '币种:', item.currency, '金额:', item.amount);
        }

        // 执行退回：frozen -= amount, balance += amount
        for (const key in refundMap) {
            const item = refundMap[key];
            const asset = await Asset.findOne({
                where: { user_id: item.user_id, currency: item.currency }
            });

            if (asset) {
                const currentFrozen = parseFloat(asset.frozen) || 0;
                const currentBalance = parseFloat(asset.balance) || 0;

                // 只退回 frozen 里有的部分（避免减成负数）
                const refundAmount = Math.min(item.amount, currentFrozen);

                if (refundAmount > 0) {
                    await asset.update({
                        frozen: currentFrozen - refundAmount,
                        balance: currentBalance + refundAmount
                    });
                    console.log('✅ 用户', item.user_id, item.currency, '退回', refundAmount, '（冻结从', currentFrozen, '→', currentFrozen - refundAmount, '）');
                } else {
                    console.log('⚠️ 用户', item.user_id, item.currency, '冻结为0，无需退回');
                }
            } else {
                console.log('❌ 找不到资产:', item.user_id, item.currency);
            }
        }

        console.log('✅ 修复完成！');
        process.exit(0);
    } catch (e) {
        console.error('❌ 修复失败:', e);
        process.exit(1);
    }
}

fixFrozen();