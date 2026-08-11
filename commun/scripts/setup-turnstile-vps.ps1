# setup-turnstile-vps.ps1 — Turnstile dans .env local + VPS + sync Vite + reload PM2
# Usage :
#   powershell -File commun/scripts/setup-turnstile-vps.ps1 -Target staging
#   powershell -File commun/scripts/setup-turnstile-vps.ps1 -Target prod
#   powershell -File commun/scripts/setup-turnstile-vps.ps1 -Target both
#
# Clés réelles (dashboard ou API) :
#   $env:CLOUDFLARE_API_TOKEN='cfat_...'; powershell -File commun/scripts/create-turnstile-widgets.ps1 -Apply
#   # ou manuellement :
#   $env:TURNSTILE_SITE_KEY='...'; $env:TURNSTILE_SECRET_KEY='...'; ... -UseRealKeys
#
# Sans clés réelles : clés de test Cloudflare (toujours « pass » — OK preprod, pas pour anti-bot prod).

param(
    [ValidateSet('staging', 'prod', 'both')]
    [string]$Target = 'both',
    [switch]$UseRealKeys,
    [switch]$SkipDeploy,
    [switch]$SkipPm2Reload
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path

# Clés de test officielles Cloudflare Turnstile (https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
$testSite = '1x00000000000000000000AA'
$testSecret = '1x0000000000000000000000000000000AA'

$siteKey = if ($UseRealKeys -and $env:TURNSTILE_SITE_KEY) { $env:TURNSTILE_SITE_KEY.Trim() } else { $testSite }
$secretKey = if ($UseRealKeys -and $env:TURNSTILE_SECRET_KEY) { $env:TURNSTILE_SECRET_KEY.Trim() } else { $testSecret }

if ($UseRealKeys -and (-not $env:TURNSTILE_SITE_KEY -or -not $env:TURNSTILE_SECRET_KEY)) {
    throw 'UseRealKeys : définir TURNSTILE_SITE_KEY et TURNSTILE_SECRET_KEY dans la session PowerShell.'
}

function Set-LocalBackendEnv {
    param([string]$EnvName)
    $path = Join-Path $root "commun\backend\.env.$EnvName"
    if (-not (Test-Path $path)) {
        Write-Warning "Skip local $path (fichier absent)"
        return
    }
    $lines = Get-Content $path -Raw
    $map = @{
        TURNSTILE_SITE_KEY   = $siteKey
        TURNSTILE_SECRET_KEY = $secretKey
        TURNSTILE_REQUIRED   = '1'
    }
    foreach ($key in $map.Keys) {
        $val = $map[$key]
        if ($lines -match "(?m)^$key=") {
            $lines = $lines -replace "(?m)^$key=.*", "$key=$val"
        } else {
            $lines = $lines.TrimEnd() + "`n$key=$val`n"
        }
    }
    [System.IO.File]::WriteAllText($path, $lines, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "[OK] Local $path" -ForegroundColor Green
}

function Invoke-VpsPatch {
    param([string]$SshHost, [string]$Pm2App, [string]$EcoFile)
    $patchScript = Join-Path $root 'commun\deploy\patch-env-turnstile.sh'
    $remotePath = '/opt/onscen/deploy/patch-env-turnstile.sh'

    Write-Host "-> SCP patch script -> $SshHost" -ForegroundColor Cyan
    scp -o ConnectTimeout=20 $patchScript "${SshHost}:${remotePath}" | Out-Null
    ssh $SshHost "sed -i 's/\r$//' $remotePath && chmod +x $remotePath" | Out-Null

    Write-Host "-> SSH $SshHost (patch .env)..." -ForegroundColor Cyan
    $escapedSite = $siteKey -replace "'", "'\\''"
    $escapedSecret = $secretKey -replace "'", "'\\''"
    $out = ssh $SshHost "export TURNSTILE_SITE_KEY='$escapedSite' TURNSTILE_SECRET_KEY='$escapedSecret' TURNSTILE_REQUIRED=1; bash $remotePath" 2>&1
    Write-Host $out
    if ($out -notmatch 'Turnstile vars mises') { throw "Patch .env échoué sur $SshHost" }

    if (-not $SkipPm2Reload) {
        Write-Host "-> pm2 reload $Pm2App..." -ForegroundColor Cyan
        $reload = ssh $SshHost "cd /opt/onscen && set -a && . ./.env && set +a && pm2 startOrReload deploy/$EcoFile --update-env && pm2 save" 2>&1
        Write-Host $reload
    }
}

if ($Target -in @('staging', 'both')) {
    Set-LocalBackendEnv 'preproduction'
    & powershell -ExecutionPolicy Bypass -File (Join-Path $root 'commun\scripts\sync-app-sentry-env.ps1') -Environment preproduction
    Invoke-VpsPatch -SshHost 'onscen-staging' -Pm2App 'onscen-backend-staging' -EcoFile 'ecosystem.staging.config.cjs'
    if (-not $SkipDeploy) {
        Write-Host '-> deploy preprod (rebuild Vite avec VITE_TURNSTILE_SITE_KEY)...' -ForegroundColor Cyan
        Push-Location $root
        try { & npm run deploy:preprod 2>&1 | Select-Object -Last 25 } finally { Pop-Location }
    }
}

if ($Target -in @('prod', 'both')) {
    Set-LocalBackendEnv 'production'
    & powershell -ExecutionPolicy Bypass -File (Join-Path $root 'commun\scripts\sync-app-sentry-env.ps1') -Environment production
    Invoke-VpsPatch -SshHost 'onscen-prod' -Pm2App 'onscen-backend' -EcoFile 'ecosystem.config.cjs'
    if (-not $SkipDeploy) {
        Write-Host '-> deploy prod...' -ForegroundColor Cyan
        Push-Location $root
        try { & npm run deploy:prod 2>&1 | Select-Object -Last 25 } finally { Pop-Location }
    }
}

if (-not $UseRealKeys) {
    Write-Host ''
    Write-Host 'NOTE : clés Turnstile de TEST Cloudflare actives (captcha non anti-bot).' -ForegroundColor Yellow
    Write-Host 'Prod réel : créer 2 widgets sur https://dash.cloudflare.com/?to=/:account/turnstile' -ForegroundColor Yellow
    Write-Host 'Puis : `$env:TURNSTILE_SITE_KEY=...; $env:TURNSTILE_SECRET_KEY=...; .\commun\scripts\setup-turnstile-vps.ps1 -UseRealKeys`' -ForegroundColor Yellow
}
