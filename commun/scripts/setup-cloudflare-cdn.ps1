#!/usr/bin/env pwsh
# Configure Cloudflare CDN/WAF for getsoundy.com (DNS, SSL, cache rules).
# Usage:
#   $env:CLOUDFLARE_DNS_API_TOKEN = 'cfat_...'
#   $env:CLOUDFLARE_ACCOUNT_ID = '...'   # optional
#   powershell -File commun/scripts/setup-cloudflare-cdn.ps1
#
# Never commit tokens. Reads CLOUDFLARE_DNS_API_TOKEN or CLOUDFLARE_API_TOKEN from env,
# then backend/.env.production as fallback.
param(
  [string]$ZoneName = 'getsoundy.com',
  [string]$ProdIp = '51.159.164.100',
  [string]$StagingIp = '51.159.170.181'
)

$ErrorActionPreference = 'Stop'

function Get-CfToken {
  if ($env:CLOUDFLARE_DNS_API_TOKEN) { return $env:CLOUDFLARE_DNS_API_TOKEN.Trim() }
  if ($env:CLOUDFLARE_API_TOKEN) { return $env:CLOUDFLARE_API_TOKEN.Trim() }
  $envFile = Join-Path $PSScriptRoot '..\backend\.env.production'
  if (Test-Path $envFile) {
    $vars = @{}
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)=(.*)$') { $vars[$Matches[1]] = $Matches[2].Trim() }
    }
    if ($vars['CLOUDFLARE_DNS_API_TOKEN']) { return $vars['CLOUDFLARE_DNS_API_TOKEN'] }
    if ($vars['CLOUDFLARE_API_TOKEN']) { return $vars['CLOUDFLARE_API_TOKEN'] }
    if ($vars['CLOUDFLARE_STREAM_API_TOKEN']) { return $vars['CLOUDFLARE_STREAM_API_TOKEN'] }
  }
  throw 'Missing CLOUDFLARE_DNS_API_TOKEN (env or .env.production)'
}

function Invoke-CfApi {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )
  $uri = "https://api.cloudflare.com/client/v4$Path"
  $headers = @{ Authorization = "Bearer $script:CfToken" }
  if ($Body -ne $null) {
    $headers['Content-Type'] = 'application/json'
    $json = $Body | ConvertTo-Json -Depth 12 -Compress
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json -TimeoutSec 30
  }
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -TimeoutSec 30
}

function Ensure-DnsRecord {
  param(
    [string]$ZoneId,
    [string]$Type,
    [string]$Name,
    [string]$Content,
    [bool]$Proxied = $true
  )
  $qName = if ($Name -eq '@') { $ZoneName } else { "$Name.$ZoneName" }
  $list = Invoke-CfApi GET "/zones/$ZoneId/dns_records?type=$Type&name=$qName"
  $existing = $list.result | Select-Object -First 1
  $payload = @{
    type    = $Type
    name    = $Name
    content = $Content
    proxied = $Proxied
    ttl     = 1
  }
  if ($existing) {
    $needs = ($existing.content -ne $Content) -or ([bool]$existing.proxied -ne $Proxied)
    if (-not $needs) {
      Write-Host "DNS OK  $qName -> $Content proxied=$Proxied"
      return
    }
    Invoke-CfApi PATCH "/zones/$ZoneId/dns_records/$($existing.id)" $payload | Out-Null
    Write-Host "DNS UPD $qName -> $Content proxied=$Proxied"
  } else {
    Invoke-CfApi POST "/zones/$ZoneId/dns_records" $payload | Out-Null
    Write-Host "DNS ADD $qName -> $Content proxied=$Proxied"
  }
}

function Set-ZoneSetting {
  param([string]$ZoneId, [string]$Id, [string]$Value)
  $res = Invoke-CfApi PATCH "/zones/$ZoneId/settings/$Id" @{ value = $Value }
  Write-Host "SETTING $Id = $($res.result.value)"
}

