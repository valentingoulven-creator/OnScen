<#
.SYNOPSIS
  Déploie seed_onscen_server.js sur la prod OnScen et le lance.
  Usage: .\run_seed.ps1
#>

$Key    = "$env:USERPROFILE\.ssh\id_ed25519"
$Server = "root@51.159.164.100"
$Local  = Join-Path $PSScriptRoot "seed_onscen_server.js"
$Remote = "/tmp/seed_onscen_server.js"
$PM2    = "onscen-backend"

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  OnScen Production Seeder" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. Copie du script sur le serveur
Write-Host "📤  SCP → serveur:$Remote" -ForegroundColor Yellow
& scp -i $Key -o StrictHostKeyChecking=no $Local "${Server}:${Remote}"
if ($LASTEXITCODE -ne 0) { Write-Error "SCP échoué."; exit 1 }
Write-Host "    OK" -ForegroundColor Green

# 2. Exécution Node.js sur le serveur
Write-Host "⚡  Exécution du seeder sur le serveur…" -ForegroundColor Yellow
& ssh -i $Key -o StrictHostKeyChecking=no $Server "node $Remote"
if ($LASTEXITCODE -ne 0) { Write-Error "Seeder Node.js échoué."; exit 1 }

# 3. Redémarrage pm2
Write-Host ""
Write-Host "🔄  Redémarrage pm2 ($PM2)…" -ForegroundColor Yellow
& ssh -i $Key -o StrictHostKeyChecking=no $Server "pm2 restart $PM2 && sleep 2 && pm2 list"
if ($LASTEXITCODE -ne 0) { Write-Error "pm2 restart échoué."; exit 1 }

# 4. Nettoyage script temporaire
& ssh -i $Key -o StrictHostKeyChecking=no $Server "rm -f $Remote" 2>$null

Write-Host ""
Write-Host "✅  Seeding terminé avec succès !" -ForegroundColor Green
Write-Host ""
