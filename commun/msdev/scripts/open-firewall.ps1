# Ouvre le port 4080 dans le pare-feu Windows pour MeloSong (admin requis)
# Clic droit PowerShell > Exécuter en tant qu'administrateur, puis:
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   & "C:\Users\valen\Projects\melosong\msdev\scripts\open-firewall.ps1"

$ErrorActionPreference = "Stop"
$port = 4080
$ruleName = "MeloSong msdev (TCP $port)"

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "La règle existe déjà: $ruleName" -ForegroundColor Yellow
} else {
    New-NetFirewallRule -DisplayName $ruleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $port `
        -Action Allow `
        -Profile Any `
        -Description "Autorise MeloSong msdev sur le réseau local"
    Write-Host "Règle pare-feu créée: $ruleName" -ForegroundColor Green
}

Write-Host ""
Write-Host "URLs pour smartphone (même Wi-Fi):" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    ForEach-Object {
        Write-Host "  http://$($_.IPAddress):$port  ($($_.InterfaceAlias))" -ForegroundColor White
    }
