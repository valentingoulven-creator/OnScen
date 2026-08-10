# Phase 8 — API externes

**Date :** 2026-08-10  
**Périmètre :** `lib/prodSaasCatalog.ts`, intégrations Stripe, LiveKit, Cloudflare, YouTube, ACRCloud, Resend, Google OAuth, Sightengine

---

## 8.1 Inventaire des services tiers

| Service | Usage | Fichiers clés |
|---------|--------|---------------|
| Scaleway | VPS, PostgreSQL, Object Storage | deploy, S3 client |
| Cloudflare | Stream (live), DNS/WAF (planifié) | `cloudflareStream.ts` |
| LiveKit | Salons audio / vidéo WebRTC | live routes, SDK |
| Stripe | Dons, abonnements créateurs | `donations.ts`, webhooks |
| YouTube | OAuth utilisateur, Data API search, lecture embed | `platformConnect`, `salons.ts` |
| Google OAuth | Login + YouTube scopes | `oauth.ts` |
| Sightengine | Modération image/vidéo | `sightengineModeration.ts` |
| ACRCloud | Empreinte audio catalogue (optionnel) | `acrCloud.ts` |
| Resend / SMTP | Emails transactionnels | mailer |
| Sentry | Erreurs | errorMonitoring |
| Apple Sign In | OAuth mobile | `appleOAuth.ts` |
| Web Push / FCM | Notifications | `nativePush.ts`, web-push |

---

## 8.2 Conformité ToS & attribution

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| YouTube | Pas de téléchargement serveur ; embed / métadonnées API | faible | Voir phase 10 |
| Stripe | Checkout hébergé — PCI délégué | faible | — |
| Sightengine | ToS interdisent certaines reuses — usage modération standard | faible | DPA Sightengine |
| Spotify / autres | Non intégrés actuellement | — | — |

---

## 8.3 Gestion des clés

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Stockage | `.env` VPS + `externalSecrets` chiffrés admin | faible | Rotation trimestrielle calendar |
| Scoping | Tokens Cloudflare custom (Stream + Analytics doc) | **moyen** | Moindre privilège par token |
| Admin UI | Masquage secrets (`maskStripeSecret`) | faible | — |

---

## 8.4 Pannes, quotas, retries

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| YouTube quota | Limiters `youtubeSearchLimiter` ; erreurs API gérées | **moyen** | Cache + message utilisateur |
| Sightengine down | Upload peut passer ou fail selon config — vérifier fail-closed prod | **élevé** | `SIGHTENGINE_REQUIRED=1` en prod |
| Stripe webhook | Idempotence partielle via ledger tests | faible | Monitoring webhook failures |
| LiveKit | Erreurs start live surfacées | **moyen** | Retry backoff + status page |

---

## 8.5 Coûts à l’échelle

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| LiveKit free tier | ~100 participants / room documenté | **élevé** | Upgrade plan avant gros live |
| Cloudflare Stream | Facturation minutes | **moyen** | Admin `cloudflare-usage` |
| Sightengine + live 60s sampling | Coût ~1 req/min/live actif | **moyen** | Plafond `LIVE_MODERATION_SAMPLE_INTERVAL_MS` |
| ACRCloud | Par identification | **moyen** | Désactiver si non licencié musique |

---

## 8.6 Synthèse phase 8

Tenir **`prodSaasCatalog`** à jour ; **fail-closed modération** ; **budget LiveKit/CF/Sightengine** lié à croissance.
