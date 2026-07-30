# Installe le hook git pre-push + sync initial Cloud Agents
# Usage: npm run cloud:sync:install-hook
param(
    [switch]$SkipGitHook
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $root

Write-Host ''
Write-Host ' Cloud Agents — installation sync locale' -ForegroundColor Cyan
Write-Host ''

node commun/scripts/sync-cloud-env.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipGitHook) {
    $hookDir = Join-Path $root '.git/hooks'
    if (-not (Test-Path $hookDir)) {
        Write-Host '[!] .git/hooks absent — hook pre-push non installé' -ForegroundColor Yellow
    } else {
        $hookPath = Join-Path $hookDir 'pre-push'
        $hookBody = @'
#!/bin/sh
# Soundy — sync Cloud Agents manifest avant push (auto)
node commun/scripts/sync-cloud-env.mjs --if-changed || exit 1
'@
        [System.IO.File]::WriteAllText($hookPath, $hookBody + "`n")
        Write-Host '[OK] Hook git pre-push installé' -ForegroundColor Green
    }
}

Write-Host ''
Write-Host ' Prochaines étapes manuelles (une fois) :' -ForegroundColor Yellow
Write-Host ' 1. https://cursor.com/dashboard/cloud-agents → connecter GitHub'
Write-Host ' 2. Secrets → copier les clés de .cursor/cloud-secrets.manifest.json'
Write-Host '    (valeurs depuis commun/msdev/.env local — jamais dans Git)'
Write-Host ' 3. Lancer un Cloud Agent sur la branche à jour'
Write-Host ''
Write-Host ' Sync continue : hook stop Cursor + pre-push Git + npm run cloud:sync' -ForegroundColor Green
Write-Host ''
