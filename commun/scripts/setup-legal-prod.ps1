# Configure l'adresse LCEN en production (sans committer l'adresse dans Git).
# Usage :
#   powershell -ExecutionPolicy Bypass -File commun/scripts/setup-legal-prod.ps1 -Address "12 rue Example, 75001 Paris, France"
#   powershell -ExecutionPolicy Bypass -File commun/scripts/setup-legal-prod.ps1 -Address "..." -Staging

param(
  [Parameter(Mandatory = $true)]
  [string] $Address,

  [switch] $Staging
)

$ErrorActionPreference = "Stop"

if ($Address -match 'acompleter|renseigner|completer|\[A') {
  throw "Adresse invalide - fournissez une adresse postale reelle (LCEN art. 6)."
}

$sshHost = if ($Staging) { "onscen-staging" } else { "onscen-prod" }
$pm2App = if ($Staging) { "onscen-backend-staging" } else { "onscen-backend" }
$remoteScript = "/tmp/soundy-setup-legal.sh"
$localScript = Join-Path $env:TEMP "soundy-setup-legal.sh"

$escaped = $Address.Replace('\', '\\').Replace('"', '\"')
$bash = @"
#!/usr/bin/env bash
set -euo pipefail
ADDR="$escaped"
ENV_FILE="/opt/onscen/.env"
if grep -q '^LEGAL_PUBLISHER_ADDRESS=' "`$ENV_FILE" 2>/dev/null; then
  sed -i "s|^LEGAL_PUBLISHER_ADDRESS=.*|LEGAL_PUBLISHER_ADDRESS=\"`$ADDR\"|" "`$ENV_FILE"
else
  printf '%s\n' "LEGAL_PUBLISHER_ADDRESS=\"`$ADDR\"" >> "`$ENV_FILE"
fi
python3 - <<PY
import json
addr = "$escaped"
path = "/opt/onscen/legal-publisher.json"
with open(path, encoding="utf-8") as f:
    data = json.load(f)
data["address"] = addr
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
pm2 reload $pm2App --update-env
curl -sf http://127.0.0.1:3000/health && echo " Health OK"
"@

Set-Content -Path $localScript -Value $bash -Encoding UTF8NoBOM
Write-Host "Mise a jour LEGAL_PUBLISHER_ADDRESS + legal-publisher.json sur $sshHost ..."

& scp $localScript "${sshHost}:${remoteScript}"
if ($LASTEXITCODE -ne 0) { throw "scp echoue" }

ssh $sshHost "sed -i 's/\r$//' $remoteScript; chmod +x $remoteScript; bash $remoteScript; rm -f $remoteScript"
Remove-Item $localScript -Force -ErrorAction SilentlyContinue

Write-Host "OK - verifiez Mentions legales sur le site."
