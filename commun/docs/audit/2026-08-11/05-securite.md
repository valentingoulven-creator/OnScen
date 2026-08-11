# Phase 5 — Sécurité applicative

**Date :** 2026-08-10  
**Périmètre :** `server.ts`, `routes/auth.ts`, `middleware/`, `lib/accessControl.test.ts`, headers, cookies

---

## 5.1 Authentification

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Hashing | bcrypt utilisateur (`BCRYPT_SALT_ROUNDS`) ; pas d’argon2 | faible | OK ; surveiller OWASP |
| 2FA | TOTP + codes secours bcrypt + WebAuthn (`twoFactor.ts`, `webauthn.ts`) | faible | Encourager 2FA staff admin |
| JWT / session | Cookie httpOnly `onscen_auth` + `tokenVersion` révocation ; expiration configurée | faible | Rotation `JWT_SECRET` runbook |
| Brute force | `authLimiter` + limiters WebAuthn/2FA ; Redis store en prod | faible | — |
| Simulation msdev | Comptes démo mots de passe connus | faible | Désactiver routes msdev en prod (garde existante) |

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

## 5.8 Synthèse phase 5

Surface auth solide ; **priorité absolue = purge historique Git secrets** ; renforcer CSP et quotas upload.
