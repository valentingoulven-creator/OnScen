# ============================================================
# commun/deploy/deploy_zero_downtime.ps1 - OnScen deploy (prod / preprod)
# Executer depuis la racine du repo :
#   powershell -ExecutionPolicy Bypass -File commun/deploy/deploy_zero_downtime.ps1
#   powershell -ExecutionPolicy Bypass -File commun/deploy/deploy_zero_downtime.ps1 -Environment preprod
# Options :
#   -Environment    prod (defaut) | preprod
#   -SkipBuild      Ignore le build backend (dist/ existant)
#   -SkipFrontend   Ignore le build + deploiement frontend
#   -VerifyProd      Lance verify-prod.sh sur le VPS apres deploy (prod uniquement)
# ============================================================
param(
    [ValidateSet('prod', 'preprod')]
    [string]$Environment = 'prod',
    [switch]$SkipBuild,
    [switch]$SkipFrontend,
    [switch]$VerifyProd
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $RepoRoot

. (Join-Path $PSScriptRoot "environments.ps1")
$cfg = Get-OnScenDeployEnvironment $Environment

$VPS     = $cfg.Vps
$SSH_HOST = $cfg.SshHost
$REMOTE  = $cfg.Remote
$PM2_APP = $cfg.Pm2App
$HEALTH  = $cfg.Health
$SITE    = $cfg.SiteUrl
$ENV_LABEL = $cfg.Label

$BackendDir = Join-Path $RepoRoot "commun\backend"
$DeployDir  = $PSScriptRoot
$PublicDir  = Join-Path $BackendDir "public"

$KEY = if ($env:DEPLOY_SSH_KEY -and (Test-Path $env:DEPLOY_SSH_KEY)) {
    $env:DEPLOY_SSH_KEY
} elseif (-not $env:SSH_AUTH_SOCK -and (Test-Path "$env:USERPROFILE\.ssh\id_ed25519")) {
    "$env:USERPROFILE\.ssh\id_ed25519"
} else {
    $null
}
$sshTarget = if ($env:DEPLOY_SSH_HOST) {
    $env:DEPLOY_SSH_HOST
} elseif ($SSH_HOST -and (Test-Path (Join-Path $env:USERPROFILE ".ssh\config"))) {
    $SSH_HOST
} else {
    $VPS
}
$sshOpts = @("-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=20", "-o", "LogLevel=ERROR", "-o", "BatchMode=yes")
if ($KEY -and (Test-Path $KEY)) {
    $sshOpts = @("-i", $KEY, "-o", "IdentitiesOnly=yes") + $sshOpts
} elseif ($env:SSH_AUTH_SOCK) {
    $sshOpts = @("-o", "IdentityAgent=$($env:SSH_AUTH_SOCK)") + $sshOpts
}

function Fail([string]$msg) {
    throw $msg
}

function Get-SshExecutable() {
    if (Get-Command ssh.exe -ErrorAction SilentlyContinue) { return 'ssh.exe' }
    if (Get-Command ssh -ErrorAction SilentlyContinue) { return 'ssh' }
    Fail 'ssh introuvable (OpenSSH requis).'
}

function Get-ScpExecutable() {
    if (Get-Command scp.exe -ErrorAction SilentlyContinue) { return 'scp.exe' }
    if (Get-Command scp -ErrorAction SilentlyContinue) { return 'scp' }
    Fail 'scp introuvable (OpenSSH requis).'
}

$sshExe = Get-SshExecutable
$scpExe = Get-ScpExecutable

function Invoke-Remote([string]$cmd) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $result = & $sshExe @sshOpts $sshTarget "$cmd" 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($code -ne 0) {
        Fail "Commande SSH echouee (code $code) : $cmd`nDetail : $($result -join '`n')"
    }
    return ($result -join "`n")
}

