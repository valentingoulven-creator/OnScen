# Cloudflare CDN + WAF devant Soundy

> **Priorité infra P1** — protéger `getsoundy.com` et `staging.getsoundy.com` sans remplacer Caddy sur le VPS.  
> **Effort :** ~½ journée · **Coût :** 0 € (plan Free) · **Prérequis :** accès DNS (OVH ou Cloudflare).

L'app utilise déjà **Cloudflare Stream** (RTMP live). Ce guide ajoute le **proxy orange cloud** devant le site web (CDN edge, WAF L7, anti-DDoS volumétrique).

---

## Architecture cible

```
Navigateur → Cloudflare edge (cache / WAF / DDoS)
          → VPS Caddy :443 (Let's Encrypt, TLS origin)
          → PM2 Node :3000
```

Caddy reste l'origine TLS (`commun/deploy/Caddyfile`). Node expose déjà `trust proxy` pour `X-Forwarded-*` (`server.ts`).

---

## État actuel (2026-07-15)

| Élément | Statut |
|---------|--------|
| Zone `getsoundy.com` | **active** (NS Cloudflare chez OVH) |
| DNS proxifié `@`, `staging`, `www` | **OK** (résolution → IP edge `188.114.96.x`) |
| Prod `/health` via CF | **200** · `Server: cloudflare` |
| Staging `/health` via CF | **200** (Caddy : chemins publics + `CF-Connecting-IP`) |
| HTTP → HTTPS | **308** |
| Cache assets `/assets/*` | **HIT** au 2ᵉ hit (origin `immutable`) |
| WAF Free managed ruleset | **présent** |
| Cache Rules explicites (dashboard) | **OK** — 3 règles `Soundy CDN cache` |
| SSL Full (strict) via API | **OK** — `strict` |

Vérification locale :

```powershell
powershell -File commun/scripts/cloudflare-verify-cdn.ps1
```

### Token API — permissions requises pour automatiser

Le token Account API doit lier les permissions **à la zone** `getsoundy.com`, pas seulement au compte :

| Permission (scope **Zone** `getsoundy.com`) | Usage |
|---------------------------------------------|--------|
| Zone DNS Write | CRUD enregistrements A/CNAME |
| Zone Settings Write | SSL mode, Always HTTPS, min TLS, WebSockets |
| Cache Settings Write | Cache Rules `/api`, `/assets`, etc. |
| SSL and Certificates Write | Full (strict) |
| Zone Read | diagnostic |

**Piège courant :** « DNS View Write » / « Account DNS Settings Write » = scope **compte** → ne suffit pas pour `/zones/.../dns_records`. Il faut **DNS Write** sur la zone.

Les expressions API Cache Rules utilisent `starts_with(http.request.uri.path, "/api")` (fonction), pas `starts with` (syntaxe dashboard).

---

## Étape 1 — Ajouter le site Cloudflare

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site** → `getsoundy.com`.
2. Plan **Free**.
3. Choisir l'une des options DNS :

| Option | Quand l'utiliser |
|--------|------------------|
| **Nameservers Cloudflare** | Recommandé — gestion DNS + proxy centralisés |
| **DNS OVH + enregistrement A proxifié** | Si vous gardez les NS OVH : créer un compte CF, ajouter le site, puis dans OVH pointer l'enregistrement A vers l'IP **ou** utiliser un sous-domaine CNAME vers un hostname CF (selon config OVH) |

Pour **staging** : ajouter `staging.getsoundy.com` comme enregistrement séparé (même zone ou zone staging).

---

## Étape 2 — DNS proxifié (nuage orange)

| Enregistrement | Type | Valeur | Proxy |
|----------------|------|--------|-------|
| `getsoundy.com` | A | `51.159.164.100` | **Proxied** ☁️ |
| `www` | CNAME | `getsoundy.com` | **Proxied** |
| `staging` | A | `51.159.170.181` | **Proxied** |

**Ne pas** proxifier l'accès direct par IP (`51.159.164.100`) — garder pour debug / transition uniquement.

---

## Étape 3 — SSL/TLS origin (Full Strict)

1. Cloudflare → **SSL/TLS** → mode **Full (strict)**.
2. Vérifier que Caddy sur le VPS a un certificat Let's Encrypt valide pour `getsoundy.com` :

```bash
ssh soundy-prod "curl -sI https://127.0.0.1/health -H 'Host: getsoundy.com' --insecure | head -5"
ssh soundy-prod "sudo caddy validate --config /etc/caddy/Caddyfile"
```

3. Optionnel (recommandé long terme) : **Origin Certificate** Cloudflare installé sur Caddy si rotation LE pose problème derrière proxy — pas obligatoire au départ.

---

## Étape 4 — Règles de cache (économie bande passante VPS)

Le backend envoie déjà les bons en-têtes (`server.ts`) :

| Chemin | `Cache-Control` côté origin |
|--------|------------------------------|
| `/assets/*` (hash Vite) | `public, max-age=31536000, immutable` |
| `/sw.js`, `/index.html` | `no-cache, must-revalidate` |
| `/api/*`, `/socket.io/*` | pas de cache long (dynamique) |

