@echo off
chcp 65001 >nul 2>&1
title MeloSong msdev (exe)
echo ========================================
echo   MeloSong msdev (depuis msdev\)
echo ========================================
echo.
echo   URL : https://localhost:4080  (HTTPS si MSDEV_HTTPS=1)
echo   http://localhost:4080 ne fonctionne PAS en mode HTTPS seul.
echo.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Lancer-msdev.ps1"
if errorlevel 1 (
  echo.
  echo [ERREUR] Echec du lancement.
  echo   - msdev\Lancer-msdev-node.bat si vous avez Node.js
  echo   - msdev\DEBLOCAGE-WINDOWS.txt si Windows bloque l'exe
  echo   - npm run build:exe pour recompiler msdev.exe
  echo.
  echo Appuyez sur une touche pour fermer cette fenetre...
  pause >nul
  exit /b 1
)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\resolve-msdev-url.ps1"
echo msdev.exe tourne en arriere-plan.
echo.
echo Appuyez sur une touche pour fermer cette fenetre...
pause >nul
exit /b 0
