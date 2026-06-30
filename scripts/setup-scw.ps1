# setup-scw.ps1 - Configure Scaleway CLI + SSH VPS Soundy + sync .env prod
#
# Usage :
#   powershell -ExecutionPolicy Bypass -File scripts/setup-scw.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/setup-scw.ps1 -SkipLogin
#
# Prerequis : scw installe (winget install Scaleway.cli)

param(
    [switch]$SkipLogin,
    [string]$ServerIp = '51.159.164.100',
    [string]$Zone = 'fr-par-2',
    [string]$Region = 'fr-par'
)

$ErrorActionPreference = 'Stop'

$ScriptRootResolved = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$RepoRoot = (Resolve-Path (Join-Path $ScriptRootResolved '..')).Path
$ScwConfig = Join-Path $env:USERPROFILE '.config\scw\config.yaml'
$SshPub = Join-Path $env:USERPROFILE '.ssh\id_ed25519.pub'
$SshKey = Join-Path $env:USERPROFILE '.ssh\id_ed25519'

function Write-Step([string]$m) { Write-Host "`n>> $m" -ForegroundColor Cyan }
function Write-Ok([string]$m)   { Write-Host "   [OK] $m" -ForegroundColor Green }
function Write-Warn([string]$m) { Write-Host "   [!] $m" -ForegroundColor Yellow }

# Refresh PATH (winget install)
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + `
    [System.Environment]::GetEnvironmentVariable('Path', 'User')

if (-not (Get-Command scw -ErrorAction SilentlyContinue)) {
    throw 'scw introuvable. Installez : winget install Scaleway.cli'
}

Write-Step '1/5 - Authentification Scaleway'
if (-not (Test-Path $ScwConfig)) {
    $accessKey = $env:SCW_ACCESS_KEY
    $secretKey = $env:SCW_SECRET_KEY
    $orgId = $env:SCW_DEFAULT_ORGANIZATION_ID
    $projectId = $env:SCW_DEFAULT_PROJECT_ID

    if ($accessKey -and $secretKey) {
        Write-Host '   Init via SCW_ACCESS_KEY / SCW_SECRET_KEY...' -ForegroundColor DarkGray
        $initArgs = @(
            "access-key=$accessKey",
            "secret-key=$secretKey",
            "region=$Region",
            "zone=$Zone",
            'with-ssh-key=false',
            'send-telemetry=false'
        )
        if ($orgId) { $initArgs += "organization-id=$orgId" }
        if ($projectId) { $initArgs += "project-id=$projectId" }
        & scw init @initArgs
    } elseif (-not $SkipLogin) {
        Write-Host '   Ouverture du navigateur pour connexion Scaleway...' -ForegroundColor White
        Write-Host '   Si echec (expires_at) : creez une cle API manuelle avec date expiration.' -ForegroundColor Yellow
        Write-Host '   https://console.scaleway.com/iam/api-keys' -ForegroundColor DarkGray
        & scw login
    } else {
        throw @"
Config absente ($ScwConfig).
Option A : variables d'environnement SCW_ACCESS_KEY + SCW_SECRET_KEY puis relancez.
Option B : scw init access-key=XXX secret-key=YYY region=fr-par zone=fr-par-1
Option C : scw login (si politique org le permet)
"@
    }
    if (-not (Test-Path $ScwConfig)) {
        throw 'Authentification Scaleway echouee - config.yaml absent'
    }
}
Write-Ok "Config : $ScwConfig"

Write-Step '2/5 - Recherche instance VPS Soundy'
$serversJson = & scw instance server list zone=$Zone -o json 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw "scw instance server list echoue : $serversJson" }
$servers = $serversJson | ConvertFrom-Json
$server = $servers | Where-Object {
    $_.public_ip.address -eq $ServerIp -or
    ($_.name -match 'sound|soundy|melo|getsoundy')
} | Select-Object -First 1
if (-not $server) {
    Write-Warn "Aucun serveur avec IP $ServerIp - liste :"
    $servers | ForEach-Object { Write-Host "     $($_.id)  $($_.name)  $($_.public_ip.address)" }
    throw "Instance introuvable pour IP $ServerIp (zone $Zone)"
}
$serverId = $server.id
Write-Ok "Serveur : $($server.name) ($serverId) - $($server.public_ip.address)"

Write-Step '3/5 - Cle SSH sur le VPS (add-key + reboot)'
if (-not (Test-Path $SshPub)) {
    throw "Cle publique absente : $SshPub - lancez setup-infra-access.ps1 -GenerateSshKey"
}
$pubContent = (Get-Content $SshPub -Raw).Trim()
& scw instance ssh add-key "server-id=$serverId" "zone=$Zone" "public-key=$pubContent" 2>&1 | ForEach-Object { Write-Host "   $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Warn 'add-key a echoue ou cle deja presente - on continue'
}
Write-Host '   Reboot instance (propagation cle SSH)...' -ForegroundColor DarkGray
& scw instance server reboot "server-id=$serverId" "zone=$Zone" 2>&1 | Out-Null
Write-Ok 'Reboot lance - attente 45s'
Start-Sleep -Seconds 45

Write-Step '4/5 - Test SSH'
$sshOk = $false
for ($i = 1; $i -le 6; $i++) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = & ssh.exe -i $SshKey -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o BatchMode=yes `
        "root@$ServerIp" "echo PING_OK" 2>&1 | Out-String
    $ErrorActionPreference = $prev
    if ($LASTEXITCODE -eq 0 -and ($out -match 'PING_OK')) {
        $sshOk = $true
        break
    }
    Write-Host "   Tentative $i/6..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 10
}
if (-not $sshOk) {
    Write-Warn ('SSH echoue apres reboot - essayez : scw instance server console server-id=' + $serverId)
    throw 'SSH non disponible'
}
Write-Ok 'SSH OK'

Write-Step '5/5 - Sync /opt/soundy/.env'
& powershell -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\setup-infra-access.ps1') -PullProdEnv -SyncMsdevFromProd
Write-Ok 'Setup Scaleway + infra termine'
