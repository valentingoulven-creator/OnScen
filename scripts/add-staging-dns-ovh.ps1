# scripts/add-staging-dns-ovh.ps1 - Add staging.getsoundy.com A record via OVH API
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/add-staging-dns-ovh.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/add-staging-dns-ovh.ps1 -VerifyOnly
#
# Credentials (one of):
#   msdev/.env  -> OVH_APPLICATION_KEY, OVH_APPLICATION_SECRET, OVH_CONSUMER_KEY
#   ~/.ovh.conf -> application_key, application_secret, consumer_key
# Create token: https://eu.api.ovh.com/createToken/
#   GET/POST/PUT/DELETE /domain/zone/getsoundy.com/*
#   POST /domain/zone/getsoundy.com/refresh
param(
    [switch]$VerifyOnly,
    [string]$Zone = 'getsoundy.com',
    [string]$SubDomain = 'staging',
    [string]$TargetIp = '51.159.170.181',
    [int]$Ttl = 3600
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Read-EnvMap([string]$path) {
    $map = @{}
    if (-not (Test-Path $path)) { return $map }
    foreach ($line in Get-Content $path) {
        $t = $line.Trim()
        if (-not $t -or $t.StartsWith('#')) { continue }
        $i = $t.IndexOf('=')
        if ($i -le 0) { continue }
        $map[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
    }
    return $map
}

function Get-OvhCredentials {
    $msdev = Read-EnvMap (Join-Path $root 'msdev\.env')
    $ak = $msdev['OVH_APPLICATION_KEY']
    $as = $msdev['OVH_APPLICATION_SECRET']
    $ck = $msdev['OVH_CONSUMER_KEY']
    if ($ak -and $as -and $ck) {
        return @{ Endpoint = 'https://eu.api.ovh.com/1.0'; AppKey = $ak; AppSecret = $as; ConsumerKey = $ck }
    }

    $conf = Join-Path $env:USERPROFILE '.ovh.conf'
    if (Test-Path $conf) {
        $ini = Read-EnvMap $conf
        $ak = $ini['application_key']
        $as = $ini['application_secret']
        $ck = $ini['consumer_key']
        $endpoint = if ($ini['endpoint']) { $ini['endpoint'] } else { 'https://eu.api.ovh.com/1.0' }
        if ($ak -and $as -and $ck) {
            return @{ Endpoint = $endpoint.TrimEnd('/'); AppKey = $ak; AppSecret = $as; ConsumerKey = $ck }
        }
    }

    throw @"
OVH API credentials missing.
Add to msdev/.env (never commit):
  OVH_APPLICATION_KEY=...
  OVH_APPLICATION_SECRET=...
  OVH_CONSUMER_KEY=...
Create token: https://eu.api.ovh.com/createToken/
Rights: GET/POST/PUT/DELETE /domain/zone/getsoundy.com/* and POST /domain/zone/getsoundy.com/refresh
Or manual: scripts/add-staging-dns-ovh.md
"@
}

function Invoke-OvhApi {
    param(
        [hashtable]$Creds,
        [string]$Method,
        [string]$Path,
        [string]$Body = ''
    )
    $url = $Creds.Endpoint + $Path
    $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
    $toSign = ($Creds.AppSecret + '+' + $Creds.ConsumerKey + '+' + $Method + '+' + $url + '+' + $Body + '+' + $timestamp)
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    $hashBytes = $sha1.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))
    $hash = -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
    $signature = '$1$' + $hash

    $headers = @{
        'X-Ovh-Application' = $Creds.AppKey
        'X-Ovh-Consumer'    = $Creds.ConsumerKey
        'X-Ovh-Timestamp'   = $timestamp
        'X-Ovh-Signature'   = $signature
    }

    if ($Method -eq 'GET') {
        return Invoke-RestMethod -Method Get -Uri $url -Headers $headers
    }
    return Invoke-RestMethod -Method $Method -Uri $url -Headers $headers -Body $Body -ContentType 'application/json; charset=utf-8'
}

function Test-StagingDns {
    param([string]$ExpectedIp)
    try {
        $answers = Resolve-DnsName "$SubDomain.$Zone" -Type A -ErrorAction Stop
        $ip = ($answers | Where-Object { $_.Type -eq 'A' } | Select-Object -First 1).IPAddress
        if ($ip -eq $ExpectedIp) {
            Write-Host "  [OK] DNS $SubDomain.$Zone -> $ip" -ForegroundColor Green
            return $true
        }
        Write-Host "  [!] DNS $SubDomain.$Zone -> $ip (expected $ExpectedIp)" -ForegroundColor Yellow
        return $false
    } catch {
        Write-Host "  [!] DNS $SubDomain.$Zone not propagated yet" -ForegroundColor Yellow
        return $false
    }
}

function Wait-DnsPropagation {
    param([string]$ExpectedIp, [int]$MaxWaitSec = 600)
    $deadline = (Get-Date).AddSeconds($MaxWaitSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-StagingDns $ExpectedIp) { return $true }
        Write-Host '  ... waiting 30s for DNS propagation' -ForegroundColor DarkGray
        Start-Sleep -Seconds 30
    }
    return $false
}

Write-Host ">> DNS staging: $SubDomain.$Zone -> $TargetIp" -ForegroundColor Cyan

if (Test-StagingDns $TargetIp) {
    if ($VerifyOnly) { exit 0 }
    Write-Host '  [OK] Record already active' -ForegroundColor Green
} elseif ($VerifyOnly) {
    Write-Host '  [X] Record missing' -ForegroundColor Red
    exit 1
} else {
    $creds = Get-OvhCredentials
    Write-Host '  [OK] OVH credentials loaded' -ForegroundColor Green

    $encodedZone = [Uri]::EscapeDataString($Zone)
    $records = Invoke-OvhApi -Creds $creds -Method GET -Path ("/domain/zone/$encodedZone/record?fieldType=A&subDomain=$SubDomain")
    $existing = @($records) | Where-Object { $_.subDomain -eq $SubDomain -and $_.fieldType -eq 'A' }

    if ($existing.Count -gt 0) {
        $rec = $existing[0]
        if ($rec.target -eq $TargetIp) {
            Write-Host "  [OK] OVH record already correct (id $($rec.id))" -ForegroundColor Green
        } else {
            Write-Host "  [update] OVH record id $($rec.id): $($rec.target) -> $TargetIp" -ForegroundColor Yellow
            $body = (@{ target = $TargetIp; ttl = $Ttl } | ConvertTo-Json -Compress)
            $null = Invoke-OvhApi -Creds $creds -Method PUT -Path ("/domain/zone/$encodedZone/record/$($rec.id)") -Body $body
        }
    } else {
        Write-Host '  [add] Creating A record on OVH' -ForegroundColor Yellow
        $body = (@{
            fieldType = 'A'
            subDomain = $SubDomain
            target    = $TargetIp
            ttl       = $Ttl
        } | ConvertTo-Json -Compress)
        $newId = Invoke-OvhApi -Creds $creds -Method POST -Path ("/domain/zone/$encodedZone/record") -Body $body
        Write-Host "  [OK] Created record id $newId" -ForegroundColor Green
    }

    Write-Host '  >> Refreshing OVH zone' -ForegroundColor DarkCyan
    $null = Invoke-OvhApi -Creds $creds -Method POST -Path ("/domain/zone/$encodedZone/refresh")

    $propagated = Wait-DnsPropagation $TargetIp
    if (-not $propagated) {
        Write-Host '  [!] DNS not visible yet — retry in 15-30 min or run -VerifyOnly' -ForegroundColor Yellow
    }
}

Write-Host '>> Staging health check' -ForegroundColor Cyan
try {
    $healthIp = Invoke-RestMethod -Uri "http://$TargetIp/health" -TimeoutSec 15
    Write-Host ('  [OK] http://' + $TargetIp + '/health env=' + $healthIp.env) -ForegroundColor Green
} catch {
    Write-Host ('  [!] Staging health via IP failed: ' + $_.Exception.Message) -ForegroundColor Yellow
}

if (Test-StagingDns $TargetIp) {
    try {
        $health = Invoke-RestMethod -Uri "https://$SubDomain.$Zone/health" -TimeoutSec 20
        Write-Host ('  [OK] https://' + $SubDomain + '.' + $Zone + '/health env=' + $health.env) -ForegroundColor Green
    } catch {
        Write-Host '  [!] HTTPS not ready yet — Caddy will request Let''s Encrypt after DNS propagation' -ForegroundColor Yellow
        Write-Host '      ssh soundy-staging "systemctl reload caddy"' -ForegroundColor DarkGray
    }
}

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
