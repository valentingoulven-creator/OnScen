@echo off
chcp 65001 >nul 2>&1
title MeloSong - Redemarrer le serveur
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0msdev\scripts\restart-server.ps1"
exit /b %ERRORLEVEL%
