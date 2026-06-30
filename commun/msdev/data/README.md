# commun/msdev/data — persistance locale

Ce dossier contient **`store.json`** (et éventuellement `store-*.json`) : la base de données fichier utilisée en **développement msdev** lorsque PostgreSQL n'est pas configuré.

## ⚠ Ne pas synchroniser via iCloud

Si le dépôt MeloSong est dans iCloud Drive (`iCloudDrive/...`) :

- **Désactivez la sync iCloud** pour ce dossier, ou excluez `msdev/data/` de la synchronisation.
- iCloud peut verrouiller, dupliquer ou corrompre `store.json` pendant l'écriture du serveur → pertes de données ou démarrage impossible.

Le fichier **`.nosync`** (macOS) ou ce README servent de rappel ; sur Windows, préférez un clone Git **hors** iCloud pour le dev actif.

## Git

Les fichiers `store*.json` sont **ignorés** par Git (données locales). Ne les committez jamais.

## Production

En production (`APP_ENV=production`), la persistance doit passer par **PostgreSQL** (`DATABASE_URL` dans `/opt/soundy/.env`). Le repli `store.json` n'est qu'un fallback d'urgence — voir `commun/deploy/RUNBOOK-PROD.md`.
