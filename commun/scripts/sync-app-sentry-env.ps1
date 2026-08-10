# commun/scripts/sync-app-sentry-env.ps1 - Genere web/app/.env.production depuis commun/backend/.env.production (VITE_SENTRY_*)
param(
    [ValidateSet('production', 'preproduction')]
    [string]$Environment = 'production'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path

$backendEnv = Join-Path $root "commun\backend\.env.$Environment"
$appEnv = Join-Path $root "web\app\.env.$Environment"
$appExample = Join-Path $root "web\app\.env.$Environment.example"

if (-not (Test-Path $backendEnv)) {
    throw "Missing file: $backendEnv (run: scp onscen-prod:/opt/onscen/.env commun/backend/.env.production)"
}

$backendLines = Get-Content $backendEnv
$sentryDsn = ($backendLines | Where-Object { $_ -match '^\s*SENTRY_DSN\s*=' } | Select-Object -First 1) -replace '^\s*SENTRY_DSN\s*=\s*', ''
$sentryTraces = ($backendLines | Where-Object { $_ -match '^\s*SENTRY_TRACES_SAMPLE_RATE\s*=' } | Select-Object -First 1) -replace '^\s*SENTRY_TRACES_SAMPLE_RATE\s*=\s*', '0.05'
$webUrl = ($backendLines | Where-Object { $_ -match '^\s*WEB_APP_URL\s*=' } | Select-Object -First 1) -replace '^\s*WEB_APP_URL\s*=\s*', ''

if (-not $sentryDsn) {
    throw 'SENTRY_DSN missing in backend env file'
}

# Projet Sentry front javascript-react (DSN distinct du backend Node)
$viteDsn = $sentryDsn -replace '/4511654915866704$', '/4511654894436432'

$appEnvLines = @(
    "VITE_APP_ENV=$Environment",
    "VITE_WEB_APP_URL=$webUrl",
    "VITE_SENTRY_DSN=$viteDsn",
    "VITE_SENTRY_TRACES_SAMPLE_RATE=$sentryTraces",
    "VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=1",
    "VITE_DESIGN_QUICK_WINS=1"
)

if ($Environment -eq 'preproduction') {
    $demoEmail = ($backendLines | Where-Object { $_ -match '^\s*STAGING_DEMO_LOGIN_EMAIL\s*=' } | Select-Object -First 1) -replace '^\s*STAGING_DEMO_LOGIN_EMAIL\s*=\s*', ''
    $demoPassword = ($backendLines | Where-Object { $_ -match '^\s*STAGING_DEMO_LOGIN_PASSWORD\s*=' } | Select-Object -First 1) -replace '^\s*STAGING_DEMO_LOGIN_PASSWORD\s*=\s*', ''
    $demoAuto = ($backendLines | Where-Object { $_ -match '^\s*STAGING_DEMO_AUTO_LOGIN\s*=' } | Select-Object -First 1) -replace '^\s*STAGING_DEMO_AUTO_LOGIN\s*=\s*', ''
    if (-not $demoEmail) { $demoEmail = 'admin@staging.getsoundy.com' }
    if (-not $demoAuto) { $demoAuto = '1' }
    if ($demoEmail) { $appEnvLines += "VITE_DEMO_LOGIN_EMAIL=$demoEmail" }
    if ($demoPassword) { $appEnvLines += "VITE_DEMO_LOGIN_PASSWORD=$demoPassword" }
    if ($demoAuto) { $appEnvLines += "VITE_DEMO_AUTO_LOGIN=$demoAuto" }
}

if (Test-Path $appExample) {
    foreach ($line in Get-Content $appExample) {
        if ($line -match '^\s*VITE_DONATION_' -and $line -notmatch '^\s*#') {
            $appEnvLines += $line
        }
    }
}

$text = ($appEnvLines -join "`n") + "`n"
[System.IO.File]::WriteAllText($appEnv, $text, (New-Object System.Text.UTF8Encoding $false))
Write-Host "[OK] $appEnv generated (VITE_SENTRY javascript-react project)" -ForegroundColor Green
