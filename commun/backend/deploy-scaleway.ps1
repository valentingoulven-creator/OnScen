# ============================================================
# deploy-scaleway.ps1  —  Soundy → Scaleway PostgreSQL
# Exécuter depuis MeloSongv2/backend/ :
#   powershell -ExecutionPolicy Bypass -File deploy-scaleway.ps1
# ============================================================
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$VPS     = "root@51.159.164.100"
$KEY     = "$env:USERPROFILE\.ssh\id_ed25519"
$REMOTE  = "/opt/soundly"
$PM2_APP = "melosong-backend"

# Paramètres SSH/SCP de base
$sshOpts = @("-i", $KEY, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=20")

function SSH([string]$cmd) {
    $result = & ssh @sshOpts $VPS "bash -c `"$cmd`"" 2>&1
    Write-Host $result
    return $result -join "`n"
}

Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Soundy → Scaleway PostgreSQL — Déploiement" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan


# ── 1. Test VPS ──────────────────────────────────────────────
Write-Host "`n[1/7] Connexion VPS..." -ForegroundColor Yellow
$ping = & ssh @sshOpts $VPS "echo PING_OK" 2>&1
if ("$ping" -notmatch "PING_OK") { Write-Error "VPS inaccessible. Vérifiez la clé SSH.`nDétail: $ping" }
Write-Host "  ✓ VPS accessible" -ForegroundColor Green


# ── 2. Configurer VPS (psql + DB + .env) ────────────────────
Write-Host "`n[2/7] Configuration VPS (psql, DB, .env)..." -ForegroundColor Yellow

# Envoyer le script bash sur le VPS
Write-Host "  → Envoi de vps-setup.sh..."
& scp @sshOpts "vps-setup.sh" "${VPS}:/tmp/vps-setup.sh" 2>&1

# Exécuter le script
Write-Host "  → Exécution vps-setup.sh..."
$setupOut = & ssh @sshOpts $VPS "bash /tmp/vps-setup.sh" 2>&1
Write-Host $setupOut

if ("$setupOut" -notmatch "SETUP_DONE=1") {
    Write-Error "Le script VPS a échoué. Vérifiez la whitelist IP Scaleway (51.159.164.100/32)."
}
Write-Host "  ✓ VPS configuré" -ForegroundColor Green

# Récupérer le nom de DB final
$FINAL_DB = "rdb"
if ("$setupOut" -match "FINAL_DB=soundy") { $FINAL_DB = "soundy" }
Write-Host "  → Base de données cible : $FINAL_DB" -ForegroundColor Cyan


# ── 3. Build local ───────────────────────────────────────────
Write-Host "`n[3/7] Build backend (npm install + tsc)..." -ForegroundColor Yellow

Write-Host "  → npm install..."
& npm install 2>&1 | Where-Object { $_ -notmatch "^npm warn" }
if ($LASTEXITCODE -ne 0) { Write-Error "npm install échoué (code $LASTEXITCODE)" }

Write-Host "  → npm run build..."
& npm run build 2>&1
if ($LASTEXITCODE -ne 0) { Write-Error "Build TypeScript échoué (code $LASTEXITCODE)" }

if (-not (Test-Path "dist\index.js")) { Write-Error "dist/index.js absent après build !" }
Write-Host "  ✓ Build réussi" -ForegroundColor Green


# Deploy dist/ + deploy/ → VPS...
Write-Host "`n[4/7] Déploiement dist/ + deploy/ → VPS..." -ForegroundColor Yellow

& ssh @sshOpts $VPS "mkdir -p $REMOTE/dist $REMOTE/deploy" 2>&1
& scp @sshOpts -r "dist/." "${VPS}:${REMOTE}/dist/" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Error "scp dist/ échoué" }
Write-Host "  ✓ dist/ déployé" -ForegroundColor Green

