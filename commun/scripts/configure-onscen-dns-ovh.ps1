# commun/scripts/configure-onscen-dns-ovh.ps1 — DNS onscen.com → VPS prod + staging
param(
    [switch]$VerifyOnly,
    [string]$Zone = 'onscen.com',
    [string]$ProdIp = '51.159.164.100',
    [string]$StagingIp = '51.159.170.181',
    [int]$Ttl = 3600
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path

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
    $msdev = Read-EnvMap (Join-Path $root 'commun\msdev\.env')
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

    throw 'OVH API credentials missing (commun/msdev/.env or ~/.ovh.conf) — see commun/docs/ONSCEN-DOMAINE.md'
}

function Invoke-OvhApi {
    param([hashtable]$Creds, [string]$Method, [string]$Path, [string]$Body = '')
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
    if ($Method -eq 'GET') { return Invoke-RestMethod -Method Get -Uri $url -Headers $headers }
    return Invoke-RestMethod -Method $Method -Uri $url -Headers $headers -Body $Body -ContentType 'application/json; charset=utf-8'
}

function Test-DnsA {
    param([string]$Fqdn, [string]$ExpectedIp)
    try {
        $answers = Resolve-DnsName $Fqdn -Type A -ErrorAction Stop
        $ip = ($answers | Where-Object { $_.Type -eq 'A' } | Select-Object -First 1).IPAddress
        if ($ip -eq $ExpectedIp) {
            Write-Host "  [OK] $Fqdn -> $ip" -ForegroundColor Green
            return $true
        }
        Write-Host "  [!] $Fqdn -> $ip (expected $ExpectedIp)" -ForegroundColor Yellow
        return $false
    } catch {
        Write-Host "  [!] $Fqdn - no A record yet" -ForegroundColor Yellow
        return $false
    }
}

function Set-OvhARecord {
    param(
        [hashtable]$Creds,
        [string]$Zone,
        [string]$SubDomain,
        [string]$TargetIp,
        [int]$Ttl
    )
    $encodedZone = [Uri]::EscapeDataString($Zone)
    $subParam = if ($SubDomain -eq '@') { '' } else { $SubDomain }
    $listPath = "/domain/zone/$encodedZone/record?fieldType=A" + '&subDomain=' + $subParam
    $records = Invoke-OvhApi -Creds $Creds -Method GET -Path $listPath
    $existing = @($records) | Where-Object { $_.subDomain -eq $subParam -and $_.fieldType -eq 'A' }
    $label = if ($subParam) { "$subParam.$Zone" } else { $Zone }

    if ($existing.Count -gt 0) {
        $rec = $existing[0]
        if ($rec.target -eq $TargetIp) {
            Write-Host "  [OK] OVH $label already $TargetIp" -ForegroundColor Green
            return
        }
        Write-Host "  [update] OVH $label $($rec.target) -> $TargetIp" -ForegroundColor Yellow
        $body = (@{ target = $TargetIp; ttl = $Ttl } | ConvertTo-Json -Compress)
        $null = Invoke-OvhApi -Creds $Creds -Method PUT -Path ("/domain/zone/$encodedZone/record/$($rec.id)") -Body $body
    } else {
        Write-Host "  [add] OVH A $label -> $TargetIp" -ForegroundColor Yellow
        $body = (@{ fieldType = 'A'; subDomain = $subParam; target = $TargetIp; ttl = $Ttl } | ConvertTo-Json -Compress)
        $newId = Invoke-OvhApi -Creds $Creds -Method POST -Path ("/domain/zone/$encodedZone/record") -Body $body
        Write-Host "  [OK] Created record id $newId" -ForegroundColor Green
    }
}

Write-Host ">> DNS onscen.com (OVH zone $Zone)" -ForegroundColor Cyan

$targets = @(
    @{ Fqdn = $Zone; Sub = '@'; Ip = $ProdIp },
    @{ Fqdn = "www.$Zone"; Sub = 'www'; Ip = $ProdIp },
    @{ Fqdn = "staging.$Zone"; Sub = 'staging'; Ip = $StagingIp }
)

$allOk = $true
foreach ($t in $targets) {
    if (-not (Test-DnsA $t.Fqdn $t.Ip)) { $allOk = $false }
}

if ($VerifyOnly) {
    if ($allOk) { exit 0 }
    exit 1
}

if ($allOk) {
    Write-Host '  [OK] DNS already correct' -ForegroundColor Green
} else {
    $creds = Get-OvhCredentials
    foreach ($t in $targets) {
        Set-OvhARecord -Creds $creds -Zone $Zone -SubDomain $t.Sub -TargetIp $t.Ip -Ttl $Ttl
    }
    Write-Host '  >> Refreshing OVH zone' -ForegroundColor DarkCyan
    $encodedZone = [Uri]::EscapeDataString($Zone)
    $null = Invoke-OvhApi -Creds $creds -Method POST -Path ("/domain/zone/$encodedZone/refresh")
    Write-Host '  >> Waiting 60s for propagation...' -ForegroundColor DarkGray
    Start-Sleep -Seconds 60
}

Write-Host '>> Health checks' -ForegroundColor Cyan
foreach ($url in @("https://$Zone/health", "https://staging.$Zone/health")) {
    try {
        $h = Invoke-RestMethod -Uri $url -TimeoutSec 25
        Write-Host ("  [OK] $url env=" + $h.env) -ForegroundColor Green
    } catch {
        Write-Host "  [!] $url - $($_.Exception.Message) (DNS/Caddy/TLS may need a few minutes)" -ForegroundColor Yellow
    }
}

Write-Host 'Done.' -ForegroundColor Green
