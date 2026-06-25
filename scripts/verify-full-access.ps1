# verify-full-access.ps1 — Verification acces agent complet Soundy
param([switch]$Quiet)

$ErrorActionPreference = 'Continue'
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + `
    [System.Environment]::GetEnvironmentVariable('Path','User')

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$checks = [System.Collections.Generic.List[hashtable]]::new()

function Add-Check([string]$Name, [bool]$Ok, [string]$Detail = '') {
    $checks.Add(@{ Name = $Name; Ok = $Ok; Detail = $Detail })
    if (-not $Quiet) {
        if ($Ok) { Write-Host "  [OK] $Name" -ForegroundColor Green }
        else { Write-Host "  [--] $Name - $Detail" -ForegroundColor Yellow }
    }
}

function Test-EnvKey([string]$file, [string]$key) {
    if (-not (Test-Path $file)) { return $false }
    $l = Select-String -Path $file -Pattern "^$key=" | Select-Object -First 1
    return ($l -and ($l.Line -split '=', 2)[1].Trim().Length -gt 3)
}

Write-Host ''
Write-Host ' Soundy — Verification acces agent' -ForegroundColor Cyan
Write-Host ''

# Dev local
Add-Check 'Repo source' (Test-Path (Join-Path $root 'package.json')) ''
Add-Check 'msdev/.env' (Test-Path (Join-Path $root 'msdev\.env')) ''
Add-Check 'backend/.env.production' (Test-Path (Join-Path $root 'backend\.env.production')) ''
Add-Check 'backend/.env.preproduction' (Test-Path (Join-Path $root 'backend\.env.preproduction')) 'scripts/setup-staging-env.ps1'
Add-Check 'node + npm' ((Get-Command node -EA SilentlyContinue) -and (Get-Command npm -EA SilentlyContinue)) ''

try {
    $h = Invoke-WebRequest -Uri 'http://localhost:4080/health' -UseBasicParsing -TimeoutSec 4
    Add-Check 'API msdev :4080' ($h.StatusCode -eq 200) "HTTP $($h.StatusCode)"
} catch {
    Add-Check 'API msdev :4080' $false 'Lancez npm run dev'
}

# Secrets dev
$msdev = Join-Path $root 'msdev\.env'
foreach ($k in @('DATABASE_URL','SIGHTENGINE_API_USER','LIVEKIT_URL','STRIPE_SECRET_KEY','GOOGLE_CLIENT_ID')) {
    Add-Check "msdev: $k" (Test-EnvKey $msdev $k) 'sync depuis prod si manquant'
}

# SSH VPS
$sshOut = & ssh.exe -o BatchMode=yes -o ConnectTimeout=12 soundy-prod 'echo PING_OK' 2>&1 | Out-String
Add-Check 'SSH VPS' ($LASTEXITCODE -eq 0 -and ($sshOut -match 'PING_OK')) 'soundy-prod / 51.159.164.100'

if ($LASTEXITCODE -eq 0) {
    $pm2 = & ssh.exe -o BatchMode=yes -o ConnectTimeout=15 soundy-prod 'pm2 jlist' 2>&1 | Out-String
    Add-Check 'PM2 melosong-backend' ($pm2 -match 'melosong-backend' -and $pm2 -match 'online') ''
    $envOk = & ssh.exe -o BatchMode=yes -o ConnectTimeout=12 soundy-prod "test -f /opt/soundly/.env && echo Y" 2>&1
    Add-Check 'VPS /opt/soundly/.env' ("$envOk" -match 'Y') ''
}

# SSH staging
$stgOut = & ssh.exe -o BatchMode=yes -o ConnectTimeout=12 soundy-staging 'echo PING_OK' 2>&1 | Out-String
Add-Check 'SSH staging' ($LASTEXITCODE -eq 0 -and ($stgOut -match 'PING_OK')) 'soundy-staging / 51.159.170.181'

if ($LASTEXITCODE -eq 0) {
    $pm2stg = & ssh.exe -o BatchMode=yes -o ConnectTimeout=15 soundy-staging 'pm2 jlist' 2>&1 | Out-String
    Add-Check 'PM2 melosong-backend-staging' ($pm2stg -match 'melosong-backend-staging' -and $pm2stg -match 'online') ''
}

# Prod publique
try {
    $ph = Invoke-WebRequest -Uri 'https://getsoundy.com/health' -UseBasicParsing -TimeoutSec 15
    Add-Check 'Health prod' ($ph.StatusCode -eq 200) ''
} catch {
    Add-Check 'Health prod' $false $_.Exception.Message
}

# Staging (IP si DNS pas encore propage)
try {
    $sh = Invoke-WebRequest -Uri 'http://51.159.170.181/health' -UseBasicParsing -TimeoutSec 15
    $preprod = $sh.Content -match 'preproduction'
    Add-Check 'Health staging (IP)' (($sh.StatusCode -eq 200) -and $preprod) ''
} catch {
    Add-Check 'Health staging (IP)' $false $_.Exception.Message
}

try {
    $shDns = Invoke-WebRequest -Uri 'https://staging.getsoundy.com/health' -UseBasicParsing -TimeoutSec 10
    Add-Check 'Health staging (DNS)' ($shDns.StatusCode -eq 200) ''
} catch {
    Add-Check 'Health staging (DNS)' $false 'Ajouter A staging -> 51.159.170.181 (OVH, voir scripts/add-staging-dns-ovh.md)'
}

# Scaleway CLI
Add-Check 'scw CLI' ([bool](Get-Command scw -EA SilentlyContinue)) 'winget install Scaleway.cli'
Add-Check 'scw config' (Test-Path (Join-Path $env:USERPROFILE '.config\scw\config.yaml')) 'scripts/setup-scw.ps1'

# GitHub
$ghOk = $false
if (Get-Command gh -EA SilentlyContinue) {
    $ghSt = & gh auth status 2>&1 | Out-String
    $ghOk = ($LASTEXITCODE -eq 0)
    Add-Check 'gh CLI installe' $true ''
    Add-Check 'gh authentifie' $ghOk 'gh auth login'
} else {
    Add-Check 'gh CLI' $false 'winget install GitHub.cli'
}

# psql local (optionnel)
Add-Check 'psql local' ([bool](Get-Command psql -EA SilentlyContinue)) 'optionnel - DB via SSH VPS'

$ok = ($checks | Where-Object { $_.Ok }).Count
$total = $checks.Count
Write-Host ''
Write-Host " Resultat : $ok / $total checks OK" -ForegroundColor $(if ($ok -ge ($total - 2)) { 'Green' } else { 'Yellow' })
Write-Host ''

if (-not $Quiet -and -not $ghOk) {
    Write-Host ' Pour acces GitHub complet : gh auth login' -ForegroundColor DarkGray
}

exit $(if ($ok -ge ($total - 2)) { 0 } else { 1 })
