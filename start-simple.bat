@echo off
echo ========================================
echo Starting BotMarket (Simple Version)
echo ========================================
echo.

echo Step 1: Starting Docker containers...
docker compose up -d
if %errorlevel% neq 0 (
    echo ERROR: Docker failed to start. Make sure Docker Desktop is running!
    pause
    exit /b 1
)
echo Docker containers started!
echo.

echo Step 2: Waiting for database to be ready...
timeout /t 5 /nobreak >nul
echo.

echo Step 3: Starting API server...
echo API will run on: http://localhost:3001
echo Keep this window open for the API!
echo.
start "BotMarket API" cmd /k "cd /d %~dp0apps\api && pnpm dev"

timeout /t 5 /nobreak >nul

echo Step 4: Starting Frontend...
echo Frontend will run on: http://localhost:3000
echo.
start "BotMarket Frontend" cmd /k "cd /d %~dp0apps\web && pnpm dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo Services Started!
echo ========================================
echo.
echo Two new windows opened:
echo - BotMarket API (port 3001)
echo - BotMarket Frontend (port 3000)
echo.
echo Open http://localhost:3000 in your browser
echo.
echo Close those windows to stop the services
echo.
pause

