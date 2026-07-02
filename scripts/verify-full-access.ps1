# Shim — delegue vers commun/scripts/verify-full-access.ps1
param([switch]$Quiet)
$target = Join-Path (Split-Path $PSScriptRoot -Parent) 'commun\scripts\verify-full-access.ps1'
& powershell -ExecutionPolicy Bypass -File $target @PSBoundParameters
exit $LASTEXITCODE
