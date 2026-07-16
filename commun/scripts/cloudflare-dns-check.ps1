#!/usr/bin/env pwsh
# Vérifie si getsoundy.com est sur Cloudflare (zone API) — n'affiche pas les secrets.
# Usage : powershell -File commun/scripts/cloudflare-dns-check.ps1
$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot '..\backend\.env.production'
if (-not (Test-Path $envFile)) {
  Write-Host 'MISS local backend/.env.production'
  exit 1
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)=(.*)$') {
    $vars[$Matches[1]] = $Matches[2].Trim()
  }
}

$token = $vars['CLOUDFLARE_API_TOKEN']
if (-not $token) { $token = $vars['CLOUDFLARE_STREAM_API_TOKEN'] }
$accountId = $vars['CLOUDFLARE_ACCOUNT_ID']

if (-not $token -or -not $accountId) {
  Write-Host 'MISS CLOUDFLARE_ACCOUNT_ID or API token in .env.production'
  exit 1
}

$headers = @{ Authorization = "Bearer $token" }

try {
  $zones = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones?account.id=$accountId&per_page=20" -Headers $headers -TimeoutSec 20
} catch {
  Write-Host "API_ERROR zones: $($_.Exception.Message)"
  exit 2
}

if (-not $zones.success) {
  Write-Host "API_FAIL zones: $($zones.errors | ConvertTo-Json -Compress)"
  exit 2
}

$targets = @('getsoundy.com', 'staging.getsoundy.com')
foreach ($name in $targets) {
  $zone = $zones.result | Where-Object { $_.name -eq $name -or $_.name -eq ($name -replace '^staging\.', '') }
  if (-not $zone) {
    Write-Host "ZONE_MISSING $name (add site to Cloudflare + OVH nameservers)"
    continue
  }
  Write-Host "ZONE_OK $($zone.name) status=$($zone.status)"
  try {
    $uri = "https://api.cloudflare.com/client/v4/zones/$($zone.id)/dns_records?type=A&per_page=20"
    $records = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 20
    foreach ($r in $records.result) {
      $proxied = if ($r.proxied) { 'proxied' } else { 'dns-only' }
      Write-Host "  A $($r.name) -> $($r.content) [$proxied]"
    }
  } catch {
    Write-Host "  DNS_LIST_ERROR: $($_.Exception.Message)"
  }
}

# Résolution publique (hors Cloudflare API)
foreach ($name in $targets) {
  try {
    $resolved = [System.Net.Dns]::GetHostAddresses($name) | ForEach-Object { $_.IPAddressToString }
    Write-Host "PUBLIC_DNS $name -> $($resolved -join ', ')"
  } catch {
    Write-Host "PUBLIC_DNS $name -> ERROR"
  }
}
