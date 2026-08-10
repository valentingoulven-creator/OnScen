@echo off
chcp 65001 >nul 2>&1
title OnScen msdev (Node.js)
cd /d "%~dp0\.."

echo ========================================
echo   OnScen msdev - Node.js
echo ========================================
echo.
echo   URL : https://localhost:4080  (si MSDEV_HTTPS=1 dans msdev\.env)
echo   Compte demo : listener@msdev.local / msdev123
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Node.js 18+ requis : https://nodejs.org
  echo.
  echo Sans Node : double-cliquez msdev\release\Lancer-msdev.bat
  echo              ou msdev\Lancer-OnScen.bat
  echo.
  goto erreur
)

if not exist "package.json" (
  echo [ERREUR] package.json introuvable. Lancez depuis le dossier OnScen Dev.
  goto erreur
)

netstat -ano | findstr /C:":4080" | findstr /I "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [INFO] Port 4080 deja utilise.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\resolve-msdev-url.ps1" -Open
  echo.
  echo Appuyez sur une touche pour fermer cette fenetre...
  pause >nul
  exit /b 0
)

set MSDEV_NPM=msdev:server
set MSDEV_URL=http://localhost:4080
findstr /R /C:"^MSDEV_HTTPS=1" "msdev\.env" >nul 2>&1
if not errorlevel 1 (
  set MSDEV_NPM=msdev:https
  set MSDEV_URL=https://localhost:4080
)

echo Demarrage du serveur ^(npm run %MSDEV_NPM%^)...
echo Ouvrez : %MSDEV_URL%
echo Fermez cette fenetre pour arreter OnScen.
echo.

:: Ouvre le navigateur seulement quand le port 4080 repond (evite "Cette page ne fonctionne pas")
start /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i-lt 45;$i++){Start-Sleep 1;try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',4080);$c.Close();Start-Process '%MSDEV_URL%';break}catch{}}"

call npm run %MSDEV_NPM%
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo [ERREUR] Le serveur s'est arrete ^(code %EXITCODE%^).
  netstat -ano | findstr /C:":4080" | findstr /I "LISTENING" >nul 2>&1
  if not errorlevel 1 (
    echo Port 4080 occupe - essayez https://localhost:4080 dans le navigateur.
  )
  goto erreur
)
goto fin

:erreur
echo.
echo Appuyez sur une touche pour fermer cette fenetre...
pause >nul
exit /b 1

:fin
echo.
echo Serveur arrete.
echo Appuyez sur une touche pour fermer cette fenetre...
pause >nul
exit /b 0
