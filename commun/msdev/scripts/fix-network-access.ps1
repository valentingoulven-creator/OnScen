# Corrige l acces telephone -> OnScen (ADMIN requis)
# Clic droit PowerShell > Executer en tant qu administrateur

$ErrorActionPreference = "Stop"
$port = 4080

Write-Host "`nOnScen - Correction acces reseau local`n" -ForegroundColor Cyan

# 1. Reseau Ethernet en Prive (souvent bloque en Public)
try {
    $eth = Get-NetConnectionProfile -InterfaceAlias "Ethernet" -ErrorAction SilentlyContinue
    if ($eth -and $eth.NetworkCategory -eq "Public") {
        Set-NetConnectionProfile -InterfaceAlias "Ethernet" -NetworkCategory Private
        Write-Host "[OK] Reseau Ethernet passe en Prive" -ForegroundColor Green
    } else {
        Write-Host "[--] Reseau Ethernet deja Prive ou introuvable" -ForegroundColor Gray
    }
} catch {
    Write-Host "[!!] Impossible de changer le profil reseau: $_" -ForegroundColor Red
}

# 2. Pare-feu port 4080
$ruleName = "OnScen msdev (TCP $port)"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Domain, Private, Public
    Write-Host "[OK] Regle pare-feu port $port creee" -ForegroundColor Green
} else {
    Set-NetFirewallRule -DisplayName $ruleName -Enabled True -Action Allow -Profile Domain, Private, Public
    Write-Host "[OK] Regle pare-feu port $port activee" -ForegroundColor Green
}

# 3. node.exe
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($nodePath) {
    $nodeRule = "OnScen node.exe inbound"
    if (-not (Get-NetFirewallRule -DisplayName $nodeRule -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $nodeRule -Direction Inbound -Program $nodePath -Action Allow -Profile Domain, Private, Public
        Write-Host "[OK] Regle pare-feu Node.js creee" -ForegroundColor Green
    }
}

# 4. URL Ethernet
$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Ethernet" -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress

Write-Host "`nSur votre telephone, ouvrez EXACTEMENT:" -ForegroundColor Yellow
if ($ip) {
    Write-Host "  http://${ip}:${port}`n" -ForegroundColor White -BackgroundColor DarkBlue
} else {
    Write-Host "  (IP Ethernet introuvable)`n" -ForegroundColor Red
}
