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

### Capacitor (iOS / Android natif) — configuré
Paquets : `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios` (^8.4).

```bash
# Depuis la racine MeloSong Dev
npm run msdev:sync-lan          # MOBILE_API_URL dans msdev/.env
npm run capacitor:build         # apptel/dist + API LAN injectée
npm run capacitor:sync          # copie vers android/ et ios/

# APK debug (Windows + Android Studio / JDK)
npm run capacitor:android:apk
# ou double-clic Smartphone/INSTALLER-ANDROID.bat
```

- `capacitor.config.json` : `appId` `com.soundy.app`, `appName` `Soundy`, `webDir` `dist`
- Build PWA web classique : `npm run build` → `backend/public/tel/` (inchangé)
- Build natif : `npm run build:capacitor` → `dist/` (base relative, pas de service worker)
- iPhone : compilation uniquement sur Mac + Xcode (voir `Smartphone/LISEZMOI-iPhone-NATIF.txt`)

## CSS mobile-first (APPTEL)

`src/index.css` contient le bloc `APPTEL` avec :
- `max-width: 430px` + `margin: 0 auto` pour colonner sur grand écran
- `min-height/min-width: 44px` sur tous les éléments interactifs
- `env(safe-area-inset-*)` sur le body (encoche / home indicator)
- Police de base à 15px pour meilleure lisibilité sur petit écran
- `.bottom-sheet` — utilitaire bottom sheet pour NearbyPanel
- `.desktop-only { display: none }` — masque les panneaux latéraux desktop
- `.nearby-sidebar { display: none }` — pas de sidebar sur téléphone
