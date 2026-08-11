# Phase 1 — Stack technique

**Date :** 2026-08-10 (rafraîchi 2026-08-11)  
**Périmètre :** `commun/backend`, `web/app`, `ios/apptel`, `commun/deploy`, `.github/workflows`  
**Convention risque :** critique · élevé · moyen · faible

> **Rafraîchissement 2026-08-11** : re-exécution `npm audit` (backend + web) et suite de tests backend sur l'état actuel du working tree (inclut les correctifs non commités depuis l'audit du 08-10 : Turnstile, date de naissance obligatoire, géo mineurs). Voir §1.2 et §1.5 pour le détail des évolutions.
>
> **Correctifs appliqués 2026-08-11 (MODIF 1352)** : `jspdf` mis à jour (§1.2), régression `stories.test.ts` corrigée (§1.5), **et bug bloquant de build production découvert et corrigé** (double appel `validateBirthDate()` non narrowable par TS dans `AuthPage.tsx`/`SignupChatWizard.tsx` — `npm run build` échouait). Détail complet : `modification.txt` MODIF 1352.

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

## 1.2 Dépendances — obsolescence & vulnérabilités (`npm audit`)

### Backend (`commun/backend`) — ré-audité 2026-08-11

| Package (transitif) | Sévérité audit (08-10) | Sévérité audit (08-11) | Constat |
|---------------------|-------------------------|--------------------------|---------|
| brace-expansion, ip-address, nanoid, postcss, socket.io-parser | **élevé** (5 findings) | **0 finding** | ✅ **Résolu** — `npm audit` backend renvoie désormais 0 vulnérabilité (559 dépendances). |

**Statut E9 (backend) :** ✅ **Résolu** — à confirmer que le correctif est bien commité/déployé (actuellement dans le working tree, cf. `package-lock.json`).

### Frontend (`web/app`) — ré-audité 2026-08-11

| Package | Sévérité (08-10) | Sévérité (08-11) | Constat |
|---------|-------------------|---------------------|---------|
| sharp, socket.io-parser, fast-uri (transitifs) | **élevé** (6 findings) | **0 finding** | ✅ Résolu par la mise à jour des lockfiles. |
| **jspdf** `<=4.2.0` (direct, `^3.0.4` déclaré) | — (non détecté 08-10) | ✅ **Résolu 08-11** (`^4.2.1`) | LFI/path traversal, injection PDF (exécution JS arbitraire), DoS décodeur BMP/GIF, injection HTML dans `window.open` (XSS) — corrigé par upgrade. |

**Constat global :** la dette transitive « moyenne » du 08-10 est **résolue**. Le risque critique `jspdf` est **corrigé** (2026-08-11).
**Risque :** résolu.
**Correctif appliqué :** `jspdf` `^3.0.4` → `^4.2.1` (`jspdf-autotable` `^5.0.8` reste compatible, peer `^2||^3||^4`). `npm audit` web → 0 vulnérabilité. Build (`tsc -b && vite build`) et 576 tests web ✅ après upgrade, y compris les 4 générateurs PDF admin (`adminStatsPresentationPdf.ts`, `adminPdfCommon.ts`, `adminAnalyticsReportPdf.ts`, `adminFullReportPdf.ts` — API jsPDF utilisée stable entre v3 et v4, aucune régression TS). Dependabot/Renovate toujours recommandé pour éviter la récidive.

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
| Volume | ~106 fichiers test backend, 94 frontend ; ré-exécution locale **2026-08-11 post-correctifs** : **106/106 fichiers backend, 513/513 tests OK** ; **94/94 fichiers web, 576/576 tests OK** | résolu | — |
| `musicHome.test.ts` | ✅ **Corrigé** depuis le 08-10 (5/5 tests OK) | résolu | — |
| ✅ `stories.test.ts` | **Régression résolue 08-11** : la cause n'était pas un bug de test isolé mais un vrai risque de régression prod — la politique géo mineurs (MODIF 1350) traitait un âge **inconnu** comme mineur, forçant la précision « ville »/Paris. Une requête PostgreSQL prod en lecture seule a confirmé **418/439 comptes actifs (95 %) sans `birthDate` ni `age`** : déployer tel quel aurait dégradé silencieusement la géolocalisation de proximité pour la quasi-totalité des comptes existants. **Corrigé** (MODIF 1352, `ageGates.ts`/`locationPrivacy.ts`) : seuls les mineurs **confirmés** (âge connu < 18) sont désormais restreints ; les comptes à âge inconnu conservent leur précision géo actuelle (grandfathering). +3 tests dédiés dans `locationPrivacy.test.ts`. | résolu | — |
| Couverture | Aucun seuil `coverage` Vitest/Istanbul configuré | **moyen** | Ajouter `--coverage` sur modules critiques (auth, donations, modération) sans viser 100 % |
| E2E | Playwright présent ; smoke staging non bloquant | **moyen** | Élargir scénarios auth + signalement |
| Mobile | `ios/apptel` : Vitest sans job CI dédié (workflows Capacitor build seulement). **Sentry natif ajouté** (`@sentry/react` + `initNativeSentry()` dans `main.tsx`) depuis le 08-10 — résout partiellement E8 (cf. [04-observabilite](./04-observabilite.md)) | **moyen** | Ajouter job lint/test apptel ou réutiliser tests web partagés |

---

## 1.6 Synthèse phase 1

**Mise à jour 2026-08-11 (post-correctifs) :** `npm audit` backend et web assainis (0 finding, y compris `jspdf` désormais à jour) ; tests backend et web 100 % au vert (513/513, 576/576) ; **bug de build production bloquant découvert et corrigé au passage** (non lié à l'audit initial — `npm run build` échouait sur une régression TypeScript de MODIF 1349, non détectée par `tsc --noEmit` seul).

Priorités stack restantes : **(1)** commit + déploiement effectif des correctifs (actuellement en working tree uniquement), **(2)** mesurer couverture ciblée (auth, donations, modération), **(3)** planifier refonte store RAM pour scaling (lié phases 2/6, hors scope code — cf. C5).
