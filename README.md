# MeloSong

## Dépôt et emplacement

- **Dossier de travail (iCloud) :** `C:\Users\valen\iCloudDrive\Application\MeloSong\MeloSongv2`
- **Dépôt Git (racine monorepo) :** [valentingoulven-creator/Melo](https://github.com/valentingoulven-creator/Melo.git) — ce code est dans le sous-dossier `MeloSongv2/`. Exécutez `git` depuis `C:\Users\valen\iCloudDrive\Application\MeloSong` (pas depuis une copie locale `Projects\melosong` sans remote).

Application sociale de **salons d'écoute musicale** géolocalisés, connectée à **Spotify** et **YouTube**, avec **lives**, **chat**, **réactions live** et **messages privés**.

Fonctionne en **local sur PC** et sur **smartphone** (navigateur ou PWA installable).

## Démarrage rapide (msdev)

```bash
# 1. Installer les dépendances
cd backend && npm install && cd ../app && npm install && cd ..

# 2. Lancer MeloSong (build app + serveur local port 4080)
npm run msdev
```

Ouvrir **http://localhost:4080** sur PC ou **http://&lt;IP-de-votre-PC&gt;:4080** sur téléphone (même Wi‑Fi).

### Compte démo

- **Email :** `listener@msdev.local`
- **Mot de passe :** `msdev123`

## Développement

| Commande | Description |
|----------|-------------|
| `npm run msdev` | Build l'app + serveur msdev (4080) |
| `npm run app:dev` | Frontend seul (5173, proxy API) |
| `npm run app:demo` | **Démo hors-ligne** (5173, sans serveur backend) |
| `npm run app:demo:public` | Démo accessible depuis le téléphone **sans même Wi‑Fi** (tunnel public) |
| `npm run msdev:server` | Backend seul |
| `npm run build:exe` | Génère `msdev/release/msdev.exe` |

## Fonctionnalités (MVP)

- Carte avec hosts/salons (position floutée ~50 m)
- Création de salon Spotify ou YouTube
- Chat temps réel dans les salons
- Mode Live + réactions
- Messages privés
- Mode fantôme

## Structure

```
melosong/
├── app/          # React + Vite (PC + mobile responsive + PWA)
├── backend/      # API REST + Socket.io
└── msdev/        # Config environnement local
```

## Smartphone

1. Lancez `npm run msdev` sur le PC (serveur sur **0.0.0.0:4080**).
2. Sur le téléphone, ouvrez l’URL indiquée dans **`msdev/MOBILE-URL.txt`** (IP du **PC**, pas du téléphone). L’IP est synchronisée au lancement de `npm run msdev` ; si le Wi‑Fi change : `npm run msdev:sync-ip`.
3. Si la page ne charge pas : `npm run msdev:diagnose` puis `npm run msdev:fix-network` (pare-feu Windows, admin).
4. L’app ne liste pas les « téléphones connectés » ; **Personnes proches** = utilisateurs MeloSong géolocalisés.
5. Option : **Ajouter à l'écran d'accueil** (PWA).

## Prochaines étapes

- OAuth Spotify / YouTube (API officielles)
- Application native (Capacitor ou React Native)
- Base de données PostgreSQL / Supabase
