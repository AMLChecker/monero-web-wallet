@echo off
setlocal enabledelayedexpansion
title Monero Web Wallet
cd /d "%~dp0"

REM ===================================================================
REM  Monero Web Wallet - Windows launcher
REM
REM  Checks the official Monero binaries, installs npm dependencies
REM  when needed, builds the app, then starts:
REM    * monero-wallet-rpc.exe  (127.0.0.1 only, RPC login enabled)
REM    * the local backend      (127.0.0.1 only)
REM    * the wallet UI in your browser
REM
REM  Usage:
REM    Start.bat             build if needed, serve the wallet, open it
REM    Start.bat --rebuild   force a rebuild of backend and frontend
REM    Start.bat --dev       run the Vite dev server on port 5173 instead
REM ===================================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "RPC_PORT=18083"
set "BACKEND_PORT=18082"
set "FRONTEND_PORT=5173"
set "RPC_USER=monero-wallet"

REM Local node is preferred; if none is running and node-address.txt is
REM missing, this node is used as a fallback so the wallet still works.
REM Set MONERO_DAEMON_ADDRESS or edit node-address.txt to change it.
set "FALLBACK_NODE=xmr-node.cakewallet.com:18081"

set "WALLET_DIR=%ROOT%"
if exist "%ROOT%\wallets\*.keys" set "WALLET_DIR=%ROOT%\wallets"

set "REBUILD=0"
set "DEVMODE=0"
:parseargs
if "%~1"=="" goto :argsdone
if /i "%~1"=="--rebuild" set "REBUILD=1"
if /i "%~1"=="--dev" set "DEVMODE=1"
shift
goto :parseargs
:argsdone

echo ==========================================================
echo   Monero Web Wallet
echo ==========================================================
echo.

REM ---------------------------------------------------------------
REM 1. checks
REM ---------------------------------------------------------------
REM Node.js and the Monero binaries are prepared automatically: whatever is missing
REM is fetched from nodejs.org / getmonero.org and checked against the published
REM checksums before anything is unpacked. Nothing is executed before that check.
if not exist "%ROOT%\scripts\ensure-deps.ps1" (
  echo [Error] scripts\ensure-deps.ps1 is missing - unpack the release archive again.
  goto :fail
)
echo [Setup] Checking the prerequisites (Node.js, Monero binaries)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\ensure-deps.ps1" -Root "%ROOT%"
if errorlevel 1 (
  echo [Error] The prerequisites could not be prepared automatically.
  echo         Check the internet connection, or install Node.js 18+ from https://nodejs.org
  echo         and put the Monero binaries from https://www.getmonero.org/downloads/ next to Start.bat.
  goto :fail
)

REM A portable Node.js copy lives in .run\node-dir.txt when one had to be installed.
if exist "%ROOT%\.run\node-dir.txt" (
  for /f "usebackq delims=" %%p in ("%ROOT%\.run\node-dir.txt") do set "NODE_DIR=%%p"
  if defined NODE_DIR set "PATH=!NODE_DIR!;!PATH!"
)

where node >nul 2>nul
if errorlevel 1 (
  echo [Error] Node.js is still not available.
  echo         Install Node.js 18 or newer from https://nodejs.org and run Start.bat again.
  goto :fail
)
if not exist "%ROOT%\monero-wallet-rpc.exe" (
  echo [Error] monero-wallet-rpc.exe was not found in:
  echo         %ROOT%
  echo         Windows Defender sometimes quarantines the official Monero binaries:
  echo         check Windows Security - Protection history, restore the file and add
  echo         this folder to Exclusions. This wallet never mines anything.
  goto :fail
)
echo [Check] monero-wallet-rpc.exe found
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VERSION=%%v"
echo [Check] Node.js !NODE_VERSION! found

