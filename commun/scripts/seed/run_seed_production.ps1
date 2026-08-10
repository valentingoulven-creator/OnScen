<#
.SYNOPSIS
  Déploie et exécute le seed production (PostgreSQL) sur le VPS OnScen.
  Usage: .\run_seed_production.ps1
#>

$Key    = "$env:USERPROFILE\.ssh\id_ed25519"
$Server = "root@51.159.164.100"
$Backend = Join-Path (Split-Path $PSScriptRoot -Parent) "OnScen\backend"
$Remote = "/opt/onscen"

Write-Host ""
Write-Host "OnScen — Seed production (PostgreSQL)" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $Backend)) {
    Write-Error "Backend introuvable: $Backend"
    exit 1
}

Write-Host "Build backend..." -ForegroundColor Yellow
Push-Location $Backend
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

$seedLocal = Join-Path $PSScriptRoot "seed_prod_testdata.js"
$pgStoreLocal = Join-Path $Backend "dist\lib\pgStore.js"
& scp -i $Key -o StrictHostKeyChecking=no $seedLocal "${Server}:${Remote}/seed_prod_testdata.js"
& scp -i $Key -o StrictHostKeyChecking=no $pgStoreLocal "${Server}:${Remote}/dist/lib/pgStore.js"
if ($LASTEXITCODE -ne 0) { Write-Error "SCP échoué."; exit 1 }

Write-Host "Arrêt pm2 puis seed (évite écrasement mémoire)..." -ForegroundColor Yellow
& ssh -i $Key -o StrictHostKeyChecking=no $Server "pm2 stop onscen-backend 2>/dev/null; cd $Remote && APP_ENV=production node seed_prod_testdata.js"
if ($LASTEXITCODE -ne 0) { Write-Error "Seed échoué."; exit 1 }

Write-Host "Démarrage pm2..." -ForegroundColor Yellow
& ssh -i $Key -o StrictHostKeyChecking=no $Server "pm2 start onscen-backend 2>/dev/null || pm2 restart onscen-backend; sleep 2; pm2 list"
if ($LASTEXITCODE -ne 0) { Write-Error "pm2 restart échoué."; exit 1 }

Write-Host ""
Write-Host "Seed production terminé." -ForegroundColor Green
Write-Host ""
