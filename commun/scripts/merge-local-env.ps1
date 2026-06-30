# merge-local-env.ps1 — Copie variables manquantes entre commun/msdev/.env et backend/.env.production
param(
    [switch]$DryRun,
    [switch]$FromProd   # backend/.env.production -> commun/msdev/.env (defaut: msdev -> backend)
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$msdevPath = Join-Path $root 'commun\msdev\.env'
$prodPath = Join-Path $root 'commun/backend\.env.production'

function Read-EnvLines([string]$path) {
    if (-not (Test-Path $path)) { return @(), @{} }
    $lines = Get-Content $path
    $map = @{}
    foreach ($line in $lines) {
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $map[$Matches[1]] = $Matches[2] }
    }
    return $lines, $map
}

if (-not (Test-Path $msdevPath)) { throw "commun/msdev/.env introuvable" }
if (-not (Test-Path $prodPath)) {
    Copy-Item (Join-Path $root 'commun/backend\.env.production.example') $prodPath
}

$msdevLines, $msdev = Read-EnvLines $msdevPath
$prodLines, $prod = Read-EnvLines $prodPath

$shareKeys = @(
    'JWT_SECRET', 'ENCRYPTION_KEY',
    'SIGHTENGINE_API_USER', 'SIGHTENGINE_API_SECRET', 'SIGHTENGINE_ENABLED',
    'SIGHTENGINE_FAIL_OPEN', 'SIGHTENGINE_MODERATE_REMOTE',
    'SIGHTENGINE_EXPLICIT_THRESHOLD', 'SIGHTENGINE_EROTICA_THRESHOLD', 'SIGHTENGINE_OFFENSIVE_THRESHOLD',
    'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET',
    'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_API_TOKEN', 'CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN',
    'DATABASE_URL', 'PG_SSL', 'PG_POOL_MAX',
    'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'YOUTUBE_API_KEY',
    'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT',
    'PROD_ADMIN_EMAIL', 'SMTP_ADMIN_EMAIL', 'ALERT_EMAIL',
    'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET',
    'SCW_BUCKET', 'SCW_REGION', 'SCW_ACCESS_KEY', 'SCW_SECRET_KEY',
    'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET', 'SIGHTENGINE_MODERATE_REMOTE',
    'SIGHTENGINE_EXPLICIT_THRESHOLD', 'SIGHTENGINE_EROTICA_THRESHOLD', 'SIGHTENGINE_OFFENSIVE_THRESHOLD'
)

if ($FromProd) {
    $srcMap = $prod; $dstLines = $msdevLines; $dstMap = $msdev
    $destPath = $msdevPath
    $label = 'commun/msdev/.env'
} else {
    $srcMap = $msdev; $dstLines = $prodLines; $dstMap = $prod
    $destPath = $prodPath
    $label = 'commun/backend/.env.production'
}

$added = @()
$newDst = [System.Collections.Generic.List[string]]::new()
foreach ($line in $dstLines) { [void]$newDst.Add([string]$line) }
foreach ($key in $shareKeys) {
    if ($dstMap.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($dstMap[$key])) { continue }
    if (-not $srcMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($srcMap[$key])) { continue }
    $newDst.Add("$key=$($srcMap[$key])")
    $added += $key
}

if ($added.Count -eq 0) {
    Write-Host "[OK] $label deja complet pour les cles locales"
    exit 0
}

Write-Host ("[OK] Ajout de {0} variable(s) dans {1} : {2}" -f $added.Count, $label, ($added -join ', '))
if ($DryRun) { exit 0 }
$newDst | Set-Content -Path $destPath -Encoding UTF8
