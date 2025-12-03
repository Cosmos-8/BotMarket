@echo off
echo ========================================
echo Starting BotMarket API Server
echo ========================================
echo.
echo API will run on: http://localhost:3001
echo.
echo Keep this window open!
echo Press Ctrl+C to stop
echo.
cd /d "%~dp0apps\api"
pnpm dev

