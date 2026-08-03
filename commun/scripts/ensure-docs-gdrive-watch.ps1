# Démarre le watcher docs → Google Drive s'il n'est pas déjà actif (Windows)
# Usage: npm run docs:gdrive:ensure
param(
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$watchMjs = Join-Path $PSScriptRoot 'watch-docs-gdrive.mjs'
$pidFile = Join-Path $root '.cursor\docs-gdrive-watch.pid'
$rcloneConf = Join-Path $env:APPDATA 'rclone\rclone.conf'

function Write-EnsureLog([string]$Message, [string]$Color = '') {
    if ($Quiet) { return }
    if ($Color) {
        Write-Host $Message -ForegroundColor $Color
    } else {
        Write-Host $Message
    }
}

if (-not (Test-Path $rcloneConf)) {
    Write-EnsureLog '[docs:gdrive] rclone non configuré — watcher ignoré' 'DarkYellow'
    exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-EnsureLog '[docs:gdrive] Node absent — watcher ignoré' 'DarkYellow'
    exit 0
}

function Test-WatcherRunning {
    if (Test-Path $pidFile) {
        $pidText = (Get-Content $pidFile -Raw).Trim()
        if ($pidText -match '^\d+$') {
            $proc = Get-Process -Id ([int]$pidText) -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -eq 'node') {
                return $true
            }
        }
    }
    $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        if ($p.CommandLine -and $p.CommandLine -match 'watch-docs-gdrive\.mjs') {
            return $true
        }
    }
    return $false
}

if (Test-WatcherRunning) {
    Write-EnsureLog '[docs:gdrive] Watcher déjà actif' 'DarkGray'
    exit 0
}

$cursorDir = Join-Path $root '.cursor'
if (-not (Test-Path $cursorDir)) {
    New-Item -ItemType Directory -Path $cursorDir | Out-Null
}

$node = (Get-Command node).Source
Start-Process -FilePath $node -ArgumentList @("`"$watchMjs`"") -WorkingDirectory $root -WindowStyle Hidden | Out-Null

Start-Sleep -Seconds 1
if (Test-WatcherRunning) {
    Write-EnsureLog '[docs:gdrive] Watcher démarré (sync auto sans commit)' 'Green'
} else {
    Write-EnsureLog '[docs:gdrive] Échec démarrage watcher — npm run docs:gdrive:watch' 'Yellow'
    exit 1
}
