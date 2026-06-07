# MeloSong — dossier backup (iCloud)

Ce dossier correspond à votre sauvegarde iCloud :

```
C:\Users\valen\iCloudDrive\Application\MeloSong\backup
```

## Démo sur téléphone (sans serveur backend)

Depuis la racine du projet (`MeloSongv2`) :

```bash
npm run backup:demo:public
```

Sous Windows (PowerShell) :

```powershell
.\msdev\scripts\start-backup-demo.ps1
```

Le script :

1. Cherche le dossier backup (iCloud, `../backup`, ou `./backup`)
2. Sert les fichiers statiques (`index.html` dans backup, `public/`, `dist/`, etc.)
3. Ouvre un tunnel public Cloudflare — URL utilisable en 4G/5G sur Safari

## Chemins recherchés (dans l’ordre)

| Priorité | Chemin |
|----------|--------|
| 1 | Variable `MELOSONG_BACKUP_PATH` |
| 2 | `./backup` (ce dossier) |
| 3 | `../backup` (à côté de MeloSongv2) |
| 4 | `C:\Users\valen\iCloudDrive\Application\MeloSong\backup` |

## Si le backup n’est pas sur cette machine

Copiez le contenu de votre backup iCloud dans `MeloSong/backup` (à côté de `MeloSongv2`), ou définissez :

```bash
export MELOSONG_BACKUP_PATH="/chemin/vers/backup"
npm run backup:demo:public
```

Sans backup détecté, une démo hors-ligne est générée automatiquement dans `backup/dist/`.
