@echo off
cd /d "%~dp0"
set "PATH=%CD%\.tools\node-v22.23.4-win-x64;%PATH%"
call npm run test:integration
