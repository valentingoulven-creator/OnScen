# create-turnstile-widgets.ps1 — Crée (ou réutilise) les widgets Turnstile Cloudflare via API
#
# Prérequis : token API avec permission Account → Turnstile → Edit
#   (PAS le token Stream CLOUDFLARE_STREAM_API_TOKEN)
#
# Usage :
#   $env:CLOUDFLARE_API_TOKEN = 'cfat_...'
#   powershell -File commun/scripts/create-turnstile-widgets.ps1
#   powershell -File commun/scripts/create-turnstile-widgets.ps1 -Apply   # + VPS + deploy
#
# Variables optionnelles :
#   CLOUDFLARE_ACCOUNT_ID (sinon lu depuis commun/backend/.env.production)

param(
    [ValidateSet('staging', 'prod', 'both')]
    [string]$Target = 'both',
    [switch]$Apply,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path

$localCfEnv = Join-Path $root 'commun\backend\.env.cloudflare'
if (Test-Path $localCfEnv) {
    foreach ($line in Get-Content $localCfEnv) {
        if ($line -match '^\s*#') { continue }
        if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+)\s*$') {
            $k = $Matches[1]
            $v = $Matches[2].Trim().Trim('"').Trim("'")
            if (-not (Test-Path "env:$k")) { Set-Item -Path "env:$k" -Value $v }
        }
    }
}

function New-TurnstileApiTokenFromGlobalKey {
    $email = [Environment]::GetEnvironmentVariable('CLOUDFLARE_API_EMAIL')
    $globalKey = [Environment]::GetEnvironmentVariable('CLOUDFLARE_GLOBAL_API_KEY')
    if (-not $email -or -not $globalKey) { return $null }
    $accountId = Get-BackendEnvVar 'CLOUDFLARE_ACCOUNT_ID'
    if (-not $accountId) { throw 'CLOUDFLARE_ACCOUNT_ID requis pour créer un token Turnstile.' }
    Write-Host '-> Création token API éphémère (Turnstile Edit) via Global API Key...' -ForegroundColor Cyan
    $headers = @{
        'X-Auth-Email' = $email
        'X-Auth-Key'   = $globalKey
        'Content-Type' = 'application/json'
    }
    $body = @{
        name = "OnScen Turnstile bootstrap $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        policies = @(
            @{
                effect = 'allow'
                resources = @{ "com.cloudflare.api.account.$accountId" = '*' }
                permission_groups = @(
                    @{ id = '755c05aa014b4f9ab263aa80b8167bd8' }
                )
            }
        )
    } | ConvertTo-Json -Depth 8 -Compress
    $r = Invoke-RestMethod -Method POST -Uri 'https://api.cloudflare.com/client/v4/user/tokens' -Headers $headers -Body $body -TimeoutSec 45
    if (-not $r.success) {
        $msg = ($r.errors | ForEach-Object { $_.message }) -join '; '
        throw "Création token Turnstile échouée : $msg"
    }
    $token = $r.result.value
    if (-not $token) { throw 'Cloudflare n''a pas renvoyé la valeur du token (réponse inattendue).' }
    Write-Host '[OK] Token Turnstile créé (valide une fois — ne pas committer).' -ForegroundColor Green
    return $token
}

function Get-BackendEnvVar {
    param([string]$Name)
    $fromEnv = [Environment]::GetEnvironmentVariable($Name)
    if ($fromEnv) { return $fromEnv.Trim() }
    $path = Join-Path $root 'commun\backend\.env.production'
    if (-not (Test-Path $path)) { return $null }
    foreach ($line in Get-Content $path) {
        if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.+)$") {
            return $Matches[1].Trim()
        }
    }
    return $null
}

function Get-CfTurnstileToken {
    if ($env:CLOUDFLARE_API_TOKEN) { return $env:CLOUDFLARE_API_TOKEN.Trim() }
    if ($env:CLOUDFLARE_TURNSTILE_API_TOKEN) { return $env:CLOUDFLARE_TURNSTILE_API_TOKEN.Trim() }
    $fromFile = Get-BackendEnvVar 'CLOUDFLARE_API_TOKEN'
    if ($fromFile) { return $fromFile }
    $dns = Get-BackendEnvVar 'CLOUDFLARE_DNS_API_TOKEN'
    if ($dns) { return $dns }
    $boot = New-TurnstileApiTokenFromGlobalKey
    if ($boot) { return $boot }
    throw @'
Token Cloudflare manquant pour Turnstile.

Option A — token API (recommandé) :
  commun/backend/.env.cloudflare  (gitignore) avec CLOUDFLARE_API_TOKEN=cfat_...
  ou $env:CLOUDFLARE_API_TOKEN

Option B — bootstrap une fois via Global API Key :
  .env.cloudflare avec CLOUDFLARE_API_EMAIL=... et CLOUDFLARE_GLOBAL_API_KEY=...
  (My Profile → API Tokens → Global API Key)

Puis :
  powershell -File commun/scripts/create-turnstile-widgets.ps1 -Apply

Le token Stream (CLOUDFLARE_STREAM_API_TOKEN) ne fonctionne pas sur l''API Turnstile.
'@
}

