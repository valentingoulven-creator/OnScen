# scripts/setup-staging-env.ps1 — Genere backend/.env.preproduction et pousse .env sur VPS staging
param(
    [switch]$PushOnly,
    [switch]$GenerateOnly
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

. (Join-Path $root 'deploy\environments.ps1')
$cfg = Get-SoundyDeployEnvironment 'preprod'

$prodEnv = Join-Path $root 'backend\.env.production'
$stagingEnv = Join-Path $root 'backend\.env.preproduction'
$appStagingEnv = Join-Path $root 'app\.env.preproduction'
$appExample = Join-Path $root 'app\.env.preproduction.example'

function New-RandomSecret([int]$Length = 48) {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    $sb = New-Object System.Text.StringBuilder
    for ($i = 0; $i -lt $Length; $i++) {
        $null = $sb.Append($chars[(Get-Random -Maximum $chars.Length)])
    }
    return $sb.ToString()
}

if (-not $PushOnly) {
    Write-Host '>> Generation backend/.env.preproduction' -ForegroundColor Cyan

    if (-not (Test-Path $prodEnv)) {
        if (-not (Test-Path (Join-Path $root 'backend\.env.preproduction.example'))) {
            throw 'Impossible de generer .env.preproduction sans backend/.env.production ou .example'
        }
        Copy-Item (Join-Path $root 'backend\.env.preproduction.example') $stagingEnv -Force
    } else {
        Copy-Item $prodEnv $stagingEnv -Force
    }

    $lines = [System.IO.File]::ReadAllLines($stagingEnv)
    $out = New-Object System.Collections.Generic.List[string]
    $seen = @{}

    foreach ($line in $lines) {
        if ($line -match '^\s*APP_ENV\s*=') { $out.Add('APP_ENV=preproduction'); $seen['APP_ENV'] = $true; continue }
        if ($line -match '^\s*WEB_APP_URL\s*=') { $out.Add('WEB_APP_URL=https://staging.getsoundy.com'); $seen['WEB_APP_URL'] = $true; continue }
        if ($line -match '^\s*CORS_ORIGIN\s*=') { $out.Add('CORS_ORIGIN=https://staging.getsoundy.com'); $seen['CORS_ORIGIN'] = $true; continue }
        if ($line -match '^\s*JWT_SECRET\s*=') { $out.Add("JWT_SECRET=$(New-RandomSecret 48)"); $seen['JWT_SECRET'] = $true; continue }
        if ($line -match '^\s*ENCRYPTION_KEY\s*=') { $out.Add("ENCRYPTION_KEY=$(New-RandomSecret 40)"); $seen['ENCRYPTION_KEY'] = $true; continue }
        if ($line -match '^\s*DATABASE_URL\s*=') {
            $db = $line -replace '/soundy-prod(\?|$)', '/soundy_staging$1'
            $db = $db -replace '/soundy(\?|$)', '/soundy_staging$1'
            if ($db -notmatch 'soundy_staging') {
                $db = $line -replace '/[^/?]+(\?|$)', '/soundy_staging$1'
            }
            $out.Add($db)
            $seen['DATABASE_URL'] = $true
            continue
        }
        if ($line -match '^\s*STRIPE_SECRET_KEY\s*=' -and $line -match 'sk_live_') {
            $testStripe = $null
            $msdevEnv = Join-Path $root 'msdev\.env'
            if (Test-Path $msdevEnv) {
                $msLine = Select-String -Path $msdevEnv -Pattern '^\s*STRIPE_SECRET_KEY\s*=' | Select-Object -First 1
                if ($msLine -and $msLine.Line -match 'sk_test_') { $testStripe = ($msLine.Line -split '=', 2)[1].Trim() }
            }
            if ($testStripe) {
                $out.Add("STRIPE_SECRET_KEY=$testStripe")
            } else {
                $out.Add('# STRIPE_SECRET_KEY=sk_test_...  # remplacer par cle test Stripe')
            }
            $seen['STRIPE_SECRET_KEY'] = $true
            continue
        }
        if ($line -match 'getsoundy\.com' -and $line -match '^\s*(GOOGLE_|SPOTIFY_|YOUTUBE_|FACEBOOK_|INSTAGRAM_|WEB_APP|CORS|STRIPE_)') {
            $out.Add(($line -replace 'getsoundy\.com', 'staging.getsoundy.com'))
            continue
        }
        $out.Add($line)
    }

    if (-not $seen['APP_ENV']) { $out.Insert(0, 'APP_ENV=preproduction') | Out-Null }
    if (-not $seen['JWT_SECRET']) { $out.Add("JWT_SECRET=$(New-RandomSecret 48)") | Out-Null }
    if (-not $seen['ENCRYPTION_KEY']) { $out.Add("ENCRYPTION_KEY=$(New-RandomSecret 40)") | Out-Null }

    $text = ($out.ToArray() -join "`n") + "`n"
    [System.IO.File]::WriteAllText($stagingEnv, $text, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "  [OK] $stagingEnv ($((Get-Item $stagingEnv).Length) bytes)" -ForegroundColor Green

    if (-not (Test-Path $appStagingEnv) -and (Test-Path $appExample)) {
        Copy-Item $appExample $appStagingEnv -Force
        Write-Host "  [OK] $appStagingEnv (depuis example)" -ForegroundColor Green
    }
}

if ($GenerateOnly) {
    Write-Host 'GenerateOnly — push ignore' -ForegroundColor DarkGray
    exit 0
}

if (-not (Test-Path $stagingEnv)) {
    throw "Fichier manquant : $stagingEnv"
}

Write-Host '>> Push .env vers VPS staging' -ForegroundColor Cyan
$key = "$env:USERPROFILE\.ssh\id_ed25519"
$sshTarget = $cfg.SshHost
if (-not (Test-Path (Join-Path $env:USERPROFILE '.ssh\config'))) { $sshTarget = $cfg.Vps }

& ssh.exe -i $key -o StrictHostKeyChecking=no $sshTarget "mkdir -p $($cfg.Remote)" 2>&1 | Out-Null
& scp.exe -i $key -o StrictHostKeyChecking=no $stagingEnv "${sshTarget}:$($cfg.Remote)/.env"
if ($LASTEXITCODE -ne 0) { throw 'SCP .env staging echoue' }
Write-Host "  [OK] $($cfg.Remote)/.env sur staging" -ForegroundColor Green

Write-Host ''
Write-Host 'Prochaine etape : scripts/deploy-preprod.ps1' -ForegroundColor Cyan