function Set-CacheRules {
  param([string]$ZoneId)
  $rules = @(
    @{
      action = 'set_cache_settings'
      action_parameters = @{ cache = $false }
      expression = '(starts_with(http.request.uri.path, "/api")) or (starts_with(http.request.uri.path, "/socket.io")) or (http.request.uri.path eq "/health") or (http.request.uri.path eq "/health/db")'
      description = 'OnScen bypass API socket health'
      enabled = $true
    },
    @{
      action = 'set_cache_settings'
      action_parameters = @{ cache = $false }
      expression = '(http.request.uri.path eq "/sw.js") or (http.request.uri.path eq "/") or (http.request.uri.path eq "/index.html")'
      description = 'OnScen bypass SPA shell and service worker'
      enabled = $true
    },
    @{
      action = 'set_cache_settings'
      action_parameters = @{
        cache = $true
        edge_ttl = @{ mode = 'respect_origin' }
      }
      expression = 'starts_with(http.request.uri.path, "/assets/")'
      description = 'OnScen cache hashed assets'
      enabled = $true
    }
  )

  $body = @{
    rules = $rules
    description = 'OnScen CDN cache rules'
  }

  try {
    Invoke-CfApi PUT "/zones/$ZoneId/rulesets/phases/http_request_cache_settings/entrypoint" $body | Out-Null
    Write-Host 'CACHE rules entrypoint OK (3 rules)'
  } catch {
    Write-Host "CACHE rules WARN: $($_.Exception.Message)"
    try {
      $create = @{
        name = 'OnScen CDN cache'
        kind = 'zone'
        phase = 'http_request_cache_settings'
        rules = $rules
      }
      Invoke-CfApi POST "/zones/$ZoneId/rulesets" $create | Out-Null
      Write-Host 'CACHE rules created via POST rulesets'
    } catch {
      Write-Host "CACHE fallback FAIL: $($_.Exception.Message)"
    }
  }
}

$script:CfToken = Get-CfToken
Write-Host '=== Cloudflare CDN setup ==='

# Account tokens need ZONE-scoped permissions (DNS Write, Zone Settings Write, Cache Settings Write).
# Account-level "DNS View Write" / "Account DNS Settings Write" are not enough for /zones/.../dns_records.
try {
  $probe = Invoke-CfApi GET "/zones?name=$ZoneName&per_page=1"
  if ($probe.result.Count -gt 0) {
    $probeZoneId = $probe.result[0].id
    try {
      Invoke-CfApi GET "/zones/$probeZoneId/dns_records?per_page=1" | Out-Null
    } catch {
      Write-Host @'

TOKEN_SCOPE_WARN: this token cannot manage zone DNS/settings.
Create a Custom Account API Token scoped to zone getsoundy.com with:
  - Zone DNS Write
  - Zone Settings Write
  - Cache Settings Write
  - Zone Read

Or finish SSL + Cache Rules in the Cloudflare dashboard (see commun/deploy/CLOUDFLARE-CDN-WAF.md).
'@
      throw 'Cloudflare token missing zone DNS/settings permissions'
    }
  }
} catch {
  if ($_.Exception.Message -notmatch 'TOKEN_SCOPE_WARN') { throw }
  exit 3
}

$zones = Invoke-CfApi GET "/zones?name=$ZoneName"
if (-not $zones.success -or $zones.result.Count -eq 0) {
  throw "Zone $ZoneName not found in account"
}
$zone = $zones.result[0]
$zoneId = $zone.id
Write-Host "ZONE $($zone.name) id=$zoneId status=$($zone.status)"

Ensure-DnsRecord -ZoneId $zoneId -Type 'A' -Name '@' -Content $ProdIp -Proxied $true
Ensure-DnsRecord -ZoneId $zoneId -Type 'A' -Name 'staging' -Content $StagingIp -Proxied $true

# www CNAME
try {
  Ensure-DnsRecord -ZoneId $zoneId -Type 'CNAME' -Name 'www' -Content $ZoneName -Proxied $true
} catch {
  Write-Host "DNS www WARN: $($_.Exception.Message)"
}

Set-ZoneSetting -ZoneId $zoneId -Id 'ssl' -Value 'strict'
Set-ZoneSetting -ZoneId $zoneId -Id 'always_use_https' -Value 'on'
Set-ZoneSetting -ZoneId $zoneId -Id 'min_tls_version' -Value '1.2'
Set-ZoneSetting -ZoneId $zoneId -Id 'tls_1_3' -Value 'on'

try {
  Set-ZoneSetting -ZoneId $zoneId -Id 'security_level' -Value 'medium'
} catch { Write-Host "SETTING security_level skip" }

try {
  Set-ZoneSetting -ZoneId $zoneId -Id 'browser_check' -Value 'on'
} catch { Write-Host "SETTING browser_check skip" }

Set-CacheRules -ZoneId $zoneId

Write-Host '=== Done ==='
