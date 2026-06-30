#!/usr/bin/env bash
# setup-legal-publisher.sh — Crée /opt/soundy/legal-publisher.json si absent
# Usage : bash /opt/soundly/deploy/setup-legal-publisher.sh
#         bash /opt/soundly/deploy/setup-legal-publisher.sh --force  # recopie depuis l'exemple
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/soundy-root.sh
source "${SCRIPT_DIR}/lib/soundy-root.sh"
EXAMPLE="${ROOT}/msdev/legal-publisher.example.json"
TARGET="${ROOT}/legal-publisher.json"
FORCE=0

if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

if [[ ! -f "$EXAMPLE" ]]; then
  echo "ERREUR — modèle absent : $EXAMPLE" >&2
  echo "Déployer commun/msdev/legal-publisher.example.json sur le VPS (git pull / deploy)." >&2
  exit 1
fi

if [[ -f "$TARGET" && "$FORCE" -eq 0 ]]; then
  echo "Fichier existant : $TARGET (utiliser --force pour recopier depuis l'exemple)"
else
  cp "$EXAMPLE" "$TARGET"
  chmod 600 "$TARGET" 2>/dev/null || true
  echo "Créé : $TARGET (copié depuis legal-publisher.example.json)"
  echo "→ Éditer : nano $TARGET (voir acompleter.txt / commun/deploy/RUNBOOK-PROD.md)"
fi

if grep -q '\[À compléter' "$TARGET" 2>/dev/null; then
  echo "ERREUR — placeholders [À compléter] détectés dans $TARGET" >&2
  exit 1
fi

# Champs obligatoires pour les mentions légales (aligné sur legalPublisher.ts)
MISSING=()
for field in publisherName address publicationDirector hostName hostAddress; do
  if ! grep -qE "\"${field}\"[[:space:]]*:[[:space:]]*\"[^\"]+\"" "$TARGET" 2>/dev/null; then
    MISSING+=("$field")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "⚠ Champs vides ou manquants : ${MISSING[*]}"
  echo "  Compléter avant mise en prod, puis : pm2 reload melosong-backend --update-env"
  exit 2
fi

echo "✓ legal-publisher.json présent et champs obligatoires remplis"