call :portstate %RPC_PORT%
if not "!PORT_STATE!"=="free" (
  echo [Error] Port %RPC_PORT% is already in use - another monero-wallet-rpc is running.
  echo         Close it with Stop.bat or the Task Manager and run Start.bat again.
  goto :fail
)
call :portstate %BACKEND_PORT%
if not "!PORT_STATE!"=="free" (
  echo [Error] Port %BACKEND_PORT% is already in use - the backend is probably already running.
  echo         Close it with Stop.bat and run Start.bat again.
  goto :fail
)
echo [Check] Ports %RPC_PORT% and %BACKEND_PORT% are free

REM ---------------------------------------------------------------
REM 2. dependencies
REM ---------------------------------------------------------------
if not exist "%ROOT%\backend\node_modules" (
  echo [Setup] Installing backend dependencies - this can take a minute...
  pushd "%ROOT%\backend"
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    popd
    echo [Error] npm install failed in the backend folder.
    goto :fail
  )
  popd
)
REM The frontend packages are only needed to build the UI. A release ships a prebuilt
REM frontend\dist which the backend serves, so npm is not touched at all in that case.
set "NEED_FRONTEND_DEPS=0"
if not exist "%ROOT%\frontend\dist\index.html" set "NEED_FRONTEND_DEPS=1"
if "%REBUILD%"=="1" set "NEED_FRONTEND_DEPS=1"
if "%DEVMODE%"=="1" set "NEED_FRONTEND_DEPS=1"
if "!NEED_FRONTEND_DEPS!"=="1" (
  echo [Setup] Installing frontend dependencies - this can take a minute...
  pushd "%ROOT%\frontend"
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    popd
    echo [Error] npm install failed in the frontend folder.
    goto :fail
  )
  popd
)
echo [Check] npm dependencies are installed

set "BUILD_BACKEND=0"
set "BUILD_FRONTEND=0"
if "%REBUILD%"=="1" (
  set "BUILD_BACKEND=1"
  set "BUILD_FRONTEND=1"
)
if not exist "%ROOT%\backend\dist\server.js" set "BUILD_BACKEND=1"
if not exist "%ROOT%\frontend\dist\index.html" set "BUILD_FRONTEND=1"
if "%DEVMODE%"=="1" set "BUILD_FRONTEND=0"

if "%BUILD_BACKEND%"=="1" (
  echo [Setup] Building the backend...
  pushd "%ROOT%\backend"
  call npm run build
  if errorlevel 1 (
    popd
    echo [Error] The backend build failed. Fix the TypeScript errors above and retry.
    goto :fail
  )
  popd
)
if "%BUILD_FRONTEND%"=="1" (
  echo [Setup] Building the wallet UI...
  pushd "%ROOT%\frontend"
  call npm run build
  if errorlevel 1 (
    popd
    echo [Error] The frontend build failed. Fix the TypeScript errors above and retry.
    goto :fail
  )
  popd
)

REM ---------------------------------------------------------------
REM 3. environment for the wallet RPC and the backend
REM ---------------------------------------------------------------
for /f "delims=" %%p in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"') do set "RPC_PASS=%%p"
set "MONERO_RPC_LOGIN=%RPC_USER%:%RPC_PASS%"
> "%ROOT%\.rpc-credentials" echo %MONERO_RPC_LOGIN%
set "MONERO_RPC_URL=http://127.0.0.1:%RPC_PORT%/json_rpc"
set "MONERO_WALLET_DIR=%WALLET_DIR%"
set "PORT=%BACKEND_PORT%"

set "NODE_ADDRESS="
set "NODE_SOURCE="
if defined MONERO_DAEMON_ADDRESS (
  set "NODE_ADDRESS=%MONERO_DAEMON_ADDRESS%"
  set "NODE_SOURCE=MONERO_DAEMON_ADDRESS"
) else (
  call :detectlocal
)
if not defined NODE_ADDRESS (
  call :readnode
)
if not defined NODE_ADDRESS (
  set "NODE_ADDRESS=%FALLBACK_NODE%"
  set "NODE_SOURCE=fallback"
  REM Values set inside this block need delayed expansion.
  > "%ROOT%\node-address.txt" echo !NODE_ADDRESS!
)
set "MONERO_DAEMON_ADDRESS=%NODE_ADDRESS%"

