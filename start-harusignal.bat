@echo off
rem HaruSignal: one-click start for Windows (local AI + web)
cd /d "%~dp0"
title HaruSignal web server
where node >nul 2>nul || (echo Node.js is not installed. Install Node.js 24 from https://nodejs.org and try again. & pause & exit /b 1)
if not exist "node_modules\expo-notifications" (
  echo [1/4] Installing packages...
  call npm.cmd ci || goto fail
)
if not exist ".local-ai\qwen2.5-1.5b-instruct-q4_k_m.gguf" (
  echo [2/4] Downloading local AI model, about 1.1GB. This happens only once...
  call npm.cmd run ai:setup:windows || goto fail
)
echo [3/4] Starting local AI in a new window. Keep that window open.
start "HaruSignal AI" cmd /k npm.cmd run ai:serve:windows
echo [4/4] Building web app...
call npm.cmd run build:web || goto fail
start "" cmd /c "timeout /t 4 >nul & start http://127.0.0.1:8081/"
echo.
echo Open http://127.0.0.1:8081/  -  close this window to stop the app.
call npm.cmd run serve:web
goto end
:fail
echo.
echo Something went wrong. Check the messages above, or see TEAM_SETUP.md.
pause
:end
