@echo off
REM Deploiement PRODUCTION Soundy -> getsoundy.com
set "ROOT=%~dp0..\..\.."
cd /d "%ROOT%"
powershell -ExecutionPolicy Bypass -File "%ROOT%\commun\scripts\deploy-prod.ps1" %*
if errorlevel 1 (
  echo.
  echo [ERREUR] Deploy prod echoue.
  pause
  exit /b 1
)
pause
