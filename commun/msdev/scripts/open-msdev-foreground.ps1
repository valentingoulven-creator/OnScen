# Lance msdev.exe au premier plan (fenetre console visible)
$releaseDir = Join-Path (Split-Path -Parent $PSScriptRoot) "release"
$exe = Join-Path $releaseDir "msdev.exe"

if (-not (Test-Path $exe)) {
    Write-Host "msdev.exe introuvable. Compilez d'abord: npm run build:exe" -ForegroundColor Red
    exit 1
}

Get-Process -Name "msdev" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 200

if (Test-Path $exe) {
  Get-ChildItem -LiteralPath $releaseDir -File -ErrorAction SilentlyContinue |
    Unblock-File -ErrorAction SilentlyContinue
}

Set-Location $releaseDir
cmd /c start "MeloSong msdev" /MAX msdev.exe

# Prefer npm msdev if exe missing
if (-not (Test-Path $exe)) {
  Write-Host "msdev.exe absent - lancement via npm run msdev:server" -ForegroundColor Yellow
  Set-Location (Join-Path (Split-Path -Parent $PSScriptRoot) "..")
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run msdev:server"
  Start-Sleep -Seconds 4
  Start-Process "https://localhost:4080"
  exit 0
}

Write-Host "msdev.exe lance au premier plan." -ForegroundColor Green
Write-Host "https://localhost:4080"
