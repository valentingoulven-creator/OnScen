# authorize-vps-key.ps1 — Prepare l'autorisation SSH sur le VPS (action manuelle console)
$ErrorActionPreference = 'Stop'
$pubPath = Join-Path $env:USERPROFILE '.ssh\id_ed25519.pub'
if (-not (Test-Path $pubPath)) {
    Write-Host '[X] Cle publique absente. Lancez setup-infra-access.ps1 -GenerateSshKey' -ForegroundColor Red
    exit 1
}
$pub = (Get-Content $pubPath -Raw).Trim()
$cmd = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$pub' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo KEY_ADDED_OK"

Write-Host ''
Write-Host ' ============================================================' -ForegroundColor Yellow
Write-Host '  Autoriser Cursor sur le VPS (console Scaleway)' -ForegroundColor Yellow
Write-Host ' ============================================================' -ForegroundColor Yellow
Write-Host ''
Write-Host '  1. Ouvrir : https://console.scaleway.com/instance/servers' -ForegroundColor White
Write-Host '  2. Cliquer sur le serveur (51.159.164.100 / DEV1-S)' -ForegroundColor White
Write-Host '  3. Onglet Console (navigateur) ou SSH via console web' -ForegroundColor White
Write-Host '  4. Coller la commande (deja dans le presse-papiers) :' -ForegroundColor White
Write-Host ''
Write-Host "  $cmd" -ForegroundColor Green
Write-Host ''

Set-Clipboard -Value $cmd
Write-Host '  [OK] Commande copiee dans le presse-papiers' -ForegroundColor Green

try {
    Start-Process 'https://console.scaleway.com/instance/servers'
    Write-Host '  [OK] Console Scaleway ouverte dans le navigateur' -ForegroundColor Green
} catch {
    Write-Warn "Ouvrez manuellement : https://console.scaleway.com/instance/servers"
}

Write-Host ''
Write-Host '  Apres KEY_ADDED_OK, relancez :' -ForegroundColor Cyan
Write-Host '    powershell -ExecutionPolicy Bypass -File scripts/setup-infra-access.ps1 -PullProdEnv -SyncMsdevFromProd'
Write-Host ''
