# Modération — checklist ops (reco CTO 2026-08-07)

Document **interne** — complète le runbook CSAM ([`RUNBOOK-CSAM.md`](./RUNBOOK-CSAM.md)). Pas de secrets dans ce fichier.

---

## 1. Variables d'environnement (VPS prod / staging)

| Variable | Rôle |
|----------|------|
| `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` | Modération images/vidéos ; requis en prod déployée (fail-closed uploads). |
| `SIGHTENGINE_MINOR_DETECTION_ENABLED` | Défaut `1` — modèle `face-age` (CSAM heuristique). |
| `SIGHTENGINE_VIOLENCE_MODELS_ENABLED` | Défaut `1` — gore/weapon. |
| `LIVE_MODERATION_SAMPLE_INTERVAL_MS` | Défaut **60000** (1 frame / min / live Cloudflare). Monter à 90000 si facture Sightengine élevée. |
| `ALERT_EXTRA_EMAILS` | Emails modération (virgules) en plus de `SMTP_ADMIN_EMAIL`. |
| `RESEND_API_KEY` ou SMTP | Requis pour les alertes `csam_risk_detected`, `live_content_flagged`, `urgent_content_report`. |

---

## 2. Rate limits anti-abus (code, pas de config env)

Valeurs par défaut dans `commun/backend/src/lib/abuseRateLimits.ts` — **ne pas baisser** sans métriques 429 :

| Endpoint | Limite |
|----------|--------|
| `POST /lives/start` | 8 / 10 min / utilisateur |
| Recherche (global, users, music) | 60 / min / utilisateur |
| `POST /users/:id/follow` | 40 / min / utilisateur |
| Like feed / cœur reel | 120 / min / utilisateur |

Revue recommandée **2–4 semaines** après deploy via logs PM2 / Sentry (pic de 429 légitimes hôtes live → assouplir live start uniquement).

---

## 3. Checklist validation **staging** (avant confiance prod)

1. Déployer sur **preprod** (`commun/scripts/deploy-preprod.ps1`) après commit des changements modération.
2. Vérifier que Sightengine répond avec les modèles effectifs : admin ou log `[sightengine]` — modèles incluant `face-age`, `gore-2.0`, `weapon` (voir `getSightengineModels()`).
3. **Upload test** : image safe → acceptée ; image NSFW de test Sightengine (compte demo) → refus 422.
4. **Live Cloudflare test** (hôte OBS) : démarrer un live ≥ 2 min, confirmer absence d'erreurs `[live-moderation]` dans les logs.
5. **Signalement test** : créer un signalement catégorie `csam_risk` → email reçu + badge Urgent dans Admin → Signalements.
6. **Dons prod** : avec `APP_ENV=production` et `sk_test_`, `isDonationsEnabled()` doit être **false** (UI pourboires masquée) jusqu'à bascule `sk_live_` — voir `donations.ts`.

---

## 4. Coût Sightengine (ordre de grandeur)

- ~**4 operations** par image scannée (nudité + offensive + violence + face-age).
- Live Cloudflare : ~**60 échantillons/heure/live** × ~4 ops ≈ **240 ops/h/live**.
- Surveiller le dashboard Sightengine ; palier Starter/Pro selon [`sightengine.com/pricing`](https://sightengine.com/pricing).

---

## 5. Paiements prod (Stripe)

Tant que **`STRIPE_SECRET_KEY=sk_test_`** sur le VPS prod :

- Les **pourboires live réels** sont **désactivés côté API** (`isDonationsEnabled()` exige `sk_live_` si `APP_ENV=production`).
- Pour réactiver : clés live + webhooks live + comptes Connect recréés en live — voir `AUDIT-CONSOLIDE.md` § STR-11.

La **préprod** (`APP_ENV=preproduction`) peut conserver `sk_test_` pour tester les flux de don.

---

*Dernière mise à jour : 2026-08-07 — aligné MODIF 1343.*
