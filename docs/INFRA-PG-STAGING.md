# PostgreSQL — isolation staging (long terme)

## État actuel

| Env | Base | Instance |
|-----|------|----------|
| Prod | `soundy-prod` | Scaleway PG `51.15.132.229:14440` |
| Staging | `soundy_staging` | **Même instance** |

Risque : charge staging / migration test impacte prod ; pas d'isolation réseau complète.

## Cible recommandée

1. **Instance PG dédiée staging** (Scaleway `db-dev-s` ou second nœud)
2. `DATABASE_URL` staging → nouvelle instance
3. Restore depuis backup prod **anonymisé** (emails test, pas de tokens prod)

## Procédure migration (runbook)

```bash
# 1. Créer instance staging Scaleway (console)
# 2. pg_dump prod (readonly) → restore staging
pg_dump "$PROD_DATABASE_URL" --no-owner --format=custom -f soundy-prod.dump
pg_restore -d "$STAGING_DATABASE_URL" --no-owner soundy-prod.dump

# 3. Anonymisation minimale
psql "$STAGING_DATABASE_URL" -c "
  UPDATE users SET email = 'staging+' || id || '@getsoundy.local'
  WHERE email NOT LIKE '%@getsoundy.com';
"

# 4. Mettre à jour backend/.env.preproduction + VPS staging
# 5. scripts/deploy-preprod.ps1
```

## Validation FK (migration 025)

Après nettoyage orphelins :

```sql
ALTER TABLE donation_payments VALIDATE CONSTRAINT donation_payments_sender_fk;
ALTER TABLE creator_subscriptions VALIDATE CONSTRAINT creator_subscriptions_subscriber_fk;
ALTER TABLE creator_subscriptions VALIDATE CONSTRAINT creator_subscriptions_creator_fk;
ALTER TABLE subscription_checkouts VALIDATE CONSTRAINT subscription_checkouts_subscriber_fk;
```

## Coût estimé

- Instance PG dev Scaleway : ~15–25 €/mois vs risque incident prod
