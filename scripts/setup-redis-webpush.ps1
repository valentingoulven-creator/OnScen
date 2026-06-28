# scripts/setup-redis-webpush.ps1 - Redis (VPS or msdev) + VAPID keys for msdev
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/setup-redis-webpush.ps1 -Staging
#   powershell -ExecutionPolicy Bypass -File scripts/setup-redis-webpush.ps1 -Prod
#   powershell -ExecutionPolicy Bypass -File scripts/setup-redis-webpush.ps1 -Msdev
param(
    [switch]$Staging,
    [switch]$Prod,
    [switch]$Msdev,
    [switch]$GenerateVapidOnly
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

function Ensure-EnvKey([string]$file, [string]$key, [string]$value) {
    if (-not (Test-Path $file)) { throw "Missing file: $file" }
    $lines = Get-Content $file -Raw
    if ($lines -match "(?m)^$([regex]::Escape($key))=") {
        Write-Host "  [skip] $key already set in $(Split-Path $file -Leaf)" -ForegroundColor DarkGray
        return $false
    }
    Add-Content -Path $file -Value "$key=$value"
    Write-Host "  [OK] Added $key to $(Split-Path $file -Leaf)" -ForegroundColor Green
    return $true
}

function New-VapidKeys {
    Push-Location (Join-Path $root 'backend')
    $out = npx --yes web-push generate-vapid-keys 2>&1 | Out-String
    Pop-Location
    $pub = if ($out -match 'Public Key:\s*(\S+)') { $Matches[1] } else { $null }
    $priv = if ($out -match 'Private Key:\s*(\S+)') { $Matches[1] } else { $null }
    if (-not $pub -or -not $priv) { throw "VAPID generation failed: $out" }
    return @{ Public = $pub; Private = $priv }
}

function Setup-VpsRedis([string]$sshHost, [string]$pm2App) {
    Write-Host ">> Redis on $sshHost" -ForegroundColor Cyan
    $remote = @"
set -e
bash /opt/soundly/deploy/setup-redis-vps.sh
pm2 reload $pm2App --update-env
pm2 logs $pm2App --lines 8 --nostream | grep -i redis | tail -3 || true
curl -s http://127.0.0.1:3000/api/push/vapid-public-key | head -c 120
echo
"@
    ssh $sshHost $remote
    Write-Host "  [OK] Redis + PM2 reload on $sshHost" -ForegroundColor Green
}

function Setup-MsdevEnv {
    Write-Host '>> msdev/.env - VAPID + optional REDIS_URL' -ForegroundColor Cyan
    $envFile = Join-Path $root 'msdev\.env'
    $example = Join-Path $root 'msdev\.env.example'

    if (-not (Test-Path $envFile)) {
        if (Test-Path $example) {
            Copy-Item $example $envFile
            Write-Host '  Copied msdev/.env.example to msdev/.env' -ForegroundColor Yellow
        } else {
            throw 'msdev/.env missing'
        }
    }

    $needsVapid = -not (Select-String -Path $envFile -Pattern '^VAPID_PUBLIC_KEY=' -Quiet)
    if ($needsVapid -or $GenerateVapidOnly) {
        $keys = New-VapidKeys
        Ensure-EnvKey $envFile 'VAPID_PUBLIC_KEY' $keys.Public | Out-Null
        Ensure-EnvKey $envFile 'VAPID_PRIVATE_KEY' $keys.Private | Out-Null
        Ensure-EnvKey $envFile 'VAPID_SUBJECT' 'mailto:contact@getsoundy.com' | Out-Null
        Write-Host '  [OK] VAPID keys generated for msdev' -ForegroundColor Green
    } else {
        Write-Host '  [OK] VAPID already in msdev/.env' -ForegroundColor Green
    }

    $hasRedis = Select-String -Path $envFile -Pattern '^REDIS_URL=' -Quiet
    $hasRedisComment = Select-String -Path $envFile -Pattern '^# REDIS_URL=' -Quiet
    if (-not $hasRedis -and -not $hasRedisComment) {
        Add-Content -Path $envFile -Value ''
        Add-Content -Path $envFile -Value '# Redis optional msdev - uncomment if redis-server on 6379'
        Add-Content -Path $envFile -Value '# REDIS_URL=redis://127.0.0.1:6379'
        Write-Host '  [info] REDIS_URL commented - msdev OK without Redis (single worker)' -ForegroundColor Yellow
    }

    Write-Host 'Web Push: VAPID OK if DATABASE_URL uses PostgreSQL.' -ForegroundColor Cyan
    Write-Host 'Enable push: Settings > Notifications, or prod PWA build.' -ForegroundColor Cyan
}

if ($GenerateVapidOnly) {
    Setup-MsdevEnv
    exit 0
}

if (-not ($Staging -or $Prod -or $Msdev)) {
    Write-Host 'Usage: -Staging | -Prod | -Msdev | -GenerateVapidOnly' -ForegroundColor Yellow
    exit 1
}

if ($Staging) { Setup-VpsRedis 'soundy-staging' 'melosong-backend-staging' }
if ($Prod) { Setup-VpsRedis 'soundy-prod' 'melosong-backend' }
if ($Msdev) { Setup-MsdevEnv }

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
