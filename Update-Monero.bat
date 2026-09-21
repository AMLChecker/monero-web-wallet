@echo off
setlocal
title Monero Web Wallet - update Monero binaries
cd /d "%~dp0"

REM Updates monero-wallet-rpc / monerod / monero-wallet-cli to the current official
REM release (or to a specific version: Update-Monero.bat 0.18.5.1).
REM The download is verified against the hashes.txt published by the Monero project,
REM and the binaries that get replaced are copied to .backup\monero-<version> first.

echo ==========================================================
echo   Updating the Monero binaries
echo ==========================================================
echo.

if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update-monero.ps1" -Root "%~dp0."
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update-monero.ps1" -Root "%~dp0." -Version "%~1" -Force
)

echo.
echo Press any key to close this window...
pause >nul
exit /b %errorlevel%
