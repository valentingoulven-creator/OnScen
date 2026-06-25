# scripts/setup-staging-infra.ps1 — Bootstrap VPS staging + base PG + SSH config
# Usage : powershell -ExecutionPolicy Bypass -File scripts/setup-staging-infra.ps1
param(
    [switch]$SkipBootstrap,
    [switch]$SkipDb,
    [switch]$SkipSshConfig
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

$key = "$env:USERPROFILE\.ssh\id_ed25519"
$stagingIp = '51.159.170.181'
$sshConfig = Join-Path $env:USERPROFILE '.ssh\config'

function Invoke-Ssh([string]$target, [string]$cmd) {
    & ssh.exe -i $key -o StrictHostKeyChecking=no -o ConnectTimeout=20 $target $cmd 2>&1
    if ($LASTEXITCODE -ne 0) { throw "SSH failed: $cmd" }
}

if (-not $SkipSshConfig) {
    Write-Host '>> SSH config soundy-staging' -ForegroundColor Cyan
    $block = @"

Host soundy-staging
    HostName $stagingIp
    User root
    IdentityFile $key
    StrictHostKeyChecking no

"@
    if (Test-Path $sshConfig) {
        $content = Get-Content $sshConfig -Raw
        if ($content -notmatch 'Host soundy-staging') {
            Add-Content -Path $sshConfig -Value $block
            Write-Host '  [OK] Host soundy-staging ajoute' -ForegroundColor Green
        } else {
            Write-Host '  [OK] soundy-staging deja present' -ForegroundColor Green
        }
    } else {
        Set-Content -Path $sshConfig -Value $block.TrimStart()
        Write-Host '  [OK] ~/.ssh/config cree' -ForegroundColor Green
    }
}

if (-not $SkipBootstrap) {
    Write-Host '>> Bootstrap VPS staging (Node, PM2, Caddy)' -ForegroundColor Cyan
    $bootstrap = Join-Path $root 'deploy\bootstrap-staging-vps.sh'
    & scp.exe -i $key -o StrictHostKeyChecking=no $bootstrap "root@${stagingIp}:/tmp/bootstrap-staging-vps.sh" 2>&1 | Out-Null
    $out = Invoke-Ssh "root@$stagingIp" "sed -i 's/\r$//' /tmp/bootstrap-staging-vps.sh; bash /tmp/bootstrap-staging-vps.sh"
    Write-Host $out
}

if (-not $SkipDb) {
    Write-Host '>> Creation base soundy_staging (via VPS prod)' -ForegroundColor Cyan
    $dbScript = Join-Path $root 'deploy\setup-staging-db.sh'
    & scp.exe -i $key -o StrictHostKeyChecking=no $dbScript 'soundy-prod:/tmp/setup-staging-db.sh' 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        & scp.exe -i $key -o StrictHostKeyChecking=no $dbScript "root@51.159.164.100:/tmp/setup-staging-db.sh" 2>&1 | Out-Null
        $prodTarget = 'root@51.159.164.100'
    } else {
        $prodTarget = 'soundy-prod'
    }
    $dbOut = Invoke-Ssh $prodTarget "sed -i 's/\r$//' /tmp/setup-staging-db.sh; bash /tmp/setup-staging-db.sh"
    Write-Host $dbOut
}

Write-Host ''
Write-Host 'DNS : ajouter enregistrement A staging.getsoundy.com -> 51.159.170.181' -ForegroundColor Yellow
Write-Host 'Scaleway PG : whitelist 51.159.170.181/32 dans Allowed IPs' -ForegroundColor Yellow
Write-Host 'Puis : scripts/setup-staging-env.ps1 && scripts/deploy-preprod.ps1' -ForegroundColor Cyan
