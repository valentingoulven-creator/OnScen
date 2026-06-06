# SETUP-NGROK.ps1
# Configure ngrok avec domaine statique pour MeloSong Dev
# Executez ce fichier une seule fois apres avoir cree votre compte ngrok.

$NGROK = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
$CONFIG_FILE = "$env:LOCALAPPDATA\ngrok\ngrok.yml"
$DOMAIN_FILE = "$PSScriptRoot\msdev\ngrok-domain.txt"

function Write-Step { param($msg) Write-Host "`n  $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  [OK]     $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [AVERT]  $msg" -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "  [ERREUR] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "  [INFO]   $msg" -ForegroundColor Gray }

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "    MeloSong Dev - Configuration ngrok (domaine statique)" -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor Cyan

# ----------------------------------------------------------------
# 1. Verifier ngrok.exe
# ----------------------------------------------------------------
Write-Step "Etape 1/4 - Verification de ngrok"

if (-not (Test-Path $NGROK)) {
    Write-Err "ngrok.exe non trouve. Installez via :"
    Write-Host "    winget install ngrok.ngrok" -ForegroundColor White
    Read-Host "`n  Appuyez sur Entree pour quitter"
    exit 1
}
Write-OK "ngrok v3 detecte (installation WinGet)"

# ----------------------------------------------------------------
# 2. Authtoken
# ----------------------------------------------------------------
Write-Step "Etape 2/4 - Authtoken"

$authtokenOk = $false
$apiKeyOk    = $false

if (Test-Path $CONFIG_FILE) {
    $cfg = Get-Content $CONFIG_FILE -Raw -ErrorAction SilentlyContinue
    if ($cfg -match "authtoken\s*:") { $authtokenOk = $true }
    if ($cfg -match "api_key\s*:")   { $apiKeyOk    = $true }
}

if ($authtokenOk) {
    Write-OK "Authtoken deja configure."
} else {
    Write-Warn "Authtoken absent. Recuperez-le sur :"
    Write-Host "    https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor White
    Write-Host ""
    $token = (Read-Host "  Collez votre authtoken").Trim()

    if (-not $token) {
        Write-Err "Authtoken requis. Configuration interrompue."
        Write-Host ""
        Write-Host "  Une fois votre token copie, executez :" -ForegroundColor White
        Write-Host "    & `"$NGROK`" config add-authtoken VOTRE_TOKEN" -ForegroundColor Gray
        Read-Host "`n  Appuyez sur Entree pour quitter"
        exit 1
    }

    & $NGROK config add-authtoken $token | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Echec - verifiez que le token est correct."
        Read-Host "`n  Appuyez sur Entree pour quitter"
        exit 1
    }
    Write-OK "Authtoken configure !"
    $authtokenOk = $true
}

# ----------------------------------------------------------------
# 3. Cle API (pour creer/lister le domaine via CLI)
# ----------------------------------------------------------------
Write-Step "Etape 3/4 - Cle API (pour domaine statique via CLI)"

if ($apiKeyOk) {
    Write-OK "Cle API deja presente dans la config."
} else {
    Write-Info "Optionnel - permet de creer le domaine automatiquement."
    Write-Host "    Disponible sur : https://dashboard.ngrok.com/api" -ForegroundColor White
    Write-Host "    (Laissez vide pour creer le domaine manuellement sur le dashboard)" -ForegroundColor DarkGray
    Write-Host ""
    $apiKey = (Read-Host "  Cle API ngrok (ou Entree pour ignorer)").Trim()

    if ($apiKey) {
        # Creer le dossier config si necessaire
        $configDir = Split-Path $CONFIG_FILE
        if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }
        # Ajouter api_key a la fin du fichier yml
        Add-Content -Path $CONFIG_FILE -Value "api_key: $apiKey"
        Write-OK "Cle API ajoutee au fichier de configuration."
        $apiKeyOk = $true
    } else {
        Write-Info "Cle API ignoree - domaine a configurer manuellement."
    }
}

# ----------------------------------------------------------------
# 4. Domaine statique
# ----------------------------------------------------------------
Write-Step "Etape 4/4 - Domaine statique"

$domain = ""

# Domaine deja enregistre ?
if (Test-Path $DOMAIN_FILE) {
    $existing = ((Get-Content $DOMAIN_FILE -First 3) | Where-Object { $_ -and -not $_.StartsWith("#") } | Select-Object -First 1).Trim()
    if ($existing) {
        Write-OK "Domaine deja configure : $existing"
        $domain = $existing
    }
}

