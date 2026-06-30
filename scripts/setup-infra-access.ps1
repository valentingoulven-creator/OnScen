# setup-infra-access.ps1 — Bootstrap acces agent Cursor vers infra Soundy
#
# Objectif : SSH VPS, sync secrets prod locaux, tests DB / Sightengine / health.
# Ne jamais committer de secrets. Usage :
#   powershell -ExecutionPolicy Bypass -File scripts/setup-infra-access.ps1
#
# Options :
#   -GenerateSshKey     Cree id_ed25519 si absent
#   -PullProdEnv        Recupere /opt/soundy/.env -> backend/.env.production (requiert SSH OK)
#   -SyncMsdevFromProd  Copie variables manquantes (Sightengine, LiveKit, etc.) vers msdev/.env
#   -TestOnly           Diagnostics sans modification

param(
    [switch]$GenerateSshKey,
    [switch]$PullProdEnv,
    [switch]$SyncMsdevFromProd,
    [switch]$TestOnly,
    [string]$ImportFile = ''
)

$ErrorActionPreference = 'Stop'
$script:ExternalErrorAction = 'Continue'

$VpsHost    = '51.159.164.100'
$VpsUser    = 'root'
$VpsTarget  = "${VpsUser}@${VpsHost}"
$RemoteEnv  = '/opt/soundy/.env'
$HealthUrl  = 'https://getsoundy.com/health'
$SshDir     = Join-Path $env:USERPROFILE '.ssh'
$PrimaryKey = Join-Path $SshDir 'id_ed25519'
$AltKey     = Join-Path $SshDir 'soundly-scaleway'

$ScriptRootResolved = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$RepoRoot = (Resolve-Path (Join-Path $ScriptRootResolved '..')).Path

function Write-Step([string]$msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Warn([string]$msg)  { Write-Host "   [!] $msg" -ForegroundColor Yellow }
function Write-Fail([string]$msg)  { Write-Host "   [X] $msg" -ForegroundColor Red }
function Write-Info([string]$msg) { Write-Host "   $msg" -ForegroundColor DarkGray }

function Get-SshKeyPath {
    if (Test-Path $PrimaryKey) { return $PrimaryKey }
    if (Test-Path $AltKey) { return $AltKey }
    return $null
}

function Test-SshConnection([string]$keyPath) {
    if (-not $keyPath) { return $false }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = $script:ExternalErrorAction
    try {
        $out = & ssh.exe -i $keyPath -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o BatchMode=yes `
            $VpsTarget "echo PING_OK" 2>&1 | Out-String
        return ($LASTEXITCODE -eq 0 -and ($out -match 'PING_OK'))
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Ensure-SshKey {
    $existing = Get-SshKeyPath
    if ($existing) {
        Write-Ok "Cle SSH : $existing"
        return $existing
    }
    if (-not $GenerateSshKey -and -not $PullProdEnv) {
        Write-Warn 'Aucune cle SSH (id_ed25519 ou soundly-scaleway)'
        Write-Info 'Relancez avec -GenerateSshKey pour en creer une, ou copiez la cle depuis votre autre poste.'
        return $null
    }
    if (-not (Test-Path $SshDir)) {
        New-Item -ItemType Directory -Path $SshDir -Force | Out-Null
    }
    Write-Info "Generation cle ed25519 : $PrimaryKey"
    & ssh-keygen -t ed25519 -f $PrimaryKey -N '""' -C "soundy-cursor-$(hostname)" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'ssh-keygen a echoue' }
    if (-not (Test-Path $PrimaryKey)) { throw "Cle introuvable apres generation : $PrimaryKey" }
    Write-Ok 'Cle generee'
    return $PrimaryKey
}

function Show-PublicKeyInstructions([string]$keyPath) {
    $pubPath = "$keyPath.pub"
    if (-not (Test-Path $pubPath)) { return }
    Write-Host ''
    Write-Host ' ============================================================' -ForegroundColor Yellow
    Write-Host '  ACTION REQUISE — autoriser cette machine sur le VPS' -ForegroundColor Yellow
    Write-Host ' ============================================================' -ForegroundColor Yellow
    Write-Host ''
    Write-Host "  Depuis un poste deja autorise (ou console Scaleway) :" -ForegroundColor White
    Write-Host "    ssh root@$VpsHost"
    Write-Host '    echo "<CLE_PUBLIQUE_CI_DESSOUS>" >> ~/.ssh/authorized_keys'
    Write-Host ''
    Write-Host '  Cle publique a ajouter :' -ForegroundColor Cyan
    Get-Content $pubPath | ForEach-Object { Write-Host "    $_" -ForegroundColor Green }
    Write-Host ''
    Write-Host '  Puis retester :' -ForegroundColor White
    Write-Host "    powershell -ExecutionPolicy Bypass -File scripts/setup-infra-access.ps1 -TestOnly"
    Write-Host ''
}

function Pull-ProdEnvFile([string]$keyPath) {
    $dest = Join-Path $RepoRoot 'backend\.env.production'
    $backup = "$dest.bak.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    if (Test-Path $dest) {
        Copy-Item $dest $backup -Force
        Write-Info "Sauvegarde : $backup"
    }
    $remoteContent = & ssh.exe -i $keyPath -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 `
        $VpsTarget "cat $RemoteEnv" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Impossible de lire $RemoteEnv sur le VPS : $($remoteContent -join '`n')"
    }
    $remoteContent | Set-Content -Path $dest -Encoding UTF8
    Write-Ok "Prod env synchronise -> backend/.env.production ($($remoteContent.Count) lignes)"
}

function Read-EnvMap([string]$path) {
    $map = @{}
    if (-not (Test-Path $path)) { return $map }
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if ($line -match '^\s*#' -or $line -eq '') { return }
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $map[$Matches[1]] = $Matches[2]
        }
    }
    return $map
}

