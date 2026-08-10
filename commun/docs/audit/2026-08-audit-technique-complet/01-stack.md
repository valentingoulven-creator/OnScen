# Audit technique OnScen — Phase 1 : Stack technique

**Date :** 2026-08-07
**Méthode :** lecture `package.json` (backend/frontend/mobile), `npm audit --json`, exécution réelle des suites de tests (`npm test`), lecture `.github/workflows/*.yml`.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

---

## 1.1 Inventaire des technologies

### Backend — `commun/backend` (Node.js/TypeScript, monolithe Express)

| Catégorie | Techno | Version |
|---|---|---|
| Runtime | Node.js | 20 (CI `actions/setup-node@v4` `node-version: '20'`) |
| Langage | TypeScript | `^5.4.5` |
| Framework HTTP | Express | `^4.19.2` |
| Temps réel | Socket.io | `^4.8.3` (+ `@socket.io/redis-adapter` `^8.3.0`) |
| Base de données | `pg` (driver PostgreSQL) | `^8.22.0` |
| Cache/queue | `redis` (client) | `^4.7.1` |
| Auth | `jsonwebtoken` `^9.0.2`, `bcryptjs` `^2.4.3`, `otplib` `^13.4.1` (TOTP), `@simplewebauthn/server` `^13.3.2` (Passkeys) |
| Sécurité HTTP | `helmet` `^8.2.0`, `express-rate-limit` `^8.5.2`, `cors` `^2.8.5` |
| Paiements | `stripe` `^22.3.1` |
| Observabilité | `@sentry/node` `^10.62.0` |
| Stockage objet | `@aws-sdk/client-s3` `^3.1077.0` (S3-compatible, Scaleway) |
| Live streaming | `livekit-server-sdk` `^2.16.0` |
| OAuth Google | `google-auth-library` `^10.9.0` |
| Email | `resend` `^6.16.0`, `nodemailer` `^9.0.3` (fallback SMTP) |
| Push web | `web-push` `^3.6.7` |
| Sanitization | `sanitize-html` `^2.17.5` |
| Tests | `vitest` `^3.2.6` |
| Dev server | `ts-node-dev` `^2.0.0` |
| Lint | `eslint` `^10.6.0` + `typescript-eslint` `^8.62.1` |

### Frontend web — `web/app` (React SPA + PWA)

| Catégorie | Techno | Version |
|---|---|---|
| Langage | TypeScript | `~6.0.2` |
| Framework UI | React / React DOM | `^19.2.6` |
| Build | Vite | `^8.1.2` |
| Style | Tailwind CSS | `^4.3.2` (`@tailwindcss/vite`) |
| i18n | `i18next` `^26.3.4` / `react-i18next` `^17.0.8` |
| Cartographie | `leaflet` `^1.9.4` + `leaflet.markercluster` |
| 3D | `three` `^0.185.1`, `@react-three/fiber` `^9.6.1`, `@react-three/drei` |
| Live vidéo | `livekit-client` `^2.20.0`, `@livekit/components-react` `^2.9.21`, `hls.js` `^1.6.16` |
| Paiements | `@stripe/stripe-js` `^9.9.0`, `@stripe/react-stripe-js` `^6.7.0` |
| Auth biométrie | `@simplewebauthn/browser` `^13.3.0` |
| Observabilité | `@sentry/react` `^10.62.0` + `@sentry/vite-plugin` (source maps) |
| Robustesse mdp | `zxcvbn` `^4.4.2` |
| Réseau temps réel | `socket.io-client` `^4.8.3` |
| Conversion image | `heic2any` `^0.0.4` (voir §12 — licence) |
| PWA | `vite-plugin-pwa` `^1.3.0` |
| Tests unitaires | `vitest` `^3.2.4` |
| Tests E2E | `@playwright/test` `^1.61.1` |

### Mobile — `ios/apptel` (Capacitor, overrides mobiles de `web/app`)

| Catégorie | Techno | Version |
|---|---|---|
| Wrapper natif | `@capacitor/core`, `android`, `ios` | `^8.4.2` |
| Modules natifs | `camera`, `geolocation`, `push-notifications`, `preferences`, `secure-storage` | `^8.x` |
| UI | React `^19.2.6`, React Router `^7.18.1` |
| TypeScript | `~6.0.2` |
| Build | Vite `^8.1.2` |

### Infra / déploiement

