# scripts/add-staging-dns-ovh.md — Enregistrement DNS staging (OVH)

Le domaine `getsoundy.com` est chez **OVH** (NS : `dns109.ovh.net`, `ns109.ovh.net`).

## Action (console OVH)

1. [OVH Manager](https://www.ovh.com/manager/) → **Noms de domaine** → `getsoundy.com` → **Zone DNS**
2. **Ajouter une entrée** :
   - Type : **A**
   - Sous-domaine : `staging`
   - Cible : `51.159.170.181`
   - TTL : 3600 (défaut)
3. Attendre propagation (5–30 min), puis vérifier :

```powershell
nslookup staging.getsoundy.com 8.8.8.8
curl https://staging.getsoundy.com/health
```

Caddy sur le VPS staging obtiendra automatiquement le certificat Let's Encrypt une fois le DNS actif.
