# Test Sightengine credentials from msdev/.env (no secret output)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root 'msdev\.env'
if (-not (Test-Path $envFile)) { throw 'msdev/.env missing' }

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        Set-Item -Path "env:$($Matches[1])" -Value $Matches[2]
    }
}

$user = $env:SIGHTENGINE_API_USER
$secret = $env:SIGHTENGINE_API_SECRET
if (-not $user -or -not $secret) { throw 'SIGHTENGINE credentials missing in msdev/.env' }

$url = "https://api.sightengine.com/1.0/check.json?models=nudity-2.1&api_user=$user&api_secret=$secret&url=https://sightengine.com/assets/img/examples/example-ok-1.jpg"
try {
    $r = Invoke-RestMethod -Uri $url -TimeoutSec 20
    if ($r.status -eq 'success') {
        Write-Host '[OK] Sightengine API accessible (test image neutre)'
    } else {
        Write-Host "[!] Sightengine reponse inattendue: $($r.status)"
        exit 1
    }
} catch {
    Write-Host "[X] Sightengine echoue: $($_.Exception.Message)"
    exit 1
}
