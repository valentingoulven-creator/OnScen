#!/usr/bin/env bash
# vps-setup.sh — Exécuté directement sur le VPS
# Envoyé par SCP depuis deploy-scaleway.ps1
set -euo pipefail

DB_HOST="51.15.132.229"
DB_PORT="14440"
DB_USER="soundy"
DB_PASS='b5+D5/uE8Qng(s?.huy0'
DB_PASS_URL="b5%2BD5%2FuE8Qng%28s%3F.huy0"
ENV_FILE="/opt/soundly/.env"

echo "=== [VPS] Installation postgresql-client ==="
apt-get install -y postgresql-client -q 2>&1 | tail -5

echo ""
echo "=== [VPS] Tentative CREATE DATABASE soundy ==="
export PGPASSWORD="$DB_PASS"
CREATE_RESULT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d rdb \
    -c "CREATE DATABASE soundy;" 2>&1) || true
echo "Résultat: $CREATE_RESULT"

if echo "$CREATE_RESULT" | grep -qiE "CREATE DATABASE|already exists"; then
    FINAL_DB="soundy"
    echo "✓ Base 'soundy' créée/disponible"
else
    FINAL_DB="rdb"
    echo "→ Scaleway restreint CREATE DATABASE — utilisation de 'rdb'"
fi

echo ""
echo "=== [VPS] Test connexion PostgreSQL sur '$FINAL_DB' ==="
TEST=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$FINAL_DB" \
    -c "SELECT 1 AS ok;" 2>&1) || true
echo "$TEST"
if echo "$TEST" | grep -q "ok"; then
    echo "✓ Connexion PostgreSQL OK"
else
    echo "✖ CONNEXION ÉCHOUÉE — IP non whitelistée sur Scaleway ?"
    echo "  Ajouter 51.159.164.100/32 dans Scaleway Console → RDB → soundy-db → Network"
    exit 1
fi

echo ""
echo "=== [VPS] Mise à jour $ENV_FILE ==="
mkdir -p /opt/soundly

if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << 'EOF'
APP_ENV=production
PORT=3000
HOST=0.0.0.0
EOF
    echo "→ .env créé"
fi

# Supprimer anciennes entrées DB puis ajouter les nouvelles
sed -i '/^DATABASE_URL=/d' "$ENV_FILE"
sed -i '/^PG_SSL/d' "$ENV_FILE"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS_URL}@${DB_HOST}:${DB_PORT}/${FINAL_DB}?sslmode=require"

cat >> "$ENV_FILE" << EOF

DATABASE_URL=${DATABASE_URL}
PG_SSL=1
PG_POOL_MAX=10
PG_SSL_REJECT_UNAUTHORIZED=0
EOF

echo "✓ .env configuré:"
grep -E '^(DATABASE_URL|PG_|APP_ENV|PORT)' "$ENV_FILE"

echo ""
echo "FINAL_DB=$FINAL_DB"
echo "SETUP_DONE=1"
