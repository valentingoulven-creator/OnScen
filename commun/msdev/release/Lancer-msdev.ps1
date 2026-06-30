# MeloSong msdev - lanceur avec debloquage Windows (SmartScreen / Zone.Identifier)
$ErrorActionPreference = 'Stop'

function Get-MsdevRoots {
  param([string]$ScriptRoot)
  if ($ScriptRoot -match '[\\/]release$') {
    return @{
      ReleaseDir = $ScriptRoot
      MsdevRoot  = Split-Path -Parent $ScriptRoot
      ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptRoot)
    }
  }
  $msdevRoot = $ScriptRoot
  $releaseDir = Join-Path $msdevRoot 'release'
  return @{
    ReleaseDir  = $releaseDir
    MsdevRoot   = $msdevRoot
    ProjectRoot = Split-Path -Parent $msdevRoot
  }
}

$roots = Get-MsdevRoots -ScriptRoot $PSScriptRoot
$releaseDir = $roots.ReleaseDir
$msdevRoot = $roots.MsdevRoot
$projectRoot = $roots.ProjectRoot
$resolveScript = Join-Path $msdevRoot 'scripts\resolve-msdev-url.ps1'

if (-not (Test-Path -LiteralPath $releaseDir)) {
  Write-Host 'Dossier msdev\release introuvable. Lancez : npm run build:exe' -ForegroundColor Red
  exit 1
}
Set-Location -LiteralPath $releaseDir

Get-ChildItem -LiteralPath $releaseDir -File -ErrorAction SilentlyContinue |
  Unblock-File -ErrorAction SilentlyContinue

$portInUse = Get-NetTCPConnection -LocalPort 4080 -State Listen -ErrorAction SilentlyContinue
if ($portInUse) {
  Write-Host 'Port 4080 deja utilise.' -ForegroundColor Yellow
  if (Test-Path -LiteralPath $resolveScript) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $resolveScript -Open
  } else {
    Write-Host 'Ouvrez : https://localhost:4080' -ForegroundColor Green
    Start-Process 'https://localhost:4080'
  }
  exit 0
}

$exe = Join-Path $releaseDir 'msdev.exe'
if (-not (Test-Path -LiteralPath $exe)) {
  Write-Host 'msdev.exe introuvable. Compilez : npm run build:exe' -ForegroundColor Red
  exit 1
}

Write-Host 'Lancement MeloSong msdev...' -ForegroundColor Cyan
Write-Host 'URL attendue (HTTPS si MSDEV_HTTPS=1) : https://localhost:4080' -ForegroundColor Green
Write-Host 'Ne pas utiliser http:// sur le port 4080 en mode HTTPS.' -ForegroundColor Yellow
Write-Host 'Si Windows bloque l''exe, lisez DEBLOCAGE-WINDOWS.txt' -ForegroundColor Yellow

$proc = Start-Process -FilePath $exe -WorkingDirectory $releaseDir -PassThru
Start-Sleep -Seconds 4

if ($proc.HasExited) {
  Write-Host 'msdev.exe s''est arrete (Smart App Control, antivirus ou erreur pkg).' -ForegroundColor Red
  Write-Host 'Repli Node.js : npm run msdev:https a la racine du projet...' -ForegroundColor Yellow
  if (Test-Path -LiteralPath (Join-Path $projectRoot 'package.json')) {
    Start-Process powershell -ArgumentList @(
      '-NoExit', '-Command',
      "Set-Location -LiteralPath '$projectRoot'; npm run msdev:https"
    )
    Start-Sleep -Seconds 6
    if (Test-Path -LiteralPath $resolveScript) {
      & powershell -NoProfile -ExecutionPolicy Bypass -File $resolveScript -Open
    }
    exit 0
  }
  Write-Host 'Essayez msdev\Lancer-msdev-node.bat avec Node.js.' -ForegroundColor Yellow
  exit 1
}

$listening = Get-NetTCPConnection -LocalPort 4080 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Write-Host 'Attention : le port 4080 ne repond pas encore. Attendez ou consultez DEBLOCAGE-WINDOWS.txt' -ForegroundColor Yellow
  exit 0
}

if (Test-Path -LiteralPath $resolveScript) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $resolveScript -Open
} else {
  Start-Process 'https://localhost:4080'
}

exit 0