# Toujours copier deploy/Caddyfile — ne jamais écrire un bloc :80 minimal sur le VPS
$deployDir = Join-Path $PSScriptRoot "..\deploy"
$caddyFiles = @("Caddyfile", "sync-caddy.sh", "caddy-watchdog.sh", "install-caddy-guard.sh", "healthcheck.sh")
foreach ($f in $caddyFiles) {
    $local = Join-Path $deployDir $f
    if (Test-Path $local) {
        & scp @sshOpts $local "${VPS}:${REMOTE}/deploy/$f" 2>&1
    }
}
Write-Host "  → Synchronisation Caddy (getsoundy.com + HTTPS)..." -ForegroundColor Cyan
$caddyOut = & ssh @sshOpts $VPS "sed -i 's/\r$//' $REMOTE/deploy/*.sh && chmod +x $REMOTE/deploy/*.sh && bash $REMOTE/deploy/install-caddy-guard.sh" 2>&1
Write-Host $caddyOut
if ("$caddyOut" -notmatch "Caddy guard install") {
    Write-Host "  ⚠ install-caddy-guard incertain — vérifiez /etc/caddy/Caddyfile" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ Caddyfile canonique + watchdog installés" -ForegroundColor Green
}


# ── 5. PM2 restart ──────────────────────────────────────────
Write-Host "`n[5/7] Redémarrage PM2..." -ForegroundColor Yellow

$restartCmd = "cd $REMOTE && printf '%s\n%s\n' `$(date +%s) deploy > /tmp/soundy-pm2-reload-intentional && (pm2 restart $PM2_APP --update-env 2>/dev/null || pm2 start dist/index.js --name $PM2_APP --min-uptime 10000 --max-restarts 20) && echo PM2_STARTED"
$restartOut = & ssh @sshOpts $VPS $restartCmd 2>&1
Write-Host $restartOut
if ("$restartOut" -notmatch "PM2_STARTED") {
    Write-Host "  ⚠ PM2 restart incertain — vérifiez manuellement" -ForegroundColor Yellow
}

Write-Host "  → Attente 5s (démarrage app)..."
Start-Sleep -Seconds 5


# ── 6. Vérifications ────────────────────────────────────────
Write-Host "`n[6/7] Vérifications post-déploiement..." -ForegroundColor Yellow

Write-Host "`n  --- Logs PM2 (30 lignes) ---" -ForegroundColor Cyan
& ssh @sshOpts $VPS "pm2 logs $PM2_APP --lines 30 --nostream 2>&1 || true" 2>&1

Write-Host "`n  --- Migrations + DB dans les logs ---" -ForegroundColor Cyan
$dbLogs = & ssh @sshOpts $VPS "pm2 logs $PM2_APP --lines 50 --nostream 2>&1 | grep -iE 'migrat|pool|PostgreSQL|error|Error' || echo '(aucun match)'" 2>&1
Write-Host $dbLogs

Write-Host "`n  --- Health check ---" -ForegroundColor Cyan
$health = & ssh @sshOpts $VPS "curl -sf http://localhost:3000/health 2>/dev/null || curl -sf http://localhost/health 2>/dev/null || echo 'Pas de /health — vérifiez le port'" 2>&1
Write-Host "  $health"

Write-Host "`n  --- Caddy HTTPS (443 + getsoundy.com) ---" -ForegroundColor Cyan
$caddyCheck = & ssh @sshOpts $VPS "ss -tlnp | grep -E ':443|:80' || true; grep -c getsoundy.com /etc/caddy/Caddyfile 2>/dev/null || echo 0" 2>&1
Write-Host $caddyCheck


# ── Résumé ──────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  DÉPLOIEMENT TERMINÉ" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  VPS         : 51.159.164.100"
Write-Host "  DB Scaleway : 51.15.132.229:14440/$FINAL_DB"
Write-Host "  DATABASE_URL: configurée (credentials masqués)"
Write-Host "  SSL         : PG_SSL=1 | sslmode=require"
Write-Host ""
Write-Host "  Commandes de diagnostic :"
Write-Host "  ssh root@51.159.164.100 'pm2 logs $PM2_APP --lines 50'"
Write-Host "  curl http://51.159.164.100/health"
Write-Host "══════════════════════════════════════════════" -ForegroundColor Green
