# Phase 1 — Stack technique

**Date :** 2026-08-10  
**Périmètre :** `commun/backend`, `web/app`, `ios/apptel`, `commun/deploy`, `.github/workflows`  
**Convention risque :** critique · élevé · moyen · faible

---

## 1.1 Inventaire des technologies (versions `package.json` / lockfiles)

| Couche | Technologies principales | Versions (semver déclaré) |
|--------|--------------------------|---------------------------|
| Backend | Node.js (CI), TypeScript, Express, Socket.io, `pg`, Redis client, JWT, bcryptjs, Stripe, LiveKit SDK, S3 SDK, Sentry Node, Vitest | TS `^5.4.5`, Express `^4.19.2`, Socket.io `^4.8.3`, Vitest `^3.2.6` |
| Web | React 19, Vite 8, Tailwind 4, Leaflet, Three/R3F, LiveKit client, HLS.js, Stripe.js, Sentry React, Playwright, Vitest | React `^19.2.6`, Vite `^8.1.2`, TS `~6.0.2` |
| Mobile | Capacitor 8, overrides `ios/apptel` sur base web, secure-storage, push, geolocation | `@capacitor/core` `^8.4.2` |
| Data / cache | PostgreSQL (+ PostGIS optionnel), Redis (sessions OAuth, rate-limit store, Socket.io adapter) | — |
| Live | LiveKit Cloud, Cloudflare Stream (RTMP→HLS), coturn (TURN self-hosted doc) | — |
| Infra | VPS Scaleway, PM2, Caddy TLS, scripts PowerShell deploy | Node 20 en CI |

**Constat :** stack cohérente pour une app sociale temps réel (monolithe Node + SPA + Capacitor).  
**Risque :** faible  
**Recommandation :** documenter la matrice « composant → owner → runbook » dans `commun/deploy/RUNBOOK-PROD.md` (déjà partiellement fait).

---

## 1.2 Dépendances — obsolescence & vulnérabilités (`npm audit`, 2026-08-10)

### Backend (`commun/backend`)

| Package (transitif) | Sévérité audit | Constat |
|---------------------|----------------|---------|
| brace-expansion, ip-address, nanoid, postcss, socket.io-parser | **élevé** (5 findings) | Chaîne dev/transitive ; correctifs annoncés via `npm audit fix` |

### Frontend (`web/app`)

| Package | Sévérité | Constat |
|---------|----------|---------|
| Idem + **fast-uri**, **sharp** `<0.35.0` | **élevé** (6 findings) | `sharp` nécessite `npm audit fix --force` (montée majeure) |

**Constat :** aucune vulnérabilité **critique** npm au moment de l’audit ; dette transitive non nulle.  
**Risque :** **moyen** (DoS parser Socket.io, libvips via sharp en CI/icons).  
**Recommandation :** PR dédiée : `npm audit fix` backend + web ; traiter `sharp@0.35.x` après test `pwa:icons` ; verrouiller versions avec lockfile ; optionnel Dependabot/Renovate.

---

## 1.3 Architecture — cohérence & séparation

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Style global | Monolithe Express unique (`commun/backend/src`) servant API REST, Socket.io, fichiers statiques build web | faible | Conserver jusqu’à charge justifiant extraction (workers modération, search) |
| Store applicatif | État métier encore largement en RAM (`models/schema.ts`) synchronisé avec PostgreSQL (hybride JSON + tables) | **élevé** | Roadmap « source de vérité PG/Redis » (cf. Phase 2 & 6) |
| Front / back | SPA Vite build copiée dans `commun/backend/public` — un déploiement | faible | OK pour stade actuel |
| Mobile | Capacitor consomme API distante ; pas de second backend | faible | — |

---

## 1.4 CI/CD & environnements

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Pipeline | `.github/workflows/ci.yml` : install, build, lint, **backend tests**, tsc, lint, build prod web, **576 tests web** | faible | Maintenir |
| E2E | Job `e2e-smoke` contre **staging** avec `continue-on-error: true` | **moyen** | Durcir : fail CI si smoke staging KO 2 fois de suite |
| Staging / prod | Scripts `deploy-preprod` / `deploy-prod` séparés ; prod non auto depuis CI (bon) | faible | Garder garde-fou humain prod |
| GitLab CI | Absent (GitHub Actions uniquement) | faible | Aligner doc si migration GitLab prévue |

---

## 1.5 Tests & couverture

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Volume | ~105 fichiers test backend, 94 frontend ; exécution locale 2026-08-10 : **576/576 web OK**, **504/505 backend** (1 échec `musicHome.test.ts`) | **moyen** | Corriger le test flaky avant release |
| Couverture | Aucun seuil `coverage` Vitest/Istanbul configuré | **moyen** | Ajouter `--coverage` sur modules critiques (auth, donations, modération) sans viser 100 % |
| E2E | Playwright présent ; smoke staging non bloquant | **moyen** | Élargir scénarios auth + signalement |
| Mobile | `ios/apptel` : Vitest sans job CI dédié (workflows Capacitor build seulement) | **moyen** | Ajouter job lint/test apptel ou réutiliser tests web partagés |

---

## 1.6 Synthèse phase 1

Priorités stack : **(1)** corriger test backend en échec + audit npm, **(2)** mesurer couverture ciblée, **(3)** planifier refonte store RAM pour scaling (lié phases 2/6).
