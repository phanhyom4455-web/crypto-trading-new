@echo off
echo 正在创建剩余页面...

REM 支付渠道
echo. > views\admin\payment-channels.ejs
echo 正在创建 payment-channels.ejs...

REM 风控管理
echo. > views\admin\risk-control.ejs
echo 正在创建 risk-control.ejs...

REM 登录日志
echo. > views\admin\login-logs.ejs
echo 正在创建 login-logs.ejs...

REM 数据备份
echo. > views\admin\backup.ejs
echo 正在创建 backup.ejs...

REM 权限管理
echo. > views\admin\permissions.ejs
echo 正在创建 permissions.ejs...

REM 工单管理
echo. > views\admin\tickets.ejs
echo 正在创建 tickets.ejs...

REM 用户反馈
echo. > views\admin\feedbacks.ejs
echo 正在创建 feedbacks.ejs...

REM API管理
echo. > views\admin\api.ejs
echo 正在创建 api.ejs...

REM 系统监控
echo. > views\admin\monitor.ejs
echo 正在创建 monitor.ejs...

REM 系统设置
echo. > views\admin\settings.ejs
echo 正在创建 settings.ejs...

REM 操作日志
echo. > views\admin\logs.ejs
echo 正在创建 logs.ejs...

REM 定时任务
echo. > views\admin\cron.ejs
echo 正在创建 cron.ejs...

REM 多语言管理
echo. > views\admin\languages.ejs
echo 正在创建 languages.ejs...

REM App管理
echo. > views\admin\app-manage.ejs
echo 正在创建 app-manage.ejs...

echo 所有页面创建完成！
pause