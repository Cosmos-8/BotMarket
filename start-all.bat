@echo off
echo ========================================
echo Starting BotMarket (All Services)
echo ========================================
echo.

echo Step 1: Checking environment files...
if not exist "apps\api\.env" (
    echo Creating apps\api\.env file...
    (
        echo DATABASE_URL="postgresql://postgres:postgres@localhost:5432/botmarket"
        echo REDIS_URL="redis://localhost:6379"
        echo BASE_RPC_URL="https://sepolia.base.org"
        echo BASE_CHAIN_ID=84532
        echo SIWE_DOMAIN="localhost"
        echo SIWE_ORIGIN="http://localhost:3001"
        echo BOT_KEY_ENCRYPTION_SECRET="botmarket-dev-secret-key-change-in-production-12345"
        echo PORT=3001
        echo NODE_ENV=development
    ) > "apps\api\.env"
    echo Created apps\api\.env
)

if not exist "apps\web\.env.local" (
    echo Creating apps\web\.env.local file...
    (
        echo NEXT_PUBLIC_API_URL=http://localhost:3001
        echo NEXT_PUBLIC_BASE_CHAIN_ID=84532
    ) > "apps\web\.env.local"
    echo Created apps\web\.env.local
)
echo Environment files ready!
echo.

echo Step 2: Starting Docker containers...
docker compose up -d
if %errorlevel% neq 0 (
    echo ERROR: Docker failed to start. Make sure Docker Desktop is running!
    pause
    exit /b 1
)
echo Docker containers started!
echo.

echo Step 3: Waiting for database to be ready...
timeout /t 5 /nobreak >nul
echo.

echo Step 4: Running database migrations...
cd /d "%~dp0apps\api"
call pnpm db:migrate
if %errorlevel% neq 0 (
    echo WARNING: Migration failed. Database might not be ready yet.
    echo You can run this manually later: cd apps\api ^&^& pnpm db:migrate
)
cd /d "%~dp0"
echo.

echo Step 5: Starting API server...
echo API will run on: http://localhost:3001
echo.
start "BotMarket API" cmd /k "cd /d %~dp0apps\api && pnpm dev"

timeout /t 5 /nobreak >nul

echo Step 6: Starting Frontend...
echo Frontend will run on: http://localhost:3000
echo.
start "BotMarket Frontend" cmd /k "cd /d %~dp0apps\web && pnpm dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo Services Started!
echo ========================================
echo.
echo Two windows opened:
echo - BotMarket API (port 3001)
echo - BotMarket Frontend (port 3000)
echo.
echo Open http://localhost:3000 in your browser
echo.
echo Close those windows to stop the services
echo.
pause