### Règles Cloudflare (Cache Rules — plan Free)

Créer dans **Caching → Cache Rules** :

1. **Bypass API & temps réel**
   - Expression : `(starts_with(http.request.uri.path, "/api")) or (starts_with(http.request.uri.path, "/socket.io")) or (http.request.uri.path eq "/health")`
   - Action : **Bypass cache** (`set_cache_settings` + `cache: false` via API)

2. **Cache assets hashés**
   - Expression : `starts_with(http.request.uri.path, "/assets/")`
   - Action : **Eligible for cache** · Respect origin TTL · Edge TTL = respect origin

3. **Service worker — pas de cache edge long**
   - Expression : `http.request.uri.path eq "/sw.js"`
   - Action : **Bypass cache** (ou TTL 0)

4. **HTML / shell SPA**
   - Expression : `http.request.uri.path eq "/" or http.request.uri.path eq "/index.html"`
   - Action : **Bypass cache** (évite servir une vieille SPA)

### Vérification post-config

```bash
# Doit montrer cf-cache-status: HIT après 2e requête (asset hashé)
curl -sI "https://getsoundy.com/assets/index-XXXX.js" | grep -i cf-cache

# API — doit rester DYNAMIC ou BYPASS
curl -sI "https://getsoundy.com/health" | grep -i cf-cache
```

Remplacer `index-XXXX.js` par un fichier réel listé dans `public/index.html`.

---

## Étape 5 — WAF & sécurité (Free)

1. **Security → WAF** → activer les règles managées disponibles (OWASP basique).
2. **Security → Bots** → laisser défaut ; surveiller faux positifs sur `/api/auth/*`.
3. **SSL/TLS → Always Use HTTPS** : ON.
4. **SSL/TLS → Minimum TLS Version** : 1.2.
5. **Network → WebSockets** : ON (Socket.io live / DM).

Rate limiting applicatif existant côté Node — le WAF CF complète, ne remplace pas.

---

## Étape 6 — WebSockets & headers

- Socket.io : chemin `/socket.io/*` — compatible Cloudflare proxy si WebSockets activés.
- Node : `app.set('trust proxy', 1)` — les IP clients réelles arrivent via `CF-Connecting-IP` / `X-Forwarded-For`.

Si un middleware de rate-limit par IP semble « tout venir de Cloudflare », vérifier que Caddy transmet bien les headers (défaut reverse_proxy).

### Staging `403 Forbidden` derrière Cloudflare

**Cause :** `Caddyfile.staging` limitait l'accès à une IP fondateur (`client_ip`). Derrière le proxy Cloudflare, Caddy voyait l'IP edge CF → `respond "Forbidden" 403`.

**Correctif (`Caddyfile.staging`) :**

1. Chemins **publics** derrière CF : `/health`, `/assets/*`, `/api/*`, `/socket.io/*`.
2. Reste de l'UI : en-tête `CF-Connecting-IP` = IP fondateur (`195.36.171.84`).
3. Déployer :

```bash
ssh soundy-staging
sudo bash /opt/soundly/deploy/sync-caddy-staging.sh
sudo systemctl reload caddy
curl -sI https://staging.getsoundy.com/health   # doit être 200
```

**DNS Cloudflare (dashboard)** — si `staging` n'existe pas encore :

| Type | Nom | Contenu | Proxy |
|------|-----|---------|-------|
| A | `staging` | `51.159.170.181` | Proxied ☁️ |

---

## Étape 7 — Tests staging avant prod

Ordre recommandé :

1. Proxifier **staging.getsoundy.com** d'abord.
2. Checklist :

```text
[ ] https://staging.getsoundy.com/health → 200 JSON
[ ] Login OAuth Google (redirect URI inchangée — même hostname)
[ ] Live / Socket.io (connexion WS OK)
[ ] Asset /assets/* → cf-cache-status HIT
[ ] Upload image (POST /api/...) → pas de cache
[ ] Admin → coûts Cloudflare Stream toujours OK (API token inchangé)
```

3. Proxifier **getsoundy.com** une fois staging validé 24–48 h.

---

## Étape 8 — Monitoring (lien P4)

Une fois proxifié, activer **Cloudflare Health Checks** (optionnel) ou **UptimeRobot** sur `https://getsoundy.com/health` — voir `commun/deploy/OPS-PRIORITIES.md` § P4.

`monitor-alerts.sh` sur le VPS ne peut pas alerter si le VPS entier est down — d'où le besoin d'un check **externe**.

---

## Rollback

1. Cloudflare DNS → passer l'enregistrement A en **DNS only** (nuage gris).
2. Propagation DNS : quelques minutes à 1 h.
3. Le trafic repasse directement sur Caddy/VPS sans changement origin.

---

## Références repo

| Fichier | Rôle |
|---------|------|
| `commun/deploy/Caddyfile` | Origin TLS + reverse proxy |
| `commun/backend/src/server.ts` | `Cache-Control` assets / API |
| `commun/backend/src/lib/cloudflareStream.ts` | Stream (inchangé par ce guide) |
| `commun/deploy/OPS-PRIORITIES.md` | Checklist priorités infra complète |

---

*Dernière mise à jour : 2026-07-15*
