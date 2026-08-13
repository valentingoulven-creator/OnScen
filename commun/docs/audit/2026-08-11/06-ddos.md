# Phase 6 — Protection DDoS & abus

**Date :** 2026-08-10 (rafraîchi 2026-08-11)  
**Périmètre :** `commun/deploy/OPS-PRIORITIES.md`, `CLOUDFLARE-CDN-WAF.md`, rate limits, PM2, `lib/turnstile.ts`, `components/TurnstileWidget.tsx`

> **🔄 Rafraîchissement 2026-08-11 (soir)** : **changement de contexte majeur** — les inscriptions en production sont désormais **ouvertes** (`ACCESS_REGISTRATION_MODE=open`, décision produit du jour, cf. `modification.txt` MODIF 1354), alors que §6.3 ci-dessous partait de l'hypothèse « inscriptions fermées par défaut ». Le captcha Turnstile est en contrepartie **confirmé déployé** en prod (chunk `TurnstileWidget-*.js` présent dans `/opt/onscen/public/assets/`). Voir §6.3 mis à jour.

---

## 6.1 CDN / WAF

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Cloudflare site | Doc indique statut **bloqué** : zone DNS absente (OVH direct → VPS) | **élevé** | Exécuter guide `CLOUDFLARE-CDN-WAF.md` (proxy orange) |
| Cloudflare Stream | Déjà utilisé pour live video | faible | Distinct du WAF site |
| Caddy seul | Origin exposé ; pas de scrubbing L7 edge | **élevé** | WAF + rate limit edge |

---

## 6.2 Endpoints coûteux

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Live start | `liveStartLimiter` 8 / 10 min / user | faible | — |
| Search | `searchLimiter` 60/min | faible | Cache Redis résultats populaires |
| Upload média | Auth requise ; pas de WAF body size edge | **moyen** | Limite taille Caddy + S3 direct upload signé |
| Tiles map | `tileLimiter` présent | faible | — |

---

## 6.3 Anti-bot inscription / reset

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Captcha | ✅ **Implémenté depuis le 08-10, confirmé déployé le 08-11 (soir)** : Cloudflare Turnstile intégré — `TurnstileWidget` sur `AuthPage` (inscription, connexion post-erreur `email_not_verified`) et `ForgotPasswordPage`, vérification serveur `verifyTurnstileToken()` dans `routes/auth.ts` (register + forgot-password + nouveau `resend-verification-email`), `isTurnstileRequired()` actif hors msdev si secret configuré | résolu (code + prod) | Vérifier manuellement un flux d'inscription réel en prod (rendu visuel du widget) pour confirmer le site key `VITE_TURNSTILE_SITE_KEY` correspond bien au domaine `onscen.com` (post-migration domaine) |
| Access control prod | ⚠️ **Changement 08-11 (soir)** : `ACCESS_REGISTRATION_MODE=open` — les inscriptions publiques sont désormais **ouvertes** (décision produit explicite, MODIF 1354), ce qui **supprime l'atténuation** précédemment citée (« inscriptions fermées par défaut »). Le captcha Turnstile devient la **seule ligne de défense anti-bot** sur `/register` | **élevé** (nouveau, remplace le « moyen » précédent) | Monitorer le taux de création de comptes/jour + spam pattern les premiers jours ; envisager un plafond quotidien d'inscriptions ou une vérification email plus stricte si abus détecté ; email de notification au fondateur déjà en place à chaque inscription (`SIGNUP_NOTIFY_EMAIL`) pour audit manuel |

---

## 6.4 Scaling & pics

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| PM2 | **`instances: 1`** volontaire (store RAM non partagé) | **critique** pour viralité | Refonte store ou sharding sessions |
| Socket.io | Redis adapter présent — scaling horizontal possible **après** store partagé | **élevé** | — |
| Live audience | LiveKit / Cloudflare absorbent flux vidéo | faible | Surveiller quota LiveKit 100 participants plan free |
| Auto-scaling | Aucun sur VPS | **élevé** | Second VPS + load balancer post-refonte store |

---

## 6.5 Détection comportementale

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Follow/like limits | Ajoutés 2026-08 | faible | Alertes admin si seuils 429 massifs |
| Comptes massifs | Pas de heuristique « 50 comptes / IP / jour » | **moyen** | Job batch + flag admin |

---

## 6.6 Synthèse phase 6

**Mise à jour 2026-08-11 (matin) :** le captcha (E3) est **codé et prêt**, mais **pas encore déployé en production** (build live sans Turnstile) — action ops requise (build + deploy), pas juste dev.

**Mise à jour 2026-08-11 (soir) :** captcha **déployé et confirmé en prod**. En contrepartie, les inscriptions publiques ont été **ouvertes** le même jour (`ACCESS_REGISTRATION_MODE=open`) — la combinaison « inscriptions ouvertes + captcha actif + notification fondateur à chaque signup » est cohérente, mais **doit être surveillée activement dans les premiers jours/semaines** (pas de plafond de rythme d'inscription automatique en place).

**WAF Cloudflare site** + **scaling API (store)** restent les 2 chantiers non résolus du triptyque anti-abus à fort trafic.
