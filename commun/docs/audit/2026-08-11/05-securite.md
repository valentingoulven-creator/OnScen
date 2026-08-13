# Phase 5 — Sécurité applicative

**Date :** 2026-08-10  
**Périmètre :** `server.ts`, `routes/auth.ts`, `middleware/`, `lib/accessControl.test.ts`, headers, cookies

> **🔄 Rafraîchissement 2026-08-11 (soir)** : inscriptions prod ouvertes (`ACCESS_REGISTRATION_MODE=open`) + Turnstile déployé (voir [06-ddos §6.3](./06-ddos.md)). Nouveau endpoint `POST /auth/resend-verification-email` ajouté (anti-énumération, rate-limité, Turnstile requis) — comblant un gap UX/sécurité (utilisateur bloqué si lien de vérification expiré sans moyen de le renouveler). Correctif branding e-mail (`RESEND_FROM` : `Soundy` → `OnScen`) déployé — cf. §5.9 (nouveau). Historique Git secrets (§5.5) **inchangé, toujours critique** (commit `72370fc8` toujours présent, vérifié `git log` ce soir).

---

## 5.1 Authentification

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Hashing | bcrypt utilisateur (`BCRYPT_SALT_ROUNDS`) ; pas d’argon2 | faible | OK ; surveiller OWASP |
| 2FA | TOTP + codes secours bcrypt + WebAuthn (`twoFactor.ts`, `webauthn.ts`) | faible | Encourager 2FA staff admin |
| JWT / session | Cookie httpOnly `onscen_auth` + `tokenVersion` révocation ; expiration configurée | faible | Rotation `JWT_SECRET` runbook |
| Brute force | `authLimiter` + limiters WebAuthn/2FA ; Redis store en prod | faible | — |
| Simulation msdev | Comptes démo mots de passe connus | faible | Désactiver routes msdev en prod (garde existante) |
| Renvoi vérification e-mail | ✅ **Ajouté 08-11** : `POST /auth/resend-verification-email` — Turnstile requis, rate limit 8/15 min (`AUTH_RATE_LIMIT_SENSITIVE_PATHS`), réponse 200 uniforme (anti-énumération d'emails) | résolu | Ajouter test dédié (actuellement couvert indirectement par `authEmailVerification.test.ts`) |

---

## 5.2 Autorisation (IDOR)

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Revue antérieure | Tests `accessControl`, `authJwtScope` ; pattern « owner or staff » sur routes sensibles | faible | Continuer tests par nouvelle route |
| Admin | Rôles `admin`/`dev` ; routes `/api/admin/*` protégées | faible | Audit log admin (`030_admin_audit_log.sql`) — exploiter pour revue |
| Ressources live/chat | Helpers `canDeleteLiveChatMessage`, etc. | faible | Checklist IDOR sur chaque PR API |

---

## 5.3 Injections

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| SQL | Requêtes paramétrées `pg` ; pas de concat user input observée sur chemins critiques | faible | ESLint rule ou revue systématique |
| NoSQL | N/A (PostgreSQL) | — | — |
| HTML | `sanitize-html` sur contenus riches ; chat filtres (`chatTextFilter`) | faible | Vérifier reels comments (phase 7) |

---

## 5.4 XSS / CSRF

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| XSS | React échappe par défaut ; CSP via Helmet (vérifier config exacte prod) | **moyen** | Durcir CSP (nonces) si inline scripts réduits |
| CSRF | Cookie SameSite + API JSON ; OAuth flows exclus rate limit global | faible | Double-submit token si cookies cross-site un jour |
| Stockage token mobile | Secure storage Capacitor | faible | — |

---

## 5.5 Secrets & repo

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| HEAD propre | `.env*` gitignorés ; exemples avec placeholders | faible | — |
| Historique Git | Audit consolidé : secrets réels dans commit ancien `72370fc8` | **critique** | `git filter-repo` + rotation credentials + invalidation clés |
| Client | Pas de `sk_live` dans bundle ; Stripe publishable key seulement | faible | Scanner CI (gitleaks) |

---

## 5.6 Rate limiting

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Global | 300 req/min/IP (`globalApiLimiter`) | faible | — |
| Auth / geo / donations | Limiters dédiés | faible | — |
| Coûteux | **`abuseRateLimits.ts`** : live start, search, follow, like (post-audit 2026-08-07) | faible | Monitor 429 rates |
| Upload | Limites taille + auth ; pas de quota stockage user global évident | **moyen** | Quota uploads/jour |

---

## 5.7 Chiffrement transport & live

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| HTTPS | Caddy TLS prod ; HSTS recommandé doc | faible | Forcer HTTPS msdev tunnel public |
| WebRTC | LiveKit TLS ; TURN coturn doc | faible | Cert coturn à jour |
| RTMP | Cloudflare Stream ingest sécurisé (clés stream) | faible | Rotation clés OBS |

---

## 5.9 Hygiène e-mails transactionnels (nouveau — 08-11 soir)

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Expéditeur | ✅ **Corrigé 08-11** : `RESEND_FROM` en prod affichait `Soundy <onboarding@resend.dev>` — fuite de l'ancien nom de marque dans un champ visible par **tous les utilisateurs** recevant un e-mail (vérification, reset password, activation). Corrigé en `OnScen <onboarding@resend.dev>` | résolu | Basculer vers `noreply@onscen.com` dès le domaine vérifié dans Resend (actuellement sandbox `resend.dev`) |
| Activation compte | ✅ **Ajouté** : e-mail « Votre compte OnScen est activé » envoyé automatiquement quand un admin approuve un compte `pending` (mode `admin_approval`) | résolu | — |
| Notification fondateur | ✅ **Ajouté** (MODIF 1354) : email à `valentin.goulven@gmail.com` à chaque inscription — utile comme garde-fou manuel maintenant que les inscriptions sont ouvertes (cf. [06-ddos](./06-ddos.md)) | faible | Surveiller le volume si la croissance s'accélère (bruit) |

---

## 5.10 Synthèse phase 5

Surface auth solide ; **priorité absolue = purge historique Git secrets** (inchangé, vérifié toujours présent) ; renforcer CSP et quotas upload. Gaps UX de sécurité comblés le 08-11 (renvoi vérification email, branding email cohérent).
