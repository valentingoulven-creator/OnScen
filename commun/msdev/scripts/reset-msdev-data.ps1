# Supprime la persistance msdev pour repartir sur les comptes démo (seed au prochain démarrage).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$store = Join-Path $root "msdev\data\store.json"
$tmp = "$store.tmp"

if (Test-Path $store) {
  Remove-Item -Force $store
  Write-Host "Supprime: $store" -ForegroundColor Green
} else {
  Write-Host "Aucun store persistant (deja vide)." -ForegroundColor Yellow
}

if (Test-Path $tmp) {
  Remove-Item -Force $tmp
}

Write-Host ""
Write-Host "Relancez le serveur:" -ForegroundColor Cyan
Write-Host "  npm run msdev          (HTTP)" -ForegroundColor Gray
Write-Host "  npm run msdev:https    (HTTPS + camera LAN)" -ForegroundColor Gray
Write-Host ""
Write-Host "Compte demo: listener@msdev.local / msdev123" -ForegroundColor Gray
