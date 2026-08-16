# Phase 4 — Sentry et observabilité

**Date :** 2026-08-16 · **Statut :** Partiel — P1-12  
**Niveau de preuve :** VÉRIFIÉ LIVE (health/PM2) + REPO · dashboard Sentry **NON VÉRIFIÉ**

## Health / PM2

| Cible | Résultat |
| ----- | -------- |
| `https://onscen.com/health` | 200 `{"status":"OK","env":"production","db":"ok","services":{"redis":"ok","stripe":"ok","smtp":"ok","livekit":"ok"}}` |
| `http://127.0.0.1:3000/health` prod | identique |
| Staging IP `/health` | 200 `preproduction`, mêmes services `ok` |
| Staging DNS | **NXDOMAIN** |
| PM2 prod | `onscen-backend` cluster, 1 process, 186 Mo, uptime 19 h, 0 restarts, `pm2-logrotate` online |
| PM2 staging | `onscen-backend-staging` fork, 170 Mo, uptime 4 j |
| Disque prod | 2 % / 442 Go |
| RAM prod | 1956 Mo, ~722 used |
| Disque staging | **82 %** / 8,9 Go |

`stripe:ok` ≠ Stripe **live** (clé `sk_test`, voir `06-apis.md`).

## Sentry

| Surface | Code | DSN prod | Preuve événements |
| ------- | ---- | -------- | ----------------- |
| Web | `web/app/src/lib/sentry.ts` — CMP cookies, `sendDefaultPii: false`, replay mask | `SENTRY_DSN` **présent** (nom) | **NON VÉRIFIÉ** |
| Backend | startup refuse de démarrer sans DSN en prod | Présent (process up) | **NON VÉRIFIÉ** |
| « Natif » | `ios/apptel/src/lib/sentryNative.ts` = **`@sentry/react`** | Build store **NON VÉRIFIÉ** | **NON VÉRIFIÉ** |

Source maps / release : variables `VITE_SENTRY_*` dans le code ; upload maps **NON VÉRIFIÉ**.

## Alertes — qui est réveillé à 3 h ?

| Système | Destinataire | Seuil | Canal | Escalade |
| ------- | ------------ | ----- | ----- | -------- |
| `monitor-alerts.sh` cron `*/5` | `ALERT_EMAIL` / SMTP (noms présents, valeurs non lues) | disque/RAM/CPU 80 %, PM2 restart | Email Resend/SMTP | **Aucune** (pas de PagerDuty/SMS) |
| `healthcheck.sh` cron `*/2` | local VPS | process down | **NON VÉRIFIÉ** contenu | — |
| GitHub `uptime-health.yml` `*/5` | GitHub (échec run) | HTTP 200 `/health` | Actions | **CASSÉ** (étape staging DNS) |
| Sentry | **NON VÉRIFIÉ** | — | — | — |

**Réponse :** aujourd’hui, **personne n’est réveillé de façon démontrée**. Au mieux le fondateur reçoit un e-mail si Resend fonctionne et si le VPS est encore assez vivant pour l’envoyer. Si le VPS est down, le monitor interne est muet ; le monitor externe GitHub est rouge pour une raison **non liée à la prod** (DNS staging).

Certificats TLS : `certbot` vide sur le VPS (Caddy ACME). Expiry exacte : **NON VÉRIFIÉ** (`openssl` absent du poste Windows). HSTS présent en prod.

## Recommandation

Vérifier un event Sentry réel ; corriger Uptime Health ; définir un canal 24/7 nommé ; libérer le disque staging avant le prochain seuil.
