#!/usr/bin/env bash
# snapshot-vps-reminder.sh — Rappel snapshot VPS Scaleway avant upgrade majeur
# Usage : bash /opt/onscen/deploy/snapshot-vps-reminder.sh
# Non bloquant — affiche la checklist console Scaleway.
set -euo pipefail

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  RAPPEL — Snapshot VPS avant déploiement / upgrade majeur       ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "  1. Console Scaleway → Instances → DEV1-S (51.159.164.100)"
echo "  2. Onglet « Snapshots » → « Create snapshot »"
echo "  3. Nom suggéré : soundy-pre-deploy-$(date '+%Y%m%d')"
echo "  4. Attendre statut « available » avant de continuer le deploy"
echo ""
echo "  Vérifier aussi :"
echo "    bash /opt/onscen/deploy/verify-scaleway-backup.sh"
echo "    bash /opt/onscen/deploy/backup-db.sh"
echo "    bash /opt/onscen/deploy/backup-uploads.sh"
echo ""
echo "  Doc : commun/deploy/RUNBOOK-PROD.md § Sauvegardes"
echo ""
