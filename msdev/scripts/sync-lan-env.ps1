# Met a jour msdev/.env avec l'IP LAN du PC (interface Internet par defaut) + test YouTube
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backend = Join-Path $root "backend"

$detected = @(
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' -and $_.PrefixOrigin -ne 'WellKnown' } |
        Select-Object -ExpandProperty IPAddress -Unique
)

$preferredIp = $null
$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
    Where-Object { $_.NextHop -ne '0.0.0.0' } |
    Sort-Object RouteMetric |
    Select-Object -First 1
if ($route) {
    $gwIp = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '169.254*' } |
        Select-Object -First 1 -ExpandProperty IPAddress
    if ($gwIp -and $detected -contains $gwIp) {
        $preferredIp = $gwIp
    }
}
if (-not $preferredIp -and $detected.Count -gt 0) {
    $preferredIp = $detected[0]
}
if ($preferredIp) {
    $env:MSDEV_FORCE_LAN_IP = $preferredIp
}

Push-Location $backend
try {
    npx ts-node --transpile-only src/scripts/sync-lan-env.ts
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
