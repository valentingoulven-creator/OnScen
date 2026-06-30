# setup-second-cursor.ps1 - Bootstrap second poste / second compte Cursor
# MeloSongv2 / Soundy - acces dev local + deploy prod (VPS getsoundy.com)
#
# Usage (depuis n'importe ou, ou apres clone) :
#   powershell -ExecutionPolicy Bypass -File commun/scripts/setup-second-cursor.ps1
#
# Options :
#   -TargetDir "C:\Dev\MeloSongv2"   Dossier cible (hors iCloud recommande)
#   -SkipClone                        Ne pas cloner (depot deja present)
#   -SkipNpmInstall                   Ignorer npm install
#   -SeedStories                      Lance npm run msdev:seed-stories (backend)
#   -NonInteractive                   Pas de Read-Host (CI / script automatise)
#
# IMPORTANT : ne jamais committer de secrets. Ce script ne contient aucun mot de passe reel.
# Voir commun/scripts/SETUP-SECOND-CURSOR.md et commun/scripts/secrets-checklist.template.txt

param(
    [string]$TargetDir = 'C:\Dev\MeloSongv2',
    [switch]$SkipClone,
    [switch]$SkipNpmInstall,
    [switch]$SeedStories,
    [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'

# --- Constantes projet -------------------------------------------------------
$RepoUrl     = 'https://github.com/valentingoulven-creator/MeloSong.git'
$VpsHost     = '51.159.164.100'
$VpsUser     = 'root'
$VpsTarget   = "${VpsUser}@${VpsHost}"
$RemotePath  = '/opt/soundly'
$HealthUrl   = 'https://getsoundy.com/health'
$SshDir      = Join-Path $env:USERPROFILE '.ssh'
$PrimaryKey  = Join-Path $SshDir 'id_ed25519'
$AltKey      = Join-Path $SshDir 'soundly-scaleway'

$ScriptRootResolved = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$RunFromRepo        = Test-Path (Join-Path $ScriptRootResolved '..\..\package.json')

# --- Helpers -----------------------------------------------------------------
function Write-Step([string]$msg) {
    Write-Host ''
    Write-Host ">> $msg" -ForegroundColor Cyan
}

function Write-Ok([string]$msg) {
    Write-Host "   [OK] $msg" -ForegroundColor Green
}

function Write-Warn([string]$msg) {
    Write-Host "   [!] $msg" -ForegroundColor Yellow
}

function Write-Fail([string]$msg) {
    Write-Host "   [X] $msg" -ForegroundColor Red
}

function Write-Info([string]$msg) {
    Write-Host "   $msg" -ForegroundColor DarkGray
}

function Test-CommandExists([string]$name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Invoke-UserPrompt([string]$question) {
    if ($NonInteractive) { return $null }
    return Read-Host $question
}

function Get-NodeMajorVersion {
    if (-not (Test-CommandExists 'node')) { return $null }
    $raw = (& node -v 2>$null).Trim()
    if ($raw -match '^v?(\d+)') { return [int]$Matches[1] }
    return $null
}

function Copy-EnvIfMissing {
    param(
        [string]$Root,
        [string]$DestRelative,
        [string]$ExampleRelative,
        [string]$Label
    )
    $dest = Join-Path $Root $DestRelative
    $example = Join-Path $Root $ExampleRelative
    if (Test-Path $dest) {
        Write-Ok "$Label deja present : $DestRelative"
        return $false
    }
    if (-not (Test-Path $example)) {
        Write-Warn "Modele introuvable : $ExampleRelative - $Label non cree"
        return $false
    }
    $destDir = Split-Path -Parent $dest
    if ($destDir -and -not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item -Path $example -Destination $dest -Force
    Write-Ok "$Label cree depuis modele : $DestRelative"
    Write-Warn "Remplissez les secrets manuellement (voir secrets-checklist.template.txt)"
    return $true
}

function Write-AppEnvDevelopmentIfMissing([string]$Root) {
    $dest = Join-Path $Root 'web\app\.env.development'
    if (Test-Path $dest) {
        Write-Ok 'web/app/.env.development deja present'
        return
    }
    @(
        '# Dev local (Vite npm run dev / commun/scripts/dev-start.ps1)',
        '# Pas de secrets ici - commun/msdev/.env reste local et gitignore',
        'VITE_APP_ENV=msdev',
        'VITE_WEB_APP_URL=http://localhost:5173'
    ) | Set-Content -Path $dest -Encoding UTF8
    Write-Ok 'web/app/.env.development cree (valeurs dev par defaut)'
}

function Get-SshKeyPath {
    if (Test-Path $PrimaryKey) { return $PrimaryKey }
    if (Test-Path $AltKey) { return $AltKey }
    return $null
}

function Test-SshConnection([string]$keyPath) {
    if (-not $keyPath) { return $false }
    $out = & ssh.exe -i $keyPath -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o BatchMode=yes `
        $VpsTarget "echo PING_OK" 2>&1
    return ($LASTEXITCODE -eq 0 -and ("$out" -match 'PING_OK'))
}

# --- Banniere ----------------------------------------------------------------
Write-Host ''
Write-Host ' ============================================================' -ForegroundColor Magenta
Write-Host '  Soundy / MeloSongv2 - Setup second Cursor' -ForegroundColor Magenta
Write-Host ' ============================================================' -ForegroundColor Magenta
Write-Host "  Depot cible : $TargetDir"
Write-Host "  GitHub      : $RepoUrl"
Write-Host "  VPS         : $VpsTarget ($RemotePath)"
Write-Host "  Prod        : $HealthUrl"
Write-Host ' ============================================================' -ForegroundColor Magenta

$manualActions = New-Object System.Collections.Generic.List[string]
$createdEnvFiles = @()

# --- 1. Prerequis ------------------------------------------------------------
Write-Step '1/8 - Verification des prerequis'

$prereqOk = $true

if (Test-CommandExists 'git') {
    $gitVer = (& git --version 2>$null)
    Write-Ok "git : $gitVer"
} else {
    Write-Fail 'git introuvable - installez Git for Windows : https://git-scm.com/download/win'
    $prereqOk = $false
    $manualActions.Add('Installer Git for Windows')
}

$nodeMajor = Get-NodeMajorVersion
if ($nodeMajor) {
    $nodeVer = (& node -v 2>$null)
    if ($nodeMajor -ge 18) {
        Write-Ok "node : $nodeVer"
    } else {
        Write-Warn "node $nodeVer - Node 18+ recommande (LTS 20 ou 22)"
    }
} else {
    Write-Fail 'node introuvable - installez Node.js LTS : https://nodejs.org/'
    $prereqOk = $false
    $manualActions.Add('Installer Node.js LTS (18+)')
}

if (Test-CommandExists 'npm') {
    $npmVer = (& npm -v 2>$null)
    Write-Ok "npm : v$npmVer"
} else {
    Write-Fail 'npm introuvable (installe avec Node.js)'
    $prereqOk = $false
}

if (Test-CommandExists 'ssh') {
    Write-Ok 'ssh : disponible'
} else {
    Write-Fail 'ssh introuvable - activez le client OpenSSH Windows ou Git Bash'
    $prereqOk = $false
    $manualActions.Add('Activer OpenSSH Client (Parametres Windows > Applications > Fonctionnalites optionnelles)')
}

if (Test-CommandExists 'gh') {
    $ghVer = (& gh --version 2>$null | Select-Object -First 1)
    Write-Ok "gh CLI : $ghVer"
} else {
    Write-Warn 'gh CLI absent (optionnel) - authentification GitHub manuelle possible'
    Write-Info 'Installation : winget install GitHub.cli'
}

if (-not $prereqOk) {
    Write-Host ''
    Write-Fail 'Prerequis manquants - corrigez puis relancez ce script.'
    exit 1
}

# --- 2. Clone depot ----------------------------------------------------------
Write-Step '2/8 - Depot Git (hors iCloud recommande)'

if ($TargetDir -match 'iCloudDrive') {
    Write-Warn 'Le chemin cible est sous iCloud - risque de lenteur et verrouillage (msdev/data).'
    Write-Info 'Recommande : C:\Dev\MeloSongv2'
}

$repoRoot = $null

if ($SkipClone -and (Test-Path $TargetDir)) {
    $repoRoot = (Resolve-Path $TargetDir).Path
    Write-Ok "Mode -SkipClone - utilisation de $repoRoot"
} elseif (Test-Path (Join-Path $TargetDir 'package.json')) {
    $repoRoot = (Resolve-Path $TargetDir).Path
    Write-Ok "Depot deja present : $repoRoot"
} elseif (-not $SkipClone) {
    $parent = Split-Path -Parent $TargetDir
    if ($parent -and -not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        Write-Ok "Dossier parent cree : $parent"
    }
    if (Test-Path $TargetDir) {
        Write-Fail "Le dossier existe mais n'est pas un depot MeloSongv2 valide : $TargetDir"
        exit 1
    }
    Write-Info "Clonage en cours : $RepoUrl -> $TargetDir"
    & git clone $RepoUrl $TargetDir
    if ($LASTEXITCODE -ne 0) {
        Write-Fail 'git clone echoue - verifiez acces GitHub (collaborateur ou token)'
        $manualActions.Add("Verifier acces au depot $RepoUrl (invitation GitHub ou PAT)")
        exit 1
    }
    $repoRoot = (Resolve-Path $TargetDir).Path
    Write-Ok "Clone termine : $repoRoot"
} else {
    Write-Fail "Depot introuvable : $TargetDir (retirez -SkipClone ou clonez manuellement)"
    exit 1
}

Set-Location $repoRoot

# Remote GitHub
$remoteUrl = (& git remote get-url origin 2>$null)
if ($LASTEXITCODE -eq 0) {
    if ($remoteUrl -match 'valentingoulven-creator/MeloSong') {
        Write-Ok "Remote origin : $remoteUrl"
    } else {
        Write-Warn "Remote inattendu : $remoteUrl (attendu MeloSong)"
    }
} else {
    Write-Warn 'Remote origin absent'
}

# --- 3. GitHub auth ----------------------------------------------------------
Write-Step '3/8 - Acces GitHub'

if (Test-CommandExists 'gh') {
    $ghStatus = & gh auth status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok 'gh deja authentifie'
        $ghStatus | ForEach-Object { Write-Info $_ }
    } else {
        Write-Warn 'gh non connecte'
        if (-not $NonInteractive) {
            $doGh = Invoke-UserPrompt 'Lancer gh auth login maintenant ? (o/N)'
            if ($doGh -match '^[oOyY]') {
                Write-Info "Suivez les instructions - GitHub.com + HTTPS + login navigateur recommande"
                & gh auth login
                if ($LASTEXITCODE -eq 0) {
                    Write-Ok 'gh auth login reussi'
                } else {
                    Write-Warn 'gh auth login echoue ou annule'
                    $manualActions.Add('Executer : gh auth login')
                }
            } else {
                $manualActions.Add('Executer : gh auth login (ou configurer credential helper Git)')
            }
        } else {
            $manualActions.Add('Executer : gh auth login')
        }
    }
} else {
    Write-Info 'Sans gh CLI : utilisez Git Credential Manager ou un PAT pour git push/pull'
    $manualActions.Add('Configurer authentification GitHub (gh auth login ou PAT HTTPS)')
}

Write-Info 'Le compte Cursor #2 doit etre invite sur le depot GitHub (Settings > Collaborators)'

# --- 4. Cle SSH VPS ----------------------------------------------------------
Write-Step '4/8 - Cle SSH vers le VPS production'

if (-not (Test-Path $SshDir)) {
    New-Item -ItemType Directory -Path $SshDir -Force | Out-Null
    Write-Ok "Dossier SSH cree : $SshDir"
}

$keyPath = Get-SshKeyPath
if ($keyPath) {
    Write-Ok "Cle SSH trouvee : $keyPath"
} else {
    Write-Warn 'Aucune cle SSH trouvee (id_ed25519 ou soundly-scaleway)'
    Write-Host ''
    Write-Host '  Transfert SECURISE depuis le premier poste (NE PAS mettre la cle dans Git) :' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  Option A - USB / fichier chiffre :' -ForegroundColor White
    Write-Host "    1. Sur machine 1 : copier %USERPROFILE%\.ssh\id_ed25519"
    Write-Host "                       et id_ed25519.pub vers cle USB"
    Write-Host "    2. Sur machine 2 : coller dans $SshDir"
    Write-Host '    3. Permissions : icacls id_ed25519 /inheritance:r /grant:r "%USERNAME%:R"'
    Write-Host ''
    Write-Host '  Option B - SCP depuis machine 1 (reseau local de confiance) :' -ForegroundColor White
    Write-Host ('    scp %USERPROFILE%\.ssh\id_ed25519 %USERNAME%@<IP_MACHINE2>:' + $SshDir)
    Write-Host ('    scp %USERPROFILE%\.ssh\id_ed25519.pub %USERNAME%@<IP_MACHINE2>:' + $SshDir)
    Write-Host ''
    Write-Host '  Option C - Ajouter une NOUVELLE cle publique sur le VPS :' -ForegroundColor White
    Write-Host '    1. Sur machine 2 : ssh-keygen -t ed25519 -f id_ed25519 -C "cursor2-soundy"'
    Write-Host "    2. Sur machine 1 (deja autorisee) : ssh root@$VpsHost"
    Write-Host '    3. Sur VPS : ajouter le contenu de id_ed25519.pub dans ~/.ssh/authorized_keys'
    Write-Host ''
    $manualActions.Add('Transferer la cle SSH privee id_ed25519 (ou autoriser une nouvelle cle sur le VPS)')
    $keyPath = Get-SshKeyPath
}

if ($keyPath -and (Test-SshConnection $keyPath)) {
    Write-Ok "Connexion SSH VPS OK ($VpsTarget)"
} elseif ($keyPath) {
    Write-Warn "Cle presente mais connexion SSH echouee - cle non autorisee sur le VPS ou pare-feu"
    $manualActions.Add(('Tester : ssh -i "' + $keyPath + '" ' + $VpsTarget))
} else {
    Write-Warn 'Test SSH ignore - aucune cle disponible'
}

Write-Info "Deploy prod : npm run deploy:prod (wrapper deploy-prod.ps1) ou commun/deploy/deploy_zero_downtime.ps1 -VerifyProd"
Write-Info "Secrets prod VPS : $RemotePath/.env (jamais dans Git) — PostgreSQL = Scaleway Managed (51.15.132.229), pas sur le VPS"

# --- 5. Fichiers .env --------------------------------------------------------
Write-Step '5/8 - Fichiers d environnement locaux'

if (Copy-EnvIfMissing -Root $repoRoot -DestRelative 'commun\msdev\.env' -ExampleRelative 'commun\msdev\.env.example' -Label 'commun/msdev/.env') {
    $createdEnvFiles += 'commun/msdev/.env'
}
if (Copy-EnvIfMissing -Root $repoRoot -DestRelative 'commun\backend\.env.production' -ExampleRelative 'commun\backend\.env.production.example' -Label 'commun/backend/.env.production') {
    $createdEnvFiles += 'commun/backend/.env.production'
}
Write-AppEnvDevelopmentIfMissing -Root $repoRoot

if ($createdEnvFiles.Count -gt 0) {
    Write-Host ''
    Write-Warn 'Fichiers .env crees avec des PLACEHOLDERS - secrets a copier depuis machine 1 ou VPS :'
    $checklist = Join-Path $repoRoot 'scripts\secrets-checklist.template.txt'
    if (Test-Path $checklist) {
        Write-Info "Checklist : commun/scripts/secrets-checklist.template.txt"
    }
    Write-Info 'Recuperer prod : ssh root@51.159.164.100 puis cat /opt/soundly/.env (sans committer)'
    Write-Info 'PostgreSQL prod = Scaleway Managed (51.15.132.229:14440) — DATABASE_URL dans .env VPS, pas sur le VPS lui-meme'
    Write-Info 'Admin prod : PROD_ADMIN_EMAIL=admin@getsoundy.com ; msdev : ACCESS_ADMIN_EMAILS (pas dev@soundy.local)'
    Write-Info '(Ne copiez que les variables necessaires - jamais dans Git)'
    $manualActions.Add('Remplir commun/msdev/.env (ACCESS_ADMIN_EMAILS) et commun/backend/.env.production (PROD_ADMIN_EMAIL=admin@getsoundy.com) depuis machine 1 ou VPS /opt/soundly/.env')
}

# --- 6. npm install --------------------------------------------------------
if (-not $SkipNpmInstall) {
    Write-Step '6/8 - Installation des dependances npm'

    foreach ($dir in @('.', 'backend', 'app', 'apptel')) {
        $path = if ($dir -eq '.') { $repoRoot } else { Join-Path $repoRoot $dir }
        $pkg = Join-Path $path 'package.json'
        if (-not (Test-Path $pkg)) {
            Write-Warn "package.json absent : $dir - ignore"
            continue
        }
        Write-Info "npm install dans $dir ..."
        Push-Location $path
        try {
            & npm install 2>&1 | Where-Object { $_ -notmatch '^npm warn' }
            if ($LASTEXITCODE -ne 0) {
                Write-Warn "npm install echoue dans $dir (code $LASTEXITCODE)"
            } else {
                Write-Ok "npm install OK : $dir"
            }
        } finally {
            Pop-Location
        }
    }
} else {
    Write-Step '6/8 - npm install ignore (-SkipNpmInstall)'
}

# --- 7. Seed stories optionnel -----------------------------------------------
if ($SeedStories) {
    Write-Step '7/8 - Seed stories msdev (optionnel)'
    $backendDir = Join-Path $repoRoot 'backend'
    if (Test-Path (Join-Path $backendDir 'package.json')) {
        Push-Location $backendDir
        try {
            Write-Info 'npm run msdev:seed-stories ...'
            & npm run msdev:seed-stories 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Ok 'Stories msdev seed OK'
            } else {
                Write-Warn 'msdev:seed-stories echoue - lancez msdev une fois puis reessayez'
            }
        } finally {
            Pop-Location
        }
    }
} else {
    Write-Step '7/8 - Seed stories (passe - ajoutez -SeedStories si besoin)'
    Write-Info 'Optionnel : cd backend && npm run msdev:seed-stories'
}

# --- 8. Verifications finales ------------------------------------------------
Write-Step '8/8 - Verifications'

# git status
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
$commit = (& git rev-parse --short HEAD 2>$null)
if ($branch -and $commit) {
    Write-Ok "Git : branche $branch @ $commit"
} else {
    Write-Warn 'Git : impossible de lire branche/commit'
}

# health prod
try {
    $health = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
    if ($health.StatusCode -eq 200) {
        Write-Ok "Health prod : $HealthUrl -> HTTP 200"
    } else {
        Write-Warn "Health prod : HTTP $($health.StatusCode)"
    }
} catch {
    Write-Warn "Health prod inaccessible : $($_.Exception.Message)"
}

# ssh recap
$keyPath = Get-SshKeyPath
if ($keyPath) {
    if (Test-SshConnection $keyPath) {
        Write-Ok 'SSH VPS : accessible'
    } else {
        Write-Warn 'SSH VPS : echec (voir etape 4)'
    }
}

# --- Resume ------------------------------------------------------------------
Write-Host ''
Write-Host ' ============================================================' -ForegroundColor Green
Write-Host '  SETUP TERMINE - prochaines etapes' -ForegroundColor Green
Write-Host ' ============================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  1. Ouvrir dans Cursor :' -ForegroundColor White
Write-Host "     $repoRoot"
Write-Host ''
Write-Host '  2. Dev local :' -ForegroundColor White
Write-Host '     npm run dev'
Write-Host '     -> http://localhost:5173 (API msdev :4080)'
Write-Host ''
Write-Host '  3. Deploy prod :' -ForegroundColor White
Write-Host '     npm run deploy:prod'
Write-Host '     ou : powershell -ExecutionPolicy Bypass -File commun/deploy/deploy_zero_downtime.ps1 -VerifyProd'
Write-Host '     (deploy-prod.ps1 reste un wrapper OK ; requiert cle SSH + acces VPS)'
Write-Host ''
Write-Host '  4. Documentation :' -ForegroundColor White
Write-Host '     docs/DEV-WORKFLOW.md'
Write-Host '     commun/scripts/SETUP-SECOND-CURSOR.md'
Write-Host '     commun/scripts/secrets-checklist.template.txt'
Write-Host ''

if ($manualActions.Count -gt 0) {
    Write-Host '  Actions MANUELLES restantes :' -ForegroundColor Yellow
    $i = 1
    foreach ($action in $manualActions) {
        Write-Host "     $i. $action" -ForegroundColor Yellow
        $i++
    }
    Write-Host ''
}

Write-Host ' ============================================================' -ForegroundColor Green
