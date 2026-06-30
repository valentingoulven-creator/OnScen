# Diagnostic acces smartphone -> MeloSong
$port = 4080
Write-Host "`n=== Diagnostic MeloSong (Ethernet) ===`n" -ForegroundColor Cyan

# 1. Serveur
$listen = netstat -ano | findstr ":$port.*LISTENING"
if ($listen -match "0.0.0.0:$port") {
    Write-Host "[OK] Serveur ecoute sur 0.0.0.0:$port" -ForegroundColor Green
} else {
    Write-Host "[!!] Serveur non demarre. Lancez: npm run msdev" -ForegroundColor Red
}

# 2. IP Ethernet
$eth = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Ethernet" -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '169.254*' } | Select-Object -First 1
if ($eth) {
    $url = "http://$($eth.IPAddress):$port"
    Write-Host "[OK] IP Ethernet: $($eth.IPAddress)" -ForegroundColor Green
    Write-Host "     URL telephone: $url" -ForegroundColor Yellow
} else {
    Write-Host "[!!] Pas d IP Ethernet active" -ForegroundColor Red
}

# 3. Pare-feu
$fw = Get-NetFirewallRule -DisplayName "MeloSong msdev*" -ErrorAction SilentlyContinue
if ($fw -and $fw.Enabled) {
    Write-Host "[OK] Regle pare-feu MeloSong active" -ForegroundColor Green
} else {
    Write-Host "[!!] Pare-feu: executez open-firewall.ps1 en ADMIN" -ForegroundColor Red
}

# 4. Test local via IP Ethernet
if ($eth) {
    try {
        $h = Invoke-RestMethod "$url/health" -TimeoutSec 3
        Write-Host "[OK] Test HTTP depuis ce PC: $($h.status)" -ForegroundColor Green
    } catch {
        Write-Host "[!!] Echec HTTP sur $url : $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 5. Reseau Windows
$profile = Get-NetConnectionProfile -InterfaceAlias "Ethernet" -ErrorAction SilentlyContinue
if ($profile) {
    Write-Host "[--] Reseau Ethernet: $($profile.NetworkCategory)" -ForegroundColor Gray
    if ($profile.NetworkCategory -eq 'Public') {
        Write-Host "     Astuce: passez le reseau en Prive (Parametres > Reseau)" -ForegroundColor Yellow
    }
}

Write-Host "`nSi le telephone echoue encore:" -ForegroundColor Cyan
Write-Host "  - Utilisez EXACTEMENT: http://$($eth.IPAddress):$port"
Write-Host "  - Pas de reseau invite / Guest Wi-Fi sur le telephone"
Write-Host "  - Certains routeurs isolent le Wi-Fi du Ethernet (desactiver 'isolation AP')"
Write-Host "  - Test: connectez temporairement le PC en Wi-Fi et utilisez l IP Wi-Fi`n"
