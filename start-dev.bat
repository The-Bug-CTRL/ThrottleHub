@echo off
cd /d "%~dp0"
if exist ".tools\node-v22.23.4-win-x64\node.exe" set "PATH=%CD%\.tools\node-v22.23.4-win-x64;%PATH%"
if not exist node_modules call npm install
call npm run dev
