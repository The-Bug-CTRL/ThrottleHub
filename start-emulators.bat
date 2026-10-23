@echo off
cd /d "%~dp0"
if exist ".tools\node-v22.23.4-win-x64\node.exe" set "PATH=%CD%\.tools\node-v22.23.4-win-x64;%PATH%"
if exist ".tools\java\jdk-21.0.12.1+1\bin\java.exe" set "PATH=%CD%\.tools\java\jdk-21.0.12.1+1\bin;%PATH%"
set "XDG_CONFIG_HOME=%CD%\.tools\config"
set "FIREBASE_EMULATORS_PATH=%CD%\.tools\emulators"
call npm run emulators
