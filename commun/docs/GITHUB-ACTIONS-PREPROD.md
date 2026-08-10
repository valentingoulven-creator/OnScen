# Configurer le deploy preprod automatique (GitHub Actions)

Le workflow `.github/workflows/deploy-preprod.yml` deploie sur **staging** apres chaque push reussi sur `main` / `master` (workflow CI vert).

## 1. Secret GitHub obligatoire

Dans le repo GitHub : **Settings → Secrets and variables → Actions → New repository secret**

| Nom | Valeur |
|-----|--------|
| `STAGING_SSH_PRIVATE_KEY` | Contenu complet de votre cle privee SSH (`~/.ssh/id_ed25519`, format OpenSSH) |

La cle publique (`id_ed25519.pub`) doit etre presente dans `/root/.ssh/authorized_keys` sur le VPS staging.

**Ne jamais** committer la cle privee dans le repo.

### Verifier / ajouter la cle sur le VPS

```powershell
# Afficher la cle publique locale
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub

# Sur le VPS (si besoin)
ssh root@51.159.170.181 "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
# Coller la ligne id_ed25519.pub dans /root/.ssh/authorized_keys
```

## 2. Declenchement

| Evenement | Action |
|-----------|--------|
| Push sur `main` / `master` | CI tourne → si OK → deploy preprod |
| Manuel | GitHub → **Actions** → **Deploy Preprod** → **Run workflow** |

Un seul deploy preprod a la fois (`concurrency` — annule le precedent si un nouveau push arrive).

## 3. Ce que fait le workflow

1. `npm ci` backend + app + apptel
2. Copie `app/.env.preproduction.example` → build Vite preprod
3. SSH vers staging via `commun/scripts/deploy-preprod.ps1`
4. Health check : `http://51.159.170.181/health` (ou DNS si configure)

Le `.env` runtime sur le VPS (`/opt/onscen/.env`) **n'est pas** ecrase par CI — seul le code deploye change.

## 4. Prod

Le deploy **production** reste manuel : `commun/scripts/deploy-prod.ps1` (demande explicite).

## 5. Depannage

- **Secret manquant** : workflow echoue au step SSH agent
- **Permission denied (SSH)** : verifier `STAGING_SSH_PRIVATE_KEY` et `authorized_keys` sur staging
- **CI rouge** : deploy preprod ne se lance pas (workflow_run condition)
- **Health echoue** : `ssh onscen-staging "pm2 logs onscen-backend-staging --lines 40"`
