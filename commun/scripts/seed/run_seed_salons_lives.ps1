<#
.SYNOPSIS
  Déploie et exécute seed-production-salons-lives sur la prod OnScen.
  Usage: .\run_seed_salons_lives.ps1
#>

$Key    = "$env:USERPROFILE\.ssh\id_ed25519"
$Server = "root@51.159.164.100"
$Dist   = Join-Path (Split-Path $PSScriptRoot -Parent) "OnScen\backend\dist"
$PM2    = "onscen-backend"

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Seed Salons / Lives — Production" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "seed-salons-lives.js",
  "bootstrap.js",
  "lib\pgSalonsLives.js",
  "scripts\seed-production-salons-lives.js"
)

foreach ($rel in $files) {
  $local = Join-Path $Dist $rel
  $remoteDir = "/opt/onscen/dist/" + ($rel -replace '\\[^\\]+$', '/')
  if (-not (Test-Path $local)) { Write-Error "Fichier manquant : $local — lancez npm run build dans OnScen/backend"; exit 1 }
  Write-Host "📤  SCP $rel" -ForegroundColor Yellow
  & scp -i $Key -o StrictHostKeyChecking=no $local "${Server}:${remoteDir}"
  if ($LASTEXITCODE -ne 0) { Write-Error "SCP échoué : $rel"; exit 1 }
}

Write-Host ""
Write-Host "⚡  Exécution du seeder…" -ForegroundColor Yellow
& ssh -i $Key -o StrictHostKeyChecking=no $Server "cd /opt/onscen && APP_ENV=production node dist/commun/scripts/seed-production-salons-lives.js"
if ($LASTEXITCODE -ne 0) { Write-Error "Seeder échoué."; exit 1 }

Write-Host ""
Write-Host "🔄  Redémarrage pm2 ($PM2)…" -ForegroundColor Yellow
& ssh -i $Key -o StrictHostKeyChecking=no $Server "pm2 restart $PM2 && sleep 2 && pm2 list"
if ($LASTEXITCODE -ne 0) { Write-Error "pm2 restart échoué."; exit 1 }

Write-Host ""
Write-Host "✅  10 salons + 5 lives seedés !" -ForegroundColor Green
Write-Host ""