function Sync-MsdevFromProd {
    $prodPath = Join-Path $RepoRoot 'backend\.env.production'
    $msdevPath = Join-Path $RepoRoot 'msdev\.env'
    if (-not (Test-Path $prodPath)) {
        Write-Warn 'backend/.env.production absent - lancez -PullProdEnv d abord'
        return
    }
    if (-not (Test-Path $msdevPath)) {
        Copy-Item (Join-Path $RepoRoot 'msdev\.env.example') $msdevPath
        Write-Ok 'msdev/.env cree depuis .env.example'
    }
    $prod = Read-EnvMap $prodPath
    $msdevLines = Get-Content $msdevPath
    $msdevKeys = @{}
    foreach ($line in $msdevLines) {
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=') { $msdevKeys[$Matches[1]] = $true }
    }
    $syncKeys = @(
        'SIGHTENGINE_API_USER', 'SIGHTENGINE_API_SECRET', 'SIGHTENGINE_ENABLED',
        'SIGHTENGINE_FAIL_OPEN', 'SIGHTENGINE_MODERATE_REMOTE',
        'SIGHTENGINE_EXPLICIT_THRESHOLD', 'SIGHTENGINE_EROTICA_THRESHOLD', 'SIGHTENGINE_OFFENSIVE_THRESHOLD',
        'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET',
        'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_API_TOKEN', 'CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN',
        'DATABASE_URL', 'PG_SSL', 'PG_POOL_MAX'
    )
    $added = @()
    $newLines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $msdevLines) { [void]$newLines.Add([string]$line) }
    foreach ($key in $syncKeys) {
        if ($msdevKeys.ContainsKey($key)) { continue }
        if (-not $prod.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($prod[$key])) { continue }
        $newLines.Add("$key=$($prod[$key])")
        $added += $key
    }
    if ($added.Count -eq 0) {
        Write-Ok 'msdev/.env deja a jour (rien a synchroniser)'
        return
    }
    $newLines | Set-Content -Path $msdevPath -Encoding UTF8
    Write-Ok ("Variables ajoutees a msdev/.env : " + ($added -join ', '))
    Write-Warn 'DATABASE_URL prod copiee pour tests locaux - ne jamais committer msdev/.env'
}

function Test-EnvVarPresent([hashtable]$envMap, [string]$key) {
    if ($envMap.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($envMap[$key])) {
        Write-Ok "$key configure"
        return $true
    }
    Write-Warn "$key absent ou vide"
    return $false
}

function Test-DatabaseUrl([string]$databaseUrl) {
    if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
        Write-Warn 'DATABASE_URL absent - pas de test DB'
        return
    }
    if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
        Write-Warn 'psql absent - installez PostgreSQL client ou testez via SSH sur le VPS'
        Write-Info 'Alternative : ssh root@51.159.164.100 "cd /opt/soundy/backend && node -e ..."'
        return
    }
    $out = & psql $databaseUrl -c 'SELECT 1 AS ok;' 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok 'Connexion PostgreSQL OK'
    } else {
        Write-Warn ("Connexion PostgreSQL echouee - whitelist IP Scaleway ? Detail : " + ($out -join ' '))
        Write-Info 'Scaleway console > Databases > soundy-prod > Allowed IPs > ajouter votre IP publique'
    }
}