if "!NODE_SOURCE!"=="fallback" (
  echo [Warn] No local monerod was detected and node-address.txt does not exist.
  echo        Using the public node !NODE_ADDRESS!.
  echo        For maximum privacy run your own monerod.exe and set
  echo        MONERO_DAEMON_ADDRESS=127.0.0.1:18081 before starting.
)
echo [Check] Daemon address: !NODE_ADDRESS!
echo [Check] Wallet directory: %WALLET_DIR%

echo !NODE_ADDRESS! | findstr /I /C:"127.0.0.1" /C:"localhost" >nul
if errorlevel 1 (
  echo [Info] This is a remote node, so it sees your wallet traffic.
  echo        For maximum privacy run monerod.exe locally and set
  echo        MONERO_DAEMON_ADDRESS=127.0.0.1:18081.
)

if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"
if not exist "%ROOT%\.run" mkdir "%ROOT%\.run"

REM ---------------------------------------------------------------
REM 4. monero-wallet-rpc (bound to loopback, RPC login required)
REM ---------------------------------------------------------------
echo [Monero] Starting Wallet RPC...
for /f "delims=" %%p in ('powershell -NoProfile -Command "$p = Start-Process -FilePath '%ROOT%\monero-wallet-rpc.exe' -ArgumentList @('--wallet-dir','%WALLET_DIR%','--rpc-bind-ip','127.0.0.1','--rpc-bind-port','%RPC_PORT%','--rpc-login','%MONERO_RPC_LOGIN%','--daemon-address','%NODE_ADDRESS%','--non-interactive','--log-level','1','--log-file','%ROOT%\logs\wallet-rpc.log','--max-log-file-size','10485000','--max-log-files','5') -WorkingDirectory '%ROOT%' -WindowStyle Hidden -PassThru; $p.Id"') do set "RPC_PID=%%p"
if not defined RPC_PID (
  echo [Error] monero-wallet-rpc.exe could not be started.
  goto :fail
)
> "%ROOT%\.run\wallet-rpc.pid" echo %RPC_PID%

call :waitport %RPC_PORT% 45
if not "!PORT_STATE!"=="up" (
  echo [Error] Wallet RPC did not start listening on 127.0.0.1:%RPC_PORT%.
  echo         See logs\wallet-rpc.log for details.
  call :stopall
  goto :fail
)
echo [Check] Wallet RPC listening on 127.0.0.1:%RPC_PORT%

REM ---------------------------------------------------------------
REM 5. backend
REM ---------------------------------------------------------------
echo [Backend] Starting...
REM No -RedirectStandardOutput here: PowerShell would block until the child exits.
REM The backend writes logs\backend.log and .run\backend.pid itself.
for /f "delims=" %%p in ('powershell -NoProfile -Command "$p = Start-Process -FilePath 'node' -ArgumentList @('dist/server.js') -WorkingDirectory '%ROOT%\backend' -WindowStyle Hidden -PassThru; $p.Id"') do set "BACKEND_PID=%%p"
if not defined BACKEND_PID (
  echo [Error] The backend could not be started.
  call :stopall
  goto :fail
)
> "%ROOT%\.run\backend.pid" echo %BACKEND_PID%

call :waithealth 45
if not "!HEALTH!"=="ok" (
  echo [Error] The backend did not answer on http://127.0.0.1:%BACKEND_PORT%/api/health
  echo         See logs\backend.log for details.
  call :stopall
  goto :fail
)
echo [Check] Backend ready on 127.0.0.1:%BACKEND_PORT%

