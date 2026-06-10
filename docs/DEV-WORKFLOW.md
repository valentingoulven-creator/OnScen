# Workflow développement — Soundy / MeloSongv2

Recommandations pour éviter les conflits iCloud, garder un dépôt sain et déployer en production sans surprise.

---

## Emplacement du dépôt

**Ne pas développer dans iCloud Drive** (`Application\MeloSong\...`) pour le travail quotidien : sync lente, fichiers verrouillés, risque de corruption sur `msdev/data/store.json`.

Recommandé :

```text
C:\Dev\MeloSongv2
```

Cloner une fois :

```powershell
mkdir C:\Dev -ErrorAction SilentlyContinue
git clone https://github.com/valentingoulven-creator/Melo.git C:\Dev\MeloSongv2
cd C:\Dev\MeloSongv2
```

Ouvrir ce dossier dans Cursor comme workspace racine.

---

## Boucle de travail

1. **Branche / master** — petits commits logiques (message clair, pas de secrets).
2. **`git push`** après chaque lot de modifications testé localement.
3. **msdev local** — depuis la racine du dépôt :

   ```powershell
   npm run msdev
   ```

   Données msdev : `msdev/data/` (ignoré par Git, ne pas synchroniser via iCloud).

4. **CI** — chaque push sur `master` déclenche `.github/workflows/ci.yml` (install + `tsc` app + build backend). Corriger avant deploy si la CI est rouge.

5. **Production** — depuis `MeloSongv2/` :

   ```powershell
   powershell -ExecutionPolicy Bypass -File deploy_zero_downtime.ps1
   ```

   Options utiles : `-SkipBuild`, `-SkipFrontend`, `-VerifyProd` (checklist ops sur le VPS).

---

## Premier setup VPS (une fois)

Voir [`deploy/RUNBOOK-PROD.md`](../deploy/RUNBOOK-PROD.md). Résumé :

```bash
# Sur le VPS (root)
bash /opt/soundly/deploy/setup-legal-publisher.sh   # puis éditer legal-publisher.json
sudo bash /opt/soundly/deploy/install-backup-cron.sh
sudo bash /opt/soundly/deploy/install-health-cron.sh   # optionnel
cd /opt/soundly && pm2 start deploy/ecosystem.config.cjs && pm2 save
```

---

## Ce qui reste manuel

- **Scaleway console** — sauvegardes automatiques Managed Database, restore test trimestriel, whitelist IP VPS.
- **`legal-publisher.json`** — contenu légal (SIREN, adresse, hébergeur) : remplir à la main après `setup-legal-publisher.sh`.
- **Secrets** — `.env` production uniquement sur le VPS, jamais dans Git.

---

## Liens

- Runbook prod : [`deploy/RUNBOOK-PROD.md`](../deploy/RUNBOOK-PROD.md)
- Deploy scripts : [`deploy/README.md`](../deploy/README.md)
- Journal des modifs : [`modification.txt`](../modification.txt)
