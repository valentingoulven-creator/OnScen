# scripts/add-staging-dns-ovh.md — Enregistrement DNS staging (OVH)

Le domaine `getsoundy.com` est chez **OVH** (NS : `dns109.ovh.net`, `ns109.ovh.net`).

## Option A — Script automatique (recommandé)

1. Créer un token API : [eu.api.ovh.com/createToken](https://eu.api.ovh.com/createToken/)
   - Droits : `GET/POST/PUT/DELETE` sur `/domain/zone/getsoundy.com/*`
   - + `POST` sur `/domain/zone/getsoundy.com/refresh`
2. Ajouter dans `msdev/.env` (ne jamais committer) :
   ```
   OVH_APPLICATION_KEY=...
   OVH_APPLICATION_SECRET=...
   OVH_CONSUMER_KEY=...
   ```
3. Exécuter :
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/add-staging-dns-ovh.ps1
   ```
4. Vérifier :
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/add-staging-dns-ovh.ps1 -VerifyOnly
   nslookup staging.getsoundy.com 8.8.8.8
   curl https://staging.getsoundy.com/health
   ```

Caddy sur le VPS staging obtiendra automatiquement le certificat Let's Encrypt une fois le DNS actif.

## Option B — Console OVH (manuel)

1. [OVH Manager](https://www.ovh.com/manager/) → **Noms de domaine** → `getsoundy.com` → **Zone DNS**
2. **Ajouter une entrée** :
   - Type : **A**
   - Sous-domaine : `staging`
   - Cible : `51.159.170.181`
   - TTL : 3600 (défaut)
