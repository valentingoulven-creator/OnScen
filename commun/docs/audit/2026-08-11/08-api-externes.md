# Phase 8 — API externes

**Date :** 2026-08-10  
**Périmètre :** `lib/prodSaasCatalog.ts`, intégrations Stripe, LiveKit, Cloudflare, YouTube, ACRCloud, Resend, Google OAuth, Sightengine

> **🔄 Rafraîchissement 2026-08-11 (soir)** : décommission complète de `getsoundy.com` (voir §8.7 nouveau) ; `RESEND_FROM` corrigé (branding, voir [05-securite §5.9](./05-securite.md)) ; **Google OAuth signalé en panne** (`deleted_client` — client OAuth supprimé côté Google Cloud Console, rapporté lors de la session de migration de domaine, non re-testé end-to-end dans le cadre de ce rafraîchissement) — voir §8.4 mis à jour, aggrave E1.

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
| ⚠️ Google OAuth cassé | **Signalé** : erreur `deleted_client` en prod — le client OAuth Google a été supprimé/désactivé dans la console Google Cloud (probablement lors de la bascule de domaine `getsoundy.com` → `onscen.com`, redirect URIs désynchronisés). **Login Google et connexion YouTube sont indisponibles en prod** indépendamment de tout code applicatif | **élevé** (fonctionnalité cassée, pas juste « mode testing » comme noté ce matin dans E1) | Recréer/reconfigurer le client OAuth dans Google Cloud Console avec les redirect URIs `onscen.com`, republier en mode Production ; frontend grise déjà le bouton Google en prod (`googleOAuthDisabled = isProduction`) donc l'UX ne montre pas d'erreur visible actuellement, mais la fonctionnalité doit être restaurée avant réactivation |
| ✅ Sightengine down | **Vérifié conforme 2026-08-11** : `sightengineFailOpenOnError()` (`sightengineConfig.ts`) est fail-closed par défaut en prod (fail-open uniquement en msdev, sauf override explicite `SIGHTENGINE_FAIL_OPEN`). Confirmé sur le VPS prod : `SIGHTENGINE_ENABLED=1`, `SIGHTENGINE_FAIL_OPEN=0` explicitement positionné | résolu | — |
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

## 8.7 Décommission getsoundy.com (nouveau — 08-11)

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Domaine legacy | ✅ **Décommission effective** : `getsoundy.com` sans bloc TLS Caddy (hard stop), `WEB_APP_URL`/`CORS_ORIGIN` limités à `onscen.com`, `legal-publisher.json` VPS et `capacitor.config.json` iOS resynchronisés sur `onscen.com` | résolu | Vérifier dans quelques semaines qu'aucun trafic résiduel n'arrive sur `getsoundy.com` (logs Caddy) avant libération définitive du nom de domaine |
| Effet de bord | La bascule de domaine est la cause probable de la casse Google OAuth (§8.4) — les redirect URIs enregistrés côté Google référencent probablement encore `getsoundy.com` ou un client supprimé | **élevé** | Traiter conjointement avec la recréation du client OAuth |

---

## 8.6 Synthèse phase 8

Tenir **`prodSaasCatalog`** à jour ; **fail-closed modération** ; **budget LiveKit/CF/Sightengine** lié à croissance.

**Mise à jour 2026-08-11 (soir) :** getsoundy.com décommissionné proprement. Nouveau point d'attention : **Google OAuth non fonctionnel en prod** (`deleted_client`), probablement lié à la migration de domaine — à traiter avant toute communication incitant à se connecter via Google.
