# msdev — MeloSong local development

Environment de développement local dédié pour MeloSong.

## Démarrage rapide

Depuis la racine du monorepo :

```bash
npm run msdev
```

Ou depuis ce dossier :

```powershell
.\scripts\start.ps1
```

## URLs (msdev)

| Service | URL |
|---------|-----|
| Web app (démo) | http://localhost:4080 |
| API REST | http://localhost:4080/api |
| Health check | http://localhost:4080/health |
| Socket.io | http://localhost:4080 |

### Smartphone (même réseau que le PC)

**URL à taper dans le navigateur du téléphone** (c’est l’**IP du PC**, pas celle du téléphone) :

**http://192.168.1.93:4080**

Configurée dans `msdev/.env` (`MOBILE_HOST_IP`) et `msdev/MOBILE-URL.txt`.

- **PC** : `http://localhost:4080`
- **Android Emulator** : `http://10.0.2.2:4080`

Le serveur écoute sur **0.0.0.0:4080** (`HOST` dans `.env`) pour accepter les connexions du téléphone.

#### Ce que MeloSong n’affiche pas

- Il n’y a **pas** d’écran « téléphone connecté » ou liste d’appareils sur le réseau.
- **Personnes proches** sur la carte = **comptes MeloSong** avec géolocalisation (pas votre téléphone en tant qu’appareil).

#### Dépannage

| Problème | Action |
|----------|--------|
| Page inaccessible sur le téléphone | `npm run msdev:diagnose` puis `npm run msdev:fix-network` (pare-feu + réseau Privé, admin) |
| IP du PC a changé | Mettre à jour `MOBILE_HOST_IP` dans `msdev/.env`, `config.json`, `MOBILE-URL.txt` ; ou `npm run msdev:mobile-url` |
| Téléphone en Wi‑Fi, PC en Ethernet | Certains routeurs **isolent** Wi‑Fi et Ethernet : désactiver « isolation AP » ou mettre le PC en Wi‑Fi |
| Vous utilisez `npm run app:dev` (port 5173) | Le téléphone doit utiliser **`npm run msdev`** (port **4080**) |

## Configuration

- Variables : [`msdev/.env`](.env)
- URLs partagées : [`msdev/config.json`](config.json)

## Port

Le port **4080** est réservé à msdev pour éviter les conflits avec d’autres apps sur le port 3000.

## Fichier .exe (Windows)

Générer l’exécutable local **msdev.exe** :

```bash
npm run build:exe
```

Le fichier sera créé dans :

```
msdev/release/msdev.exe
```

Contenu du dossier `release/` (à garder ensemble) :

- `Lancer-msdev.ps1` / `Lancer-msdev.bat` — lancement recommandé (déblocage Windows)
- `msdev.exe` — serveur + navigateur (voir `DEBLOCAGE-WINDOWS.txt` si blocage)
- `public/` — interface web
- `.env` — configuration msdev
- `config.json` — URLs pour les clients

**Prérequis pour compiler** : Node.js installé (une seule fois). L’exe fonctionne ensuite sans Node.

Guides détaillés :

- [`BUILD-EXE.txt`](BUILD-EXE.txt) — compilation et utilisation de l’exe
- [`DEBLOCAGE-WINDOWS.txt`](DEBLOCAGE-WINDOWS.txt) — SmartScreen, Smart App Control, alternatives
- [`Lancer-msdev-node.bat`](Lancer-msdev-node.bat) — lancer sans exe (Node.js, contourne SAC)
- [`MOBILE-PWA.txt`](MOBILE-PWA.txt) — smartphone, PWA, HTTPS LAN
- Page QR sur le PC : http://localhost:4080/msdev-mobile