function Invoke-TurnstileApi {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )
    $uri = "https://api.cloudflare.com/client/v4$Path"
    $headers = @{ Authorization = "Bearer $script:CfToken" }
    if ($null -ne $Body) {
        $headers['Content-Type'] = 'application/json'
        $json = $Body | ConvertTo-Json -Depth 8 -Compress
        $r = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json -TimeoutSec 45
    } else {
        $r = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -TimeoutSec 45
    }
    if (-not $r.success) {
        $msg = ($r.errors | ForEach-Object { $_.message }) -join '; '
        throw "Cloudflare API $Method $Path : $msg"
    }
    return $r
}

function Get-AllWidgets {
    $acc = $script:AccountId
    $page = 1
    $all = @()
    do {
        $r = Invoke-TurnstileApi GET "/accounts/$acc/challenges/widgets?per_page=50&page=$page"
        if ($r.result) { $all += @($r.result) }
        $total = [int]($r.result_info.total_count)
        $page++
    } while ($all.Count -lt $total -and $page -le 20)
    return $all
}

function Find-WidgetByName {
    param([string]$Name, [array]$Widgets)
    $Widgets | Where-Object { $_.name -eq $Name } | Select-Object -First 1
}

function Get-WidgetWithSecret {
    param([string]$SiteKey)
    $r = Invoke-TurnstileApi GET "/accounts/$($script:AccountId)/challenges/widgets/$SiteKey"
    return $r.result
}

function New-TurnstileWidget {
    param(
        [string]$Name,
        [string[]]$Domains
    )
    $existing = Find-WidgetByName -Name $Name -Widgets $script:AllWidgets
    if ($existing) {
        Write-Host "[OK] Widget existant : $Name (sitekey $($existing.sitekey))" -ForegroundColor Green
        if (-not $existing.secret) {
            return Get-WidgetWithSecret -SiteKey $existing.sitekey
        }
        return $existing
    }
    if ($DryRun) {
        Write-Host "[DRY] Créerait widget : $Name domains=$($Domains -join ', ')" -ForegroundColor Yellow
        return $null
    }
    Write-Host "-> Création widget : $Name ..." -ForegroundColor Cyan
    $body = @{
        name    = $Name
        domains = $Domains
        mode    = 'managed'
        region  = 'world'
    }
    $r = Invoke-TurnstileApi POST "/accounts/$($script:AccountId)/challenges/widgets" $body
    $w = $r.result
    Write-Host "[OK] Créé : $Name sitekey=$($w.sitekey)" -ForegroundColor Green
    if (-not $w.secret) {
        $w = Get-WidgetWithSecret -SiteKey $w.sitekey
    }
    $script:AllWidgets += @($w)
    return $w
}

$script:CfToken = Get-CfTurnstileToken
$script:AccountId = Get-BackendEnvVar 'CLOUDFLARE_ACCOUNT_ID'
if (-not $script:AccountId) { throw 'CLOUDFLARE_ACCOUNT_ID introuvable (commun/backend/.env.production ou env).' }

# Certains tokens compte (Turnstile only) renvoient 401 sur /user/tokens/verify — liste widgets comme smoke test.
try {
    $script:AllWidgets = @(Get-AllWidgets)
} catch {
    throw "Token Turnstile refusé par Cloudflare : $($_.Exception.Message)"
}

$defs = @{
    staging = @{
        Name    = 'OnScen Turnstile Staging'
        Domains = @('localhost', '127.0.0.1', 'staging.onscen.com', 'staging.getsoundy.com')
    }
    prod    = @{
        Name    = 'OnScen Turnstile Production'
        Domains = @('getsoundy.com', 'www.getsoundy.com', 'onscen.com', 'www.onscen.com')
    }
}

$created = @{}
foreach ($key in @('staging', 'prod')) {
    if ($Target -notin @($key, 'both')) { continue }
    $d = $defs[$key]
    $w = New-TurnstileWidget -Name $d.Name -Domains $d.Domains
    if ($w) { $created[$key] = $w }
}

if ($DryRun -or $created.Count -eq 0) { exit 0 }

Write-Host ''
Write-Host 'Clés (à ne pas committer) :' -ForegroundColor Cyan
foreach ($key in $created.Keys) {
    $w = $created[$key]
    Write-Host "  [$key] TURNSTILE_SITE_KEY=$($w.sitekey)"
    if ($w.secret) {
        Write-Host "  [$key] TURNSTILE_SECRET_KEY=(présent, $($w.secret.Length) car.)"
    }
}

if (-not $Apply) {
    Write-Host ''
    Write-Host 'Pour propager VPS + deploy : relancer avec -Apply' -ForegroundColor Yellow
    exit 0
}

$setup = Join-Path $root 'commun\scripts\setup-turnstile-vps.ps1'
if ($Target -in @('staging', 'both') -and $created['staging']) {
    $env:TURNSTILE_SITE_KEY = $created['staging'].sitekey
    $env:TURNSTILE_SECRET_KEY = $created['staging'].secret
    & powershell -ExecutionPolicy Bypass -File $setup -Target staging -UseRealKeys
}
if ($Target -in @('prod', 'both') -and $created['prod']) {
    $env:TURNSTILE_SITE_KEY = $created['prod'].sitekey
    $env:TURNSTILE_SECRET_KEY = $created['prod'].secret
    & powershell -ExecutionPolicy Bypass -File $setup -Target prod -UseRealKeys
}

Write-Host '[OK] Turnstile widgets appliqués (local + VPS + deploy selon cible).' -ForegroundColor Green
