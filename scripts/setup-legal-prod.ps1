# Configure l'adresse LCEN en production (sans committer l'adresse dans Git).
# Usage :
#   powershell -ExecutionPolicy Bypass -File scripts/setup-legal-prod.ps1 -Address "12 rue Example, 75001 Paris, France"
#   powershell -ExecutionPolicy Bypass -File scripts/setup-legal-prod.ps1 -Address "..." -Staging

param(
  [Parameter(Mandatory = $true)]
  [string] $Address,

  [switch] $Staging
)

$ErrorActionPreference = "Stop"

if ($Address -match 'à compléter|acompleter|à renseigner') {
  throw "Adresse invalide — fournissez une adresse postale réelle (LCEN art. 6)."
}

$sshHost = if ($Staging) { "soundy-staging" } else { "soundy-prod" }
$pm2App = if ($Staging) { "melosong-backend-staging" } else { "melosong-backend" }
$envFile = "/opt/soundly/.env"

Write-Host "Mise à jour LEGAL_PUBLISHER_ADDRESS sur $sshHost ..."

$remoteCmd = @"
set -euo pipefail
ENV_FILE='$envFile'
ADDR='$($Address.Replace("'", "'\"'\"'"))'
if grep -q '^LEGAL_PUBLISHER_ADDRESS=' `"`$ENV_FILE`" 2>/dev/null; then
  sed -i "s/^LEGAL_PUBLISHER_ADDRESS=.*/LEGAL_PUBLISHER_ADDRESS=`$ADDR/" `"`$ENV_FILE`"
else
  printf '%s\n' "LEGAL_PUBLISHER_ADDRESS=`$ADDR" >> `"`$ENV_FILE`"
fi
pm2 reload $pm2App --update-env
curl -sf http://127.0.0.1:3000/health && echo ' Health OK'
"@

ssh $sshHost $remoteCmd

Write-Host "OK — vérifiez Mentions légales sur le site."
