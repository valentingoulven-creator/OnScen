# fix-onscen-local-access.ps1 — contourne le cache DNS bbox/OVH parking pour onscen.com
# Exécuter en administrateur :
#   powershell -ExecutionPolicy Bypass -File commun/scripts/fix-onscen-local-access.ps1
param(
    [string]$ProdIp = '51.159.164.100',
    [switch]$SkipHosts,
    [switch]$SkipDnsServers
)

$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
    Write-Host 'Relance avec élévation (UAC)...' -ForegroundColor Yellow
    $argList = @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', $PSCommandPath
    )
    if ($SkipHosts) { $argList += '-SkipHosts' }
    if ($SkipDnsServers) { $argList += '-SkipDnsServers' }
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argList -Wait
    exit $LASTEXITCODE
}

Write-Host '>> OnScen — accès local onscen.com' -ForegroundColor Cyan

if (-not $SkipDnsServers) {
    $ifaces = Get-DnsClientServerAddress -AddressFamily IPv4 |
        Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.ServerAddresses.Count -gt 0 } |
        Select-Object -ExpandProperty InterfaceAlias -Unique
    foreach ($alias in $ifaces) {
        Write-Host "  DNS $alias -> 1.1.1.1, 8.8.8.8" -ForegroundColor DarkCyan
        Set-DnsClientServerAddress -InterfaceAlias $alias -ServerAddresses @('1.1.1.1', '8.8.8.8')
    }
}

if (-not $SkipHosts) {
    $hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
    $marker = '# OnScen prod — fix-onscen-local-access.ps1'
    $lines = Get-Content $hostsPath -ErrorAction SilentlyContinue
    if ($lines -match 'onscen\.com') {
        Write-Host '  [OK] hosts contient déjà onscen.com' -ForegroundColor Green
    } else {
        Add-Content -Path $hostsPath -Value @('', $marker, "$ProdIp`t onscen.com www.onscen.com")
        Write-Host "  [OK] hosts: onscen.com -> $ProdIp" -ForegroundColor Green
    }
}

ipconfig /flushdns | Out-Null
Write-Host '  Cache DNS vidé' -ForegroundColor DarkGray

Start-Sleep -Seconds 1
try {
    $ip = (Resolve-DnsName onscen.com -Type A -ErrorAction Stop | Select-Object -First 1).IPAddress
    Write-Host "  DNS onscen.com -> $ip" -ForegroundColor $(if ($ip -eq $ProdIp) { 'Green' } else { 'Yellow' })
} catch {
    Write-Host "  [!] Resolve-DnsName: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host '>> Health' -ForegroundColor Cyan
try {
    $h = Invoke-RestMethod -Uri 'https://onscen.com/health' -TimeoutSec 30
    Write-Host "  [OK] https://onscen.com/health env=$($h.env) db=$($h.db)" -ForegroundColor Green
    Write-Host '  Ouvre https://onscen.com dans le navigateur (Ctrl+Shift+R si PWA ancienne).' -ForegroundColor Green
    exit 0
} catch {
    Write-Host "  [!] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