# VPS : preferer le repertoire actif (PM2 + .env)
$REMOTE = (Invoke-Remote "if [ -f /opt/onscen/.env ]; then echo /opt/onscen; elif [ -f /opt/onscen/.env ]; then echo /opt/onscen; elif [ -d /opt/onscen ]; then echo /opt/onscen; else echo /opt/onscen; fi").Trim()

function Invoke-Scp([string[]]$ScpArgs) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $scpExe @sshOpts @ScpArgs 2>&1 | ForEach-Object { Write-Host $_ }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($code -ne 0) {
        Fail "Transfert SCP echoue (code $code)."
    }
}

function FileHash([string]$path) {
    if (-not (Test-Path $path)) { return $null }
    return (Get-FileHash -Algorithm SHA256 -Path $path).Hash
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  OnScen - Deploiement zero-downtime ($ENV_LABEL)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Env    : $Environment ($ENV_LABEL)"
Write-Host "  VPS    : $VPS"
Write-Host "  SSH    : $sshTarget"
Write-Host "  Remote : $REMOTE"
Write-Host ("  PM2    : " + $PM2_APP + " (reload, pas stop/start)")
if ($SkipBuild)    { Write-Host "  [!] Build backend ignore (-SkipBuild)" -ForegroundColor Yellow }
if ($SkipFrontend) { Write-Host "  [!] Frontend ignore (-SkipFrontend)" -ForegroundColor Yellow }
if ($VerifyProd)   { Write-Host "  [+] Verify-prod actif (-VerifyProd)" -ForegroundColor Cyan }
Write-Host ""
if ($Environment -eq 'prod') {
    Write-Host "  [!] RAPPEL : creer un snapshot VPS Scaleway avant upgrade majeur" -ForegroundColor Yellow
    Write-Host "      Console -> Instances -> Snapshots (voir commun/deploy/snapshot-vps-reminder.sh)" -ForegroundColor Yellow
    Write-Host ""
}


# -- 1. Connexion VPS ---------------------------------------------------------
Write-Host "[1/9] Connexion VPS..." -ForegroundColor Yellow
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$ping = & $sshExe @sshOpts $sshTarget "echo PING_OK" 2>&1
$pingCode = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ("$ping" -notmatch "PING_OK") {
    Fail "VPS inaccessible ($sshTarget). Verifiez la cle SSH (~/.ssh/id_ed25519).`nDetail : $ping"
}
Write-Host "  [OK] VPS accessible" -ForegroundColor Green

# -- 1b. Sauvegarde rollback (dist/ + public/ avant modification) ------------
Write-Host "`n[1b/9] Sauvegarde pre-deploiement (rollback)..." -ForegroundColor Yellow
$backupCmd = 'cd ' + $REMOTE + '; rm -rf dist.bak public.bak; if [ -d dist ]; then cp -a dist dist.bak; fi; if [ -d public ] && [ ! -L public ]; then cp -a public public.bak; fi; echo BACKUP_OK'
$backupOut = Invoke-Remote $backupCmd
if ("$backupOut" -match "BACKUP_OK") {
    Write-Host "  [OK] dist.bak / public.bak crees sur le VPS (rollback possible)" -ForegroundColor Green
} else {
    Write-Host "  [!] Sauvegarde rollback impossible - deploiement sans filet en cas d'echec" -ForegroundColor Yellow
}

# Rollback automatique : restaure dist.bak/public.bak, recharge PM2, revalide le health
# check. Utilise si le reload PM2 ou le health check final echoue (cf. modification.txt).
function Invoke-AutoRollback([string]$reason) {
    Write-Host ""
    Write-Host "==============================================" -ForegroundColor Red
    Write-Host "  ECHEC DEPLOIEMENT - ROLLBACK AUTOMATIQUE" -ForegroundColor Red
    Write-Host "==============================================" -ForegroundColor Red
    Write-Host "  Raison : $reason" -ForegroundColor Red

    $restoreCmd = 'cd ' + $REMOTE + '; ok=1; if [ -d dist.bak ]; then rm -rf dist; mv dist.bak dist; else ok=0; fi; if [ -d public.bak ]; then rm -rf public; mv public.bak public; fi; echo RESTORE_DONE=$ok'
    $restoreOut = ''
    try { $restoreOut = Invoke-Remote $restoreCmd } catch { Write-Host "  [!] Restauration fichiers echouee : $_" -ForegroundColor Red }
    Write-Host $restoreOut

    if ("$restoreOut" -notmatch "RESTORE_DONE=1") {
        Fail "Rollback impossible (pas de dist.bak sur le VPS). Intervention manuelle requise immediatement.`nDiagnostic : ssh $sshTarget pm2 logs $PM2_APP --lines 50"
    }

    Write-Host "  -> Rechargement PM2 avec la version precedente..." -ForegroundColor Yellow
    $ecoFile = Split-Path -Leaf $cfg.EcosystemFile
    $rollbackReloadCmd = 'cd ' + $REMOTE + '; set -a; . ./.env; set +a; pm2 startOrReload deploy/' + $ecoFile + ' --update-env 2>&1; pm2 save 2>&1; echo PM2_ROLLBACK_OK'
    $rollbackReloadOut = ''
    try { $rollbackReloadOut = Invoke-Remote $rollbackReloadCmd } catch { Write-Host "  [!] pm2 reload post-rollback echoue : $_" -ForegroundColor Red }
    Write-Host $rollbackReloadOut

    Start-Sleep -Seconds 5
    $rollbackHealthOk = $false
    try {
        $rb = Invoke-WebRequest -Uri $HEALTH -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
        $rollbackHealthOk = ($rb.StatusCode -eq 200)
    } catch { }

    if ($rollbackHealthOk) {
        Write-Host ""
        Write-Host "  [OK] Rollback reussi - version precedente restauree et saine ($HEALTH)" -ForegroundColor Green
        Write-Host "  Le code defaillant n'a PAS ete deploye. Corrigez puis relancez." -ForegroundColor Yellow
        Fail "Deploiement annule : $reason (rollback automatique reussi, service restaure)."
    } else {
        Write-Host ""
        Write-Host "  [!!] Rollback applique mais health check toujours en echec." -ForegroundColor Red
        Fail "Deploiement ET rollback en echec ($reason). INTERVENTION MANUELLE IMMEDIATE REQUISE.`nssh $sshTarget pm2 logs $PM2_APP --lines 50`nssh $sshTarget pm2 status"
    }
}

$snapshotReminder = Join-Path $DeployDir "snapshot-vps-reminder.sh"
if ($Environment -eq 'prod' -and (Test-Path $snapshotReminder)) {
    Write-Host "  -> Rappel snapshot VPS (non bloquant)..." -ForegroundColor DarkGray
    try {
        Invoke-Scp @($snapshotReminder, "${sshTarget}:${REMOTE}/deploy/snapshot-vps-reminder.sh")
        Invoke-Remote "sed -i 's/\r$//' ${REMOTE}/deploy/snapshot-vps-reminder.sh 2>/dev/null; chmod +x ${REMOTE}/deploy/snapshot-vps-reminder.sh 2>/dev/null; bash ${REMOTE}/deploy/snapshot-vps-reminder.sh" | Out-Null
    } catch {
        Write-Host "  [!] snapshot-vps-reminder ignore (non bloquant)" -ForegroundColor DarkGray
    }
}


# -- 2. Build backend ---------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host "`n[2/9] Build backend (tsc)..." -ForegroundColor Yellow
    Push-Location $BackendDir
    try {
        Write-Host "  -> npm install..."
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & npm install 2>&1 | Where-Object { "$_" -notmatch '^npm warn' }
        $npmCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEap
        if ($npmCode -ne 0) { Fail "npm install backend echoue (code $npmCode)." }

        # build:prod = tsc + retrait des modules dev-only non conformes ToS tiers
        # (fallback Piped/Invidious YouTube, cf. audit YT-2) du bundle livre en
        # prod/preprod, en plus du garde-fou runtime deja existant.
        Write-Host "  -> npm run build:prod..."
        $ErrorActionPreference = 'Continue'
        & npm run build:prod 2>&1
        $buildCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEap
        if ($buildCode -ne 0) { Fail "Build TypeScript echoue (code $buildCode)." }
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
    $syncSentryScript = Join-Path $RepoRoot 'commun\scripts\sync-app-sentry-env.ps1'
    $backendEnvName = if ($Environment -eq 'preprod') { 'preproduction' } else { 'production' }
    $backendEnvPath = Join-Path $RepoRoot "commun/backend\.env.$backendEnvName"
    if ((Test-Path $syncSentryScript) -and (Test-Path $backendEnvPath)) {
        Write-Host "  -> sync-app-sentry-env.ps1 ($backendEnvName)..." -ForegroundColor DarkGray
        & powershell -ExecutionPolicy Bypass -File $syncSentryScript -Environment $backendEnvName
        if ($LASTEXITCODE -ne 0) { Fail "sync-app-sentry-env.ps1 a echoue." }
    }

    $viteEnvFile = Join-Path $RepoRoot $cfg.ViteEnvFile
    if (-not (Test-Path $viteEnvFile)) {
        $example = "$viteEnvFile.example"
        if (Test-Path $example) {
            Write-Host "  -> Copie $example -> $viteEnvFile" -ForegroundColor DarkGray
            Copy-Item $example $viteEnvFile
        } else {
            Fail "Fichier Vite manquant : $viteEnvFile (voir $($cfg.ViteEnvFile).example)"
        }
    }

    if ($Environment -eq 'preprod') {
        Write-Host "  -> npm run app:build:preprod..."
        $ErrorActionPreference = 'Continue'
        & npm run app:build:preprod 2>&1
        $feCode = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
    } else {
        Write-Host "  -> npm run app:build..."
        $ErrorActionPreference = 'Continue'
        & npm run app:build 2>&1
        $feCode = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
    }
    if ($feCode -ne 0) { Fail "Build frontend echoue (code $feCode)." }

    Write-Host "  -> npm run apptel:build..."
    $ErrorActionPreference = 'Continue'
    & npm run apptel:build 2>&1
    $telCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($telCode -ne 0) { Fail "Build apptel echoue (code $telCode)." }

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
Invoke-Scp @("-r", (Join-Path $BackendDir "dist/."), "${sshTarget}:${REMOTE}/dist/")
Write-Host "  [OK] dist/ synchronise" -ForegroundColor Green

$localPkgHash = FileHash (Join-Path $BackendDir "package.json")
$remotePkgCmd = 'test -f ' + $REMOTE + '/package.json; if [ $? -eq 0 ]; then sha256sum ' + $REMOTE + '/package.json | awk ''{print $1}''; else echo MISSING; fi'
$remotePkgHash = Invoke-Remote $remotePkgCmd

Write-Host "  -> package.json..."
Invoke-Scp @((Join-Path $BackendDir "package.json"), "${sshTarget}:${REMOTE}/package.json")

$lockFile = Join-Path $BackendDir "package-lock.json"
if (Test-Path $lockFile) {
    Write-Host "  -> package-lock.json..."
    Invoke-Scp @($lockFile, "${sshTarget}:${REMOTE}/package-lock.json")
}

$pkgChanged = ($localPkgHash -ne $remotePkgHash) -or ($remotePkgHash -match "MISSING")
if ($pkgChanged) {
    Write-Host "  [OK] package.json modifie - npm install prevu" -ForegroundColor Cyan
} else {
    Write-Host "  [OK] package.json inchange" -ForegroundColor Green
}


# -- 5. Fusion frontend (public.new -> public, conserve anciens chunks) ---------
if (-not $SkipFrontend) {
    Write-Host "`n[5/9] Fusion frontend (public.new -> public)..." -ForegroundColor Yellow

    $prepPublicCmd = 'rm -rf ' + $REMOTE + '/public.new; mkdir -p ' + $REMOTE + '/public.new'
    Invoke-Remote $prepPublicCmd

    Write-Host "  -> backend/public -> public.new..."
    Invoke-Scp @("-r", (Join-Path $PublicDir "/."), "${sshTarget}:${REMOTE}/public.new/")

    # Fusion dans public/ : conserve les anciens chunks hash?s (clients avec bundle stale)
    # tout en mettant ? jour index.html, sw.js et les nouveaux assets.
    $mergeCmd = 'cd ' + $REMOTE + '; mkdir -p public/uploads; if [ -d public ]; then cp -a public.new/. public/; else mv public.new public; fi; rm -rf public.new; echo MERGE_OK'
    $mergeOut = Invoke-Remote $mergeCmd
    if ("$mergeOut" -notmatch "MERGE_OK") {
        Fail "Fusion frontend echoue. Etat VPS incertain - verifiez $REMOTE/public*."
    }
    Write-Host "  [OK] Frontend fusionne (anciens chunks conserves)" -ForegroundColor Green
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

$deployFiles = @(
    "Caddyfile", "Caddyfile.staging", "sync-caddy.sh", "sync-caddy-staging.sh",
    "caddy-watchdog.sh", "install-caddy-guard.sh", "healthcheck.sh",
    "postgres-setup.sh", "migrate-remote.sh", "backup-db.sh", "backup-uploads.sh", "backup-offsite.sh",
    "verify-backup.sh", "verify-prod.sh", "verify-scaleway-backup.sh", "setup-scaleway-object-storage.sh", "setup-phase0-prod.sh", "snapshot-vps-reminder.sh",
    "install-backup-cron.sh", "install-uploads-backup-cron.sh", "install-offsite-backup-cron.sh",
    "install-health-cron.sh", "setup-legal-publisher.sh", "ecosystem.config.cjs", "ecosystem.staging.config.cjs",
    "bootstrap-staging-vps.sh", "setup-staging-db.sh",
    "monitor-alerts.sh", "install-monitor-cron.sh", "pm2-reload-intentional.sh"
)
foreach ($f in $deployFiles) {
    $local = Join-Path $DeployDir $f
    if (Test-Path $local) {
        Invoke-Scp @($local, "${sshTarget}:${REMOTE}/deploy/$f")
    }
}
$deployLibDir = Join-Path $DeployDir "lib"
if (Test-Path $deployLibDir) {
    Invoke-Remote "mkdir -p ${REMOTE}/deploy/lib"
    Invoke-Scp @("-r", (Join-Path $deployLibDir "/."), "${sshTarget}:${REMOTE}/deploy/lib/")
}

$migrateCmd = 'sed -i ''s/\r$//'' ' + $REMOTE + '/deploy/migrate-remote.sh ' + $REMOTE + '/deploy/lib/*.sh 2>/dev/null; chmod +x ' + $REMOTE + '/deploy/migrate-remote.sh 2>/dev/null; if [ -f ' + $REMOTE + '/deploy/migrate-remote.sh ]; then ONSCEN_ROOT=' + $REMOTE + ' bash ' + $REMOTE + '/deploy/migrate-remote.sh 2>&1; else echo MIGRATE_SKIP=1; fi'
$migrateOut = Invoke-Remote $migrateCmd
Write-Host $migrateOut
if ("$migrateOut" -match "MIGRATE_OK") {
    Write-Host "  [OK] Migrations appliquees" -ForegroundColor Green
} elseif ("$migrateOut" -match "MIGRATE_SKIP=1") {
    Write-Host "  [OK] Migrations au demarrage PM2 (script absent)" -ForegroundColor Green
} else {
    Fail "Migrations PostgreSQL echouees. Verifiez DATABASE_URL dans ${REMOTE}/.env et les logs ci-dessus."
}


# -- 7b. Phase 0 scale (Redis + env S3) - prod uniquement ----------------------
if ($Environment -eq 'prod') {
    Write-Host "`n[7b/9] Phase 0 scale (Redis + S3 env)..." -ForegroundColor Yellow
    $phase0Cmd = 'sed -i ''s/\r$//'' ' + $REMOTE + '/deploy/setup-phase0-prod.sh 2>/dev/null; chmod +x ' + $REMOTE + '/deploy/setup-phase0-prod.sh 2>/dev/null; bash ' + $REMOTE + '/deploy/setup-phase0-prod.sh 2>&1; echo PHASE0_OK'
    $phase0Out = Invoke-Remote $phase0Cmd
    Write-Host $phase0Out
    if ("$phase0Out" -match "PHASE0_OK") {
        Write-Host "  [OK] Phase 0 infra (Redis / env)" -ForegroundColor Green
    } else {
        Write-Host "  [!] Phase 0 - verifiez Redis manuellement" -ForegroundColor Yellow
    }
}


# -- 8. PM2 reload + Caddy ----------------------------------------------------
Write-Host "`n[8/9] PM2 reload + Caddy..." -ForegroundColor Yellow

$gitCommit = ""
try {
    $gitCommit = (& git -C $RepoRoot rev-parse --short HEAD 2>$null).Trim()
} catch { }
$deployCommitEnv = ""
if ($gitCommit) {
    $deployCommitEnv = "DEPLOY_COMMIT=$gitCommit "
}

$markIntentionalFlag = 'printf ''%s\n%s\n'' "$(date +%s)" "deploy" > /tmp/onscen-pm2-reload-intentional'
Invoke-Remote $markIntentionalFlag | Out-Null

$pm2ExistsCmd = 'pm2 describe ' + $PM2_APP + ' >/dev/null 2>&1 && echo PM2_EXISTS || echo PM2_MISSING'
$pm2Exists = Invoke-Remote $pm2ExistsCmd
if ("$pm2Exists" -match "PM2_MISSING") {
    Write-Host "  -> Premier demarrage PM2 ($PM2_APP)..." -ForegroundColor Cyan
    $ecoFile = Split-Path -Leaf $cfg.EcosystemFile
    $startCmd = 'cd ' + $REMOTE + '; mkdir -p logs; set -a; . ./.env; set +a; pm2 delete ' + $PM2_APP + ' 2>/dev/null; pm2 start deploy/' + $ecoFile + ' 2>&1; pm2 save 2>&1; echo PM2_START_OK'
    $startOut = Invoke-Remote $startCmd
    Write-Host $startOut
    if ("$startOut" -notmatch "PM2_START_OK") {
        Fail "pm2 start $PM2_APP echoue. Verifiez .env et : ssh $sshTarget pm2 logs $PM2_APP --lines 30"
    }
    Write-Host "  [OK] PM2 demarre" -ForegroundColor Green
} else {
    $ecoFile = Split-Path -Leaf $cfg.EcosystemFile
    $pm2ModeCmd = 'pm2 show ' + $PM2_APP + ' 2>/dev/null | grep "exec mode" || echo PM2_FORK'
    $pm2Mode = Invoke-Remote $pm2ModeCmd
    if ("$pm2Mode" -match "fork_mode|fork mode|PM2_FORK") {
        Write-Host "  -> Migration PM2 fork -> cluster (ecosystem)..." -ForegroundColor Cyan
        $reloadCmd = 'cd ' + $REMOTE + '; set -a; . ./.env; set +a; ' + $deployCommitEnv + 'pm2 delete ' + $PM2_APP + ' 2>/dev/null; pm2 start deploy/' + $ecoFile + ' --update-env 2>&1; pm2 save 2>&1; echo PM2_RELOAD_OK'
    } else {
        $reloadCmd = 'cd ' + $REMOTE + '; set -a; . ./.env; set +a; ' + $deployCommitEnv + 'pm2 startOrReload deploy/' + $ecoFile + ' --update-env 2>&1; pm2 save 2>&1; echo PM2_RELOAD_OK'
    }
    $reloadOut = Invoke-Remote $reloadCmd
    Write-Host $reloadOut
    if ("$reloadOut" -notmatch "PM2_RELOAD_OK") {
        Invoke-AutoRollback "pm2 reload $PM2_APP echoue"
    }
    Write-Host "  [OK] PM2 recharge (zero-downtime)" -ForegroundColor Green
}

if ($Environment -eq 'preprod') {
    Write-Host "  -> Synchronisation Caddy (staging.onscen.com)..."
    $caddyCmd = 'sed -i ''s/\r$//'' ' + $REMOTE + '/deploy/*.sh 2>/dev/null; chmod +x ' + $REMOTE + '/deploy/*.sh 2>/dev/null; bash ' + $REMOTE + '/deploy/sync-caddy-staging.sh 2>&1'
} else {
    Write-Host "  -> Synchronisation Caddy (onscen.com + HTTPS)..."
    $caddyCmd = 'sed -i ''s/\r$//'' ' + $REMOTE + '/deploy/*.sh 2>/dev/null; chmod +x ' + $REMOTE + '/deploy/*.sh 2>/dev/null; bash ' + $REMOTE + '/deploy/install-caddy-guard.sh 2>&1; rc=$?; if [ $rc -ne 0 ]; then bash ' + $REMOTE + '/deploy/sync-caddy.sh 2>&1; fi'
}
$caddyOut = Invoke-Remote $caddyCmd
Write-Host $caddyOut
if ("$caddyOut" -match "guard install|Caddyfile synchronis|staging synchronis") {
    Write-Host "  [OK] Caddy synchronise" -ForegroundColor Green
} else {
    Write-Host "  [!] Caddy - verifiez /etc/caddy/Caddyfile manuellement" -ForegroundColor Yellow
}

Write-Host "  -> Attente 8s (graceful reload)..."
Start-Sleep -Seconds 8


# -- 9. Verification ----------------------------------------------------------
Write-Host "`n[9/9] Verification sante..." -ForegroundColor Yellow

$healthLocal = $null
$healthTried = $HEALTH
if ($Environment -eq 'preprod') {
    $healthCandidates = @('http://51.159.170.181/health', $HEALTH, 'https://51.159.170.181/health')
} else {
    $healthCandidates = @($HEALTH)
}
$healthErr = $null
$maxAttempts = 5
for ($attempt = 1; $attempt -le $maxAttempts -and -not $healthLocal; $attempt++) {
    if ($attempt -gt 1) {
        Write-Host "  -> Nouvelle tentative ($attempt/$maxAttempts) dans 4s..." -ForegroundColor DarkYellow
        Start-Sleep -Seconds 4
    }
    foreach ($candidate in $healthCandidates) {
        try {
            if ($candidate -like 'https://*') {
                $curlOut = & curl.exe -sk -w "`n%{http_code}" $candidate 2>$null
                if ($curlOut -match '(\d{3})$') {
                    $code = [int]$Matches[1]
                    if ($code -eq 200) {
                        $healthLocal = [PSCustomObject]@{ StatusCode = 200; Content = ($curlOut -replace '\d{3}$','').Trim() }
                        $healthTried = $candidate
                        break
                    }
                    $healthErr = "HTTP $code"
                } else {
                    $healthErr = "curl sans code HTTP"
                }
                continue
            }
            $healthLocal = Invoke-WebRequest -Uri $candidate -UseBasicParsing -TimeoutSec 25 -ErrorAction Stop
            $healthTried = $candidate
            break
        } catch {
            $healthErr = $_.Exception.Message
        }
    }
}
if (-not $healthLocal) {
    # Filet de securite : la machine locale peut avoir un probleme reseau/DNS
    # transitoire alors que le service est en realite sain. On revalide depuis
    # le VPS lui-meme (boucle locale + verification du domaine public) avant
    # de declencher un rollback qui annulerait un deploiement reussi.
    Write-Host "  -> Check local en echec, revalidation depuis le VPS..." -ForegroundColor DarkYellow
    $vpsHealthCmd = 'code=$(curl -sk -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health); echo "LOCAL_CODE=$code"; code2=$(curl -sk -o /dev/null -w "%{http_code}" ' + $HEALTH + '); echo "PUBLIC_CODE=$code2"'
    $vpsHealthOut = ''
    try { $vpsHealthOut = Invoke-Remote $vpsHealthCmd } catch { $vpsHealthOut = "ERREUR : $_" }
    Write-Host $vpsHealthOut
    if ("$vpsHealthOut" -match "LOCAL_CODE=200" -and "$vpsHealthOut" -match "PUBLIC_CODE=200") {
        Write-Host "  [OK] Service confirme sain depuis le VPS (probleme reseau local cote machine de deploiement)." -ForegroundColor Green
        $healthLocal = [PSCustomObject]@{ StatusCode = 200; Content = "(verifie depuis le VPS, check local indisponible)" }
    } else {
        Invoke-AutoRollback "Health check public echoue apres $maxAttempts tentatives ($($healthCandidates -join ', ')) - Detail : $healthErr`nVerification VPS : $vpsHealthOut"
    }
}

if ($healthLocal.StatusCode -ne 200) {
    Invoke-AutoRollback "Health check retourne HTTP $($healthLocal.StatusCode) - attendu 200."
}

Write-Host "  [OK] $healthTried -> HTTP $($healthLocal.StatusCode)" -ForegroundColor Green
$contentPreview = $healthLocal.Content.Substring(0, [Math]::Min(120, $healthLocal.Content.Length))
Write-Host "  -> Corps : $contentPreview"

if ($VerifyProd -and $Environment -eq 'prod') {
    Write-Host "`n  -> verify-prod.sh sur le VPS..." -ForegroundColor Cyan
    $verifyCmd = 'sed -i ''s/\r$//'' ' + $REMOTE + '/deploy/verify-prod.sh 2>/dev/null; chmod +x ' + $REMOTE + '/deploy/verify-prod.sh 2>/dev/null; bash ' + $REMOTE + '/deploy/verify-prod.sh 2>&1; echo VERIFY_PROD_EXIT=$?'
    $verifyOut = Invoke-Remote $verifyCmd
    Write-Host $verifyOut
    if ("$verifyOut" -notmatch "VERIFY_PROD_EXIT=0") {
        Write-Host "  [!] verify-prod a signale des problemes (voir ci-dessus)" -ForegroundColor Yellow
        Write-Host "      Corriger : commun/deploy/RUNBOOK-PROD.md, setup-legal-publisher.sh" -ForegroundColor Yellow
    } else {
        Write-Host "  [OK] verify-prod OK" -ForegroundColor Green
    }
}


# -- Resume -------------------------------------------------------------------
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  DEPLOIEMENT ZERO-DOWNTIME TERMINE" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  Site   : $SITE"
Write-Host "  Health : $HEALTH"
Write-Host "  PM2    : pm2 reload $PM2_APP (sans coupure)"
Write-Host ""
Write-Host "  Diagnostic :"
Write-Host "  ssh $sshTarget pm2 logs $PM2_APP --lines 50"
if ($Environment -eq 'prod') {
    Write-Host "  ssh $sshTarget bash $REMOTE/deploy/verify-prod.sh   # ou -VerifyProd au prochain deploy"
}
Write-Host "==============================================" -ForegroundColor Green

