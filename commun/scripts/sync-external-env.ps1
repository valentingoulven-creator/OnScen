# commun/scripts/sync-external-env.ps1 - Sync missing external env keys commun/msdev/local -> VPS
# Usage:
#   powershell -ExecutionPolicy Bypass -File commun/scripts/sync-external-env.ps1 -Staging
#   powershell -ExecutionPolicy Bypass -File commun/scripts/sync-external-env.ps1 -Prod
#   powershell -ExecutionPolicy Bypass -File commun/scripts/sync-external-env.ps1 -Staging -Prod
#   powershell -ExecutionPolicy Bypass -File commun/scripts/sync-external-env.ps1 -DryRun
param(
    [switch]$Staging,
    [switch]$Prod,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $root
. (Join-Path $root 'commun\deploy\environments.ps1')

if (-not $Staging -and -not $Prod) {
    $Staging = $true
    $Prod = $true
}

function Read-EnvFile([string]$path) {
    $map = @{}
    if (-not (Test-Path $path)) { return $map }
    foreach ($line in Get-Content $path) {
        $t = $line.Trim()
        if (-not $t -or $t.StartsWith('#')) { continue }
        $i = $t.IndexOf('=')
        if ($i -le 0) { continue }
        $k = $t.Substring(0, $i).Trim()
        $v = $t.Substring($i + 1).Trim()
        if ($v) { $map[$k] = $v }
    }
    return $map
}

function Get-EnvValue([hashtable]$map, [string]$key) {
    if ($map.ContainsKey($key) -and $map[$key]) { return $map[$key] }
    return $null
}

function Merge-EnvKeys([hashtable]$remoteMap, [array]$entries) {
    $added = @()
    foreach ($entry in $entries) {
        $key = $entry.Key
        if (Get-EnvValue $remoteMap $key) { continue }
        $val = $entry.Value
        if (-not $val) { continue }
        $remoteMap[$key] = $val
        $added += $entry
    }
    return $added
}

$msdevEnv = Read-EnvFile (Join-Path $root 'commun\msdev\.env')
$localProdEnv = Read-EnvFile (Join-Path $root 'commun/backend\.env.production')
$script:remoteProdEnv = @{}

function Load-ProdEnvFromVps {
    if ($script:remoteProdEnv.Count -gt 0) { return $script:remoteProdEnv }
    $cfg = Get-SoundyDeployEnvironment 'prod'
    $tmp = Join-Path $env:TEMP 'soundy-sync-prod-source.env'
    scp ($cfg.SshHost + ':' + $cfg.Remote + '/.env') $tmp 2>$null
    if (Test-Path $tmp) {
        $script:remoteProdEnv = Read-EnvFile $tmp
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }
    return $script:remoteProdEnv
}

$fromMsdev = @(
    'ANTHROPIC_API_KEY',
    'STRIPE_PRICE_ID_TIER1',
    'STRIPE_PRICE_ID_TIER2'
)

$s3Keys = @(
    'S3_BUCKET',
    'S3_REGION',
    'S3_ENDPOINT',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_PUBLIC_BASE_URL',
    'S3_FORCE_PATH_STYLE',
    'S3_PUBLIC_READ'
)

function Build-Entries([hashtable]$remoteMap, [string]$targetLabel) {
    $entries = @()

    foreach ($key in $fromMsdev) {
        $val = Get-EnvValue $msdevEnv $key
        if (-not $val) {
            Write-Host "  [skip] $key missing in commun/msdev/.env" -ForegroundColor DarkGray
            continue
        }
        $entries += @{ Key = $key; Value = $val; Source = 'msdev' }
    }

    if ($targetLabel -eq 'preproduction') {
        $prodRemote = Load-ProdEnvFromVps
        foreach ($key in $s3Keys) {
            $val = Get-EnvValue $localProdEnv $key
            if (-not $val) { $val = Get-EnvValue $msdevEnv $key }
            if (-not $val) { $val = Get-EnvValue $prodRemote $key }
            if ($val) {
                $entries += @{ Key = $key; Value = $val; Source = 'prod-vps' }
            }
        }
    }

    return Merge-EnvKeys $remoteMap $entries
}

function Write-EnvFile([string]$path, [hashtable]$map, [string[]]$originalLines) {
    $seen = @{}
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($line in $originalLines) {
        $t = $line.Trim()
        if ($t -and -not $t.StartsWith('#') -and $t.Contains('=')) {
            $k = $t.Substring(0, $t.IndexOf('=')).Trim()
            if ($map.ContainsKey($k)) {
                $out.Add($k + '=' + $map[$k])
                $seen[$k] = $true
                continue
            }
        }
        $out.Add($line)
    }
    foreach ($k in ($map.Keys | Sort-Object)) {
        if (-not $seen[$k]) {
            $out.Add($k + '=' + $map[$k])
        }
    }
    $text = ($out.ToArray() -join [Environment]::NewLine) + [Environment]::NewLine
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding $false))
}

function Sync-Target([string]$envName) {
    $cfg = Get-SoundyDeployEnvironment $envName
    $sshHost = $cfg.SshHost
    $remoteEnv = $cfg.Remote + '/.env'
    $tmp = Join-Path $env:TEMP ('soundy-sync-' + $envName + '.env')

    Write-Host ('>> Sync ' + $cfg.Label + ' (' + $sshHost + ')') -ForegroundColor Cyan

    scp ($sshHost + ':' + $remoteEnv) $tmp
    if (-not (Test-Path $tmp)) { throw ('Cannot read ' + $remoteEnv + ' from ' + $sshHost) }

    $originalLines = Get-Content $tmp
    $remoteMap = Read-EnvFile $tmp
    $added = Build-Entries $remoteMap $cfg.Label

    if (-not $added.Count) {
        Write-Host '  [OK] Nothing to sync' -ForegroundColor Green
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        return
    }

    foreach ($a in $added) {
        Write-Host ('  [add] ' + $a.Key + ' (from ' + $a.Source + ')') -ForegroundColor Yellow
    }

    if ($DryRun) {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        return
    }

    Write-EnvFile $tmp $remoteMap $originalLines
    scp $tmp ($sshHost + ':' + $remoteEnv)
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue

    Write-Host ('  >> pm2 reload ' + $cfg.Pm2App) -ForegroundColor DarkCyan
    ssh $sshHost ('pm2 reload ' + $cfg.Pm2App + ' --update-env')
    Write-Host '  [OK] Sync complete' -ForegroundColor Green
}

if ($Prod) { Sync-Target 'prod' }
if ($Staging) { Sync-Target 'preprod' }

Write-Host ''
Write-Host 'Manual actions still required:' -ForegroundColor Yellow
Write-Host '  - Stripe sk_live_ on prod (replace sk_test_)'
Write-Host '  - ACRCloud keys at acrcloud.com'
Write-Host '  - LEGAL_PUBLISHER_ADDRESS / legal-publisher.json'
Write-Host '  - OVH DNS: staging.getsoundy.com A -> 51.159.170.181'
