# Certificat auto-signé msdev (HTTPS local + LAN pour getUserMedia)
$ErrorActionPreference = "Stop"
$Msdev = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $Msdev "certs"
$keyPath = Join-Path $certDir "dev-key.pem"
$certPath = Join-Path $certDir "dev-cert.pem"

New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$ips = @("127.0.0.1")
$ips += @(
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1' } |
        Select-Object -ExpandProperty IPAddress -Unique
)
$sanParts = @("DNS:localhost", "DNS:*.localhost")
foreach ($ip in $ips) { $sanParts += "IP:$ip" }
$san = $sanParts -join ","

Write-Host "Génération certificat msdev dans $certDir" -ForegroundColor Cyan
Write-Host "SAN: $san" -ForegroundColor Gray

$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $openssl) {
    Write-Host "openssl introuvable. Utilisez Git Bash ou installez OpenSSL." -ForegroundColor Red
    exit 1
}

& openssl req -x509 -newkey rsa:2048 -keyout $keyPath -out $certPath -days 825 -nodes `
    -subj "/CN=OnScen msdev local" -addext "subjectAltName=$san"

Write-Host "OK: $certPath" -ForegroundColor Green
Write-Host "Lancez: npm run msdev:https" -ForegroundColor Yellow
