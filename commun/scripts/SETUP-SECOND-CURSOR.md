# Setup second Cursor — checklist rapide

Bootstrap d’un **second poste** ou **second compte Cursor** avec accès dev local + deploy prod Soundy / MeloSongv2.

## Lancer le script

```powershell
# Recommandé : clone hors iCloud vers C:\Dev\MeloSongv2
powershell -ExecutionPolicy Bypass -File commun/scripts/setup-second-cursor.ps1

# Options utiles
powershell -ExecutionPolicy Bypass -File commun/scripts/setup-second-cursor.ps1 -SeedStories
powershell -ExecutionPolicy Bypass -File commun/scripts/setup-second-cursor.ps1 -SkipClone -TargetDir "C:\Dev\MeloSongv2"
```

## Avant de lancer

| Étape | Action |
|-------|--------|
| Git | [Git for Windows](https://git-scm.com/download/win) |
| Node | LTS 18+ ([nodejs.org](https://nodejs.org/)) |
| SSH | Client OpenSSH Windows activé |
| GitHub | Inviter le compte #2 sur `valentingoulven-creator/MeloSong` |
| Emplacement | **Pas iCloud** — utiliser `C:\Dev\MeloSongv2` |

## À faire manuellement (secrets)

1. **Clé SSH** — copier `~/.ssh/id_ed25519` (+ `.pub`) depuis la machine 1 (USB/SCP), **jamais dans Git**.
2. **msdev/.env** — coller les secrets OAuth/YouTube/Stripe **dev** depuis la machine 1.
3. **backend/.env.production** — référence locale uniquement ; la prod réelle est sur le VPS `/opt/soundy/.env`.
   - Admin prod : `PROD_ADMIN_EMAIL=admin@getsoundy.com` (pas `dev@soundy.local`).
   - Dev local : `ACCESS_ADMIN_EMAILS` dans `msdev/.env` (même email ou liste séparée par virgules).
4. **VPS prod** — récupérer les variables critiques :

   ```bash
   ssh root@51.159.164.100 "cat /opt/soundy/.env"
   ```

   Variables clés : `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, `PG_SSL`, Stripe, OAuth, Cloudflare Stream, LiveKit.

   **PostgreSQL** = Scaleway Managed (`51.15.132.229:14440`) — la `DATABASE_URL` est dans le `.env` VPS, la base n’est **pas** hébergée sur le VPS.

5. **Checklist détaillée** — `commun/scripts/secrets-checklist.template.txt` (placeholders uniquement).

## Vérifications après setup

```powershell
cd C:\Dev\MeloSongv2
npm run dev                    # http://localhost:5173
ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@51.159.164.100 "echo OK"
curl https://getsoundy.com/health
git status
```

## Deploy production

```powershell
npm run deploy:prod
# ou directement :
powershell -ExecutionPolicy Bypass -File commun/deploy/deploy_zero_downtime.ps1 -VerifyProd
```

`commun/scripts/deploy-prod.ps1` reste un wrapper valide (appelle `commun/deploy/deploy_zero_downtime.ps1 -VerifyProd`).

VPS : `51.159.164.100`, chemin `/opt/soundy`, health `https://getsoundy.com/health`. PostgreSQL : Scaleway Managed `51.15.132.229:14440`.

## Références

- Workflow dev : [`docs/DEV-WORKFLOW.md`](../docs/DEV-WORKFLOW.md)
- Runbook prod : [`commun/deploy/RUNBOOK-PROD.md`](../commun/deploy/RUNBOOK-PROD.md)
- Deploy : [`commun/deploy/deploy_zero_downtime.ps1`](../commun/deploy/deploy_zero_downtime.ps1)
