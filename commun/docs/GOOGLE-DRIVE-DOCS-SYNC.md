# Sync documentation → Google Drive

Synchronise `commun/docs/` et `docs/` vers le dossier Drive Soundy (remote rclone `gdrive-soundy`).

## Prérequis (une fois)

1. **rclone** : `winget install Rclone.Rclone`
2. **OAuth Google** : `rclone authorize drive` (connexion navigateur)
3. **Remote** : fichier `%APPDATA%\rclone\rclone.conf` avec section `[gdrive-soundy]` et `root_folder_id` = ID du dossier Drive cible.
4. **Installation auto** : `npm run docs:gdrive:install`

## Comportement (sans commit)

Dès qu’un fichier sous `commun/docs/` ou `docs/` est **enregistré**, le watcher envoie la mise à jour sur Drive (~3 s de debounce). Aucun commit Git n’est nécessaire.

Le watcher est démarré automatiquement :

- **À la connexion Windows** — tâche planifiée `Soundy-Docs-GDrive-Watch` (installée par `docs:gdrive:install`)
- **À `npm run dev`** — script `ensure-docs-gdrive-watch` (processus Node en arrière-plan)

## Commandes

| Commande | Rôle |
|----------|------|
| `npm run docs:gdrive:install` | Hook post-commit + tâche à la connexion + démarre le watcher |
| `npm run docs:gdrive:ensure` | Démarre le watcher s’il n’est pas déjà actif |
| `npm run docs:gdrive:watch` | Watcher au premier plan (debug) |
| `npm run docs:gdrive:sync` | Upload incrémental immédiat |

`npm run dev -SkipDocsGDrive` (via script PowerShell) désactive le démarrage du watcher pour cette session dev.

## Exclusions

- `node_modules/**`
- `youtube-audit-demo-credentials.local.txt`

## Dépannage

- **Drive pas à jour** → `npm run docs:gdrive:ensure` puis modifier/sauvegarder un fichier test
- **rclone introuvable** → redémarrer le terminal après `winget install Rclone.Rclone`
- **Token expiré** → `rclone authorize drive` puis mettre à jour `rclone.conf`
- **Désinstaller la tâche Windows** → Planificateur de tâches → supprimer `Soundy-Docs-GDrive-Watch`
