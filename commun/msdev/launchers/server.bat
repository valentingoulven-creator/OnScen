@echo off
chcp 65001 >nul 2>&1
title OnScen - Redemarrer le serveur
set "ROOT=%~dp0..\..\.."
cd /d "%ROOT%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\restart-server.ps1"
exit /b %ERRORLEVEL%
