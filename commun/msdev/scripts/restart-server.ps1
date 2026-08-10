# Redémarre le serveur msdev (HTTP) : libère le port 4080 puis npm run msdev:server
# Utilisé par server.bat, server.exe (build:server-exe) et npm run msdev:restart
$ErrorActionPreference = 'Stop'

function Get-OnScenRoot {
  param([string]$StartDir)
  $dir = $StartDir
  while ($dir) {
    $pkgPath = Join-Path $dir 'package.json'
    if (Test-Path $pkgPath) {
      try {
        $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
        if ($pkg.scripts.'msdev:server') {
          return (Resolve-Path $dir).Path
        }
      } catch {
        # ignore invalid package.json
      }
    }
    $parent = Split-Path -Parent $dir
    if (-not $parent -or $parent -eq $dir) { break }
    $dir = $parent
  }
  return $null
}

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$root = Get-OnScenRoot -StartDir $scriptDir
if (-not $root) {
  Write-Host '[ERREUR] Racine OnScen Dev introuvable (package.json).' -ForegroundColor Red
  Write-Host 'Placez server.exe ou server.bat a la racine du projet.' -ForegroundColor Yellow
  if ($Host.Name -eq 'ConsoleHost') { Read-Host 'Appuyez sur Entree pour fermer' }
  exit 1
}

Set-Location $root

Write-Host ''
Write-Host ' ==========================================' -ForegroundColor Cyan
Write-Host '   OnScen  -  Redemarrer le serveur' -ForegroundColor Cyan
Write-Host ' ==========================================' -ForegroundColor Cyan
Write-Host "   URL    : http://localhost:4080"
Write-Host '   Compte : listener@msdev.local / msdev123'
Write-Host ' ==========================================' -ForegroundColor Cyan
Write-Host ''

where.exe node 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host '[ERREUR] Node.js 18+ est requis : https://nodejs.org' -ForegroundColor Red
  if ($Host.Name -eq 'ConsoleHost') { Read-Host 'Appuyez sur Entree pour fermer' }
  exit 1
}

function Stop-ListenersOnPort {
  param([int]$Port)
  $pids = [System.Collections.Generic.HashSet[int]]::new()
  try {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object { [void]$pids.Add([int]$_.OwningProcess) }
  } catch {
    # ignore
  }
  if ($pids.Count -eq 0) {
    netstat -ano | Select-String ":$Port\s" | Select-String 'LISTENING' | ForEach-Object {
      $parts = ($_.Line -replace '\s+', ' ').Trim().Split(' ')
      if ($parts.Length -ge 5) {
        $netPid = 0
        if ([int]::TryParse($parts[-1], [ref]$netPid) -and $netPid -gt 0) {
          [void]$pids.Add($netPid)
        }
      }
    }
  }
  foreach ($procId in $pids) {
    if ($procId -le 4) { continue }
    Write-Host "  Arret du processus PID $procId (port $Port)..." -ForegroundColor Yellow
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
}

Get-Process -Name 'msdev' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Stop-ListenersOnPort -Port 4080
Start-Sleep -Milliseconds 400

$env:MSDEV_HTTPS = '0'
$env:WEB_APP_URL = 'http://localhost:4080'

Start-Job -ScriptBlock {
  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    try {
      $c = New-Object Net.Sockets.TcpClient
      $c.Connect('127.0.0.1', 4080)
      $c.Close()
      Start-Process 'http://localhost:4080'
      break
    } catch {
      # wait for server
    }
  }
} | Out-Null

Write-Host ' Demarrage du serveur... (navigateur a l ouverture du port 4080)' -ForegroundColor Green
Write-Host ' Fermez cette fenetre pour arreter OnScen.' -ForegroundColor DarkGray
Write-Host ''

npm run msdev:server
$code = $LASTEXITCODE
Write-Host ''
if ($code -ne 0) {
  Write-Host "[ERREUR] Le serveur s'est arrete (code $code)." -ForegroundColor Red
} else {
  Write-Host ' Serveur arrete.' -ForegroundColor Green
}
if ($Host.Name -eq 'ConsoleHost') {
  Read-Host 'Appuyez sur Entree pour fermer'
}
exit $code
