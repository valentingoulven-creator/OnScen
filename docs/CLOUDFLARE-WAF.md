# Cloudflare — WAF, proxy et cache (post-lancement)

Guide pour activer la protection Cloudflare sur **getsoundy.com** sans casser WebSocket (salons, live, DMs).

## Prérequis

- Domaine `getsoundy.com` géré dans Cloudflare
- Certificat origin sur le VPS (Caddy Let's Encrypt) — mode **Full (strict)**

## 1. Activer le proxy (orange cloud)

| Enregistrement | Type | Cible | Proxy |
|----------------|------|-------|-------|
| `getsoundy.com` | A | IP VPS prod `51.159.164.100` | Proxied |
| `www` | CNAME | `getsoundy.com` | Proxied |

**Staging** : garder DNS direct ou sous-domaine séparé (`staging`) pour éviter de mélanger les configs.

## 2. SSL/TLS

- Mode : **Full (strict)**
- Minimum TLS : 1.2
- Always Use HTTPS : ON
- Automatic HTTPS Rewrites : ON

## 3. WebSocket / Socket.IO

Règle **Configuration** (pas de cache) :

```
(http.request.uri.path contains "/socket.io")
→ Cache Level: Bypass
```

Ou Page Rule legacy : `*getsoundy.com/socket.io*` → WebSockets ON, Cache Bypass.

## 4. WAF — règles recommandées

| Règle | Action |
|-------|--------|
| OWASP Core Ruleset | Managed challenge sur score élevé |
| Bot Fight Mode | ON (Free) |
| Rate limiting `/api/auth/login` | 10 req/min/IP → block 15 min |
| Rate limiting `/api/auth/register` | 5 req/min/IP → block 30 min |

Le backend applique déjà des limiters ; Cloudflare = couche edge.

## 5. Cache static assets

Cache Rule :

```
(http.request.uri.path starts_with "/assets/")
→ Cache eligibility: eligible
→ Edge TTL: 1 month
→ Browser TTL: respect origin
```

Ne **pas** cacher : `/api/*`, `/health`, `/socket.io/*`, `/uploads/*` (UGC dynamique).

## 6. Compression

- Brotli : ON (Cloudflare)
- Caddy compresse déjà côté origin — pas de double compression agressive sur HTML

## 7. HTTP/3

- Network → HTTP/3 (with QUIC) : ON

## 8. Vérification post-activation

```bash
curl -I https://getsoundy.com/health
# cf-cache-status: DYNAMIC attendu

# WebSocket (wscat ou navigateur salon)
# Doit rester connecté > 60s
```

## 9. Rollback

Désactiver le proxy (grey cloud) sur l'enregistrement A → trafic direct VPS immédiat.
