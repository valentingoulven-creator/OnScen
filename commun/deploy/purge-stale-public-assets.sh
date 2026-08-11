#!/usr/bin/env bash
# Supprime les fichiers *.js / *.css / *.gz dans public/assets NON référencés par
# index.html, sw.js, ni par les imports statiques du bundle principal (1 niveau).
# ⚠ Ne pas lancer seul après un deploy : toujours resynchroniser public/ complet avant.
# Usage : bash purge-stale-public-assets.sh [/opt/onscen/public]
set -euo pipefail

PUBLIC="${1:-/opt/onscen/public}"
ASSETS="$PUBLIC/assets"

[[ -d "$ASSETS" ]] || { echo "assets/ introuvable : $ASSETS"; exit 1; }

mapfile -t REFS < <(
  {
    grep -hoE '/assets/[^"'\'' )>]+' "$PUBLIC/index.html" "$PUBLIC/sw.js" 2>/dev/null || true
    MAIN=$(grep -oE 'assets/index-[^"'\'' ]+\.js' "$PUBLIC/index.html" | head -1 || true)
    if [[ -n "$MAIN" && -f "$PUBLIC/$MAIN" ]]; then
      grep -hoE '/assets/[^"'\'' )>]+\.(js|css)' "$PUBLIC/$MAIN" 2>/dev/null || true
      grep -hoE 'assets/[^"'\'' )>]+\.(js|css)' "$PUBLIC/$MAIN" 2>/dev/null || true
    fi
  } | sed 's|^/||' | sort -u
)

if [[ ${#REFS[@]} -eq 0 ]]; then
  echo "Aucune référence assets — abandon (évite de tout supprimer)."
  exit 1
fi

declare -A KEEP=()
for r in "${REFS[@]}"; do KEEP["$r"]=1; done

removed=0
kept=0
shopt -s nullglob
for f in "$ASSETS"/*; do
  base="$(basename "$f")"
  rel="assets/$base"
  if [[ -n "${KEEP[$base]:-}" || -n "${KEEP[$rel]:-}" ]]; then
    kept=$((kept + 1))
  else
    rm -f "$f"
    removed=$((removed + 1))
  fi
done

echo "PURGE_STALE_ASSETS_OK kept=$kept removed=$removed dir=$ASSETS"
