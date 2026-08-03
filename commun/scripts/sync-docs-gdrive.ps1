# Sync commun/docs + docs/ → Google Drive (remote rclone gdrive-soundy)
# Usage:
#   powershell -ExecutionPolicy Bypass -File commun/scripts/sync-docs-gdrive.ps1
#   npm run docs:gdrive:sync
param(
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $root

$machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
$userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$machinePath;$userPath"

if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
    Write-Error 'rclone introuvable. Installez-le (winget install Rclone.Rclone) puis npm run docs:gdrive:install'
    exit 1
}

$conf = Join-Path $env:APPDATA 'rclone\rclone.conf'
if (-not (Test-Path $conf)) {
    Write-Error "Config rclone absente ($conf). Lancez: rclone authorize drive puis npm run docs:gdrive:install"
    exit 1
}

$remote = 'gdrive-soundy:'
$excludes = @(
    '--exclude', 'node_modules/**',
    '--exclude', '**/youtube-audit-demo-credentials.local.txt'
)

function Write-SyncLog {
    param([string]$Message)
    if (-not $Quiet) {
        Write-Host $Message
    }
}

Write-SyncLog '[docs:gdrive] Sync commun/docs…'
& rclone copy 'commun/docs' "${remote}commun/docs" @excludes '--create-empty-src-dirs' '-q'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-SyncLog '[docs:gdrive] Sync docs/…'
& rclone copy 'docs' "${remote}docs" @excludes '--create-empty-src-dirs' '-q'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-SyncLog '[docs:gdrive] OK'
