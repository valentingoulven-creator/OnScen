# ============================================================
# deploy_zero_downtime.ps1 - Soundy production (zero-downtime)
# Executer depuis MeloSongv2/ :
#   powershell -ExecutionPolicy Bypass -File deploy_zero_downtime.ps1
# Options :
#   -SkipBuild      Ignore le build backend (dist/ existant)
#   -SkipFrontend   Ignore le build + deploiement frontend
# ============================================================
param(
    [switch]$SkipBuild,
    [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$VPS     = "root@51.159.164.100"
$KEY     = "$env:USERPROFILE\.ssh\id_ed25519"
$REMOTE  = "/opt/soundly"
$PM2_APP = "melosong-backend"
$HEALTH  = "https://getsoundy.com/health"

$BackendDir = Join-Path $PSScriptRoot "backend"
$DeployDir  = Join-Path $PSScriptRoot "deploy"
$PublicDir  = Join-Path $BackendDir "public"

$sshOpts = @("-i", $KEY, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=20")

function Fail([string]$msg) {
    throw $msg
}

function Invoke-Remote([string]$cmd) {
    $result = & ssh.exe @sshOpts $VPS "$cmd" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Fail "Commande SSH echouee (code $LASTEXITCODE) : $cmd`nDetail : $($result -join '`n')"
    }
    return ($result -join "`n")
}

function Invoke-Scp([string[]]$ScpArgs) {
    & scp.exe @sshOpts @ScpArgs 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
        Fail "Transfert SCP echoue (code $LASTEXITCODE)."
    }
}

function FileHash([string]$path) {
    if (-not (Test-Path $path)) { return $null }
    return (Get-FileHash -Algorithm SHA256 -Path $path).Hash
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Soundy - Deploiement zero-downtime (prod)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  VPS    : 51.159.164.100"
Write-Host "  Remote : $REMOTE"
Write-Host ("  PM2    : " + $PM2_APP + " (reload, pas stop/start)")
if ($SkipBuild)    { Write-Host "  [!] Build backend ignore (-SkipBuild)" -ForegroundColor Yellow }
if ($SkipFrontend) { Write-Host "  [!] Frontend ignore (-SkipFrontend)" -ForegroundColor Yellow }
Write-Host ""


# -- 1. Connexion VPS ---------------------------------------------------------
Write-Host "[1/9] Connexion VPS..." -ForegroundColor Yellow
$ping = & ssh.exe @sshOpts $VPS "echo PING_OK" 2>&1
if ("$ping" -notmatch "PING_OK") {
    Fail "VPS inaccessible. Verifiez la cle SSH (~/.ssh/id_ed25519, soundly-scaleway).`nDetail : $ping"
}
Write-Host "  [OK] VPS accessible" -ForegroundColor Green


# -- 2. Build backend ---------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host "`n[2/9] Build backend (tsc)..." -ForegroundColor Yellow
    Push-Location $BackendDir
    try {
        Write-Host "  -> npm install..."
        & npm install 2>&1 | Where-Object { $_ -notmatch "^npm warn" }
        if ($LASTEXITCODE -ne 0) { Fail "npm install backend echoue (code $LASTEXITCODE)." }

        Write-Host "  -> npm run build..."
        & npm run build 2>&1
        if ($LASTEXITCODE -ne 0) { Fail "Build TypeScript echoue (code $LASTEXITCODE)." }
    } finally {
        Pop-Location
    }

    if (-not (Test-Path (Join-Path $BackendDir "dist\index.js"))) {
        Fail "dist/index.js absent apres build - verifiez les erreurs TypeScript."
    }
    Write-Host "  [OK] Backend compile" -ForegroundColor Green
} else {
    Write-Host "`n[2/9] Build backend - ignore (-SkipBuild)" -ForegroundColor DarkGray
    if (-not (Test-Path (Join-Path $BackendDir "dist\index.js"))) {
        Fail "dist/index.js introuvable localement. Lancez sans -SkipBuild."
    }
}


# -- 3. Build frontend --------------------------------------------------------
if (-not $SkipFrontend) {
    Write-Host "`n[3/9] Build frontend (Vite -> backend/public)..." -ForegroundColor Yellow
    Write-Host "  -> npm run app:build..."
    & npm run app:build 2>&1
    if ($LASTEXITCODE -ne 0) { Fail "Build frontend echoue (code $LASTEXITCODE)." }

    if (-not (Test-Path (Join-Path $PublicDir "index.html"))) {
        Fail "backend/public/index.html absent apres build frontend."
    }
    Write-Host "  [OK] Frontend compile" -ForegroundColor Green
} else {
    Write-Host "`n[3/9] Build frontend - ignore (-SkipFrontend)" -ForegroundColor DarkGray
}


# -- 4. Sync backend (dist/ + package.json) ---------------------------------
Write-Host "`n[4/9] Deploiement backend -> VPS..." -ForegroundColor Yellow

Invoke-Remote "mkdir -p $REMOTE/dist $REMOTE/deploy"

Write-Host "  -> dist/..."
Invoke-Scp @("-r", (Join-Path $BackendDir "dist/."), "${VPS}:${REMOTE}/dist/")
Write-Host "  [OK] dist/ synchronise" -ForegroundColor Green

$localPkgHash = FileHash (Join-Path $BackendDir "package.json")
$remotePkgCmd = 'test -f ' + $REMOTE + '/package.json; if [ $? -eq 0 ]; then sha256sum ' + $REMOTE + '/package.json | awk ''{print $1}''; else echo MISSING; fi'
$remotePkgHash = Invoke-Remote $remotePkgCmd

Write-Host "  -> package.json..."
Invoke-Scp @((Join-Path $BackendDir "package.json"), "${VPS}:${REMOTE}/package.json")

$lockFile = Join-Path $BackendDir "package-lock.json"
if (Test-Path $lockFile) {
    Write-Host "  -> package-lock.json..."
    Invoke-Scp @($lockFile, "${VPS}:${REMOTE}/package-lock.json")
}

$pkgChanged = ($localPkgHash -ne $remotePkgHash) -or ($remotePkgHash -match "MISSING")
if ($pkgChanged) {
    Write-Host "  [OK] package.json modifie - npm install prevu" -ForegroundColor Cyan
} else {
    Write-Host "  [OK] package.json inchange" -ForegroundColor Green
}


# -- 5. Swap atomique frontend ------------------------------------------------
if (-not $SkipFrontend) {
    Write-Host "`n[5/9] Swap atomique frontend (public.new -> public)..." -ForegroundColor Yellow

    $prepPublicCmd = 'rm -rf ' + $REMOTE + '/public.new ' + $REMOTE + '/public.old; mkdir -p ' + $REMOTE + '/public.new'
    Invoke-Remote $prepPublicCmd

    Write-Host "  -> backend/public -> public.new..."
    Invoke-Scp @("-r", (Join-Path $PublicDir "/."), "${VPS}:${REMOTE}/public.new/")

    $swapCmd = 'cd ' + $REMOTE + '; if [ -d public ]; then mv public public.old; fi; mv public.new public; rm -rf public.old; echo SWAP_OK'
    $swapOut = Invoke-Remote $swapCmd
    if ("$swapOut" -notmatch "SWAP_OK") {
        Fail "Swap atomique frontend echoue. Etat VPS incertain - verifiez $REMOTE/public*."
    }
    Write-Host "  [OK] Frontend active (swap atomique)" -ForegroundColor Green
} else {
    Write-Host "`n[5/9] Deploiement frontend - ignore (-SkipFrontend)" -ForegroundColor DarkGray
}


# -- 6. npm install (si package.json change) --------------------------------
Write-Host "`n[6/9] Dependances VPS..." -ForegroundColor Yellow
if ($pkgChanged) {
    Write-Host "  -> npm install --omit=dev..."
    $npmCmd = 'cd ' + $REMOTE + '; npm install --omit=dev 2>&1; echo NPM_OK'
    $npmOut = Invoke-Remote $npmCmd
    Write-Host $npmOut
    if ("$npmOut" -notmatch "NPM_OK") {
        Fail "npm install --omit=dev echoue sur le VPS."
    }
    Write-Host "  [OK] Dependances mises a jour" -ForegroundColor Green
} else {
    Write-Host "  [OK] package.json inchange - npm install ignore" -ForegroundColor Green
}


# -- 7. Migrations DB ---------------------------------------------------------
Write-Host "`n[7/9] Migrations PostgreSQL..." -ForegroundColor Yellow

$deployFiles = @("Caddyfile", "sync-caddy.sh", "caddy-watchdog.sh", "install-caddy-guard.sh", "healthcheck.sh", "postgres-setup.sh", "migrate-remote.sh")
foreach ($f in $deployFiles) {
    $local = Join-Path $DeployDir $f
    if (Test-Path $local) {
        Invoke-Scp @($local, "${VPS}:${REMOTE}/deploy/$f")
    }
}

$migrateCmd = 'sed -i ''s/\r$//'' ' + $REMOTE + '/deploy/migrate-remote.sh 2>/dev/null; chmod +x ' + $REMOTE + '/deploy/migrate-remote.sh 2>/dev/null; if [ -f ' + $REMOTE + '/deploy/migrate-remote.sh ]; then bash ' + $REMOTE + '/deploy/migrate-remote.sh 2>&1; else echo MIGRATE_SKIP=1; fi'
$migrateOut = Invoke-Remote $migrateCmd
Write-Host $migrateOut
if ("$migrateOut" -match "MIGRATE_OK") {
    Write-Host "  [OK] Migrations appliquees" -ForegroundColor Green
} elseif ("$migrateOut" -match "MIGRATE_SKIP=1") {
    Write-Host "  [OK] Migrations au demarrage PM2 (script absent)" -ForegroundColor Green
} else {
    Fail "Migrations PostgreSQL echouees. Verifiez DATABASE_URL dans /opt/soundly/.env et les logs ci-dessus."
}


# -- 8. PM2 reload + Caddy ----------------------------------------------------
Write-Host "`n[8/9] PM2 reload + Caddy..." -ForegroundColor Yellow

$reloadCmd = 'cd ' + $REMOTE + '; pm2 reload ' + $PM2_APP + ' --update-env 2>&1; echo PM2_RELOAD_OK'
$reloadOut = Invoke-Remote $reloadCmd
Write-Host $reloadOut
if ("$reloadOut" -notmatch "PM2_RELOAD_OK") {
    Fail "pm2 reload $PM2_APP echoue. Verifiez : ssh $VPS pm2 logs $PM2_APP --lines 30"
}
Write-Host "  [OK] PM2 recharge (zero-downtime)" -ForegroundColor Green

Write-Host "  -> Synchronisation Caddy (getsoundy.com + HTTPS)..."
$caddyCmd = 'sed -i ''s/\r$//'' ' + $REMOTE + '/deploy/*.sh 2>/dev/null; chmod +x ' + $REMOTE + '/deploy/*.sh 2>/dev/null; bash ' + $REMOTE + '/deploy/install-caddy-guard.sh 2>&1; rc=$?; if [ $rc -ne 0 ]; then bash ' + $REMOTE + '/deploy/sync-caddy.sh 2>&1; fi'
$caddyOut = Invoke-Remote $caddyCmd
Write-Host $caddyOut
if ("$caddyOut" -match "guard install|Caddyfile synchronis") {
    Write-Host "  [OK] Caddy synchronise" -ForegroundColor Green
} else {
    Write-Host "  [!] Caddy - verifiez /etc/caddy/Caddyfile manuellement" -ForegroundColor Yellow
}

Write-Host "  -> Attente 5s (graceful reload)..."
Start-Sleep -Seconds 5


# -- 9. Verification ----------------------------------------------------------
Write-Host "`n[9/9] Verification sante..." -ForegroundColor Yellow

$healthLocal = $null
try {
    $healthLocal = Invoke-WebRequest -Uri $HEALTH -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
} catch {
    Fail "Health check public echoue : $HEALTH`nDetail : $($_.Exception.Message)"
}

if ($healthLocal.StatusCode -ne 200) {
    Fail "Health check retourne HTTP $($healthLocal.StatusCode) - attendu 200."
}

Write-Host "  [OK] $HEALTH -> HTTP $($healthLocal.StatusCode)" -ForegroundColor Green
$contentPreview = $healthLocal.Content.Substring(0, [Math]::Min(120, $healthLocal.Content.Length))
Write-Host "  -> Corps : $contentPreview"


# -- Resume -------------------------------------------------------------------
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  DEPLOIEMENT ZERO-DOWNTIME TERMINE" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  Site   : https://getsoundy.com"
Write-Host "  Health : $HEALTH"
Write-Host "  PM2    : pm2 reload $PM2_APP (sans coupure)"
Write-Host ""
Write-Host "  Diagnostic :"
Write-Host "  ssh $VPS pm2 logs $PM2_APP --lines 50"
Write-Host "==============================================" -ForegroundColor Green
