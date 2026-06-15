#!/usr/bin/env bash
# verify-scaleway-backup.sh — Checklist manuelle sauvegardes Scaleway (sans API / credentials)
#
# Ce script ne peut PAS vérifier automatiquement les backups Managed DB ni les snapshots VPS
# sans clés API Scaleway. Il affiche une checklist ops à cocher dans la console.
#
# Usage : bash /opt/soundly/deploy/verify-scaleway-backup.sh
set -euo pipefail

echo "=== Checklist sauvegardes Scaleway (manuelle) ==="
echo ""
echo "Managed Database (soundy-prod) — https://console.scaleway.com/databases"
echo "  [ ] Sauvegardes automatiques ACTIVÉES (onglet Backups)"
echo "  [ ] Rétention notée : _____ jours (typ. 7 j sur DB-DEV-S)"
echo "  [ ] Dernière backup < 24 h (date affichée dans la console)"
echo "  [ ] Test restore trimestriel planifié (instance de test)"
echo "  [ ] IP autorisée : 51.159.164.100/32"
echo ""
echo "Instance VPS (51.159.164.100) — https://console.scaleway.com/instances"
echo "  [ ] Snapshot manuel avant chaque upgrade majeur (deploy_zero_downtime.ps1)"
echo "  [ ] Option « Automatic backups » instance activée si disponible sur le plan"
echo ""
echo "Object Storage (optionnel, off-site) — https://console.scaleway.com/object-storage"
echo "  [ ] Bucket créé (ex. soundy-backups, région fr-par)"
echo "  [ ] Clés API créées → SCW_ACCESS_KEY / SCW_SECRET_KEY dans /opt/soundly/.env"
echo "  [ ] SCW_BUCKET défini → backup-offsite.sh sync S3"
echo ""
echo "VPS local (automatisé via cron) :"
echo "  bash /opt/soundly/deploy/verify-prod.sh"
echo ""
echo "Pour activer les crons locaux :"
echo "  sudo bash /opt/soundly/deploy/install-backup-cron.sh"
echo "  sudo bash /opt/soundly/deploy/install-uploads-backup-cron.sh"
echo "  sudo bash /opt/soundly/deploy/install-offsite-backup-cron.sh"
echo ""
echo "Référence : docs/INFRA-SOUNDY.md · deploy/RUNBOOK-PROD.md"
echo ""
