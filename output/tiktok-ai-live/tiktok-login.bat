@echo off
rem Brings you to the TikTok login screen. Nothing is streamed or published.
rem 1) If TikTok LIVE Studio is installed, start it (log in with your TikTok account there).
rem 2) Otherwise open the official LIVE Studio download page and the TikTok login page in your browser.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$roots = @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)}) | Where-Object { $_ };" ^
  "$exe = Get-ChildItem -Path $roots -Filter 'TikTok LIVE Studio.exe' -Recurse -Depth 4 -ErrorAction SilentlyContinue | Select-Object -First 1;" ^
  "if ($exe) { Write-Host ('Starting ' + $exe.FullName); Start-Process $exe.FullName }" ^
  "else { Write-Host 'TikTok LIVE Studio not found. Opening the official download page and the login page.'; Start-Process 'https://www.tiktok.com/studio/download'; Start-Process 'https://www.tiktok.com/login' }"
echo.
echo Log in with your TikTok account. Do NOT press "Go LIVE" yet.
pause
