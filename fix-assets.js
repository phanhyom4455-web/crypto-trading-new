const sequelize = require('./config/database');
const Asset = require('./models/Asset');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功');

        // 找出所有用户的资产
        const allAssets = await Asset.findAll();
        console.log(`共 ${allAssets.length} 条资产记录`);

        // 按 user_id + currency 分组
        const grouped = {};
        for (const a of allAssets) {
            const key = a.user_id + '_' + a.currency;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(a);
        }

        let deleted = 0;

        for (const key in grouped) {
            const list = grouped[key];
            if (list.length <= 1) continue;   // 没重复，跳过

            // 按余额从高到低排序
            list.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

            // 保留第一条（余额最高），删除其他
            const keep = list[0];
            const toDelete = list.slice(1);

            console.log(`用户 ${keep.user_id} 的 ${keep.currency}: 保留余额 ${keep.balance}，删除 ${toDelete.length} 条重复`);

            for (const a of toDelete) {
                await a.destroy();
                deleted++;
            }
        }

        console.log(`✅ 清理完成，共删除 ${deleted} 条重复资产`);
        process.exit(0);
    } catch (e) {
        console.error('❌ 出错:', e.message);
        process.exit(1);
    }
})();