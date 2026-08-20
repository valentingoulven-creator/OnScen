# Cloudflare CDN + WAF devant OnScen

> **Priorité infra P1** — protéger `onscen.com` et `staging.onscen.com` sans remplacer Caddy sur le VPS.  
> **Effort :** ~½ journée · **Coût :** 0 € (plan Free) · **Prérequis :** accès DNS (OVH ou Cloudflare).

L'app utilise déjà **Cloudflare Stream** (RTMP live). Ce guide ajoute le **proxy orange cloud** devant le site web (CDN edge, WAF L7, anti-DDoS volumétrique).

---

## Architecture cible

```
Navigateur → Cloudflare edge (cache / WAF / DDoS)
          → VPS Caddy :443 (Let's Encrypt, TLS origin)
          → PM2 Node :3000
```

Caddy reste l'origine TLS (`commun/deploy/Caddyfile`) avec `trusted_proxies` = plages Cloudflare. Node expose déjà `trust proxy` pour `X-Forwarded-*` (`server.ts`).

---

## État actuel (2026-08-20)

| Élément | Statut |
|---------|--------|
| Zone `onscen.com` | **active** (NS `sri` / `summer`.ns.cloudflare.com) |
| DNS proxifié `@`, `www` | **OK** — anycast CF · `Server: cloudflare` + `CF-RAY` |
| Prod `/health` via CF | **200** — utiliser `1.1.1.1` + `--resolve` (fichier **hosts** Windows = bypass) |
| Staging `/health` via CF | **NXDOMAIN** jusqu’à l’A `staging` au dashboard |
| Token API Stream | Liste la zone, **403** DNS / WAF / settings |
| Caddy `trusted_proxies` | Plages Cloudflare v4+v6 |
| HTTP → HTTPS | **308** via Cloudflare |
| WAF Free managed | Dashboard **Security → WAF** (API 403) |

Vérification locale (contourne le fichier hosts) :

```powershell
powershell -File commun/scripts/cloudflare-verify-cdn.ps1
```

### Token API — permissions requises pour automatiser

Le token Account API doit lier les permissions **à la zone** `onscen.com`, pas seulement au compte :

| Permission (scope **Zone** `onscen.com`) | Usage |
|---------------------------------------------|--------|
| Zone DNS Write | CRUD enregistrements A/CNAME |
| Zone Settings Write | SSL mode, Always HTTPS, min TLS, WebSockets |
| Cache Settings Write | Cache Rules `/api`, `/assets`, etc. |
| SSL and Certificates Write | Full (strict) |
| Zone WAF Write | Managed ruleset (sinon dashboard ci-dessous) |
| Zone Read | diagnostic |

**Piège courant :** « DNS View Write » / « Account DNS Settings Write » = scope **compte** → ne suffit pas pour `/zones/.../dns_records`. Il faut **DNS Write** sur la zone.

Les expressions API Cache Rules utilisent `starts_with(http.request.uri.path, "/api")` (fonction), pas `starts with` (syntaxe dashboard).

---

## Étape 1 — Ajouter le site Cloudflare

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site** → `onscen.com`.
2. Plan **Free**.
3. Choisir l'une des options DNS :

| Option | Quand l'utiliser |
|--------|------------------|
| **Nameservers Cloudflare** | Recommandé — gestion DNS + proxy centralisés |
| **DNS OVH + enregistrement A proxifié** | Si vous gardez les NS OVH : créer un compte CF, ajouter le site, puis dans OVH pointer l'enregistrement A vers l'IP **ou** utiliser un sous-domaine CNAME vers un hostname CF (selon config OVH) |

Pour **staging** : ajouter `staging.onscen.com` comme enregistrement séparé (même zone ou zone staging).

---

## Étape 2 — DNS proxifié (nuage orange)

| Enregistrement | Type | Valeur | Proxy |
|----------------|------|--------|-------|
| `onscen.com` | A | `51.159.164.100` | **Proxied** ☁️ |
| `www` | CNAME | `onscen.com` | **Proxied** |
| `staging` | A | `51.159.170.181` | **Proxied** |

**Ne pas** proxifier l'accès direct par IP (`51.159.164.100`) — garder pour debug / transition uniquement.

---

## Étape 3 — SSL/TLS origin (Full Strict)

1. Cloudflare → **SSL/TLS** → mode **Full (strict)**.
2. Vérifier que Caddy sur le VPS a un certificat Let's Encrypt valide pour `onscen.com` :

```bash
ssh onscen-prod "curl -sI https://127.0.0.1/health -H 'Host: onscen.com' --insecure | head -5"
ssh onscen-prod "sudo caddy validate --config /etc/caddy/Caddyfile"
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
curl -sI "https://onscen.com/assets/index-XXXX.js" | grep -i cf-cache

# API — doit rester DYNAMIC ou BYPASS
curl -sI "https://onscen.com/health" | grep -i cf-cache
```

Remplacer `index-XXXX.js` par un fichier réel listé dans `public/index.html`.

---

## Étape 5 — WAF & sécurité (Free)

Le token Stream (`CLOUDFLARE_API_TOKEN`) n’a souvent **pas** WAF Write → l’API répond **403**. Dans ce cas, activer à la main (2 min) :

1. [dash.cloudflare.com](https://dash.cloudflare.com) → zone **onscen.com**.
2. **Security → WAF → Managed rules**.
3. **Cloudflare Managed Ruleset** → interrupteur **Enabled**.
4. (Optionnel Free) **OWASP Core Ruleset** → Enabled, action *Managed Challenge* ou *Block* (surveiller `/api/auth/*` et `/socket.io`).
5. **Security → Settings** → Security level **Medium**.
6. **Network → WebSockets** : **On** (lives, DM, salons).
7. **SSL/TLS** → Always Use HTTPS **On** · Minimum TLS **1.2** · mode **Full (strict)**.

Automatisation (token avec **Zone WAF Write**) :

```powershell
powershell -File commun/scripts/setup-cloudflare-cdn.ps1
```

Si la ligne `WAF managed WARN` apparaît : revenir aux clics dashboard ci-dessus, ce n’est pas bloquant pour le CDN.

Rate limiting applicatif existe déjà côté Node — le WAF CF complète, ne remplace pas.

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
ssh onscen-staging
sudo bash /opt/onscen/deploy/sync-caddy-staging.sh
sudo systemctl reload caddy
curl -sI https://staging.onscen.com/health   # doit être 200
```

**DNS Cloudflare (dashboard)** — si `staging` n'existe pas encore :

| Type | Nom | Contenu | Proxy |
|------|-----|---------|-------|
| A | `staging` | `51.159.170.181` | Proxied ☁️ |

---

## Étape 7 — Tests staging avant prod

Ordre recommandé :

1. Proxifier **staging.onscen.com** d'abord.
2. Checklist :

```text
[ ] https://staging.onscen.com/health → 200 JSON
[ ] Login OAuth Google (redirect URI inchangée — même hostname)
[ ] Live / Socket.io (connexion WS OK)
[ ] Asset /assets/* → cf-cache-status HIT
[ ] Upload image (POST /api/...) → pas de cache
[ ] Admin → coûts Cloudflare Stream toujours OK (API token inchangé)
```

3. Proxifier **onscen.com** une fois staging validé 24–48 h.

---

## Étape 8 — Monitoring (lien P4)

Une fois proxifié, activer **Cloudflare Health Checks** (optionnel) ou **UptimeRobot** sur `https://onscen.com/health` — voir `commun/deploy/OPS-PRIORITIES.md` § P4.

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
