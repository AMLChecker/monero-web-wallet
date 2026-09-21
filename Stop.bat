@echo off
setlocal enabledelayedexpansion
title Monero Web Wallet - stop
cd /d "%~dp0"

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo Stopping Monero Web Wallet services...

call :killpid "%ROOT%\.run\backend.pid" "backend"
call :killpid "%ROOT%\.run\frontend.pid" "frontend"
call :killpid "%ROOT%\.run\wallet-rpc.pid" "wallet rpc"

REM Fall back to image names in case the PID files are missing.
taskkill /IM monero-wallet-rpc.exe /F >nul 2>nul
taskkill /IM npm.cmd /F >nul 2>nul
call :killport 18082 "backend"
call :killport 18083 "wallet rpc"
call :killport 5173 "dev server"
del /q "%ROOT%\.run\backend.pid" >nul 2>nul

echo.
set "STILL_UP="
for %%P in (18082 18083 5173) do (
  for /f "delims=" %%R in ('powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %%P -State Listen -ErrorAction SilentlyContinue) { 'busy' } else { 'free' }"') do (
    if "%%R"=="busy" set "STILL_UP=!STILL_UP! %%P"
  )
)
if defined STILL_UP (
  echo Still listening:!STILL_UP!
  echo If a service keeps restarting, close its window manually.
) else (
  echo All wallet services stopped. Ports 18082, 18083 and 5173 are free.
)
echo.
echo Done.
pause
exit /b 0

:killpid
if not exist %~1 exit /b 0
set "STOP_PID="
for /f "usebackq delims=" %%p in ("%~1") do set "STOP_PID=%%p"
if defined STOP_PID (
  echo   stopping %~2 ^(pid !STOP_PID!^)
  taskkill /PID !STOP_PID! /T /F >nul 2>nul
)
del /q %~1 >nul 2>nul
exit /b 0

:killport
for /f "delims=" %%p in ('powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"') do (
  echo   stopping %~2 on port %~1 ^(pid %%p^)
  taskkill /PID %%p /T /F >nul 2>nul
)
exit /b 0
