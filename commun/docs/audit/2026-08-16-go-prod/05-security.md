# Phase 5 — Sécurité (OWASP-inspiré)

**Date :** 2026-08-16 · **Statut :** bases saines + **P0-02** secrets Git  
**Niveau de preuve :** VÉRIFIÉ REPO + HTTP live + SSH noms · IDOR authentifié **NON VÉRIFIÉ**

## Auth / sessions

Cookie httpOnly `onscen_auth` + `tokenVersion` (audit 08-11, non re-lu ligne à ligne).  
`GET /api/auth/me` sans cookie : **401** `Token manquant` (prod + staging IP).  
2FA TOTP / WebAuthn : code présent (audits antérieurs).  
`ACCESS_REGISTRATION_MODE=open` prod. `TURNSTILE_REQUIRED=1`. Plafond volume : `registrationVolumeLimit.ts` (200/j défaut).

`GOOGLE_OAUTH_PROD_ENABLED` **absent** → OAuth public coupé.

## Autorisation / IDOR

Tests `accessControl` / `authJwtScope` historiquement nombreux.  
Cette passe : `GET /api/admin` → 404 (pas d’API racine) ; page `/admin` = SPA 200 (garde côté client + API).  
User A → ressource B : **NON TESTÉ** (pas de comptes).  
**NON VÉRIFIÉ ≠ OK.**

## XSS / CSRF / headers

Prod : CSP nonce, `X-Frame-Options: DENY`, HSTS, `Referrer-Policy`, `Permissions-Policy` (geolocation/mic/camera self, payment=()).  
React escape + `sanitize-html` (08-11). CSRF : SameSite + JSON API.

Staging IP : pas de HSTS, `X-Frame-Options: SAMEORIGIN`.

## Injections

SQL paramétré (constat historique). Pas de scan exhaustif 2026-08-16.

## Uploads / webhooks

Stripe webhook **sans** signature : `400 Signature manquante` (prod + staging). `constructEvent` dans `donations.ts` / `subscriptions.ts`. Startup refuse de boot si dons/abos on sans secret — aujourd’hui dons **off** en prod.

## CORS / rate limit / anti-bot

CORS prod restreint (audit 08-11 décommission getsoundy).  
Turnstile requis. Rate limits : code `abuseRateLimits` / auth limiter. Contournement live : **NON TESTÉ**.

## WAF / DDoS / CDN

**Absent.** `Via: 1.1 Caddy`. PM2 1 process. Redis OK (rate-limit store possible). Inscriptions ouvertes = surface.

## Secrets

| Emplacement | Présence | Valeurs dans le rapport |
| ----------- | -------- | ----------------------- |
| `/opt/onscen/.env` prod | Oui | **non dumpé** |
| Staging `.env` | Oui | non dumpé |
| `commun/msdev/.env` / `.env.production` locaux | Oui | OK/MISS seulement |
| Git HEAD `.env` | gitignoré | — |
| Historique `72370fc8` | **Toujours présent** (2026-06-30) | P0-02 |
| HEAD des 4 fichiers SEC-1 | **Absent de HEAD**, gitignorés ; copies locales disque possibles | Atténué HEAD ; historique reste P0 |
| CI logs | **NON VÉRIFIÉ** scan complet | — |

`STAGING_DEMO_AUTO_LOGIN=1` + `STAGING_DEMO_LOGIN_*` **noms** présents staging. Aucune référence code `commun/backend/src` trouvée. Staging IP **sans** Basic Auth observé sur `/health` et `/api/auth/me`. Risque : credentials demo dans l’env d’un host public par IP.

Scripts `seed_prod_testdata.js`, `query_prod.js`, `debug_*.js` sur le VPS prod : P1-15.

## Tests négatifs effectués (non destructifs)

| Test | Cible | Résultat |
| ---- | ----- | -------- |
| `/api/auth/me` sans token | prod + staging | 401 |
| POST webhook donations `{}` | prod + staging | 400 signature |
| `/api/admin` GET | prod + staging | 404 |
| Admin page | prod | 200 HTML SPA |

Non faits : IDOR A→B, upload malveillant, replay webhook avec signature, spam, session expirée, contournement âge.

## Recommandation

P0-02 rotation + purge. Retirer scripts debug prod. Décider du sort des vars demo staging. Tests IDOR authentifiés sur staging après comptes test.
