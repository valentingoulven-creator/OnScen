# Copie deploy/legal-publisher.template.json → msdev/legal-publisher.json (dev local)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "deploy\legal-publisher.template.json"
$dest = Join-Path $root "msdev\legal-publisher.json"
Copy-Item $src $dest -Force
Write-Host "Créé : $dest"
Write-Host "⚠ Complétez le champ address avant mise en production LCEN."
