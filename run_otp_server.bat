@echo off
title LostLink AI — Campus OTP Server
echo ===================================================
echo   Starting LostLink AI Campus OTP Verification Server...
echo ===================================================
cd /d "%~dp0otp-server"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
echo Starting server on http://localhost:5000...
node server.js
pause
