# Configuration domaine onscen.com — OnScen

Domaine canonique **web** : `https://onscen.com`  
Domaine **legacy** (toujours servi, pas de redirect 301 pour l’instant) : `getsoundy.com`  
Emails / Workspace : `admin@getsoundy.com` (inchangé jusqu’à migration messagerie).

## 1. DNS (OVH)

Enregistrements cibles :

| Nom | Type | Cible |
|-----|------|--------|
| `@` (apex) | A | `51.159.164.100` (prod) |
| `www` | A | `51.159.164.100` |
| `staging` | A | `51.159.170.181` (preprod) |

Automatique (token OVH avec droits zone `onscen.com`) :

```powershell
powershell -ExecutionPolicy Bypass -File commun/scripts/configure-onscen-dns-ovh.ps1
powershell -ExecutionPolicy Bypass -File commun/scripts/configure-onscen-dns-ovh.ps1 -VerifyOnly
```

Token OVH : droits `GET/POST/PUT/DELETE /domain/zone/onscen.com/*` + `POST /domain/zone/onscen.com/refresh`  
(voir `commun/msdev/.env` : `OVH_APPLICATION_*`, `OVH_CONSUMER_KEY`).

Manuel : OVH Manager → Domaines → `onscen.com` → Zone DNS.

## 2. Caddy (TLS Let’s Encrypt)

Fichiers canoniques :

- Prod : `commun/deploy/Caddyfile` — blocs `onscen.com`, `www.onscen.com` + legacy `getsoundy.com`
- Staging : `commun/deploy/Caddyfile.staging` — `staging.onscen.com` + legacy `staging.getsoundy.com`

Sur VPS après deploy du Caddyfile :

```bash
ssh onscen-prod "bash /opt/onscen/deploy/sync-caddy.sh"
ssh onscen-staging "bash /opt/onscen/deploy/sync-caddy-staging.sh"
```

## 3. Variables VPS (`.env`)

Script :

```bash
bash /opt/onscen/deploy/patch-env-onscen-domain.sh prod    # prod
bash /opt/onscen/deploy/patch-env-onscen-domain.sh staging # staging
```

Puis relancer PM2 **via l’ecosystem** (sinon anciennes variables figées `CORS_ORIGIN` / `WEB_APP_URL`) :

```bash
cd /opt/onscen && pm2 reload deploy/ecosystem.config.cjs --update-env && pm2 save          # prod
cd /opt/onscen && pm2 reload deploy/ecosystem.staging.config.cjs --update-env && pm2 save # staging
```

Accès bloqué en local (box renvoie encore `213.186.33.5`) :

```powershell
powershell -ExecutionPolicy Bypass -File commun/scripts/fix-onscen-local-access.ps1
```

(Administrateur — DNS public + entrée `hosts` optionnelle.)

Clés mises à jour : `WEB_APP_URL`, `CORS_ORIGIN` (plusieurs origines), `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`.

## 4. OAuth / Stripe / WebAuthn (consoles externes)

Ajouter **en plus** des URLs `getsoundy.com` :

- Google / YouTube : `https://onscen.com/api/auth/google/callback`, etc.
- Stripe : webhooks inchangés (URL VPS) ; liens Checkout utilisent `WEB_APP_URL`.

## 5. Mobile (Capacitor)

- `ios/apptel/capacitor.config.prod.json` → `server.hostname`: `onscen.com`
- Xcode **Associated Domains** : `applinks:onscen.com` (garder `getsoundy.com` le temps de la transition)
- Regénérer AASA si besoin : `node commun/scripts/update-well-known-mobile.mjs`

## 6. Vérification

```powershell
Resolve-DnsName onscen.com -Type A
Invoke-RestMethod https://onscen.com/health
Invoke-RestMethod https://staging.onscen.com/health
curl -I https://onscen.com/.well-known/apple-app-site-association
```
