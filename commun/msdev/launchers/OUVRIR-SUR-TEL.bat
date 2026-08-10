@echo off
chcp 65001 >nul 2>&1
setlocal
title OnScen — Ouvrir sur telephone

set "ROOT=%~dp0..\..\.."
cd /d "%ROOT%"

echo.
echo  ============================================================
echo    OnScen Mobile — build + serveur LAN + URL telephone
echo    iPhone : ajouter a l'ecran d'accueil ^(PWA standalone^)
echo    Android : Smartphone\TOUT-INSTALLER.bat pour l'APK
echo  ============================================================
echo.

echo  [1/3] Synchronisation IP LAN...
call npm run msdev:sync-lan
if errorlevel 1 (
    echo  [ERREUR] sync-lan a echoue.
    pause
    exit /b 1
)

echo.
echo  [2/3] Build mobile optimise (apptel)...
call npm run mobile:build
if errorlevel 1 (
    echo  [ERREUR] Build mobile a echoue.
    pause
    exit /b 1
)

echo.
echo  [3/3] Demarrage serveur + affichage URL...
powershell -ExecutionPolicy Bypass -File "%~dp0..\scripts\serve-mobile-tel.ps1"

echo.
pause
endlocal
