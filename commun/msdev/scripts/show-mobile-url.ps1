# URL OnScen pour smartphone (lit commun/msdev/.env + compare a l'IP reelle)
$ErrorActionPreference = "Stop"
$Msdev = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $Msdev ".env"
$port = 4080
$fixedIp = "192.168.1.93"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*MOBILE_HOST_IP\s*=\s*(.+)\s*$') {
            $fixedIp = $Matches[1].Trim()
        }
    }
}

$url = "http://${fixedIp}:${port}"
$httpsUrl = "https://${fixedIp}:${port}"
$detected = @(
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } |
        Select-Object -ExpandProperty IPAddress -Unique
)

Write-Host ""
Write-Host "OnScen - URL smartphone" -ForegroundColor Cyan
Write-Host ""
Write-Host "  $url" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ""
Write-Host "  Caméra sur telephone: npm run msdev:https puis" -ForegroundColor Yellow
Write-Host "  $httpsUrl" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host "  (acceptez le certificat auto-signé une fois)" -ForegroundColor Gray
Write-Host ""
Write-Host "C'est l'IP du PC (a ouvrir sur le telephone), pas l'IP du telephone." -ForegroundColor Gray
if ($detected -and $detected -notcontains $fixedIp) {
    Write-Host ""
    Write-Host "  Attention: MOBILE_HOST_IP=$fixedIp ne correspond pas au PC actuel." -ForegroundColor Yellow
    Write-Host "  IPs detectees: $($detected -join ', ')" -ForegroundColor Yellow
    Write-Host "  Mettez a jour commun/msdev/.env (MOBILE_HOST_IP) et MOBILE-URL.txt" -ForegroundColor Yellow
}
Write-Host ""
