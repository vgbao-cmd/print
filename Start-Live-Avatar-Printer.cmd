@echo off
setlocal
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
set VITE_DEV_SERVER_URL=
if exist "release\win-unpacked\Live Avatar Printer.exe" (
  start "" "release\win-unpacked\Live Avatar Printer.exe"
  exit /b 0
)
for /d %%D in ("%~dp0.tools\node-*-win-x64") do set "PATH=%%~fD;%PATH%"
if not exist "dist-electron\main.cjs" (
  echo Build the app first. See README.md.
  pause
  exit /b 1
)
call npm.cmd start
if errorlevel 1 pause
