# commun/scripts/dev-start.ps1 — Lance l'environnement DEV local (pas la prod)
# Backend msdev :4080 + frontend Vite :5173
# Usage : npm run dev   ou   powershell -ExecutionPolicy Bypass -File commun/scripts/dev-start.ps1
param(
    [switch]$NoBrowser,
    [switch]$SkipDocsGDrive
)

$ErrorActionPreference = 'Stop'

function Get-ProjectRoot {
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

$root = Get-ProjectRoot -StartDir $PSScriptRoot
if (-not $root) {
    Write-Host '[ERREUR] Racine OnScen introuvable.' -ForegroundColor Red
    exit 1
}

Set-Location $root

if (-not $SkipDocsGDrive) {
    & (Join-Path $root 'commun\scripts\ensure-docs-gdrive-watch.ps1') -Quiet
}

Write-Host ''
Write-Host ' ==============================================' -ForegroundColor Green
Write-Host '   MODE DEV — pas la prod' -ForegroundColor Green
Write-Host ' ==============================================' -ForegroundColor Green
Write-Host '   Backend  : http://localhost:4080  (msdev)'
Write-Host '   Frontend : http://localhost:5173  (Vite HMR)'
Write-Host '   APP_ENV  : msdev'
Write-Host '   Carte    : copiez web/app/.env.development.example -> .env.development (parite prod UI)'
Write-Host '   Prod     : onscen.com (deploy-prod.ps1 uniquement)'
Write-Host ' ==============================================' -ForegroundColor Green
Write-Host ''

where.exe node 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERREUR] Node.js 18+ requis : https://nodejs.org' -ForegroundColor Red
    exit 1
}

$msdevEnv = Join-Path $root 'commun\msdev\.env'
if (-not (Test-Path $msdevEnv)) {
    $example = Join-Path $root 'commun\msdev\.env.example'
    if (Test-Path $example) {
        Write-Host '[!] commun/msdev/.env absent — copiez commun/msdev/.env.example vers commun/msdev/.env' -ForegroundColor Yellow
    }
}

function Test-PortListening([int]$Port) {
    try {
        $c = New-Object Net.Sockets.TcpClient
        $c.Connect('127.0.0.1', $Port)
        $c.Close()
        return $true
    } catch {
        return $false
    }
}

$backendRunning = Test-PortListening -Port 4080
$frontendRunning = Test-PortListening -Port 5173

if (-not $backendRunning) {
    $backendScript = @"
`$ErrorActionPreference = 'Stop'
Set-Location '$root'
`$env:APP_ENV = 'msdev'
`$env:MSENV = 'msdev'
`$env:PORT = '4080'
`$env:MSDEV_HTTPS = '0'
`$env:WEB_APP_URL = 'http://localhost:5173'
Write-Host ''
Write-Host ' [DEV] Backend msdev — port 4080' -ForegroundColor Cyan
Write-Host ' MODE DEV — pas la prod' -ForegroundColor Green
Write-Host ''
npm run msdev:server
"@

    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-Command', $backendScript
    ) -WindowStyle Normal | Out-Null

    Write-Host '[DEV] Demarrage backend (port 4080)...' -ForegroundColor Cyan
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-PortListening -Port 4080) {
            Write-Host '  [OK] Backend pret sur :4080' -ForegroundColor Green
            break
        }
        if ($i -eq 59) {
            Write-Host '[ERREUR] Backend inaccessible apres 30s.' -ForegroundColor Red
            exit 1
        }
    }
} else {
    Write-Host '[DEV] Backend deja actif sur :4080' -ForegroundColor DarkGray
}

if (-not $NoBrowser -and -not $frontendRunning) {
    Start-Job -ScriptBlock {
        for ($i = 0; $i -lt 90; $i++) {
            Start-Sleep -Milliseconds 500
            try {
                $c = New-Object Net.Sockets.TcpClient
                $c.Connect('127.0.0.1', 5173)
                $c.Close()
                Start-Process 'http://localhost:5173'
                break
            } catch {
                # wait for Vite
            }
        }
    } | Out-Null
}

$env:APP_ENV = 'msdev'
$env:VITE_APP_ENV = 'msdev'
$env:VITE_WEB_APP_URL = 'http://localhost:5173'

Write-Host '[DEV] Demarrage frontend Vite (port 5173)...' -ForegroundColor Cyan
Write-Host ' Fermez cette fenetre pour arreter le frontend (backend dans sa propre fenetre).' -ForegroundColor DarkGray
Write-Host ''

npm run app:dev
exit $LASTEXITCODE
