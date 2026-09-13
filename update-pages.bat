@echo off
echo 正在更新页面文件...

REM 备份旧文件
copy views\admin\dashboard.ejs views\admin\dashboard.ejs.bak 2>nul
copy views\admin\users.ejs views\admin\users.ejs.bak 2>nul

echo ✅ 已备份旧文件
echo.
echo 请手动将以下文件内容替换为最新版本：
echo 1. views\admin\dashboard.ejs（带图表版本）
echo 2. views\admin\users.ejs（带搜索/分页/导出版本）
echo.
echo 更新完成后重启服务器：node app.js
pause