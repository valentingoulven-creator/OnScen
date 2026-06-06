# Detecte l''URL msdev qui repond sur le port 4080 (HTTP vs HTTPS).
param(
  [switch]$Open,
  [switch]$Quiet
)

$ErrorActionPreference = 'SilentlyContinue'

function Test-MsdevUrl {
  param([string]$Url, [switch]$Insecure)
  $args = @('-s', '-o', 'NUL', '-w', '%{http_code}', '--connect-timeout', '3')
  if ($Insecure) { $args += '-k' }
  $args += $Url
  $code = (& curl.exe @args 2>$null)
  return ($code -match '^[23]')
}

$httpsUrl = 'https://localhost:4080/'
$httpUrl = 'http://localhost:4080/'
$working = $null

if (Test-MsdevUrl -Url $httpsUrl -Insecure) {
  $working = 'https://localhost:4080'
} elseif (Test-MsdevUrl -Url $httpUrl) {
  $working = 'http://localhost:4080'
} else {
  $envPath = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'msdev\.env'
  if (-not (Test-Path $envPath)) {
    $envPath = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
  }
  if (Test-Path $envPath) {
    $envText = Get-Content -LiteralPath $envPath -Raw
    if ($envText -match '(?m)^MSDEV_HTTPS\s*=\s*1') {
      $working = 'https://localhost:4080'
    }
  }
}

$listening = Get-NetTCPConnection -LocalPort 4080 -State Listen -ErrorAction SilentlyContinue

if (-not $working) {
  if (-not $Quiet) {
    if ($listening) {
      Write-Host '[ATTENTION] Port 4080 occupe mais aucune reponse HTTP/HTTPS testee.' -ForegroundColor Yellow
      Write-Host '          Essayez https://localhost:4080 (certificat auto-signe a accepter).' -ForegroundColor Yellow
    } else {
      Write-Host '[ERREUR] Aucun serveur sur le port 4080.' -ForegroundColor Red
    }
  }
  exit 2
}

if (-not $Quiet) {
  Write-Host "Ouvrez : $working" -ForegroundColor Green
}

if ($Open) {
  Start-Process $working
}

Write-Output $working
exit 0
