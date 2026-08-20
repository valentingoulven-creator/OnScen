# Resend — e-mails production OnScen

Le 403 Resend *« You can only send testing emails to your own email address »* n’est **pas** un FROM incorrect. `RESEND_FROM` prod est déjà `OnScen <noreply@onscen.com>`. La clé API est encore une **clé sandbox / Testing**.

SMTP sortant est bloqué sur le VPS Scaleway : Resend HTTP (443) est le canal unique.

## Ce que le code fait maintenant

- Refuse `@resend.dev` comme expéditeur si `APP_ENV=production`.
- Les alertes monitor utilisent `ALERT_EMAIL` **et** `SMTP_ADMIN_EMAIL`.
- Message d’erreur explicite si Resend répond *testing emails*.
- `/health` → `services.smtp: error` si le From est encore `@resend.dev` en production (une clé sandbox avec From `noreply@onscen.com` reste `ok` jusqu’au test d’envoi).

Cela ne remplace **pas** une clé Production dans `/opt/onscen/.env`.

## Procédure fondateur (≈ 5 min)

1. Connexion [resend.com](https://resend.com) → projet OnScen.
2. **Domains** → `onscen.com` doit être **Verified** (SPF + DKIM + DMARC). Si *Pending*, coller les records DNS Cloudflare et attendre le vert.
3. **API Keys** → **Create API Key**
   - Nom : `onscen-prod`
   - Permission : **Sending access** (Full, pas « Testing only »)
   - Domain : `onscen.com` (ou All)
4. Copier la clé `re_…` (une seule fois).
5. Sur le VPS (ne jamais committer la clé) :

```bash
ssh onscen-prod
sudo nano /opt/onscen/.env
# RESEND_API_KEY=re_...          ← nouvelle clé Production
# RESEND_FROM=OnScen <noreply@onscen.com>
# ALERT_EMAIL=admin@onscen.com
```

6. Recréer le process PM2 (un `reload --update-env` a déjà gardé l’ancienne clé une fois) :

```bash
cd /opt/onscen
pm2 delete onscen-backend
pm2 start ecosystem.config.cjs
pm2 save
```

7. Test : e-mail « mot de passe oublié » vers `admin@onscen.com`.  
   Succès = HTTP 200 Resend, pas 403.

## Vérifier sans afficher la clé

```bash
ssh onscen-prod 'python3 - <<'"'"'PY'"'"'
import json, urllib.request
env = {}
with open("/opt/onscen/.env", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k] = v.strip().strip("'\"").strip()
from_addr = env.get("RESEND_FROM", "")
key = env.get("RESEND_API_KEY", "").strip()
print("RESEND_FROM=", from_addr)
print("KEY_LEN=", len(key), "PREFIX=", key[:3] if key else "MISS")
req = urllib.request.Request(
    "https://api.resend.com/domains",
    headers={"Authorization": "Bearer " + key},
)
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode())
    for d in data.get("data", []):
        print("DOMAIN", d.get("name"), "status=", d.get("status"))
except Exception as e:
    print("DOMAINS_API_ERROR", type(e).__name__, str(e)[:180])
PY'
```

| Résultat | Action |
|----------|--------|
| Domain `onscen.com` `verified` + envoi OK | Terminé |
| Domain `not_started` / `pending` | Finir DNS (SPF/DKIM) |
| 403 *testing emails* après nouvelle clé | La clé créée est encore Testing — en recréer une **Production** |
| 401 | Clé mal collée / espaces / quotes |

## Staging

Même procédure avec le `.env` staging. Un domaine `staging.onscen.com` n’est pas obligatoire si les mails partent depuis `noreply@onscen.com`.
