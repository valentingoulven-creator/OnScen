# Bootstrap Stripe test account for msdev: subscription prices + webhook signing secret in msdev/.env
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-stripe-msdev.ps1

$ErrorActionPreference = 'Stop'

function Get-ProjectRoot {
    $dir = $PSScriptRoot
    while ($dir) {
        if (Test-Path (Join-Path $dir 'msdev\.env')) { return (Resolve-Path $dir).Path }
        $parent = Split-Path -Parent $dir
        if (-not $parent -or $parent -eq $dir) { break }
        $dir = $parent
    }
    return $null
}

function Set-EnvVar {
    param([string]$Path, [string]$Key, [string]$Value)
    $lines = Get-Content $Path -Raw
    $pattern = "(?m)^$([regex]::Escape($Key))=.*$"
    if ($lines -match "(?m)^$([regex]::Escape($Key))=") {
        $lines = [regex]::Replace($lines, $pattern, "$Key=$Value")
    } else {
        $lines = $lines.TrimEnd() + "`n$Key=$Value`n"
    }
    Set-Content -Path $Path -Value $lines -NoNewline
}

function New-StripeRecurringPrice {
    param([string]$ApiKey, [string]$ProductName, [int]$AmountCents)
    $prodJson = stripe products create --name $ProductName --api-key $ApiKey 2>&1 | Out-String
    $prod = $prodJson | ConvertFrom-Json
    $priceJson = stripe prices create --product $prod.id -d "unit_amount=$AmountCents" -d currency=eur -d "recurring[interval]=month" --api-key $ApiKey 2>&1 | Out-String
    $price = $priceJson | ConvertFrom-Json
    return $price.id
}

$root = Get-ProjectRoot
if (-not $root) {
    Write-Host '[ERREUR] msdev/.env introuvable.' -ForegroundColor Red
    exit 1
}

$envFile = Join-Path $root 'msdev\.env'
$match = Select-String -Path $envFile -Pattern '^STRIPE_SECRET_KEY=(.+)$'
if (-not $match) {
    Write-Host '[ERREUR] STRIPE_SECRET_KEY manquant dans msdev/.env' -ForegroundColor Red
    exit 1
}
$apiKey = $match.Matches.Groups[1].Value.Trim()

if (-not (Get-Command stripe -ErrorAction SilentlyContinue)) {
    Write-Host '[ERREUR] Stripe CLI absent. Installez : winget install Stripe.StripeCli' -ForegroundColor Red
    exit 1
}

Write-Host 'Configuration Stripe msdev (test)...' -ForegroundColor Cyan

$existing = stripe prices list --limit 1 --api-key $apiKey 2>&1 | ConvertFrom-Json
if ($existing.data.Count -gt 0) {
    Write-Host 'Des prices existent deja sur le compte test — creation ignoree.' -ForegroundColor Yellow
    Write-Host 'Pour recreer, supprimez les products/prices dans le Dashboard Stripe test.' -ForegroundColor DarkGray
} else {
    Write-Host 'Creation des products/prices...'
    $tier1 = New-StripeRecurringPrice -ApiKey $apiKey -ProductName 'Soundy Supporter (tier1)' -AmountCents 499
    $tier2 = New-StripeRecurringPrice -ApiKey $apiKey -ProductName 'Soundy Super fan (tier2)' -AmountCents 999
    $plus = New-StripeRecurringPrice -ApiKey $apiKey -ProductName 'Soundy+ (platform)' -AmountCents 999
    $ultra = New-StripeRecurringPrice -ApiKey $apiKey -ProductName 'SoundyUltra (platform)' -AmountCents 1999

    Set-EnvVar -Path $envFile -Key 'STRIPE_PRICE_ID_TIER1' -Value $tier1
    Set-EnvVar -Path $envFile -Key 'STRIPE_PRICE_ID_TIER2' -Value $tier2
    Set-EnvVar -Path $envFile -Key 'STRIPE_PRICE_ID_SOUNDY_PLUS' -Value $plus
    Set-EnvVar -Path $envFile -Key 'STRIPE_PRICE_ID_SOUNDY_ULTRA' -Value $ultra
    Write-Host "  tier1=$tier1"
    Write-Host "  tier2=$tier2"
    Write-Host "  soundy_plus=$plus"
    Write-Host "  soundy_ultra=$ultra"
}

Write-Host 'Webhook signing secret (stripe listen)...'
$whsec = (stripe listen --print-secret --api-key $apiKey 2>&1 | Out-String).Trim()
if (-not $whsec.StartsWith('whsec_')) {
    Write-Host "[ERREUR] Secret webhook invalide: $whsec" -ForegroundColor Red
    exit 1
}

Set-EnvVar -Path $envFile -Key 'STRIPE_WEBHOOK_SECRET' -Value $whsec
Set-EnvVar -Path $envFile -Key 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET' -Value $whsec
Set-EnvVar -Path $envFile -Key 'SUBSCRIPTION_TIER1_AMOUNT_EUR' -Value '4.99'
Set-EnvVar -Path $envFile -Key 'SUBSCRIPTION_TIER2_AMOUNT_EUR' -Value '9.99'
Set-EnvVar -Path $envFile -Key 'SUBSCRIPTION_SOUNDLY_PLUS_AMOUNT_EUR' -Value '9.99'
Set-EnvVar -Path $envFile -Key 'SUBSCRIPTION_SOUNDLY_ULTRA_AMOUNT_EUR' -Value '19.99'
Set-EnvVar -Path $envFile -Key 'SUBSCRIPTIONS_ENABLED' -Value '1'

Write-Host ''
Write-Host 'msdev/.env mis a jour.' -ForegroundColor Green
Write-Host 'Lancez les webhooks locaux : scripts/stripe-listen-msdev.ps1' -ForegroundColor Cyan
Write-Host 'Puis redemarrez npm run dev si le backend tourne deja.' -ForegroundColor DarkGray
