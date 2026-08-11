# Configuration domaine onscen.com — OnScen

Domaine **unique et canonique** : `https://onscen.com`  
`getsoundy.com` est **décommissionné** (2026-08-11) : hard stop côté Caddy (aucun bloc =
pas de certificat TLS obtenu pour ce host, connexion refusée dès le handshake). Pas de
redirect 301 — le domaine ne doit plus répondre du tout.  
Emails / Workspace : `admin@onscen.com` (code applicatif basculé ; vérifier que la boîte
`admin@onscen.com` existe bien côté Google Workspace avant d'annoncer ce contact).

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

**`getsoundy.com`** : la zone DNS OVH du domaine legacy n'est **pas** modifiée par ce
changement (décision volontaire — éviter de perdre le nom de domaine / risque de
squatting). Seul le serveur (Caddy) ne répond plus sur ce host.

## 2. Caddy (TLS Let's Encrypt)

Fichiers canoniques :

- Prod : `commun/deploy/Caddyfile` — blocs `onscen.com`, `www.onscen.com` uniquement.
  `getsoundy.com` / `www.getsoundy.com` retirés (2026-08-11) : sans bloc Caddy, aucun
  certificat TLS n'est obtenu pour ce host → connexion refusée au handshake TLS (hard
  stop volontaire, pas de redirect).
- Staging : `commun/deploy/Caddyfile.staging` — `staging.onscen.com` uniquement
  (`staging.getsoundy.com` retiré).

Sur VPS après deploy du Caddyfile :

```bash
ssh onscen-prod "bash /opt/onscen/deploy/sync-caddy.sh"
ssh onscen-staging "bash /opt/onscen/deploy/sync-caddy-staging.sh"
```

Ces deux scripts refusent désormais explicitement d'installer un Caddyfile contenant
encore `getsoundy.com` (garde-fou anti-réintroduction accidentelle).

## 3. Variables VPS (`.env`)

Script :

```bash
bash /opt/onscen/deploy/patch-env-onscen-domain.sh prod    # prod
bash /opt/onscen/deploy/patch-env-onscen-domain.sh staging # staging
```

Depuis 2026-08-11, ce script ne met plus `getsoundy.com` dans `CORS_ORIGIN` — seules les
origines `onscen.com` / `www.onscen.com` (prod) ou `staging.onscen.com` (staging) sont
autorisées.

Puis relancer PM2 **via l'ecosystem** (sinon anciennes variables figées `CORS_ORIGIN` / `WEB_APP_URL`) :

```bash
cd /opt/onscen && pm2 reload deploy/ecosystem.config.cjs --update-env && pm2 save          # prod
cd /opt/onscen && pm2 reload deploy/ecosystem.staging.config.cjs --update-env && pm2 save # staging
```

Accès bloqué en local (box renvoie encore `213.186.33.5`) :

```powershell
powershell -ExecutionPolicy Bypass -File commun/scripts/fix-onscen-local-access.ps1
```

(Administrateur — DNS public + entrée `hosts` optionnelle.)

Clés mises à jour : `WEB_APP_URL`, `CORS_ORIGIN`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` —
`onscen.com` uniquement.

## 4. OAuth / Stripe / WebAuthn (consoles externes)

`getsoundy.com` doit être **retiré** des consoles tierces (Google/Meta/Apple/Stripe) au
profit de `onscen.com` uniquement — ces réglages sont externes au repo, à faire
manuellement :

- Google / YouTube (console.cloud.google.com) : Authorized redirect URIs →
  `https://onscen.com/api/auth/google/callback`, `https://onscen.com/api/auth/youtube/callback`.
  Retirer les entrées `getsoundy.com` correspondantes.
- Facebook / Instagram (developers.facebook.com) : idem, callback `onscen.com` uniquement.
- Sign in with Apple (developer.apple.com) : Services ID → Web Auth → domain `onscen.com`
  uniquement, return URL `https://onscen.com/api/auth/apple/callback`.
- Stripe : webhooks inchangés (URL VPS, pas de nom de domaine dans l'endpoint) ; liens
  Checkout utilisent `WEB_APP_URL` (déjà `onscen.com`).

## 5. Mobile (Capacitor)

- `ios/apptel/capacitor.config.prod.json` → `server.hostname`: `onscen.com` (inchangé)
- iOS `App.entitlements` : `applinks:onscen.com` / `webcredentials:onscen.com` uniquement
  (`getsoundy.com` retiré le 2026-08-11).
- Android `AndroidManifest.xml` (généré par `ios/apptel/scripts/patch-android-native.mjs`) :
  deep links `onscen.com` / `www.onscen.com` uniquement.
- `commun/scripts/fetch-cert-pins.mjs` → pin uniquement `onscen.com` (Android SSL pinning).
- Regénérer AASA si besoin : `node commun/scripts/update-well-known-mobile.mjs` (contenu
  indépendant du nom de domaine, pas d'impact).

## 6. Vérification

```powershell
Resolve-DnsName onscen.com -Type A
Invoke-RestMethod https://onscen.com/health
Invoke-RestMethod https://staging.onscen.com/health
curl -I https://onscen.com/.well-known/apple-app-site-association

# getsoundy.com doit maintenant échouer (hard stop, pas de certificat TLS pour ce host) :
curl -I https://getsoundy.com/health    # attendu : erreur TLS / connexion refusée
```
