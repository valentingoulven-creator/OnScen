@echo off
chcp 65001 >nul 2>&1
title MeloSong

cd /d "%~dp0..\..\.."

echo.
echo  ==========================================
echo    MeloSong  -  Lancer localement (HTTP)
echo  ==========================================
echo    URL    : http://localhost:4080
echo    Compte : listener@msdev.local / msdev123
echo  ==========================================
echo.

:: 1. Node.js requis
where node >nul 2>&1
if errorlevel 1 (
  echo  [ERREUR] Node.js 18+ est requis.
  echo    Telechargez : https://nodejs.org
  echo.
  pause
  exit /b 1
)

:: 2. Serveur deja actif - ouvrir directement
netstat -ano | findstr /C:":4080" | findstr /I "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo  [INFO] Serveur deja actif sur le port 4080.
  echo  Ouverture du navigateur ^(HTTP ou HTTPS selon le serveur^)...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\resolve-msdev-url.ps1" -Open
  echo.
  echo  Appuyez sur une touche pour fermer cette fenetre...
  pause >nul
  exit /b 0
)

:: 3. Forcer mode HTTP (ignore MSDEV_HTTPS=1 du fichier commun/msdev/.env)
set MSDEV_HTTPS=0

:: 3b. Fichier backend manquant (doublon iCloud � msdevLanConfig 2.ts �)
if not exist "commun\backend\src\lib\msdevLanConfig.ts" (
  if exist "commun\backend\src\lib\msdevLanConfig 2.ts" (
    echo  [INFO] Restauration de msdevLanConfig.ts ^(copie iCloud^)...
    copy /y "commun\backend\src\lib\msdevLanConfig 2.ts" "commun\backend\src\lib\msdevLanConfig.ts" >nul
  )
)

:: 4. Ouvrir le navigateur des que le port 4080 repond (HTTP, pas https si MSDEV_HTTPS=0)
start /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i-lt 45;$i++){Start-Sleep 1;try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',4080);$c.Close();Start-Process 'http://localhost:4080';break}catch{}}"

echo  Demarrage du serveur... (le navigateur s'ouvrira automatiquement)
echo  Fermez cette fenetre pour arreter MeloSong.
echo.

:: 5. Serveur en avant-plan (logs visibles, fenetre reste ouverte tant que le serveur tourne)
npm run msdev:server
set ERR=%ERRORLEVEL%

echo.
if not "%ERR%"=="0" (
  echo  [ERREUR] Le serveur s'est arrete ^(code %ERR%^).
  echo.
  echo  Solutions courantes :
  echo    - Port 4080 occupe  : double-clic server.exe (redemarrage) ou fermez les autres fenetres
  echo    - Modules manquants : npm install  ^(dans ce dossier^)
  echo    - Voir les logs ci-dessus pour le detail
) else (
  echo  Serveur arrete.
)
echo.
pause
