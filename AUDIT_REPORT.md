# AUDIT REPORT — Soundy / MeloSongv2
**Date :** 2026-06-22  
**Auditeur :** Équipe fictive CTO · Architecte · QA · UX · Performance · Streaming  
**Version analysée :** état courant branche principale (modification.txt : MODIF 590)  
**Score global : 67 / 100**

---

## TABLE DES MATIÈRES
1. [Architecture globale](#1-architecture-globale)
2. [Qualité du code](#2-qualité-du-code)
3. [Performance](#3-performance)
4. [Gestion des erreurs](#4-gestion-des-erreurs)
5. [Architecture temps réel](#5-architecture-temps-réel)
6. [Architecture streaming](#6-architecture-streaming)
7. [Tests](#7-tests)
8. [UX/UI — Comparaison concurrents](#8-uxui--comparaison-concurrents)
9. [Rapport de test fonctionnel](#9-rapport-de-test-fonctionnel)
10. [Audit du système Live](#10-audit-du-système-live)
11. [Audit Salons YouTube](#11-audit-salons-youtube)
12. [Scalabilité](#12-scalabilité)
13. [Top 20 problèmes critiques](#13-top-20-problèmes-critiques)
14. [Top 20 améliorations](#14-top-20-améliorations)

---

## 1. Architecture globale

### 1.1 Vue d'ensemble

```
app/ (React 19 + Vite 8 + Tailwind v4 PWA)
  ↓  builds to backend/public/
backend/ (Express 4 + Socket.io 4 + PostgreSQL)
  ↓  real-time
apptel/ (Capacitor 8 Android/iOS)
```

**Points forts :**
- Monorepo bien structuré, séparation `app/` / `backend/` / `apptel/`
- Tailwind v4 (pointe), React 19 (pointe)
- PWA + Capacitor mobile = couverture plateforme large
- Auth multi-couches : JWT httpOnly cookie + WebAuthn + 2FA + OAuth
- Multiple modes streaming (WebRTC mesh, LiveKit SFU, Cloudflare HLS)

**Points faibles :**
- **Pas de React Router pour la navigation principale** — navigation 100% state dans `App.tsx`. Impossible de partager des URLs directes pour la plupart des vues, pas de gestion du bouton Retour navigateur sur /live/:id ou /salon/:id.
- **`api.ts` monolithique** (~2 200 lignes). Un seul fichier pour toutes les requêtes API. Maintenabilité très faible.
- **Deux stores de données incompatibles** : JSON flat-file (msdev) vs PostgreSQL (prod). Risque de divergences de comportement en développement non détectées en production.
- **`index.css` de 3 200 lignes** — mélange Tailwind, Leaflet, CSS custom, classes utilitaires. Maintenu manuellement.
- **`types.ts` de ~1 200 lignes** — fichier de types global, pas de co-location avec les modules.

### 1.2 Frontend

| Critère | Note | Commentaire |
|---------|------|-------------|
| Structure pages | 7/10 | 25+ pages correctement séparées |
| Structure composants | 6/10 | 168 composants, peu de répertoires de groupement |
| Hooks | 8/10 | Bonne séparation logique/vue |
| Lib utilities | 5/10 | 197 fichiers lib, granularité incohérente |
| State management | 6/10 | Context + local state OK pour cette taille, mais App.tsx gère trop |
| Navigation | 4/10 | State-driven, pas de URL-based routing |
| Bundle splitting | 7/10 | Manual chunks bien configurés |
| i18n | 7/10 | Couvre fr/en, mais pas toutes les chaînes |

### 1.3 Backend

| Critère | Note | Commentaire |
|---------|------|-------------|
| Structure routes | 7/10 | ~40 fichiers routes, bien séparés |
| Auth | 8/10 | JWT + httpOnly cookie + WebAuthn + 2FA |
| Base de données | 5/10 | JSONB payload pattern — flexibilité aux dépens des contraintes |
| Migrations | 6/10 | 17 migrations SQL, mais gestion manuelle |
| Middleware | 8/10 | Helmet, CORS, rate limits, compression |
| Gestion erreurs | 6/10 | Global error handler présent, mais couverture inégale |
| Tests | 3/10 | Tests partiels, pas de couverture API complète |

### 1.4 Dette technique estimée

| Catégorie | Impact | Effort de remédiation |
|-----------|--------|----------------------|
| `api.ts` monolithique | Moyen | 2-3j — découpage par domaine |
| Navigation state-only | Élevé | 3-5j — migration React Router |
| `index.css` non structuré | Faible | 1-2j — extraction en modules CSS |
| `types.ts` non co-localisé | Faible | 2j — refactoring modules |
| Stockage dev vs prod | Élevé | ~~déjà géré par abstraction~~ risque subsiste |
| Tests manquants | Élevé | Continu |
| `App.tsx` trop volumineux | Moyen | 2j — extraction gestion overlays |

---

## 2. Qualité du code

### 2.1 Bonnes pratiques constatées

- TypeScript strict partout (frontend + backend)
- ESLint configuré (`eslint` 10, `@typescript-eslint`)
- Hooks React respectés (après la correction MODIF 588)
- Lazy loading généralisé pour les pages lourdes
- `createPortal` pour les menus clippés par overflow
- `useCallback`/`useMemo` utilisés dans les hooks critiques
- Mobile-first CSS (règles `dvh`, `safe-area-inset`)

### 2.2 Problèmes de qualité détectés

#### P1 — Critique
- **`react-router-dom` installé mais non utilisé** : dépendance morte dans `package.json`. Possible future confusion.
- **WebRTC mesh limité à 30 viewers** : au-delà, les nouveaux spectateurs ne reçoivent pas le flux vidéo sans que l'UI ne le signale clairement.
- **Absence de reconnexion WebSocket robuste** : si Socket.io se déconnecte pendant un live, les spectateurs peuvent perdre le chat/sync sans notification visible.

#### P2 — Majeur
- **Uploads en base64 JSON** : pas de multipart, les images/audio sont encodés en base64 dans le corps JSON. Inefficace (ratio 4/3), stress mémoire serveur pour gros fichiers.
- **`purgeUnboundedChatHistory()`** : sans limite dure sur les messages en mémoire, un live très actif peut OOM le processus.
- **`App.tsx` gère trop d'état** : état du salon, du live, des overlays, des tabs, de la navigation. Couplage fort, réactivité difficile à raisonner.
- **Manque de boundary d'erreur sur LivePage** : une exception dans le rendu de `LivePage` plante toute l'app.

#### P3 — Mineur
- **`ALLOW_YOUTUBE_REMOTE_FALLBACK`** : fallback YouTube non officiel gated par env var — OK en dev, mais la tentation de l'activer en prod existe.
- **Pas de skeleton loading** sur la plupart des pages (juste un spinner ou rien).
- **`api.ts` ne gère pas l'annulation de requêtes** (AbortController) — fuites mémoire potentielles sur navigation rapide.
- **Images de profil traitées côté client** uniquement — pas de re-processing serveur, taille variable.

### 2.3 Maintenabilité

- **Score : 58/100**
- Modification log (`modification.txt`) est une bonne pratique interne mais non standard.
- Pas de Storybook ou design system documenté.
- 168 composants sans catégories de dossiers — difficulté de découverte.
- Test coverage faible = régression non détectée facilement.

---

## 3. Performance

### 3.1 Frontend

| Méthode | Situation actuelle |
|---------|--------------------|
| Code splitting | ✅ Manuel chunks bien configurés |
| Lazy loading pages | ✅ `React.lazy()` généralisé |
| Lazy loading images | ⚠️ Partiel — pas d'`IntersectionObserver` systématique |
| Virtualisation listes | ❌ Aucune liste virtualisée (reels, chat, feed) |
| Memoization composants | ⚠️ Hooks memoized, composants non systématiquement |
| AbortController | ❌ Absent sur les fetches |
| PWA cache | ✅ Workbox, assets immutables |

**Taille bundle (production estimée) :**

| Chunk | Taille gzip |
|-------|------------|
| `vendor-misc` (lodash-like + misc) | ~576 kB |
| `vendor-globe` | ~516 kB |
| `vendor-heic2any` | ~344 kB |
| `vendor-livekit` | ~121 kB |
| `index` (app core) | ~73 kB |
| `vendor-react` | ~71 kB |

> ⚠️ `vendor-misc` et `vendor-globe` sont très lourds. Globe pourrait être en option uniquement sur desktop. `heic2any` n'est utile qu'à l'upload photo.

### 3.2 Backend

| Domaine | État |
|---------|------|
| Compression HTTP | ✅ `compression()` middleware |
| Cache assets statiques | ✅ `immutable` 1 an sur assets hachés |
| Cache API | ✅ YouTube (1h), news, trending |
| Index BDD | ✅ FTS, geo, GIN sur tags |
| Requêtes N+1 | ⚠️ Non auditable sans profiler en live |
| Connection pooling | ✅ `pg` pool |
| Geo nearby O(n) | ⚠️ Scan complet à optimiser sur grande base |

### 3.3 First Contentful Paint (estimé)

En dev ≈ 300ms (Vite HMR).  
En prod (VPS + Caddy + compression) : FCP estimé **< 1.5s** sur 4G, **< 0.6s** sur fibre (bundle initial ~73 kB gzip + PWA).

---

## 4. Gestion des erreurs

### 4.1 Frontend

| Composant | Couverture erreur |
|-----------|-------------------|
| `AppErrorBoundary` | ✅ Composant présent (scope app) |
| `LivePage` | ⚠️ Pas de boundary spécifique |
| `SalonPage` | ⚠️ Pas de boundary spécifique |
| API errors | ✅ `parseApiError()` → i18n messages |
| WebRTC errors | ✅ `mapLiveCameraError()` |
| Upload errors | ✅ Messages utilisateurs définis |
| Socket disconnect | ⚠️ Reconnexion auto Socket.io, mais UX silencieuse |

### 4.2 Backend

- Global error handler en fin de middleware chain ✅
- Erreurs non capturées (unhandled promise) : présence de `.catch()` dans la plupart des routes, mais non systématique
- Logs : basique `console.error` — pas de logging structuré (Winston, Pino) ni de monitoring (Sentry, Datadog)
- Alertes email via `alertNotifier.ts` pour les erreurs critiques serveur ✅

### 4.3 Risques de perte de données

| Scénario | Risque |
|----------|--------|
| Crash backend pendant un live | Chat perdu (en mémoire) |
| Crash backend pendant upload composition | Données partiellement écrites |
| Déconnexion WebRTC pendant live | Spectateurs sans fallback clair |
| Expiration JWT mid-session | Socket déconnecté silencieusement |

---

## 5. Architecture temps réel

### 5.1 Socket.io

**Points forts :**
- JWT middleware sur connexion
- Rooms bien structurées (`user_*`, `salon_*`, `live_*`)
- Rate limiting chat
- Validation senderId ≠ spoofing

**Points faibles :**
- **Aucun message de backfill** : si un client se reconnecte après un drop, il perd les messages émis pendant la déconnexion (pas de séquence / curseur).
- **Pas de heartbeat applicatif** visible côté frontend pour détecter les zombies connections.
- **Absence de namespace séparation** : tout dans le namespace `/` — difficile d'isoler les préoccupations (salon vs live vs DM).
- **Présence des events** : `presence` event envoyé à tout `user_{id}` room — pas de batching, peut générer du bruit sur grande base.

### 5.2 WebRTC mesh

- **Limite 30 viewers** : au-delà, pas de stream vidéo (ni message clair côté UX)
- **Pas de SFU fallback automatique** : si les 30 viewers sont atteints, le mode LiveKit n'est pas proposé automatiquement
- **ICE Servers** : Google STUN + TURN optionnel — sans TURN, les utilisateurs derrière NAT strict échouent silencieusement
- **Mesh n-to-n** : la bande passante upload du host est le goulot d'étranglement. 30 viewers × ~1 Mbps = 30 Mbps upload requis. Irréaliste en pratique pour la majorité des connexions résidentielles.

**Recommandation urgente :** switcher automatiquement sur LiveKit SFU dès que les viewers > 5-10.

---

## 6. Architecture streaming

### 6.1 Modes disponibles

| Mode | Technologie | Limite | Latence | Qualité |
|------|-------------|--------|---------|---------|
| WebRTC mesh | Navigateur natif | 30 viewers | < 500ms | Variable |
| LiveKit SFU | LiveKit cloud | Illimité (payant) | < 1s | Stable |
| Cloudflare HLS | HLS.js | Illimité | 10-30s | Stable |
| Fichier local | `<video>` | Local seulement | 0 | HD |

### 6.2 Problèmes détectés

- **Sélection du mode non transparente** : l'utilisateur ne comprend pas quel mode est actif ni ses limites
- **OBS uniquement via Cloudflare** : les streamers habitués à OBS sont limités au plan SoundyUltra
- **Pas de qualité adaptative (ABR)** en WebRTC mesh — une mauvaise connexion host dégrade l'expérience de tous
- **Cloudflare HLS : latence 10-30s** — incompatible avec l'aspect "temps réel" et les interactions live (dons, chat)
- **Egress LiveKit → Cloudflare** : double service, double coût, double point de failure

---

## 7. Tests

### 7.1 État actuel

| Type | Fichiers trouvés | Couverture |
|------|-----------------|------------|
| Unit tests (Vitest) | `liveCameraSupport.test.ts`, `sponsorAds.test.ts`, `stripeConnectSkip.test.ts`, `pwaManifest.test.ts`, `liveCameraSupport.test.ts` | < 5% |
| Tests agents | `tests/agents/` (admin, donor, newUser, powerUser) | Scénarios E2E partiels |
| Tests API backend | Partiel (Vitest) | Non quantifié |
| Tests de charge | `docs/` (load-test output) | Présent |

### 7.2 Manques critiques

- Aucun test sur les flux WebRTC
- Aucun test sur les paiements Stripe
- Aucun test sur les webhooks
- Aucun test sur les WebSockets
- Aucun test E2E automatisé (Playwright/Cypress)
- CI/CD non visible dans le dépôt

---

## 8. UX/UI — Comparaison concurrents

### 8.1 Comparaison fonctionnelle

| Fonctionnalité | Soundy | TikTok Live | Instagram Live | Twitch |
|----------------|--------|-------------|----------------|--------|
| Vidéo live host | ✅ | ✅ | ✅ | ✅ |
| Chat live | ✅ | ✅ | ✅ | ✅ |
| Dons/cadeaux | ✅ (partiel) | ✅✅ | ✅ | ✅✅ |
| Co-host | ❌ | ✅ | ✅ | ✅ |
| Screenshare | ❌ | ❌ | ❌ | ✅ |
| Questions/réponses | ❌ | ✅ | ✅ | ❌ |
| Polls/sondages | ❌ | ✅ | ✅ | ✅ |
| Clips/highlights | ❌ | ✅ | ❌ | ✅ |
| VOD replay | ❌ | ✅ | ✅ | ✅ |
| Subscriptions host | ✅ | ✅ | ❌ | ✅✅ |
| Tableau de bord live | ✅ | ✅ | ✅ | ✅✅ |
| Notif push live | ✅ | ✅ | ✅ | ✅ |
| Mode nuit/filtre | ❌ | ✅ | ✅ | — |
| Modération IA | ❌ | ✅ | ✅ | ✅ |
| Salons YouTube | ✅ (unique) | ❌ | ❌ | ❌ |
| Carte géo | ✅ (unique) | ❌ | ❌ | ❌ |

**Différenciateur unique de Soundy :** salons YouTube géolocalisés = USP fort. Personne d'autre ne propose ça.

### 8.2 Friction UX détectée

| Friction | Sévérité | Description |
|----------|----------|-------------|
| Démarrage live complexe | Élevée | Plusieurs modaux avant de diffuser (setup caméra, termes, Stripe) |
| Aucune URL partageable pour live/salon | Critique | Impossible de linker directement `/live/abc123` dans un navigateur externe |
| Mode offline non communiqué | Moyenne | PWA installable mais pas d'écran offline explicite |
| Long scroll dans le menu Board | Faible | Menu live paramètres dense sur petits écrans |
| Pas de skeleton loader | Moyenne | Flashes de contenu vide sur chargement |
| Contrôles live desktop vs mobile | Moyenne | Expérience incohérente entre viewports |
| Viewer > 30 : flux vidéo coupé silencieusement | Critique | Aucun message d'erreur pour les viewers manquants |

---

## 9. Rapport de test fonctionnel

### 9.1 Bugs critiques

| # | Composant | Description | Reproduction |
|---|-----------|-------------|-------------|
| BUG-001 | `LivePage` | Viewers 31+ ne reçoivent pas le flux WebRTC sans message d'erreur | Rejoindre un live avec 30 viewers actifs |
| BUG-002 | Navigation | Pas d'URL canonique pour live/salon — lien partagé via `ShareLinkMenu` redirige vers la page d'accueil, pas le live | Copier l'URL du navigateur depuis un live |
| BUG-003 | `BoardMenuButton` | Si `refreshMediaDevices()` échoue (permission refusée), pas de feedback utilisateur | Refuser permissions caméra et ouvrir le menu Board |
| BUG-004 | WebRTC | Si le host perd sa connexion socket, les viewers restent bloqués en `connecting` sans timeout utilisateur explicite | Couper le réseau du host 10s |
| BUG-005 | Upload | Composition audio en base64 > 10 MB peut dépasser la limit JSON du body et retourner 413 sans message clair | Uploader un fichier audio > 10 MB |

### 9.2 Bugs majeurs

| # | Composant | Description |
|---|-----------|-------------|
| BUG-006 | `DmPage` | Pas de pagination des messages DM — une conversation ancienne longue charge tout en mémoire |
| BUG-007 | `SalonPage` | Si le YouTube Player échoue à charger (cookie/GDPR blocker), aucun fallback affiché |
| BUG-008 | `ReelsTabPage` | Absence de virtualisation de la liste de reels — > 100 reels = dégradation notable |
| BUG-009 | `LiveHostQuickBar` | En mode `footer`, `StopLiveButton` apparaît deux fois (dans `footerButtons` ET potentiellement en `compact=false`) |
| BUG-010 | `LivePage` | `onBoardMenuOpen` déclenche `refreshMediaDevices()` à chaque toggle du menu, même quand caméra inactive (requête inutile) |
| BUG-011 | `api.ts` | Aucun `AbortController` — si l'utilisateur navigue rapidement, plusieurs requêtes en vol peuvent setter du state sur un composant démonté |

### 9.3 Bugs mineurs

| # | Composant | Description |
|---|-----------|-------------|
| BUG-012 | `AuthPage` | Bouton de connexion reste cliquable pendant le chargement (double-submit possible) |
| BUG-013 | `MapView` | Les marqueurs de salons/lives ne se mettent pas à jour en temps réel (poll ou refresh manuel requis) |
| BUG-014 | `StoryViewer` | Barre de progression story se réinitialise si l'onglet est en arrière-plan puis redevient actif |
| BUG-015 | `ProfilePhotoViewer` | Pas de lazy loading sur la galerie de photos — toutes les images chargées à l'ouverture |

### 9.4 Incohérences UX

| # | Description |
|---|-------------|
| UX-001 | Le bouton "Arrêter le live" est maintenant centré dans la top bar — risque d'appui accidentel |
| UX-002 | Textes mélangés FR/EN dans certains composants (quelques hardcoded strings anglaises) |
| UX-003 | `MsdevEnvBadge` visible en dev mais potentiellement exposé si env variables mal configurées en prod |
| UX-004 | Pas de mode sombre/clair — app 100% dark, pas de préférence système respectée |
| UX-005 | Pas de confirmation pour quitter un salon en cours d'écoute |

---

## 10. Audit du système Live

### 10.1 Création de live

- **Flow :** `LivesTabPage` → `StartLiveMediaSetupModal` → permissions → prefs → `POST /api/lives/start`
- **Problème :** 4 étapes avant de commencer à streamer (sélection caméra, termes légaux, Stripe check, paramètres). TikTok : 1 tap.
- **Recommandation :** mémoriser les préférences, skip les étapes déjà validées.

### 10.2 Arrêt de live

- `POST /api/lives/stop` + socket `live_ended` ✅
- Confirmation modal présente ✅
- **Problème :** si le host ferme l'onglet sans cliquer "Arrêter", le live reste actif côté serveur jusqu'au prochain `disconnect` socket (plusieurs secondes).
- **Manque :** pas d'enregistrement automatique (VOD). Le live est perdu après arrêt.

### 10.3 Synchronisation temps réel

- Playback salon : `sync_playback` + `salon_playback` ✅
- Chat : Socket.io rooms ✅
- Presence : `presence` event ✅
- **Problème :** pas de séquençage des messages — si deux messages arrivent simultanément, l'ordre n'est pas garanti côté client.

### 10.4 Gestion des viewers

- Compteur `viewers` maintenu via socket ✅
- VIP modérateurs avec permissions étendues ✅
- Bans temporaires et permanents ✅
- **Problème :** pas de liste persistée des viewers (au-delà de la mémoire session)
- **Manque :** pas de "wave" (notification privée au host qu'un viewer veut interagir)

### 10.5 Gestion du chat live

- Rate limiting ✅
- Modération (delete, ban) ✅
- **Problème :** chat non paginé — messages en mémoire uniquement, perdus à l'arrêt du live
- **Manque :** pas d'emojis/réactions rapides en overlay (comme TikTok)
- **Manque :** pas d'épinglage de message

### 10.6 Gestion des dons

- Stripe PaymentIntent + Connect ✅
- Animations cadeaux ✅
- **Problème :** pas de paliers de dons suggérés visibles pendant le live
- **Problème :** flow Stripe Connect long pour les créateurs (KYC Stripe)

### 10.7 Points de rupture identifiés

| Point | Seuil estimé | Impact |
|-------|-------------|--------|
| WebRTC mesh | 30 viewers | Pas de vidéo au-delà |
| Chat mémoire | ~500 messages/h | OOM sur lives très actifs |
| Socket.io mono-process | ~3 000 connexions simultanées | Saturation CPU |
| Uploads base64 | Fichiers > 8 MB | 413 / OOM |

---

## 11. Audit Salons YouTube

### 11.1 Utilisation actuelle

| Usage | Conformité | Détails |
|-------|-----------|---------|
| IFrame Player API (embed) | ✅ **Autorisé** | Usage standard, respecte les TOS YouTube |
| YouTube Data API v3 (recherche) | ✅ **Autorisé** | Dans les quotas (10 000 unités/jour par défaut) |
| Cache résultats API (1h) | ✅ **Conforme** | YouTube API Policy autorise le cache ≤ 24h |
| oEmbed pour métadonnées | ✅ **Autorisé** | Service public non authentifié |
| `ALLOW_YOUTUBE_REMOTE_FALLBACK` | ⚠️ **RISQUE** | Scraping non officiel si activé — violation TOS |
| Playback synchronisé multi-users | ⚠️ **ZONE GRISE** | Voir analyse détaillée section §11.3 |
| Attribution "Powered by YouTube" | ✅ **Requis et présent** | `OpenOnYoutubeButton.tsx` |

### 11.2 Conformité App Store / Google Play

| Règle | Soundy | Conformité |
|-------|--------|-----------|
| YouTube TOS §4C : pas d'utilisation commerciale de l'IFrame sans accord | ⚠️ Publicités sponsor dans les salons | **Risque** |
| Attribution YouTube obligatoire | ✅ Présente | **Conforme** |
| Pas de téléchargement ou capture de contenu | ✅ Pas de download | **Conforme** |
| Respect des droits d'auteur DMCA | ⚠️ Pas de Content ID dans salons | **Risque** |
| Pas de modification de l'IFrame Player | ✅ Pas de modification | **Conforme** |

### 11.3 Zone grise : playback synchronisé

La synchronisation de lecture YouTube entre plusieurs utilisateurs dans un "salon" est une fonctionnalité non explicitement couverte par les YouTube API Terms. Elle est techniquement possible avec l'IFrame API mais **n'est pas expressément autorisée ni interdite**. Des services similaires (Watch2Gether, YouTube Watch Party via Prime Video Channels partenariat) existent, mais YouTube n'a pas de programme officiel pour les tiers.

**Risque :** si YouTube considère que cela constitue une "redistribution" ou une "diffusion publique synchronisée", cela pourrait violer :
- YouTube API Services Terms §4.F : "You must not use the YouTube API Services to modify, alter, or create derivative works..."
- YouTube TOS §6 : droits limités accordés à l'utilisateur pour usage personnel

**Recommandation :** consulter un avocat spécialisé TOS / API. Envisager un partenariat YouTube officiel.

### 11.4 Risques quota

- Default : 10 000 unités/jour (1 recherche = 100 unités → **100 recherches/jour max**)
- À 10 000 utilisateurs actifs : quota atteint en quelques minutes
- **Recommandation critique :** demander une augmentation de quota YouTube ou implémenter un système de file d'attente + cache distribué agressif.

---

## 12. Scalabilité

### 12.1 Estimations par palier

| Utilisateurs | CPU | RAM | BW | WebSocket | BD | État |
|-------------|-----|-----|----|-----------|----|------|
| 100 | < 5% | ~200 MB | < 1 Mbps | ~100 | Minimal | ✅ OK |
| 1 000 | ~20% | ~500 MB | ~10 Mbps | ~1 000 | Faible | ✅ OK |
| 10 000 | ~80% | ~2 GB | ~100 Mbps | ~5 000 | Moyen | ⚠️ Limite |
| 100 000 | ❌ Saturation | OOM | ~1 Gbps | ❌ OOM | Élevé | ❌ Impossible mono-process |
| 1 000 000 | N/A | N/A | N/A | N/A | N/A | ❌ Architecture à revoir |

### 12.2 Architecture cible pour 100 000+ utilisateurs

```
                    Load Balancer (HAProxy / Cloudflare)
                            │
           ┌────────────────┼────────────────┐
           │                │                │
       API nodes        API nodes        API nodes
    (Express stateless) (3+ instances)
           │                │                │
    ┌──────┴──────┐          │          ┌────┴──────┐
    │   Redis     │◄─────────┴─────────►│  Redis    │
    │(Pub/Sub     │                     │  cluster  │
    │ Socket.io   │                     │           │
    │ adapter)    │                     └───────────┘
    └──────┬──────┘
           │
    ┌──────┴──────┐
    │ PostgreSQL  │
    │ + replicas  │
    │ + PgBouncer │
    └─────────────┘
           │
    LiveKit SFU (cloud) pour tous les lives > 10 viewers
```

**Changements nécessaires :**
1. **Socket.io Redis adapter** — actuellement in-process, multi-instance impossible
2. **LiveKit SFU** comme mode par défaut (pas WebRTC mesh)
3. **PostgreSQL replicas** lecture/écriture séparées
4. **Cache Redis** pour les recherches YouTube, sessions, présence
5. **File d'attente** (BullMQ/Redis) pour uploads, emails, notifications
6. **CDN** pour les assets uploads (compositions, photos)

---

## 13. Top 20 problèmes critiques

| # | Sévérité | Domaine | Problème |
|---|----------|---------|---------|
| 1 | 🔴 Critique | Navigation | Pas d'URL canonique — impossible de partager un lien direct vers un live/salon |
| 2 | 🔴 Critique | Scalabilité | Socket.io in-process — 1 seule instance possible |
| 3 | 🔴 Critique | Streaming | WebRTC mesh limité à 30 viewers sans fallback automatique |
| 4 | 🔴 Critique | Performance | Listes non virtualisées (reels, chat, DM) — dégradation sur mobile bas de gamme |
| 5 | 🔴 Critique | YouTube | Quota Data API 10 000 unités/jour — insuffisant dès 1 000 users actifs |
| 6 | 🔴 Critique | YouTube | `ALLOW_YOUTUBE_REMOTE_FALLBACK` = scraping en violation des TOS YouTube |
| 7 | 🔴 Critique | Données | Pas de VOD — les lives ne sont pas enregistrés |
| 8 | 🔴 Critique | Tests | Coverage < 5% — régressions non détectées |
| 9 | 🟠 Majeur | UX | Démarrage live trop complexe (4 étapes) |
| 10 | 🟠 Majeur | Erreurs | Viewer > 30 : flux coupé sans message d'erreur |
| 11 | 🟠 Majeur | Code | `api.ts` ~2 200 lignes — maintenabilité critique |
| 12 | 🟠 Majeur | Sécurité | Uploads base64 — stress mémoire + limite 15 MB JSON |
| 13 | 🟠 Majeur | Temps réel | Pas de backfill messages Socket.io après reconnexion |
| 14 | 🟠 Majeur | Backend | Pas de logging structuré (Winston/Pino) ni de Sentry |
| 15 | 🟠 Majeur | Live | Chat live non persisté — perdu à l'arrêt |
| 16 | 🟠 Majeur | Légal | Playback YouTube synchronisé = zone grise juridique non clarifiée |
| 17 | 🟠 Majeur | Performance | Absence d'`AbortController` dans `api.ts` |
| 18 | 🟡 Moyen | UX | Pas de VOD replay — perte de contenu créateur |
| 19 | 🟡 Moyen | Mobile | HEIC → 344 kB gzip dans le bundle — lourd pour tous les utilisateurs |
| 20 | 🟡 Moyen | CI/CD | Pas de pipeline CI visible — pas de tests automatiques sur PR |

---

## 14. Top 20 améliorations

| # | Priorité | Impact | Domaine | Amélioration |
|---|----------|--------|---------|--------------|
| 1 | 🔥 Urgent | Élevé | Navigation | Migrer vers React Router — URLs canoniques pour live/salon/profile |
| 2 | 🔥 Urgent | Élevé | Streaming | Auto-switch LiveKit SFU quand viewers > 10 |
| 3 | 🔥 Urgent | Élevé | YouTube | Cache Redis + queue pour contourner quota 10k/jour |
| 4 | 🔥 Urgent | Élevé | Live | VOD automatique via Cloudflare Stream |
| 5 | 🔥 Urgent | Élevé | Scalabilité | Socket.io Redis adapter |
| 6 | 📈 Haute | Élevé | Performance | Virtualiser listes (TanStack Virtual) |
| 7 | 📈 Haute | Élevé | Tests | Ajouter Playwright E2E + Vitest 50% coverage |
| 8 | 📈 Haute | Moyen | UX | Réduire le démarrage live à 1 tap (prefs mémorisées) |
| 9 | 📈 Haute | Moyen | Monitoring | Intégrer Sentry + logging structuré (Pino) |
| 10 | 📈 Haute | Moyen | Code | Découper `api.ts` par domaine |
| 11 | 📌 Normale | Élevé | Live | Co-host / invite viewer sur scène |
| 12 | 📌 Normale | Élevé | Engagement | Polls/sondages temps réel pendant un live |
| 13 | 📌 Normale | Élevé | Engagement | Réactions flottantes en overlay (comme TikTok) |
| 14 | 📌 Normale | Moyen | UX | Skeleton loaders systématiques |
| 15 | 📌 Normale | Moyen | Uploads | Migrer vers multipart/form-data (remplacer base64) |
| 16 | 📌 Normale | Moyen | Chat | Pagination + historique persisté des chats live |
| 17 | 📌 Normale | Moyen | Sécurité | `AbortController` dans `api.ts` |
| 18 | 📌 Normale | Faible | Bundle | Exclure `vendor-globe` du critical path (desktop only) |
| 19 | 📌 Normale | Faible | UX | Respect `prefers-color-scheme` (mode clair optionnel) |
| 20 | 💡 Bonus | Élevé | Innovation | Clips automatiques des moments forts (IA) |

---

## Score détaillé

| Domaine | Note /100 |
|---------|----------|
| Architecture frontend | 65 |
| Architecture backend | 70 |
| Qualité du code | 62 |
| Sécurité | 74 |
| Performance | 60 |
| Tests | 25 |
| UX/UI | 68 |
| Scalabilité | 45 |
| Streaming | 65 |
| Conformité légale | 58 |
| **GLOBAL** | **67** |

---

*Rapport généré le 2026-06-22. Révision recommandée après chaque milestone majeur.*
