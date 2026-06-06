@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title MeloSong - Acces iPhone

cd /d "%~dp0"

echo.
echo  ============================================================
echo    MeloSong - Acces depuis partout (iPhone / Internet)
echo  ============================================================
echo.

:: -- 1. Trouver ngrok ------------------------------------------
echo  [1/4] Recherche de ngrok...

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

:: -- 2. Lire le domaine ----------------------------------------
echo  [2/4] Lecture du domaine statique...

set NGROK_DOMAIN=
if exist "%~dp0msdev\ngrok-domain.txt" (
    for /f "usebackq tokens=*" %%d in ("%~dp0msdev\ngrok-domain.txt") do (
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

:: -- 3. Serveur MeloSong ---------------------------------------
echo  [3/4] Verification du serveur MeloSong (port 4080)...

netstat -ano | findstr /C:":4080" | findstr /I "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo  [OK] Serveur deja actif.
) else (
    echo  [INFO] Demarrage du serveur...
    set "_D=%~dp0"
    start "MeloSong Server" /min cmd /c "cd /d ""%_D%"" && set MSDEV_HTTPS=0 && npm run msdev:server"
    echo  [INFO] Attente max 45s...
    powershell -NoProfile -Command "$ok=$false;for($i=0;$i-lt 45;$i++){Start-Sleep 1;try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',4080);$c.Close();$ok=$true;break}catch{Write-Host -NoNewline '.'}} ;if($ok){Write-Host ' OK'}else{Write-Host ' TIMEOUT'}"
    netstat -ano | findstr /C:":4080" | findstr /I "LISTENING" >nul 2>&1
    if errorlevel 1 (
        echo  [ERREUR] Serveur non demarre. Voir fenetre MeloSong Server.
        echo.
        pause
        exit /b 1
    )
    echo  [OK] Serveur pret.
)
echo.

:: -- 4. Tunnel ngrok -------------------------------------------
echo  [4/4] Lancement du tunnel...
echo.
echo  ============================================================
echo    URL PERMANENTE - ouvrir dans Safari sur iPhone :
echo.
echo    https://%NGROK_DOMAIN%
echo.
echo  ============================================================
echo.
echo  Identifiants de test : listener@msdev.local / msdev123
echo.
echo  Laissez cette fenetre ouverte.
echo  Fermez-la pour couper l acces internet a MeloSong.
echo.

"%NGROK_EXE%" http --url="%NGROK_DOMAIN%" 4080

echo.
echo  [INFO] Tunnel ferme.
echo.
pause
endlocal