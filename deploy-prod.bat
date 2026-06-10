@echo off
REM Deploiement PRODUCTION Soundy -> getsoundy.com
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-prod.ps1" %*
if errorlevel 1 (
  echo.
  echo [ERREUR] Deploy prod echoue.
  pause
  exit /b 1
)
pause
