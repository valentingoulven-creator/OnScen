# Start OnScen msdev local environment
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Msdev = Join-Path $Root "msdev"

Write-Host "Starting OnScen msdev on port 4080..." -ForegroundColor Cyan
Set-Location (Join-Path $Root "backend")

$env:MSENV = "msdev"
$env:PORT = "4080"
$env:APP_ENV = "msdev"

npm run dev
