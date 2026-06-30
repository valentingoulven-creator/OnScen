# Object Storage — uploads médias (Scaleway)

État actuel : les uploads (avatars, reels, sponsors, pièces jointes chat) sont stockés **sur disque VPS** (`backend/public/uploads/`). Les backups off-site peuvent sync vers un bucket S3 Scaleway (`commun/deploy/backup-offsite.sh`).

## Tarification Scaleway Object Storage (2025–2026, hors taxes)

| Poste | Prix indicatif |
|-------|----------------|
| Standard Multi-AZ | ~€0,016 / Go / mois |
| Standard One Zone | ~€0,008 / Go / mois |
| Ingress | Inclus |
| Egress | 75 Go/mo gratuits, puis ~€0,01 / Go |

**Exemple** : 50 Go de médias ≈ **€0,80–1,60/mo** (One Zone vs Multi-AZ).

## Quand migrer

- Disque VPS > 70 % ou croissance reels/vidéos rapide.
- Besoin CDN / URLs signées pour gros fichiers.
- **Pas urgent** au lancement si < 20 Go uploads.

## Migration future (non implémentée)

1. Bucket privé `soundy-uploads` en `fr-par`.
2. Variables `.env` : `SCW_BUCKET`, `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`, `SCW_REGION=fr-par`.
3. Remplacer écriture disque par `PutObject`, servir via **URLs signées** (TTL 1h) ou proxy backend.
4. Script de migration one-shot `uploads/` → bucket.

Voir aussi : `commun/deploy/setup-scaleway-object-storage.sh`, `docs/INFRA-SOUNDY.md`.
