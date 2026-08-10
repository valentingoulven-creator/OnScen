# Configure Sign in with Apple sur le VPS (prod ou preprod)
# Prérequis : apple-oauth.env à la racine du repo (gitignoré)
param(
    [ValidateSet('prod', 'preprod')]
    [string]$Environment = 'prod'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$envFile = Join-Path $root 'apple-oauth.env'
$example = Join-Path $root 'apple-oauth.env.example'

if (-not (Test-Path $envFile)) {
    if (Test-Path $example) { Copy-Item $example $envFile }
    Write-Error "Renseignez apple-oauth.env puis relancez ce script."
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $i = $line.IndexOf('=')
    if ($i -le 0) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1).Trim().Trim('"')
    if ($v) { $vars[$k] = $v }
}

$required = @('APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_CALLBACK_URL')
foreach ($k in $required) {
    if (-not $vars.ContainsKey($k)) { Write-Error "Variable manquante : $k" }
}
if (-not $vars['APPLE_PRIVATE_KEY'] -and -not $vars['APPLE_PRIVATE_KEY_PATH']) {
    Write-Error 'APPLE_PRIVATE_KEY ou APPLE_PRIVATE_KEY_PATH requis'
}

$sshHost = if ($Environment -eq 'preprod') { 'onscen-staging' } else { 'onscen-prod' }
$remoteEnv = '/opt/onscen/.env'
$pm2App = if ($Environment -eq 'preprod') { 'onscen-backend-staging' } else { 'onscen-backend' }

$tmpLocal = Join-Path $env:TEMP "soundy-apple-env-$Environment.txt"
$lines = @()
foreach ($k in $required + @('APPLE_PRIVATE_KEY', 'APPLE_PRIVATE_KEY_PATH')) {
    if ($vars.ContainsKey($k)) { $lines += "$k=$($vars[$k])" }
}
Set-Content -Path $tmpLocal -Value ($lines -join "`n") -Encoding UTF8

Write-Host "Configuration Apple OAuth sur $Environment ($sshHost)..."
ssh $sshHost "grep -v '^APPLE_' $remoteEnv > ${remoteEnv}.bak 2>/dev/null || true; grep -v '^APPLE_' $remoteEnv > ${remoteEnv}.tmp 2>/dev/null || touch ${remoteEnv}.tmp"
scp $tmpLocal "${sshHost}:${remoteEnv}.apple"
ssh $sshHost "cat ${remoteEnv}.apple >> ${remoteEnv}.tmp && mv ${remoteEnv}.tmp $remoteEnv && rm -f ${remoteEnv}.apple && chmod 600 $remoteEnv && pm2 restart $pm2App --update-env"

Remove-Item $tmpLocal -Force -ErrorAction SilentlyContinue
Write-Host "OK — tester : curl https://getsoundy.com/api/auth/providers (apple: true)"
