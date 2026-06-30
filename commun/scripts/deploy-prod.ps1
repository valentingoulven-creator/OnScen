# commun/scripts/deploy-prod.ps1 - Deploiement PRODUCTION canonique (getsoundy.com)
# Usage : powershell -ExecutionPolicy Bypass -File commun/scripts/deploy-prod.ps1
#         ou double-clic deploy-prod.bat
param(
    [switch]$AskCommit,
    [switch]$SkipBuild,
    [switch]$SkipFrontend,
    [switch]$SkipVerify
)

$ErrorActionPreference = 'Stop'

$root = if ($PSScriptRoot) {
    (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
} else {
    (Get-Location).Path
}

Set-Location $root

Write-Host ''
Write-Host ' ==============================================' -ForegroundColor Red
Write-Host '   DEPLOY PRODUCTION -> getsoundy.com' -ForegroundColor Red
Write-Host ' ==============================================' -ForegroundColor Red
Write-Host '   VPS    : 51.159.164.100 (/opt/soundy)'
Write-Host '   Health : https://getsoundy.com/health'
Write-Host '   Script : commun/deploy/deploy_zero_downtime.ps1 -VerifyProd'
Write-Host ' ==============================================' -ForegroundColor Red
Write-Host ''

$gitExe = Get-Command git -ErrorAction SilentlyContinue
if ($gitExe) {
    $porcelain = & git status --porcelain 2>&1
    if ($LASTEXITCODE -eq 0 -and $porcelain) {
        Write-Host '[!] Modifications non commitees detectees :' -ForegroundColor Yellow
        $porcelain | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }

        if ($AskCommit) {
            $answer = Read-Host 'Continuer le deploy prod malgre les changements locaux ? (o/N)'
            if ($answer -notmatch '^[oOyY]') {
                Write-Host 'Deploy annule. Commitez ou stash vos changements puis relancez.' -ForegroundColor Yellow
                exit 1
            }
        } else {
            Write-Host ''
            Write-Host 'Astuce : git add/commit avant deploy, ou -AskCommit pour confirmer manuellement.' -ForegroundColor DarkGray
            Write-Host ''
        }
    } elseif ($LASTEXITCODE -eq 0) {
        $branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
        $commit = (& git rev-parse --short HEAD 2>$null)
        if ($branch -and $commit) {
            Write-Host "[OK] Depot propre - branche $branch @ $commit" -ForegroundColor Green
        }
    }
} else {
    Write-Host '[!] git introuvable - verification des commits ignoree' -ForegroundColor Yellow
}

$deployScript = Join-Path $root 'commun/deploy/deploy_zero_downtime.ps1'
if (-not (Test-Path $deployScript)) {
    Write-Host "[ERREUR] Script introuvable : $deployScript" -ForegroundColor Red
    exit 1
}

$deployArgs = @('-ExecutionPolicy', 'Bypass', '-File', $deployScript, '-Environment', 'prod')
if ($SkipBuild)    { $deployArgs += '-SkipBuild' }
if ($SkipFrontend) { $deployArgs += '-SkipFrontend' }
if (-not $SkipVerify) { $deployArgs += '-VerifyProd' }

Write-Host 'Lancement deploy zero-downtime...' -ForegroundColor Cyan
Write-Host ''

& powershell.exe @deployArgs
exit $LASTEXITCODE