# Essayer l'API CLI si api_key disponible
if (-not $domain -and $apiKeyOk) {
    Write-Info "Recherche de domaines reserves existants..."
    $listJson = & $NGROK api reserved-domains list 2>&1 | Out-String

    # Chercher un domaine *.ngrok-free.app ou *.ngrok.app dans la sortie JSON
    $match = [regex]::Match($listJson, '"([\w-]+\.ngrok(?:-free)?\.app)"')
    if ($match.Success) {
        $domain = $match.Groups[1].Value
        Write-OK "Domaine existant detecte via API : $domain"
    } else {
        Write-Info "Aucun domaine existant. Tentative de creation..."
        $createJson = & $NGROK api reserved-domains create --region us 2>&1 | Out-String
        $matchNew = [regex]::Match($createJson, '"([\w-]+\.ngrok(?:-free)?\.app)"')
        if ($matchNew.Success) {
            $domain = $matchNew.Groups[1].Value
            Write-OK "Nouveau domaine cree : $domain"
        } else {
            Write-Warn "Impossible de creer le domaine via CLI."
            Write-Host "  Reponse API :" -ForegroundColor DarkGray
            ($createJson -split "`n")[0..4] | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        }
    }
}

# Saisie manuelle si domaine toujours inconnu
if (-not $domain) {
    Write-Host ""
    Write-Warn "Domaine introuvable automatiquement."
    Write-Host "  Creez-le sur : https://dashboard.ngrok.com/domains" -ForegroundColor White
    Write-Host "  (Cliquez 'New Domain', copiez le nom genere)" -ForegroundColor DarkGray
    Write-Host ""
    $domain = (Read-Host "  Entrez votre domaine (ex: melosong-xyz.ngrok-free.app)").Trim()
    $domain = $domain -replace "^https?://",""  -replace "/$",""
}

if (-not $domain) {
    Write-Err "Aucun domaine fourni. Configuration incomplete."
    Write-Host ""
    Write-Info "Creez msdev\ngrok-domain.txt manuellement avec votre domaine."
    Read-Host "`n  Appuyez sur Entree pour quitter"
    exit 1
}

# Ecrire msdev/ngrok-domain.txt
$domain | Set-Content -Path $DOMAIN_FILE -Encoding UTF8 -NoNewline
Write-OK "Fichier ecrit : msdev\ngrok-domain.txt"
Write-OK "Contenu       : $domain"

# ----------------------------------------------------------------
# Test rapide du tunnel
# ----------------------------------------------------------------
Write-Host ""
Write-Host "  --- Test rapide du tunnel (5 secondes) ---" -ForegroundColor Cyan

$port4080 = (netstat -ano | Select-String ":4080" | Select-String "LISTENING") -ne $null
if (-not $port4080) {
    Write-Warn "Port 4080 non actif - le test tunnel va echouer (normal si serveur eteint)."
    Write-Info "ACCES-IPHONE.bat demarrera automatiquement le serveur."
} else {
    $proc = $null
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $NGROK
        $psi.Arguments = "http --domain=$domain 4080 --log stdout --log-level warn"
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        $proc = [System.Diagnostics.Process]::Start($psi)
        Start-Sleep -Seconds 4

        if (-not $proc.HasExited) {
            Write-OK "Tunnel demarre avec succes !"
            Write-Host "     URL : https://$domain" -ForegroundColor White
            $proc.Kill()
            Write-Info "Process de test arrete."
        } else {
            Write-Warn "Le tunnel s'est termine prematurement (code: $($proc.ExitCode))."
            Write-Info "Verifiez que l'authtoken est valide."
        }
    } catch {
        Write-Warn "Impossible de tester le tunnel : $_"
    } finally {
        if ($proc -and -not $proc.HasExited) { try { $proc.Kill() } catch {} }
    }
}

# ----------------------------------------------------------------
# Recapitulatif
# ----------------------------------------------------------------
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "    Configuration terminee !" -ForegroundColor Green
Write-Host ""
Write-Host "    Authtoken     : $(if($authtokenOk){'[OK] Configure'}else{'[NON] Manquant'})"
Write-Host "    Cle API       : $(if($apiKeyOk){'[OK] Configure'}else{'[--] Ignoree'})"
Write-Host "    Domaine       : $domain"
Write-Host "    Fichier       : msdev\ngrok-domain.txt"
Write-Host ""
Write-Host "    --> Double-cliquez ACCES-IPHONE.bat pour lancer le tunnel"
Write-Host "    --> Ouvrez https://$domain sur votre iPhone"
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "  Appuyez sur Entree pour quitter"
