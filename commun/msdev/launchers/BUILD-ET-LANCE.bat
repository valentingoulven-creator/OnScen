@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title OnScen - Build + Acces iPhone

set "ROOT=%~dp0..\..\.."
cd /d "%ROOT%"
echo  [1/5] Build du frontend (web/app/)...
echo         (minification, code splitting, PWA, vers commun/backend/public/)
echo.

cd /d "%ROOT%\web\app"
call npm run build 2>&1
if errorlevel 1 (
    echo.
    echo  [ERREUR] Le build frontend a echoue. Voir messages ci-dessus.
    echo.
    pause
    exit /b 1
)

cd /d "%ROOT%"

:: -- 2. Trouver ngrok --------------------------------------------
echo  [2/5] Recherche de ngrok...

set NGROK_EXE=
for /f "tokens=*" %%f in ('powershell -NoProfile -Command "Get-ChildItem \"$env:LOCALAPPDATA\Microsoft\WinGet\Packages\" -Recurse -Filter ngrok.exe -EA SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName" 2^>nul') do set NGROK_EXE=%%f

if not defined NGROK_EXE (
    for /f "tokens=*" %%f in ('where ngrok 2^>nul') do if not defined NGROK_EXE set NGROK_EXE=%%f
)

if not defined NGROK_EXE (
    echo  [ERREUR] ngrok introuvable.
    echo  Lancez : winget install ngrok.ngrok
    echo.
    pause
    exit /b 1
)
echo  [OK] ngrok : %NGROK_EXE%
echo.

:: -- 3. Lire le domaine ------------------------------------------
echo  [3/5] Lecture du domaine statique...

set NGROK_DOMAIN=
if exist "%~dp0..\ngrok-domain.txt" (
    for /f "usebackq tokens=*" %%d in ("%~dp0..\ngrok-domain.txt") do (
        if not defined NGROK_DOMAIN set NGROK_DOMAIN=%%d
    )
)

if not defined NGROK_DOMAIN (
    echo  [ERREUR] msdev\ngrok-domain.txt introuvable ou vide.
    echo.
    pause
    exit /b 1
)
echo  [OK] Domaine : %NGROK_DOMAIN%
echo.

:: -- 4. Serveur OnScen -----------------------------------------
echo  [4/5] Verification du serveur OnScen (port 4080)...

netstat -ano | findstr /C:":4080" | findstr /I "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo  [INFO] Serveur deja actif. Redemarrage pour charger le nouveau build...
    powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4080 -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue }"
    timeout /t 1 /nobreak >nul
)

echo  [INFO] Demarrage du serveur avec build de production...
set "_D=%ROOT%"
start "OnScen Server (Production)" /min cmd /c "cd /d ""%_D%"" && set MSDEV_HTTPS=0 && npm run msdev:server"

echo  [INFO] Attente max 45s...
powershell -NoProfile -Command "$ok=$false;for($i=0;$i-lt 45;$i++){Start-Sleep 1;try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',4080);$c.Close();$ok=$true;break}catch{Write-Host -NoNewline '.'}} ;if($ok){Write-Host ' OK'}else{Write-Host ' TIMEOUT'}"

netstat -ano | findstr /C:":4080" | findstr /I "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo  [ERREUR] Serveur non demarre. Voir fenetre "OnScen Server".
    echo.
    pause
    exit /b 1
)
echo  [OK] Serveur pret.
echo.

:: -- 5. Tunnel ngrok ---------------------------------------------
echo  [5/5] Lancement du tunnel...
echo.
echo  ============================================================
echo    URL PERMANENTE - ouvrir dans Safari sur iPhone :
echo.
echo    https://%NGROK_DOMAIN%
echo.
echo  ============================================================
echo.
echo  Build de production : compression Brotli + cache 1 an (assets hashes)
echo  Identifiants de test : listener@msdev.local / msdev123
echo.
echo  Laissez cette fenetre ouverte.
echo  Fermez-la pour couper l acces internet a OnScen.
echo.

"%NGROK_EXE%" http --domain="%NGROK_DOMAIN%" 4080

echo.
echo  [INFO] Tunnel ferme.
echo.
pause
endlocal
