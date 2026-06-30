# Lance msdev en ecoute LAN (HOST=0.0.0.0) et affiche l'URL mobile /tel/
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root

$port = 4080
$envFile = Join-Path $root 'msdev\.env'
$lanIp = $null

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*MOBILE_HOST_IP\s*=\s*(.+)\s*$') { $lanIp = $Matches[1].Trim() }
        if ($_ -match '^\s*PORT\s*=\s*(\d+)\s*$') { $port = [int]$Matches[1] }
    }
}

if (-not $lanIp) {
    $lanIp = @(
        Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } |
            Select-Object -ExpandProperty IPAddress -Unique
    ) | Select-Object -First 1
}

if (-not $lanIp) {
    Write-Host '[ERREUR] IP LAN introuvable. Lancez npm run msdev:sync-lan' -ForegroundColor Red
    exit 1
}

$telUrl = "http://${lanIp}:${port}/tel/"
$qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=$([uri]::EscapeDataString($telUrl))"
$pcQrPage = "http://localhost:${port}/msdev-mobile?app=tel"

Write-Host ''
Write-Host '  ============================================================' -ForegroundColor Cyan
Write-Host '    Soundly Mobile — meme Wi-Fi que le PC' -ForegroundColor Cyan
Write-Host '  ============================================================' -ForegroundColor Cyan
Write-Host ''
Write-Host "  Sur iPhone (Safari, meme Wi-Fi) :" -ForegroundColor White
Write-Host "  $telUrl" -ForegroundColor Yellow -BackgroundColor DarkBlue
Write-Host ''
Write-Host '  iPhone SANS Mac — PWA standalone (une fois) :' -ForegroundColor White
Write-Host '    1. Safari : ouvrir l''URL ci-dessus' -ForegroundColor Gray
Write-Host '    2. Partager -> Sur l''ecran d''accueil -> Ajouter' -ForegroundColor Gray
Write-Host '    3. Ensuite : lancer l''ICONE MeloSong (plein ecran, pas Safari)' -ForegroundColor Gray
Write-Host ''
Write-Host "  QR code (PC) : $pcQrPage" -ForegroundColor Gray
Write-Host "  Compte demo : listener@msdev.local / msdev123" -ForegroundColor Gray
Write-Host ''
Write-Host '  HOST=0.0.0.0 pour cette session (acces LAN).' -ForegroundColor DarkGray
Write-Host '  Camera : npm run msdev:https puis https://IP:4080/tel/' -ForegroundColor DarkGray
Write-Host '  Script PC : Smartphone\INSTALLER-IPHONE-SANS-MAC.bat' -ForegroundColor DarkGray
Write-Host '  Android APK : Smartphone\TOUT-INSTALLER.bat' -ForegroundColor DarkGray
Write-Host ''

$listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    Write-Host '  [OK] Serveur deja actif sur le port' $port -ForegroundColor Green
    Write-Host '  Si le telephone ne repond pas, relancez via OUVRIR-SUR-TEL.bat' -ForegroundColor Yellow
    Write-Host '  (HOST doit etre 0.0.0.0, pas 127.0.0.1).' -ForegroundColor Yellow
    try { Start-Process $pcQrPage } catch {}
    Write-Host ''
    exit 0
}

Write-Host '  Demarrage du serveur msdev (LAN)...' -ForegroundColor Gray
$env:HOST = '0.0.0.0'
$env:CORS_ORIGIN = '*'
$env:MSDEV_HTTPS = '0'

Start-Job -ScriptBlock {
    param($r)
    Set-Location $r
    $env:HOST = '0.0.0.0'
    $env:CORS_ORIGIN = '*'
    $env:MSDEV_HTTPS = '0'
    npm run dev:msdev --prefix commun/backend 2>&1 | Out-Null
} -ArgumentList $root | Out-Null

$ok = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    try {
        $c = New-Object Net.Sockets.TcpClient
        $c.Connect('127.0.0.1', $port)
        $c.Close()
        $ok = $true
        break
    } catch {}
}

if (-not $ok) {
    Write-Host '  [ERREUR] Serveur non demarre apres 45s.' -ForegroundColor Red
    exit 1
}

Write-Host '  [OK] Serveur pret.' -ForegroundColor Green
try { Start-Process $pcQrPage } catch {}
Write-Host ''
Write-Host '  Laissez cette fenetre ouverte ou le serveur en arriere-plan.' -ForegroundColor Gray
Write-Host ''
