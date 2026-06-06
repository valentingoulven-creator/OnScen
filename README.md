# Soundly — Architecture source partagée

## Comment ça marche : une seule source de vérité

```
app/src/          ← SOURCE DE VÉRITÉ  (webapp)
apptel/src/       ← OVERRIDES ONLY    (téléphone)
```

**`app/src/` est le seul endroit où l'on développe.**

Le plugin Vite `apptelSrcFallback` (dans `apptel/vite.config.ts`) fait que :
- Si un fichier existe dans `apptel/src/` → version spécifique téléphone utilisée
- Si absent de `apptel/src/` → le fichier de `app/src/` est chargé automatiquement

**Résultat : toute modification dans `app/src/` est immédiatement visible dans les deux apps, sans aucune action manuelle.**

---

## Règle d'or : où coder quoi ?

| Situation | Où modifier |
|---|---|
| Logique métier, composant partagé, hook, lib | `app/src/` uniquement |
| UI différente sur téléphone (safe-area, taille…) | `apptel/src/<fichier>` (override) |
| Nouvelle feature pour les deux apps | `app/src/` → automatiquement dans les deux |
| Feature web seulement | `app/src/` (pas dans apptel/src) |

---

## Commandes

```bash
# Développement
npm run appweb:dev      # webapp sur http://localhost:5173
npm run apptel:dev      # téléphone sur http://localhost:4082

# Build production
npm run appweb:build
npm run apptel:build

# Diagnostic : voir quels fichiers sont partagés vs overrides
npm run src:status

# Vérifier l'intégrité (aucun doublon parasite)
npm run src:check

# Nettoyer les éventuels doublons dans apptel/src (si quelqu'un a copié par erreur)
npm run src:clean       # effectue les suppressions
npm run src:clean:dry   # aperçu sans écriture
```

---

## Quand faire quoi

### Modifier un composant existant (ex: SalonPlaybackPanel)

`SalonPlaybackPanel.tsx` est partagé (pas dans `apptel/src/`).

```bash
# 1. Modifier app/src/components/SalonPlaybackPanel.tsx
# 2. Les deux apps voient la modif automatiquement
# 3. Tester les deux :
npm run appweb:dev
npm run apptel:dev
```

### Ajouter un nouveau composant

```bash
# 1. Créer app/src/components/NouveauComposant.tsx
# 2. L'importer dans les fichiers qui en ont besoin
# → disponible immédiatement dans apptel via le plugin Vite
# → si TypeScript se plaint, lancer : npm run src:sync
```

### Modifier un override téléphone

Les overrides sont les fichiers dans `apptel/src/`. Ce sont les 23 fichiers avec UI ou comportement volontairement différent sur téléphone.

```bash
# Pour voir la liste : npm run src:status
# Pour modifier : éditer directement apptel/src/<fichier>
```

### Ajouter un nouvel override téléphone

Si vous avez modifié `app/src/Foo.tsx` et voulez une version téléphone différente :

```bash
# 1. Copier app/src/Foo.tsx → apptel/src/Foo.tsx
# 2. Modifier apptel/src/Foo.tsx pour les spécificités mobile
# 3. Ajouter 'Foo.tsx' à PROTECTED dans scripts/sync-src.js
```

---

## Fichiers overrides téléphone (`apptel/src/`)

Ces 23 fichiers ont une implémentation volontairement différente :

| Fichier | Raison |
|---|---|
| `index.css` | Styles spécifiques téléphone (safe-area, polices…) |
| `App.tsx` | Onglet par défaut différent, pas de GlobeView |
| `main.tsx` | Ordre d'initialisation légèrement différent |
| `types.ts` | Types adaptés au mobile |
| `components/MapView.tsx` | Version allégée sans Globe 3D ni MarkerCluster |
| `components/ChatPanel.tsx` | UI chat adaptée au mobile |
| `components/NearbyPeoplePanel.tsx` | Panneau repensé pour petit écran |
| `components/NotificationBell.tsx` | Version mobile |
| `components/MainTabNav.tsx` | Ordre des onglets différent (Carte en premier) |
| `components/FloatingSalonChat.tsx` | Poignée resize plus petite sur mobile |
| `components/RoomTheaterLayout.tsx` | Pas de safe-area-inset sur la version tel |
| `pages/HomePage.tsx` | Page d'accueil allégée |
| `pages/DmPage.tsx` | Messages directs version mobile |
| `pages/SalonPage.tsx` | Salon version mobile (safe-area-inset) |
| `pages/ActualiteTabPage.tsx` | Actualités allégées |
| `pages/LivePage.tsx` | Lives version mobile |
| `pages/UserProfilePage.tsx` | Profil version mobile |
| `lib/api.ts` | API avec endpoints adaptés |
| `lib/feedUserPrefs.ts` | Préférences feed mobile |
| + 4 autres | (voir `npm run src:status`) |

---

## Architecture interne

```
MeloSong Dev/
├── app/                  ← webapp (source de vérité)
│   └── src/              ← ~170 fichiers partagés
├── apptel/               ← téléphone
│   ├── src/              ← 23 fichiers overrides UNIQUEMENT
│   ├── vite.config.ts    ← contient le plugin apptelSrcFallback
│   └── tsconfig.app.json ← rootDirs: ["src", "../app/src"]
├── scripts/
│   └── sync-src.js       ← diagnostic + sync manuel
└── package.json
```

Le plugin Vite et `rootDirs` TypeScript fonctionnent ensemble :
- **Build/Dev** : le plugin Vite intercepte les imports et redirige vers `app/src` si le fichier est absent de `apptel/src`
- **TypeScript** : `rootDirs` fait la même chose pour la vérification de types
