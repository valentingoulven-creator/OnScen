# Forward Stripe test webhooks to the local msdev backend (:4080).
# Requires Stripe CLI (winget install Stripe.StripeCli) and msdev/.env STRIPE_SECRET_KEY.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/stripe-listen-msdev.ps1

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

$root = Get-ProjectRoot
if (-not $root) {
    Write-Host '[ERREUR] msdev/.env introuvable.' -ForegroundColor Red
    exit 1
}

$envFile = Join-Path $root 'msdev\.env'
$match = Select-String -Path $envFile -Pattern '^STRIPE_SECRET_KEY=(.+)$' -ErrorAction SilentlyContinue
if (-not $match) {
    Write-Host '[ERREUR] STRIPE_SECRET_KEY manquant dans msdev/.env' -ForegroundColor Red
    exit 1
}
$apiKey = $match.Matches.Groups[1].Value.Trim()

$stripe = Get-Command stripe -ErrorAction SilentlyContinue
if (-not $stripe) {
    Write-Host '[ERREUR] Stripe CLI absent. Installez : winget install Stripe.StripeCli' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'Stripe listen — msdev (test mode)' -ForegroundColor Cyan
Write-Host 'Backend attendu : http://localhost:4080' -ForegroundColor DarkGray
Write-Host ''

$donEvents = 'payment_intent.succeeded'
$subEvents = 'checkout.session.completed,invoice.paid,customer.subscription.updated,customer.subscription.deleted'

Write-Host '[1/2] Dons       -> /api/donations/webhook' -ForegroundColor Yellow
Write-Host "      events: $donEvents"
Start-Process -FilePath 'stripe' -ArgumentList @(
    'listen',
    '--api-key', $apiKey,
    '--forward-to', 'localhost:4080/api/donations/webhook',
    '--events', $donEvents
) -NoNewWindow

Start-Sleep -Seconds 2

Write-Host '[2/2] Abonnements -> /api/subscriptions/webhook' -ForegroundColor Yellow
Write-Host "      events: $subEvents"
Start-Process -FilePath 'stripe' -ArgumentList @(
    'listen',
    '--api-key', $apiKey,
    '--forward-to', 'localhost:4080/api/subscriptions/webhook',
    '--events', $subEvents
) -NoNewWindow

Write-Host ''
Write-Host 'Deux processus stripe listen demarres (fenetres separees).' -ForegroundColor Green
Write-Host 'Webhook secret : voir STRIPE_WEBHOOK_SECRET dans msdev/.env (stripe listen --print-secret).' -ForegroundColor DarkGray
Write-Host 'Arret : fermer les fenetres stripe listen ou Stop-Process -Name stripe' -ForegroundColor DarkGray
Write-Host ''
