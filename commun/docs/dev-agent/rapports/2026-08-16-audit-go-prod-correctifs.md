# Rapport Dev Agent — 2026-08-16 — Audit GO prod : correctifs code + restore staging

**Agent :** @onscen-dev-agent  
**Date :** 2026-08-16  
**Durée estimée :** 2 h  
**Statut global :** PARTIEL

---

## Mission

Analyser la synthèse `commun/docs/audit/2026-08-16-go-prod/00-synthese.md` et corriger tous les points corrigeables (code + ops staging). Ne pas inventer les décisions fondateur / avocat / prod.

**Source :** fondateur + handoff `@audit` / `@onscen-cto`

---

## Contexte / problème

Audit **NO-GO** : 3 P0 + 15 P1 + 7 P2. Beaucoup d’items sont hors code (contrats, DNS OVH, IAP, avocat).

---

## Actions réalisées

- [x] P0-01 restore staging réel (drop schema + dump 16/08, 439 users, health `db:ok`)
- [x] P0-03 / P1-07 : relais LiveKit → Cloudflare + sampling ; refus WebRTC non échantillonné en prod
- [x] P0-03 : `PHOTODNA_REQUIRED=1` refuse les médias si PhotoDNA absent ; fail-closed erreur PhotoDNA
- [x] P1-06 : 6 erreurs ESLint CI corrigées
- [x] P1-09 : AASA ne sert plus `TEAM_ID` placeholder (404 si `APPLE_TEAM_ID` manquant)
- [x] P1-01 : `/health` expose `stripeMode` test/live/disabled (sans secret)
- [x] P1-13 : `DEPLOYED_SHA` écrit au deploy + `release` dans `/health`
- [x] P1-05 : disque staging 82 % → 77 % (journals + leftover `/opt/soundy`)
- [x] P2-01 : CI / deploy-preprod Node 22 ; `engines` `>=20 <25`
- [x] P2-06 : Caddy staging déjà DENY+HSTS dans le repo (IP HTTP sans HSTS = voulu)
- [x] Uptime GH : fallback IP si DNS staging KO
- [ ] P0-02 rotation secrets Git — BLOQUÉ fondateur
- [ ] P0-03 contrat PhotoDNA / exercice runbook — BLOQUÉ fondateur + avocat
- [ ] P1-02 OAuth Google console — BLOQUÉ fondateur
- [ ] P1-03 WAF Cloudflare DNS prod — BLOQUÉ fondateur
- [ ] P1-04 DNS `staging.onscen.com` — BLOQUÉ (pas de credentials OVH dans msdev)
- [ ] P1-08 ACRCloud — en attente réponse fondateur
- [ ] P1-09 IAP / Team ID réel — BLOQUÉ fondateur
- [ ] P1-10 / P1-11 / P1-14 avocat — BLOQUÉ
- [ ] P1-12 Sentry dashboard / astreinte — BLOQUÉ ops
- [ ] P1-15 scripts debug **prod** — pas de mutation prod
- [ ] P2-03 `@sentry/capacitor` — nouvelle lib, STOP CTO
- [ ] P2-04 bundle `com.soundy.app` — fondateur
- [ ] P2-05 load test — ops
- [ ] P2-07 Facebook / OpenAI — fondateur

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/deploy/restore-db-staging.sh` | Drop schema staging + vérif `users` |
| `commun/deploy/backup-db.sh` | Exclure data `spatial_ref_sys` |
| `commun/deploy/deploy_zero_downtime.ps1` | Écrit `DEPLOYED_SHA` |
| `commun/backend/src/lib/csamHashMatch.ts` | `PHOTODNA_REQUIRED` + `unavailable` |
| `commun/backend/src/lib/contentModeration.ts` | Refus si hash unavailable |
| `commun/backend/src/lib/liveSamplingPolicy.ts` | Garde lives non échantillonnés |
| `commun/backend/src/routes/lives.ts` | Relais LiveKit + refus WebRTC prod |
| `commun/backend/src/server.ts` | AASA 404 ; health `stripeMode` + `release` |
| `commun/backend/src/lib/productionStartup.ts` | Warn PhotoDNA + PM2_INSTANCES |
| `.github/workflows/ci.yml` | Node 22 |
| `.github/workflows/uptime-health.yml` | Fallback IP staging |
| Lint : `auth.ts`, `donations.ts`, `subscriptions.ts`, `locationPrivacy.ts`, `integrationAccounts.ts`, `seed-production-sponsors.ts` | ESLint CI |

---

## Commandes exécutées

```text
npm run lint --prefix commun/backend          → ✅
npx vitest run (6 fichiers, 25 tests)         → ✅
gzip -t dump prod                             → ✅
restore staging + pm2 reload                  → ✅ health db:ok
configure-onscen-dns-ovh.ps1                  → ❌ credentials OVH absents
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests exécutés | csamHashMatch, liveSamplingPolicy, stripeMode, productionStartup, AASA, lives.start |
| Tests **non** exécutés | suite backend complète, `app:build`, `mobile:check`, QA UI |
| Build frontend (`web/app`) | NON FAIT |
| Web | Code AASA/health ; **non déployé** |
| Tel | AASA partagé ; sentry natif **non** changé |
| Migration DB | Non (restore staging seulement) |
| NON VÉRIFIÉ | Egress LiveKit réel en prod (besoin deploy) |
| CTO | Handoff : P0-02 rotation ; PhotoDNA contrat ; OVH DNS ; IAP |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1463)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| ACRCloud | Clés en prod ou absence volontaire ? |
| PhotoDNA | Contrat **ou** `PHOTODNA_REQUIRED=1` (refuse UGC média) |
| Secrets `72370fc8` | Rotation + accord purge Git |
| OVH | Ajouter `OVH_*` pour `staging.onscen.com` |
| Stripe live / OAuth Google / WAF / IAP / avocat | inchangés |

---

## Prochaines étapes

1. Répondre ACRCloud.
2. Deploy staging/prod **quand demandé** (AASA, sampling lives, health release).
3. Credentials OVH → DNS staging.
4. Rotation secrets (ops + fondateur).

---

*Généré par OnScen Dev Agent*