REM ---------------------------------------------------------------
REM 6. frontend
REM ---------------------------------------------------------------
if "%DEVMODE%"=="1" (
  echo [Frontend] Starting the Vite dev server...
  start "Monero Wallet Dev Server" /min /d "%ROOT%\frontend" cmd /c "npm run dev"
  call :waitport %FRONTEND_PORT% 45
  set "UI_URL=http://127.0.0.1:%FRONTEND_PORT%/#/welcome"
) else (
  echo [Frontend] Starting...
  echo [Frontend] The built wallet UI is served by the local backend.
  set "UI_URL=http://127.0.0.1:%BACKEND_PORT%/#/welcome"
)
echo [Frontend] UI available at !UI_URL!

start "" "!UI_URL!"

echo.
echo [Wallet] Ready
echo ----------------------------------------------------------
echo   Wallet UI      !UI_URL!
echo   Wallet RPC     127.0.0.1:%RPC_PORT%  (login enabled, loopback only)
echo   Backend API    127.0.0.1:%BACKEND_PORT%
echo   Daemon         !NODE_ADDRESS!
echo   Wallet files   %WALLET_DIR%
echo   Logs           %ROOT%\logs
echo ----------------------------------------------------------
echo   Processes stay running in the background.
echo   Press any key to stop the wallet and close the services...
echo.
pause >nul

call :stopall
echo [Wallet] Stopped.
exit /b 0

REM ===================================================================
REM  helpers
REM ===================================================================

:readnode
if not exist "%ROOT%\node-address.txt" exit /b 0
for /f "usebackq delims=" %%a in ("%ROOT%\node-address.txt") do (
  if not "%%a"=="" (
    set "NODE_ADDRESS=%%a"
    set "NODE_SOURCE=node-address.txt"
    exit /b 0
  )
)
exit /b 0

:detectlocal
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:18081/get_height'; if ($r.StatusCode -eq 200) { exit 0 } } catch { }; exit 1" >nul 2>nul
if not errorlevel 1 (
  set "NODE_ADDRESS=127.0.0.1:18081"
  set "NODE_SOURCE=local monerod"
)
exit /b 0

:portstate
set "PORT_STATE=unknown"
for /f "delims=" %%r in ('powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue) { 'busy' } else { 'free' }"') do set "PORT_STATE=%%r"
exit /b 0

:waitport
set "PORT_STATE=down"
set /a WAIT_TRIES=0
:waitportloop
set /a WAIT_TRIES+=1
call :portstate %~1
if "!PORT_STATE!"=="busy" (
  set "PORT_STATE=up"
  exit /b 0
)
if !WAIT_TRIES! GEQ %~2 exit /b 0
ping -n 2 127.0.0.1 >nul
goto :waitportloop

:waithealth
set "HEALTH=down"
set /a HEALTH_TRIES=0
:waithealthloop
set /a HEALTH_TRIES+=1
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:%BACKEND_PORT%/api/health'; if ($r.StatusCode -eq 200) { exit 0 } } catch { }; exit 1" >nul 2>nul
if not errorlevel 1 (
  set "HEALTH=ok"
  exit /b 0
)
if !HEALTH_TRIES! GEQ %~1 exit /b 0
ping -n 2 127.0.0.1 >nul
goto :waithealthloop

:stopall
call :killpid "%ROOT%\.run\backend.pid"
call :killpid "%ROOT%\.run\frontend.pid"
call :killpid "%ROOT%\.run\wallet-rpc.pid"
taskkill /IM npm.cmd /F >nul 2>nul
exit /b 0

:killpid
if not exist %~1 exit /b 0
set "STOP_PID="
for /f "usebackq delims=" %%p in ("%~1") do set "STOP_PID=%%p"
if defined STOP_PID taskkill /PID !STOP_PID! /T /F >nul 2>nul
del /q %~1 >nul 2>nul
exit /b 0

:fail
echo.
echo Startup failed. Nothing was left running.
echo.
pause
exit /b 1
