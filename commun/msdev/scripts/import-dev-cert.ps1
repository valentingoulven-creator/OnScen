# Importe le certificat msdev (auto-signé) dans le magasin Windows
# "Autorités de certification racines de confiance" de l'utilisateur courant.
#
# AVERTISSEMENT : réservé au développement local OnScen msdev uniquement.
# N'exécutez pas sur une machine partagée ou en production.
# Pour retirer : certmgr.msc → Utilisateur courant → Autorités racines → supprimer "OnScen msdev local"

$ErrorActionPreference = "Stop"
$Msdev = Split-Path -Parent $PSScriptRoot
$certPath = Join-Path $Msdev "certs\dev-cert.pem"

if (-not (Test-Path $certPath)) {
    Write-Host "Certificat introuvable : $certPath" -ForegroundColor Red
    Write-Host "Lancez d'abord : msdev\scripts\generate-dev-cert.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== Import certificat DEV OnScen (utilisateur courant) ===" -ForegroundColor Cyan
Write-Host "Fichier : $certPath"
Write-Host ""
Write-Host "Ce certificat est AUTO-SIGNE et sert uniquement au dev HTTPS msdev." -ForegroundColor Yellow
Write-Host "Il sera ajoute au magasin Racines de confiance de VOTRE compte Windows." -ForegroundColor Yellow
$confirm = Read-Host "Continuer ? (oui/non)"
if ($confirm -notmatch '^(oui|o|yes|y)$') {
    Write-Host "Annule." -ForegroundColor Gray
    exit 0
}

try {
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certPath)
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
        [System.Security.Cryptography.X509Certificates.StoreName]::Root,
        [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
    )
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $store.Add($cert)
    $store.Close()
    Write-Host ""
    Write-Host "OK : certificat importe (CurrentUser\Root)." -ForegroundColor Green
    Write-Host "Redemarrez Chrome/Edge puis ouvrez https://<votre-IP>:4080" -ForegroundColor Gray
    Write-Host "Guide : msdev\HTTPS-ACCES.txt" -ForegroundColor Gray
}
catch {
    Write-Host "Echec import : $_" -ForegroundColor Red
    exit 1
}