| Composant | Détail |
|---|---|
| Hébergement | VPS Scaleway (prod `51.159.164.100`, staging `51.159.170.181`), zone `fr-par-2` |
| Process manager | PM2 (`commun/deploy/ecosystem.config.cjs`), `instances: 1` en `cluster` mode (volontaire, cf. `03-database` / store RAM non partagé) |
| Reverse proxy / TLS | Caddy (`commun/deploy/Caddyfile`) — HTTPS Let's Encrypt automatique |
| Base de données | PostgreSQL managé Scaleway + extension PostGIS (`51.15.132.229:14440`), prod et staging **sur la même instance physique** (bases logiques distinctes) |
| Live | LiveKit Cloud (WebRTC) + Cloudflare Stream (RTMP→HLS), fallback mesh WebRTC P2P + TURN (coturn self-hosted sur le VPS) |
| Stockage objet | S3-compatible Scaleway Object Storage (optionnel, sinon disque local `public/uploads/`) |
| CI/CD | GitHub Actions |

---

## 1.2 Dépendances obsolètes / vulnérabilités connues (`npm audit`)

Exécuté le 2026-08-07 (`npm audit --json`).

### Backend (`commun/backend`) — 4 vulnérabilités **high**, 0 critique

| Paquet | Sévérité | CVE/GHSA | Chemin | Directe ? |
|---|---|---|---|---|
| `brace-expansion` | 🟠 High | GHSA-mh99-v99m-4gvg / GHSA-rgw5-rvv9-x895 (DoS mémoire) | via `ts-node-dev` (outillage dev) | Non |
| `ip-address` | 🟠 High | GHSA-mwp4-54f8-5fhr (bypass SSRF via décodage octal) | transitif | Non |
| `postcss` | 🟠 High | GHSA-r28c-9q8g-f849 (path traversal source map) | transitif (tooling build) | Non |
| `socket.io-parser` | 🟠 High | GHSA-2m8v-j782-fhvr (memory exhaustion) | **nested** `<4.2.7`, distinct de la dépendance directe `socket.io@4.8.3` qui embarque déjà un parser à jour | Non |

**Constat :** les 4 vulnérabilités touchent des dépendances **transitives d'outillage** (dev/build), pas le runtime de production exposé directement. `fixAvailable: true` pour les 4. Aucune vulnérabilité critique.

### Frontend (`web/app`) — 5 vulnérabilités **high**, 0 critique

