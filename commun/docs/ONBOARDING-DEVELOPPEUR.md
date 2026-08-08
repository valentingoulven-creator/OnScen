# Onboarding développeur — OnScen

> **Point d'entrée unique** pour un nouveau développeur rejoignant le projet OnScen (getsoundy.com).  
> Dernière mise à jour : **juillet 2026** · Branche principale : `master` · Repo : [github.com/valentingoulven-creator/Melo](https://github.com/valentingoulven-creator/Melo)

---

## Table des matières

1. [Vue d'ensemble produit](#1-vue-densemble-produit)
2. [Prérequis](#2-prérequis)
3. [Setup local pas à pas](#3-setup-local-pas-à-pas)
4. [Architecture du monorepo](#4-architecture-du-monorepo)
5. [Conventions de développement](#5-conventions-de-développement)
6. [Environnements](#6-environnements)
7. [Workflow dev quotidien](#7-workflow-dev-quotidien)
8. [Domaines clés du produit](#8-domaines-clés-du-produit)
9. [Documentation à lire](#9-documentation-à-lire)
10. [Première semaine — parcours suggéré](#10-première-semaine--parcours-suggéré)
11. [Contacts et escalade](#11-contacts-et-escalade)
12. [État actuel du projet (juillet 2026)](#12-état-actuel-du-projet-juillet-2026)

---

## 1. Vue d'ensemble produit

**OnScen** ([getsoundy.com](https://getsoundy.com)) est une plateforme sociale autour de la musique et des événements géolocalisés :

- **Carte et globe 3D** — découverte de salons musicaux, lives et événements à proximité ou dans le monde.
- **Salons** — écoute synchronisée YouTube entre participants (type « watch party »).
- **Lives** — diffusion caméra (LiveKit) ou RTMP (Cloudflare Stream), chat temps réel, dons.
- **Fil social** — posts, stories, reels courts, DMs, abonnements créateurs.
- **Monétisation** — Stripe Connect (dons live, abonnements), sponsors sur la carte et le fil.

### Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend web | React 19, Vite, Tailwind CSS v4, TypeScript |
| Mobile | Capacitor 8 (PWA + APK Android) — overrides dans `ios/apptel/` |
| Backend | Node.js, Express, Socket.io, TypeScript |
| Base de données | PostgreSQL (prod/preprod) · store JSON local en msdev |
| Temps réel | Socket.io · LiveKit · Cloudflare Stream |
| Paiements | Stripe Connect |
| Infra | VPS Scaleway (fr-par-2), Caddy, PM2, PostgreSQL managé |
| Carte | Leaflet (2D) + Three.js / React Three Fiber (globe 3D) |

Pour la vision scaling : [`commun/docs/STACK-CIBLE.md`](./STACK-CIBLE.md).

### Structure monorepo (racine)

```
OnScen/
├── web/app/           # Frontend React (source de vérité web)
├── ios/apptel/        # Overrides Capacitor mobile uniquement
├── commun/
│   ├── backend/       # API Express + Socket.io
│   ├── msdev/         # Config et scripts dev local
│   ├── scripts/       # Scripts ops et dev (PowerShell)
│   └── deploy/        # Deploy zero-downtime, Caddy, PM2
├── android/           # Build APK/AAB Capacitor
├── docs/              # Docs produit / infra (racine)
├── commun/docs/       # Docs techniques — index : commun/docs/README.md
├── AGENTS.md          # Instructions agents Cursor
├── modification.txt   # Changelog significatif (obligatoire)
└── TODO-MANUAL.md     # Tâches non automatisables post-audit
```

Le package npm racine s'appelle `onscen` (héritage OnScenv2) — le produit public est **OnScen**.

---

## 2. Prérequis

### Obligatoires

| Outil | Version | Notes |
|-------|---------|-------|
| **Node.js** | 18+ (LTS recommandé) | Vérifié par `dev-start.ps1` |
| **npm** | 9+ | Inclus avec Node |
| **Git** | Récent | Clone HTTPS ou SSH |
| **PowerShell** | 5.1+ (Windows) | Scripts dev/deploy |

### Recommandés

| Outil | Usage |
|-------|-------|
| **Cursor** ou VS Code | Éditeur — règles projet dans `.cursor/rules/` |
| **Chrome DevTools** | Debug mobile (390 px) + console |

### Optionnels (mobile natif)

| Outil | Usage |
|-------|-------|
| **Android Studio + SDK** | `npm run capacitor:android:apk` · script `commun/scripts/setup-android-sdk.ps1` |
| **Xcode** (macOS) | Build iOS Capacitor |
| **Java JDK 17** | Gradle Android |

Pour le travail web/backend quotidien, **Android/iOS ne sont pas requis**.

---

## 3. Setup local pas à pas

### 3.1 Cloner le dépôt

```powershell
git clone https://github.com/valentingoulven-creator/Melo.git OnScen
cd OnScen
git checkout master   # branche principale
```

### 3.2 Installer les dépendances

```powershell
# À la racine — installe web/app, commun/backend, ios/apptel si besoin
npm install
npm install --prefix web/app
npm install --prefix commun/backend
```

> Astuce : certains scripts npm utilisent `--prefix` ; un `npm install` à la racine ne suffit pas toujours pour les sous-packages.

### 3.3 Configurer les fichiers d'environnement

**Ne jamais committer de secrets.** Les valeurs réelles sont fournies par le fondateur (ou copiées depuis un poste existant).

#### Backend msdev — `commun/msdev/.env`

```powershell
Copy-Item commun\msdev\.env.example commun\msdev\.env
```

Fichier template : [`commun/msdev/.env.example`](../msdev/.env.example)

- `APP_ENV=msdev` · `PORT=4080`
- Clés optionnelles (YouTube, Stripe test, Sightengine…) : le fondateur vous les transmettra si nécessaire pour tester les intégrations.
- **Sans `.env`**, le script dev affiche un avertissement ; le backend démarre quand même avec les valeurs par défaut msdev.

#### Frontend Vite — `web/app/.env.development`

```powershell
Copy-Item web\app\.env.development.example web\app\.env.development
```

- `VITE_DESIGN_QUICK_WINS=1` — aligne l'UI carte sur la prod (recommandé).

Templates complémentaires (lecture seule) :

| Fichier | Rôle |
|---------|------|
| `commun/backend/.env.production.example` | Référence prod |
| `commun/backend/.env.preproduction.example` | Référence staging |
| `web/app/.env.production.example` | Build prod (sans secrets) |

### 3.4 Lancer le dev

```powershell
npm run dev
```

Équivalent : `commun/scripts/dev-start.ps1`

| Service | URL | Rôle |
|---------|-----|------|
| **Frontend Vite** | http://localhost:5173 | UI React (HMR) |
| **Backend msdev** | http://localhost:4080 | API + Socket.io |
| **Health check** | http://localhost:4080/health | Statut API |

Le script ouvre deux fenêtres PowerShell (backend + frontend) et le navigateur.

### 3.5 Compte démo msdev

| Champ | Valeur |
|-------|--------|
| Email | `listener@msdev.local` |
| Mot de passe | `msdev123` |

Autres comptes démo (même mot de passe) : `dj@msdev.local`, `bass@msdev.local`.

Le compte `listener@msdev.local` est pré-seedé avec un écosystème showcase (243k abonnés affichés, reels, lives, salons, stories). Idéal pour explorer l'app sans créer de données.

### 3.6 Vérifier que tout fonctionne

1. Ouvrir http://localhost:5173 → page d'accueil / carte.
2. Se connecter avec `listener@msdev.local` / `msdev123`.
3. Naviguer : carte → salon → live → profil → fil.
4. `curl http://localhost:4080/health` → `"env":"msdev"`.

En cas de problème réseau mobile/LAN : `npm run msdev:diagnose` · doc `commun/msdev/MOBILE-PWA.txt`.

---

## 4. Architecture du monorepo

### Frontend — `web/app/src/`

| Dossier | Contenu |
|---------|---------|
| `pages/` | Écrans (HomePage, LivePage, SalonPage, ProfilePage, AuthPage…) |
| `components/` | UI réutilisable (carte, globe, chat, modals…) |
| `components/globe3d/` | Globe Three.js (marqueurs salons, lives, événements) |
| `hooks/` | Logique React (socket salon, geo refresh, live flow…) |
| `lib/` | Utilitaires + tests Vitest (`*.test.ts`) |
| `lib/api/` | Clients API REST |
| `context/` | AuthContext, providers globaux |
| `locales/` | i18n FR/EN |

Point d'entrée : `web/app/src/App.tsx` · routing React Router.

### Backend — `commun/backend/src/`

| Dossier | Contenu |
|---------|---------|
| `routes/` | Endpoints REST |
| `lib/` | Logique métier (geo, live, auth, Stripe, modération…) |
| `lib/aiAgents/` | Agents CEO/Dev IA (admin) |
| `models/` | Schéma données (store RAM msdev + sync PG) |
| `db/migrations/` | Migrations PostgreSQL (001 → 031+) |

Point d'entrée : `commun/backend/src/index.ts` · flag msdev : `--msdev`.

### Mobile — `ios/apptel/src/`

**Uniquement les overrides Capacitor.** Les fixes partagés web/mobile vont dans `web/app/src/`. Ne pas dupliquer la logique métier ici.

### Dev local — `commun/msdev/`

- `.env` — config msdev (non versionné)
- `data/store.json` — persistance locale msdev
- `scripts/` — LAN, mobile, restart, reset data

### Scripts ops — `commun/scripts/`

Scripts PowerShell pour dev, deploy, infra, Stripe, Android SDK, etc. (voir [§7](#7-workflow-dev-quotidien)).

---

## 5. Conventions de développement

### Mobile-first (obligatoire)

Règle Cursor : `.cursor/rules/mobile-responsive.mdc`

- Breakpoints Tailwind **mobile-first** : défaut = mobile, `sm:` tablette, `lg:` desktop.
- Viewport : **`dvh` / `dvw`**, jamais `100vh`.
- Cibles tactiles : minimum **44×44 px**.
- Modals : **bottom-sheet** sur mobile, dialog centré sur desktop.
- Pas de scroll horizontal involontaire — tester à **390 px** (iPhone 14).

### Changelog — `modification.txt`

Après toute modification **significative** (feature, bug fix, refonte UI, backend), ajouter une entrée en fin de `modification.txt` à la racine. Format et numérotation `MODIF N` — voir les entrées existantes et la règle `.cursor/rules/modification-log.mdc`.

### Commits

- **Ne pas committer** sans demande explicite du fondateur.
- Messages en français ou anglais, descriptifs du *pourquoi*.
- **Jamais** de secrets (`.env`, clés API, mots de passe) dans Git.

### Deploy prod

- **Interdit sans demande explicite** du fondateur.
- Commande canonique : `commun/scripts/deploy-prod.ps1` (voir `.cursor/rules/deploy-prod.mdc`).
- Preprod/staging : `commun/scripts/deploy-preprod.ps1` — réservé QA interne, pas au nouveau dev par défaut.

### Code

- Scope minimal — ne pas refactorer hors sujet.
- Lire le code existant avant d'ajouter ; matcher les conventions du fichier.
- Commentaires : uniquement pour la logique métier non évidente.
- Langue : UI en FR par défaut ; identifiants code en anglais.

---

## 6. Environnements

| Env | `APP_ENV` | URL | Données | Qui peut déployer |
|-----|-----------|-----|---------|---------------------|
| **Dev local** | `msdev` | localhost:5173 / :4080 | `commun/msdev/data/` | Vous (local) |
| **Preprod** | `preproduction` | https://staging.getsoundy.com | PG `soundy_staging` | Fondateur / CI auto |
| **Prod** | `production` | https://getsoundy.com | PG `soundy-prod` | Fondateur uniquement |

Doc détaillée : [`commun/docs/ENVIRONNEMENTS.md`](./ENVIRONNEMENTS.md) · infra : [`commun/docs/INFRA-ONSCEN.md`](./INFRA-ONSCEN.md).

### Ce que vous pouvez toucher (nouveau dev)

| ✅ Autorisé | ❌ Interdit sans accord explicite |
|------------|-----------------------------------|
| Dev local (`npm run dev`) | Deploy prod |
| Branches feature + PR | SSH prod (`soundy-prod`) |
| Tests et build locaux | Modifier `.env` prod/preprod sur VPS |
| Lire les docs infra | Push secrets dans Git |
| Preprod si le fondateur vous l'accorde | Reset DB prod/staging |

### Inscriptions

- **Prod** : inscriptions **fermées** par défaut (`registrationMode: 'closed'`). Seuls les comptes existants peuvent se connecter.
- **Msdev** : inscriptions ouvertes + comptes démo pré-seedés.

---

## 7. Workflow dev quotidien

### Agent Cursor — `@onscen-dev-agent`

Pour implémenter bugs, features, refactors :

```
@onscen-dev-agent

Mission : [description]
Scope : [fichiers / périmètre]
Ne pas commit. Rapport en fin de session.
```

Guide complet : [`commun/docs/ONSCEN-DEV-AGENT.md`](./ONSCEN-DEV-AGENT.md) · règle : `.cursor/rules/onscen-dev-agent.mdc`.

L'agent Dev **code et teste** ; il ne décide pas de la stratégie produit ni ne déploie en prod.

### Tests (Vitest)

```powershell
# Frontend
cd web/app
npm test                    # vitest run
npm test -- mobileSalonLiveSafari   # fichier ciblé

# Backend
cd commun/backend
npm test
```

Tests E2E (Playwright, optionnel) : `cd web/app && npm run test:e2e`

### Lint

```powershell
cd web/app && npm run lint
cd commun/backend && npm run lint
```

### Build de vérification

```powershell
cd web/app && npm run build
cd commun/backend && npm run build
```

### Scripts npm utiles (racine)

| Commande | Usage |
|----------|-------|
| `npm run dev` | Dev local complet |
| `npm run msdev:server` | Backend seul (:4080) |
| `npm run app:dev` | Frontend Vite seul (:5173) |
| `npm run backend:build` | Compile le backend |
| `npm run app:build` | Build frontend |
| `npm run deploy:preprod` | Deploy staging (fondateur) |
| `npm run deploy:prod` | Deploy prod (fondateur) |
| `npm run msdev:reset-data` | Reset données msdev locales |

### Scripts PowerShell courants (`commun/scripts/`)

| Script | Usage |
|--------|-------|
| `dev-start.ps1` | Lance dev (appelé par `npm run dev`) |
| `verify-full-access.ps1` | Vérifie accès infra (20+ checks) |
| `deploy-preprod.ps1` | Deploy staging |
| `deploy-prod.ps1` | Deploy prod |
| `setup-staging-env.ps1` | Config env preprod |
| `db-health-check.ps1` | Santé PostgreSQL |
| `stripe-listen-msdev.ps1` | Webhooks Stripe en local |
| `setup-android-sdk.ps1` | SDK Android pour APK |

---

## 8. Domaines clés du produit

### Authentification

- **Fichiers** : `web/app/src/pages/AuthPage.tsx` · `commun/backend/src/lib/accessControl.ts`
- Email/mot de passe, OAuth (Google, Apple, Instagram), WebAuthn (passkeys).
- JWT — migration vers cookies httpOnly en cours (voir `TODO-MANUAL.md` CRIT-01).
- Politique d'inscription configurable (fermée en prod).

### Live et salon

- **Salon YouTube** : `SalonPage.tsx` · sync playback Socket.io · `SalonYouTubePlayer.tsx`
- **Live caméra** : `LivePage.tsx` · LiveKit (`LiveKitVideoStage.tsx`)
- **Live RTMP** : Cloudflare Stream · HLS (`LiveVideoStage.tsx`)
- **Chat** : flottant ou épinglé (`RoomTheaterLayout.tsx`, `FloatingSalonChat.tsx`)
- **Backend** : `commun/backend/src/lib/livekit.ts`, `livePublic.ts`, `pgSalonsLives.ts`

Priorité modes live : LiveKit → Cloudflare Stream → mesh WebRTC + Coturn.

### Carte et globe

- **Carte 2D** : Leaflet · `MapView.tsx`, `components/globe3d/` (vue alternative)
- **Globe 3D** : Three.js · `GlobeView.tsx`, `OnScenGlobeScene.tsx`
- **Géo** : `/api/geo/nearby` · bots msdev (1000 par défaut) · PostGIS en prod
- **Événements** : marqueurs salons, lives, festivals sur carte et globe

### Reels

- **Frontend** : `ReelsTabPage.tsx` · `ProfileReelRecorder.tsx`
- **Backend** : `commun/backend/src/lib/pgReels.ts`
- Feed vertical type TikTok, liens albums/plateformes streaming.

### Sponsors

- Bannières sur fil et carte · admin panel
- **Backend** : migrations `008_sponsors`, `009_sponsors_display_duration`
- **Frontend** : `lib/api/sponsors.ts`, `MapAdBanner.tsx`

### Stripe (paiements)

- **Connect** : comptes créateurs, onboarding Stripe
- **Dons live** · **Abonnements créateurs**
- **Backend** : `commun/backend/src/lib/donations.ts`, routes Stripe webhooks
- **Frontend** : `@stripe/react-stripe-js` · `AdminStripeConfigCard.tsx`
- Msdev : clés test via `commun/scripts/setup-stripe-msdev.ps1`

---

## 9. Documentation à lire

Par ordre de priorité la première semaine :

| Document | Contenu |
|----------|---------|
| **Ce fichier** | Onboarding |
| [`AGENTS.md`](../../AGENTS.md) | Instructions agents Cursor, chemins canoniques |
| [`commun/docs/ONSCEN-DEV-AGENT.md`](./ONSCEN-DEV-AGENT.md) | Workflow agent Dev, rapports de session |
| [`commun/docs/STACK-CIBLE.md`](./STACK-CIBLE.md) | Architecture cible scaling |
| [`commun/docs/INFRA-ONSCEN.md`](./INFRA-ONSCEN.md) | VPS, PG, backups, coûts, LiveKit/CF |
| [`commun/docs/ENVIRONNEMENTS.md`](./ENVIRONNEMENTS.md) | Dev / preprod / prod, fichiers `.env` |
| [`TODO-MANUAL.md`](../../TODO-MANUAL.md) | QA manuelle, tâches sécurité, priorités audit |
| [`commun/msdev/SCALABILITY.md`](../msdev/SCALABILITY.md) | Checklist montée en charge 500k |

Compléments :

- [`commun/deploy/RUNBOOK-PROD.md`](../deploy/RUNBOOK-PROD.md) — procédures prod (lecture)
- [`commun/docs/dev-agent/INDEX.md`](./dev-agent/INDEX.md) — rapports de sessions dev passées
- `.cursor/rules/` — conventions automatiques Cursor

---

## 10. Première semaine — parcours suggéré

### Jour 1 — Environnement

- [ ] Clone + `npm install` + copie `.env.example` → `.env`
- [ ] `npm run dev` → login `listener@msdev.local`
- [ ] Explorer : carte, globe, salon, live, profil, fil, reels
- [ ] Lire ce document + `AGENTS.md` + `ENVIRONNEMENTS.md`

### Jour 2 — Codebase

- [ ] Parcourir `web/app/src/App.tsx` (routing)
- [ ] Parcourir `commun/backend/src/server.ts` (routes principales)
- [ ] Lancer `npm test` frontend et backend
- [ ] Lire `TODO-MANUAL.md` (section QA + CRIT)

### Jour 3 — Premier fix

- [ ] Prendre un petit bug ou tâche `TODO-MANUAL` (non CRIT sans review)
- [ ] Travailler sur une branche `fix/…` ou `feat/…`
- [ ] Tester à 390 px mobile + desktop
- [ ] Entrée `modification.txt` si changement significatif

### Jour 4–5 — Approfondissement

- [ ] Lire un rapport dev récent : `commun/docs/dev-agent/INDEX.md`
- [ ] Lire `STACK-CIBLE.md` (Phase 0–1)
- [ ] QA manuelle : checklist `TODO-MANUAL.md` § « QA manuelle » (globe, live chat épinglé, profil)
- [ ] Optionnel : smoke test live msdev `/live/prod-seed-salon-beat-castel`

### Critères de fin de semaine 1

- Dev local stable sans aide.
- Compréhension des 3 environnements et des interdictions prod.
- Au moins un PR ou patch reviewé par le fondateur.
- Connaissance des conventions mobile-first et `modification.txt`.

---

## 11. Contacts et escalade

| Sujet | Qui contacter |
|-------|---------------|
| Accès secrets (`.env`, Stripe, OAuth) | **Fondateur** — transmission sécurisée, jamais par chat non chiffré |
| Décisions produit / priorisation | Fondateur · agent `@onscen-ceo-ia` pour briefs stratégiques |
| Architecture avant gros chantier | `@onscen-cto` (audit, recommandations — pas d'implémentation) |
| Implémentation code | `@onscen-dev-agent` ou vous directement |
| Deploy prod / SSH prod | Fondateur uniquement |
| Incidents prod | Fondateur — ne pas toucher au VPS sans autorisation |

### Règles de sécurité

- **Secrets jamais dans Git** — `.env`, clés API, mots de passe VPS.
- Fichiers `.env` listés dans `.gitignore` — vérifier avant tout commit.
- SSH prod (`ssh soundy-prod`) : accès **sur demande et validation explicite**.
- En cas de doute sur un changement infra ou données prod : **stopper et escalader**.

---

## 12. État actuel du projet (juillet 2026)

### Produit

- Site public : **https://getsoundy.com** — ~10 utilisateurs prod, MVP actif.
- **Inscriptions prod fermées** — mode `registrationMode: 'closed'` ; connexion des comptes existants uniquement.
- Staging ouvert pour QA : **https://staging.getsoundy.com** (Basic Auth).
- Travail récent : UX live (chat épinglé), carte/globe, présentations stratégie, fermeture inscriptions prod.

### Branches Git

- Branche principale : **`master`** (`origin/HEAD` → `origin/master`).
- Branches feature/fix courantes : `fix/…`, `feat/…`, `test/…`.
- CI GitHub : tests sur PR ; deploy preprod auto après CI verte sur `master`.
- Travailler sur une branche dédiée, PR vers `master`.

### Comptes démo msdev

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| `listener@msdev.local` | `msdev123` | Auditeur showcase (243k followers affichés) |
| `dj@msdev.local` | `msdev123` | Créateur / host |
| `bass@msdev.local` | `msdev123` | Créateur |

### Dette / priorités connues

Voir `TODO-MANUAL.md` :

- **CRIT** : sécurité auth (JWT → cookies httpOnly)
- **Stores mobile** : Sign in with Apple, IAP, Android
- **QA manuelle** : globe, live chat épinglé, profil (checklist juillet 2026)

### Changelog

Le journal complet des modifications est dans `modification.txt` (dernières entrées : MODIF 1280+). Numérotation séquentielle — incrémenter le dernier numéro pour vos contributions.

---

## Checklist arrivée (résumé)

```
□ Node 18+ installé
□ Repo cloné, branche master
□ npm install (racine + web/app + commun/backend)
□ commun/msdev/.env créé depuis .env.example
□ web/app/.env.development créé depuis .env.development.example
□ npm run dev → :5173 + :4080 OK
□ Login listener@msdev.local / msdev123 OK
□ AGENTS.md + ce document lus
□ Conventions mobile-first comprises
□ Pas de deploy prod sans accord
```

---

*Bienvenue dans l'équipe OnScen. En cas de blocage setup, contactez le fondateur avec la sortie de `npm run dev` et de `curl http://localhost:4080/health`.*
