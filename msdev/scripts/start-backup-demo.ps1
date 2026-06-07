# MeloSong — démo backup iCloud sur téléphone (sans backend)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$DefaultBackup = "C:\Users\valen\iCloudDrive\Application\MeloSong\backup"

if (-not $env:MELOSONG_BACKUP_PATH) {
    if (Test-Path $DefaultBackup) {
        $env:MELOSONG_BACKUP_PATH = $DefaultBackup
        Write-Host "Backup iCloud: $DefaultBackup" -ForegroundColor Cyan
    } else {
        Write-Host "Backup non trouvé: $DefaultBackup" -ForegroundColor Yellow
        Write-Host "Définissez MELOSONG_BACKUP_PATH ou copiez backup à côté de MeloSongv2." -ForegroundColor Yellow
    }
}

Set-Location $Root
npm run backup:demo:public
