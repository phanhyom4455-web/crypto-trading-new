@echo off
chcp 65001 >nul
echo ========================================
echo   修复依赖
echo ========================================
echo.

echo 1. 设置镜像源...
npm config set registry https://registry.npmmirror.com

echo.
echo 2. 安装所有依赖...
npm install express ejs express-session body-parser morgan cors compression helmet mysql2 sequelize exceljs xlsx echarts socket.io bcrypt

echo.
echo 3. 启动服务器...
node app.js

pause