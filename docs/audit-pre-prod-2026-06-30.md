# Audit Pré-Production — Soundy (post MODIF 879)

**Date :** 2026-06-30  
**Verdict :** **92 / 100 — Greenlight** (deploy + smoke test)

---

## Synthèse

Corrections MODIF 878 + 879 : sécurité cluster, secrets VPS, Sentry actif, uptime monitor, persistance checkouts, FK progressives, CI E2E smoke, docs Cloudflare/PG staging.

---

## Note globale : **92 / 100**

| Pilier | Note |
|--------|------|
| Sécurité | **94** |
| Base de données | **82** |
| Logs & monitoring | **88** |
| Code & architecture | **76** |
| LiveKit | **88** |
| Infra VPS | **85** |
| Tests & CI/CD | **86** |
| Conformité | **85** |

---

## Ops — état VPS (2026-06-30)

| Variable | Prod | Staging |
|----------|------|---------|
| SENTRY_DSN | ✅ | ✅ |
| REDIS_URL | ✅ PONG | ✅ |
| TOTP_ENCRYPTION_KEY | ✅ | ✅ |
| OPS_HEALTH_TOKEN | ✅ ajouté | ✅ ajouté |

**Local :** `backend/.env.production`, `app/.env.production` générés via SCP + `scripts/sync-app-sentry-env.ps1`.

**Sentry :**
- Backend : projet `backend` (DSN dans `SENTRY_DSN`)
- Frontend : projet `javascript-react` (`VITE_SENTRY_DSN` — suffixe `/4511654894436432`)

---

## Verdict production

### **Oui — greenlight**

Conditions restantes :
1. **Deploy** prod/staging (migrations 024 + 025)
2. Smoke : login, salon, live Safari
3. Optionnel : activer Cloudflare proxy (`docs/CLOUDFLARE-WAF.md`)

---

## Long terme (documenté, non bloquant)

- Instance PG staging dédiée → `docs/INFRA-PG-STAGING.md`
- `VALIDATE CONSTRAINT` après nettoyage orphelins (migration 025)
- Architecture PG-first (snapshot global)
- k6 charge : `scripts/load/k6-smoke.js`