# --- Main -------------------------------------------------------------------
Write-Host ''
Write-Host ' ============================================================' -ForegroundColor Magenta
Write-Host '  Soundy - Setup acces infra (agent Cursor)' -ForegroundColor Magenta
Write-Host ' ============================================================' -ForegroundColor Magenta
Write-Host "  Repo : $RepoRoot"
Write-Host "  VPS  : $VpsTarget"
Write-Host ' ============================================================' -ForegroundColor Magenta

$keyPath = Ensure-SshKey | Select-Object -Last 1
$sshOk = $false
if ($keyPath) {
    $sshOk = Test-SshConnection $keyPath
    if ($sshOk) {
        Write-Ok "SSH VPS OK"
    } else {
        Write-Warn 'SSH VPS echoue — cle non autorisee sur le VPS'
        Show-PublicKeyInstructions $keyPath
    }
} else {
    Write-Warn 'SSH non configure'
}

if ($ImportFile) {
    $dest = Join-Path $RepoRoot 'backend\.env.production'
    if (-not (Test-Path $ImportFile)) { throw "Fichier introuvable : $ImportFile" }
    Copy-Item $ImportFile $dest -Force
    Write-Ok "Import -> backend/.env.production"
    $SyncMsdevFromProd = $true
}

if ($PullProdEnv) {
    if (-not $sshOk) {
        Write-Warn 'SSH indisponible - utilisez -ImportFile avec un export console (cat /opt/soundy/.env)'
        if (-not $ImportFile) { throw 'SSH requis pour -PullProdEnv sans -ImportFile.' }
    } else {
        Write-Step 'Synchronisation /opt/soundy/.env'
        Pull-ProdEnvFile $keyPath
    }
}

if ($SyncMsdevFromProd) {
    Write-Step 'Sync msdev/.env depuis backend/.env.production'
    Sync-MsdevFromProd
}

Write-Step 'Diagnostics'

try {
    $health = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 15
    if ($health.StatusCode -eq 200) { Write-Ok "Health prod : $HealthUrl" }
} catch {
    Write-Warn "Health prod : $($_.Exception.Message)"
}

$prodEnvPath = Join-Path $RepoRoot 'backend\.env.production'
$msdevEnvPath = Join-Path $RepoRoot 'msdev\.env'
$prodMap = Read-EnvMap $prodEnvPath
$msdevMap = Read-EnvMap $msdevEnvPath

Write-Info 'backend/.env.production :'
Test-EnvVarPresent $prodMap 'DATABASE_URL' | Out-Null
Test-EnvVarPresent $prodMap 'SIGHTENGINE_API_USER' | Out-Null
Test-EnvVarPresent $prodMap 'LIVEKIT_URL' | Out-Null

Write-Info 'msdev/.env :'
Test-EnvVarPresent $msdevMap 'SIGHTENGINE_API_USER' | Out-Null
$hasDb = Test-EnvVarPresent $msdevMap 'DATABASE_URL'

if ($hasDb) {
    Test-DatabaseUrl $msdevMap['DATABASE_URL']
}

Write-Host ''
Write-Host ' ============================================================' -ForegroundColor Green
Write-Host '  Prochaines etapes' -ForegroundColor Green
Write-Host ' ============================================================' -ForegroundColor Green
if (-not $sshOk) {
    Write-Host '  1. Autoriser la cle SSH sur le VPS (voir instructions ci-dessus)' -ForegroundColor Yellow
    Write-Host '  2. Relancer : scripts/setup-infra-access.ps1 -PullProdEnv -SyncMsdevFromProd' -ForegroundColor White
} else {
    Write-Host '  SSH OK - l agent peut deployer et lire les logs VPS.' -ForegroundColor Green
    if (-not (Test-Path $prodEnvPath) -or $prodMap.Count -lt 5) {
        Write-Host '  Lancez : scripts/setup-infra-access.ps1 -PullProdEnv -SyncMsdevFromProd' -ForegroundColor White
    }
}
Write-Host '  Regle agent : .cursor/rules/infra-access.mdc' -ForegroundColor DarkGray
Write-Host ' ============================================================' -ForegroundColor Green
Write-Host ''
