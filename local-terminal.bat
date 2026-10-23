@echo off
cd /d "%~dp0"
set "PATH=%CD%\.tools\node-v22.23.4-win-x64;%CD%\.tools\java\jdk-21.0.12.1+1\bin;%PATH%"
set "XDG_CONFIG_HOME=%CD%\.tools\config"
set "FIREBASE_EMULATORS_PATH=%CD%\.tools\emulators"
cmd /k
