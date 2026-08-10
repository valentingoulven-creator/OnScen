@echo off
chcp 65001 >nul 2>&1
title OnScen msdev (exe)
echo ========================================
echo   OnScen msdev (release)
echo ========================================
echo.
echo   URL : https://localhost:4080
echo   Compte demo : listener@msdev.local / msdev123
echo   http://localhost:4080 est indisponible si le serveur est en HTTPS seul.
echo.
cd /d "%~dp0"

netstat -ano | findstr /C:":4080" | findstr /I "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [INFO] Port 4080 deja utilise.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\resolve-msdev-url.ps1" -Open
  echo.
  echo Appuyez sur une touche pour fermer cette fenetre...
  pause >nul
  exit /b 0
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Lancer-msdev.ps1"
if errorlevel 1 (
  echo.
  echo [ERREUR] Echec du lancement. Lisez DEBLOCAGE-WINDOWS.txt dans ce dossier.
  echo Alternative : msdev\Lancer-msdev-node.bat ^(Node.js^)
  echo.
  echo Appuyez sur une touche pour fermer cette fenetre...
  pause >nul
  exit /b 1
)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\resolve-msdev-url.ps1"
echo msdev.exe tourne en arriere-plan.
echo.
echo Appuyez sur une touche pour fermer cette fenetre...
pause >nul
exit /b 0
