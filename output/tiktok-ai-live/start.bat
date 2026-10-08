@echo off
rem TikTok AI character live - local test launcher (nothing is published to TikTok)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js is not installed. Install the LTS version from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing packages...
  call npm install
)
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8787/control.html"
node server.js %*
pause