| Paquet | Sévérité | CVE/GHSA | Directe ? |
|---|---|---|---|
| `brace-expansion` | 🟠 High | idem backend | Non |
| `fast-uri` | 🟠 High | GHSA-v2hh-gcrm-f6hx / GHSA-7p8r-x3mc-p8w7 (confusion d'hôte backslash) | Non |
| `postcss` | 🟠 High | idem | Non |
| `sharp` | 🟠 High | GHSA-f88m-g3jw-g9cj (CVE-2026-33327/28, 35590/91 — libvips) | **Oui** (devDependency, génération d'assets/PWA icons) — fix dispo mais **major** (`0.34.5` → `0.35.3`) |
| `socket.io-parser` | 🟠 High | idem | Non |

**Constat :** `sharp` est la seule dépendance **directe** vulnérable des deux audits, utilisée uniquement en devDependency (génération d'icônes PWA, `commun/scripts/generate-pwa-icons.mjs`), pas dans le runtime servi aux utilisateurs. Upgrade non appliqué automatiquement car `isSemVerMajor: true`.

**Recommandation :**
1. 🟡 Lancer `npm audit fix` (safe, non-breaking) sur les deux paquets pour purger `brace-expansion`/`fast-uri`/`postcss`/`socket.io-parser` transitifs.
2. 🟢 Planifier la montée de `sharp` vers `0.35.x` (breaking mineur probable sur l'API, à tester sur le script de génération d'icônes uniquement — pas de surface d'attaque publique actuelle).
3. Ce périmètre recoupe `ARC-10` de `AUDIT-CONSOLIDE.md` (dette de dépendances Stripe/Express/Redis) — voir aussi §1.4.

---

## 1.3 Cohérence de l'architecture

**Verdict : monolithe assumé et cohérent pour l'échelle actuelle, avec dette d'organisation interne connue.**

- **Style** : monolithe modulaire — 1 backend Express/Socket.io (`commun/backend/src/`), 1 SPA React (`web/app/src/`), overrides Capacitor mobiles isolés (`ios/apptel/src/`). Pas de microservices : choix raisonnable au stade actuel (équipe réduite, trafic pas encore massif), les composants réellement scalables (live vidéo, stockage objet, paiement) sont **déjà externalisés** (LiveKit Cloud, Cloudflare Stream, S3, Stripe) plutôt que ré-implémentés en interne — bon signal architectural.
- **Séparation des responsabilités** : `routes/` (Express routers) → `lib/` (288 fichiers) mélange logique métier, accès données et intégrations tierces sans couche `services/` explicite (**ARC-9**, `AUDIT-CONSOLIDE.md` — 🟡 moyen, XL pour corriger, non bloquant à ce stade).
- **God components** frontend confirmés toujours présents : `DmPage.tsx` (~3352 lignes), `HomePage.tsx` (~2743 lignes) et similaires (**ARC-5**) — 🟡 moyen (maintenabilité), pas de risque fonctionnel direct.
- **Incohérence TypeScript strict** : `strict: false` en frontend/mobile (`web/app/tsconfig.app.json`, `ios/apptel/tsconfig.app.json`) vs backend strict — 🟡 moyen (**ARC-2**), classe de bugs `null`/`undefined` non détectée à la compilation côté UI.
- **Nouvelle observation (cette phase)** : version TypeScript **divergente** entre backend (`^5.4.5`) et frontend/mobile (`~6.0.2`) — 🟢 faible en soi (pas de bug connu), mais source de divergences de comportement du compilateur (types stricts, inférence) entre les deux bases de code partageant parfois des types (`shared`/contrats API). Recommandation : aligner sur une seule version majeure lors de la prochaine campagne de mise à jour.

---

## 1.4 CI/CD

**Verdict : 🟢 bon niveau pour la taille du projet — build, lint, tests et déploiement continu vers staging avec garde-fous ; prod restée volontairement manuelle.**

Fichiers : `.github/workflows/ci.yml`, `deploy-preprod.yml`, `android-capacitor.yml`, `ios-capacitor.yml`, `uptime-health.yml`.

| Étape | Détail | Constat |
|---|---|---|
| Déclencheurs CI | `push`/`pull_request` sur `master`/`main` | Couvre les 2 branches principales |
| Build backend | `npm ci` + `npm run build` (tsc) | ✅ |
| Lint backend | `npm run lint` (`--max-warnings=0`) | ✅ zéro tolérance (cf. **ARC-8** résolu) |
| Tests backend | `npm test` (vitest) | ✅ — **489/489 tests passent** (vérifié en exécution réelle le 2026-08-07) |
| Typecheck frontend | `npx tsc -b --noEmit` | ✅ |
| Lint frontend | `npm run lint` | ✅ (445 warnings préexistants non bloquants, **ARC-7** — dette React Compiler, pas d'erreur) |
| Build prod frontend | `npm run build` avec `VITE_APP_ENV=production` | ✅ |
| Tests frontend | `npm test` (vitest) | ✅ — **576/576 tests passent** (vérifié en exécution réelle) |
| E2E smoke | Playwright contre **staging public** (`continue-on-error: true`) | 🟡 non bloquant — un échec E2E ne bloque pas le merge (`continue-on-error`), à surveiller |
| **Déploiement staging** | Auto après CI verte sur `master`/`main` (`deploy-preprod.yml`, `workflow_run`) + vérif santé (`/health` doit répondre `preproduction`) | ✅ zero-downtime documenté + smoke post-déploiement |
| **Déploiement prod** | **Aucun workflow GitHub** — script manuel `commun/scripts/deploy-prod.ps1` uniquement | ✅ conforme à la règle « jamais de déploiement prod automatique » |
| Environnements séparés | staging (`51.159.170.181`) / prod (`51.159.164.100`) — VPS distincts | ✅ mais **DB physique partagée** (voir Phase 2, DBI-6) |

**Recommandation :**
- 🟡 Retirer `continue-on-error: true` sur l'E2E smoke une fois la suite stabilisée, ou au minimum notifier explicitement (Slack/email) en cas d'échec silencieux.
- 🟢 Ajouter un job `npm audit --audit-level=high` en CI pour détecter automatiquement les nouvelles vulnérabilités (actuellement aucun contrôle de sécurité des dépendances en CI).

---

## 1.5 Tests (unitaires, intégration, e2e) et couverture

**Verdict : bonne base de tests unitaires/logique métier, mais 🟠 absence totale de mesure de couverture, 🟠 aucun test de composant React (UI), et E2E limité à un smoke test.**

| Type | Backend (`commun/backend/src`) | Frontend (`web/app/src`) |
|---|---|---|
| Fichiers `*.test.ts` | **103** fichiers | **94** fichiers (`0` fichier `.test.tsx`) |
| Fichiers source (hors tests) | 360 | 668 |
| Tests exécutés (run réel du 2026-08-07) | **489 tests, 489 passent** | **576 tests, 576 passent** |
| Framework | Vitest, `environment: 'node'` | Vitest, `environment: 'node'` |
| Coverage tool configuré | ❌ Absent (`vitest.config.ts` ne définit pas de section `coverage`, pas de `--coverage` dans les scripts `package.json`) | ❌ Absent, idem |
| Tests de composants UI (React Testing Library / jsdom) | N/A | ❌ **Aucun** — tous les tests `.test.ts` couvrent uniquement `lib/`/logique pure, aucun test de rendu de composant `.tsx` |
| E2E | — | `@playwright/test` — **2 fichiers spec** seulement, exécutés en CI contre `staging.getsoundy.com` (smoke uniquement : santé de l'app, pas de parcours utilisateur complet) |

**Constats détaillés :**
1. **Pas de taux de couverture chiffré** — impossible de dire quel pourcentage du code est réellement testé ; seul un ratio approximatif fichiers-test/fichiers-source peut être calculé (~29 % backend, ~14 % frontend en nombre de fichiers, ce qui **ne reflète pas** la couverture de lignes/branches réelle).
2. **Aucun test de rendu de composant React** — tout le frontend UI (modals, formulaires, pages) n'a de garde-fou automatisé que via `tsc` (typage) et ESLint, pas de test comportemental (clic, état, accessibilité).
3. **E2E réduit à un smoke test non bloquant** (`continue-on-error: true`) — pas de scénario critique testé automatiquement (inscription, login, envoi de don, démarrage d'un live, DM).
4. **Point positif** : les 103 + 94 = 197 fichiers de test couvrent une bonne partie de la logique métier sensible identifiée dans les phases suivantes (moderation, donations, retention, notifications — noms de fichiers `*.test.ts` correspondants trouvés pour la plupart des modules `lib/` critiques).
5. Historique : `AUDIT-CONSOLIDE.md` **ARC-11** signalait un test `sponsors.test.ts` en échec (date figée dépassée) — **résolu**, confirmé par l'exécution complète 489/489 verte aujourd'hui.

**Recommandation :**
1. 🟠 Ajouter `@vitest/coverage-v8` (ou `c8`) aux deux `vitest.config.ts`, publier le rapport en CI (seuil minimal, ex. 60 % pour commencer, sans bloquer immédiatement).
2. 🟡 Introduire des tests de composants critiques (auth, paiement, formulaire de don, modération) avec `@testing-library/react`.
3. 🟡 Étendre l'E2E Playwright à 3-5 parcours critiques (inscription, login, live start, don, DM) et retirer `continue-on-error` une fois stabilisé.

---

## Synthèse des risques — Phase 1

| # | Sujet | Risque | Effort correction |
|---|---|---|---|
| STK-1 | 4-5 vulnérabilités npm `high` (toutes transitives sauf `sharp` en devDep) | 🟡 Moyen | Faible (`npm audit fix` + upgrade `sharp`) |
| STK-2 | Version TypeScript divergente backend (5.4) / frontend (6.0) | 🟢 Faible | Faible |
| STK-3 | Pas de couche `services/` (ARC-9, hérité) | 🟡 Moyen (long terme) | XL |
| STK-4 | `strict: false` TS frontend/mobile (ARC-2, hérité) | 🟡 Moyen | Élevé (L) |
| STK-5 | God components non découpés (ARC-5, hérité) | 🟡 Moyen | Élevé (L/XL) |
| STK-6 | Aucune mesure de couverture de tests | 🟠 Élevé | Faible (outillage) |
| STK-7 | Aucun test de composant React (UI) | 🟡 Moyen | Moyen |
| STK-8 | E2E limité à 2 specs smoke, non bloquant | 🟡 Moyen | Moyen |
| STK-9 | Pas de scan de sécurité des dépendances en CI | 🟡 Moyen | Faible |

*Les findings ARC-2/5/9 sont hérités de `commun/docs/audit/AUDIT-CONSOLIDE.md` (2026-07-22), reconfirmés inchangés à ce jour.*
