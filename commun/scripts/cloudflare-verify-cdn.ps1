#!/usr/bin/env pwsh
# Vérifie que onscen.com / staging passent bien par Cloudflare (sans token zone DNS).
# Usage : powershell -File commun/scripts/cloudflare-verify-cdn.ps1
$ErrorActionPreference = 'Continue'

function Test-Headers {
  param([string]$Url, [string[]]$Need)
  try {
    $r = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 20 -UseBasicParsing
    $ok = $true
    foreach ($n in $Need) {
      $hit = $false
      foreach ($k in $r.Headers.Keys) {
        if ($k -ieq $n) { $hit = $true; Write-Host "  $k`: $($r.Headers[$k])" }
      }
      if (-not $hit) { Write-Host "  MISS $n"; $ok = $false }
    }
    Write-Host "  HTTP $($r.StatusCode)"
    return $ok
  } catch {
    Write-Host "  ERR $($_.Exception.Message)"
    return $false
  }
}

Write-Host '=== Cloudflare CDN verify ==='

$checks = @()

Write-Host "`n[prod] https://onscen.com/health"
$checks += Test-Headers 'https://onscen.com/health' @('Server', 'CF-RAY', 'Cf-Cache-Status')

Write-Host "`n[staging] https://staging.onscen.com/health"
$checks += Test-Headers 'https://staging.onscen.com/health' @('Server', 'CF-RAY')

Write-Host "`n[prod] HTTP -> HTTPS"
try {
  $r = Invoke-WebRequest -Uri 'http://onscen.com/health' -Method Head -MaximumRedirection 0 -TimeoutSec 15 -UseBasicParsing
} catch {
  if ($_.Exception.Response) {
    $code = [int]$_.Exception.Response.StatusCode
    $loc = $_.Exception.Response.Headers['Location']
    Write-Host "  HTTP $code Location: $loc"
    $checks += ($code -ge 301 -and $code -le 308 -and $loc -like 'https://*')
  } else {
    Write-Host "  ERR $($_.Exception.Message)"
    $checks += $false
  }
}

$asset = '/assets/vendor-misc-DuKqaIJt.css'
Write-Host "`n[prod] asset cache $asset"
try {
  $null = Invoke-WebRequest -Uri "https://onscen.com$asset" -Method Head -TimeoutSec 20 -UseBasicParsing
  $r2 = Invoke-WebRequest -Uri "https://onscen.com$asset" -Method Head -TimeoutSec 20 -UseBasicParsing
  $cache = $r2.Headers['Cf-Cache-Status']
  Write-Host "  Cf-Cache-Status (2e hit): $cache"
  $checks += ($cache -eq 'HIT' -or $cache -eq 'REVALIDATED')
} catch {
  Write-Host "  ERR $($_.Exception.Message)"
  $checks += $false
}

Write-Host "`n[DNS] résolution publique"
foreach ($hostname in @('onscen.com', 'staging.onscen.com', 'www.onscen.com')) {
  try {
    $ips = [System.Net.Dns]::GetHostAddresses($hostname) | ForEach-Object { $_.IPAddressToString }
    $cf = ($ips | Where-Object { $_ -match '^188\.114\.' }).Count -gt 0
    Write-Host "  $hostname -> $($ips -join ', ') $(if($cf){'[CF proxy]'}else{'[WARN not CF IP]'})"
    $checks += $cf
  } catch {
    Write-Host "  $hostname -> ERROR"
    $checks += $false
  }
}

$passed = ($checks | Where-Object { $_ }).Count
$total = $checks.Count
Write-Host "`n=== Result: $passed / $total checks OK ==="
if ($passed -lt $total) { exit 1 }
