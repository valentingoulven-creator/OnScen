# commun/scripts/deploy-preprod.ps1 - Deploiement PREPRODUCTION (staging.getsoundy.com)
# Usage : powershell -ExecutionPolicy Bypass -File commun/scripts/deploy-preprod.ps1
param(
    [switch]$SkipBuild,
    [switch]$SkipFrontend
)

$ErrorActionPreference = 'Stop'

$root = if ($PSScriptRoot) {
    (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
} else {
    (Get-Location).Path
}

Set-Location $root

Write-Host ''
Write-Host ' ==============================================' -ForegroundColor Magenta
Write-Host '   DEPLOY PREPROD -> staging.getsoundy.com' -ForegroundColor Magenta
Write-Host ' ==============================================' -ForegroundColor Magenta
Write-Host '   VPS    : 51.159.170.181 (/opt/soundy)'
Write-Host '   Health : https://staging.getsoundy.com/health'
Write-Host '   Script : commun/deploy/deploy_zero_downtime.ps1 -Environment preprod'
Write-Host ' ==============================================' -ForegroundColor Magenta
Write-Host ''

$deployScript = Join-Path $root 'commun/deploy/deploy_zero_downtime.ps1'
if (-not (Test-Path $deployScript)) {
    Write-Host "[ERREUR] Script introuvable : $deployScript" -ForegroundColor Red
    exit 1
}

$deployArgs = @{
    Environment = 'preprod'
}
if ($SkipBuild)    { $deployArgs.SkipBuild = $true }
if ($SkipFrontend) { $deployArgs.SkipFrontend = $true }

Write-Host 'Lancement deploy preprod...' -ForegroundColor Cyan
Write-Host ''

& $deployScript @deployArgs
exit $LASTEXITCODE
