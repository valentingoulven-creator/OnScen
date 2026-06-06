# Soundly — apptel (téléphone, mobile-first)

Ce dossier est la version **mobile-first** de l'application Soundly,
ciblant iOS et Android via **PWA** ou **Capacitor**.

Il est un sibling de `app/` (version desktop/web large écran) et partage
le même backend situé dans `backend/`.

## Différences clés avec `app/` (appweb)

| Aspect | `app/` (appweb) | `apptel/` |
|---|---|---|
| Dev port | 5173 | **4082** |
| Vite base | `/` | **`/tel/`** |
| Build output | `backend/public/` | **`backend/public/tel/`** |
| Layout | Sidebar + large écran | **Pleine largeur, 430 px max** |
| Tap targets | défaut | **≥ 44 px (Apple HIG)** |
| Safe-area | non | **oui** (`env(safe-area-inset-*)`) |
| NearbyPanel | panneau latéral | **bottom sheet** |
| Éléments desktop | visibles | **masqués** (`.desktop-only`) |

## Démarrage

```bash
# Depuis la racine du projet
npm run apptel:dev      # serveur dev → http://localhost:4082/tel/
npm run apptel:build    # build prod → backend/public/tel/
```

Ou depuis ce répertoire :

```bash
npm install
npm run dev     # http://localhost:4082/tel/
npm run build
```

## Déploiement mobile

### PWA (recommandé)
Construire avec `npm run apptel:build`, servir `backend/public/tel/` via
l'Express backend à `/tel/*`. Les utilisateurs peuvent installer depuis le navigateur.

### Capacitor (iOS / Android natif)
1. `npm install @capacitor/core @capacitor/cli`
2. `npx cap init`
3. `npx cap add ios` et/ou `npx cap add android`
4. `npm run build && npx cap sync`
5. Ouvrir dans Xcode / Android Studio

## CSS mobile-first (APPTEL)

`src/index.css` contient le bloc `APPTEL` avec :
- `max-width: 430px` + `margin: 0 auto` pour colonner sur grand écran
- `min-height/min-width: 44px` sur tous les éléments interactifs
- `env(safe-area-inset-*)` sur le body (encoche / home indicator)
- Police de base à 15px pour meilleure lisibilité sur petit écran
- `.bottom-sheet` — utilitaire bottom sheet pour NearbyPanel
- `.desktop-only { display: none }` — masque les panneaux latéraux desktop
- `.nearby-sidebar { display: none }` — pas de sidebar sur téléphone
