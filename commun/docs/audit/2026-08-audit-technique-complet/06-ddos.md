# Audit technique Soundy — Phase 6 : Protection DDoS et abus

**Date :** 2026-08-07
**Méthode :** revue de `commun/deploy/Caddyfile`, `ecosystem.config.cjs`, `lib/socketCluster.ts`, recherche exhaustive de mécanismes anti-bot/captcha, croisement avec `API-2` de `AUDIT-CONSOLIDE.md`.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

---

## 6.1 CDN / WAF devant l'infrastructure

**Constat (hérité, reconfirmé — `API-2`) :** **absence de CDN/WAF de type Cloudflare** devant l'application principale. Le trafic HTTP/HTTPS arrive directement sur le VPS Scaleway via Caddy (`commun/deploy/Caddyfile`), sans couche de filtrage réseau en amont (pas de protection anti-DDoS volumétrique niveau réseau, pas de cache edge, pas de règles WAF applicatives).

Ce point est **toujours bloqué** au 2026-08-07 selon `OPS-PRIORITIES.md` — la cause documentée est l'absence d'accès aux DNS OVH nécessaires pour basculer le proxy Cloudflare (action manuelle fondateur, hors périmètre code).

**Note de nuance :** Cloudflare **est** utilisé pour le **live streaming** (Cloudflare Stream, ingest RTMP → HLS/CDN), mais **pas** en frontal de l'application web/API principale (`getsoundy.com`).

**Risque : 🟠 Élevé** — en cas d'attaque volumétrique (DDoS L3/L4/L7) ciblant directement l'IP du VPS, aucune protection réseau dédiée n'absorbe le trafic avant qu'il n'atteigne le serveur applicatif unique (SPOF, voir Phase 12).

**Recommandation :** activer le proxy Cloudflare (DNS + WAF + cache) dès que l'accès DNS OVH est débloqué — action déjà identifiée comme priorité 1 dans `OPS-PRIORITIES.md`, effort technique faible une fois l'accès obtenu.

---

## 6.2 Protection des endpoints coûteux

**Constat (recoupement avec Phase 5 §5.6) :**

| Endpoint coûteux | Rate limiting dédié | Protection additionnelle |
|---|---|---|
| Upload média (reels/compositions/stories/photo profil/PJ chat) | ✅ Oui (12-25 req selon surface) | Vérification magic-bytes, scan Sightengine bloquant, plafond de durée vidéo |
| Démarrage d'un live | ❌ **Non** | Garde anti-doublon host uniquement (pas de throttling par fréquence de démarrage) |
| Recherche (search/users/music) | ❌ **Non** | Couvert uniquement par le plafond global 300 req/60s/IP |
| Envoi de message | ✅ Oui (12/10s/utilisateur) | — |

**Risque : 🟠 Élevé** sur le démarrage de live et la recherche — ce sont typiquement les endpoints les plus coûteux en ressources (création de room LiveKit/Cloudflare, requêtes de recherche full-text/DB) et les plus ciblés lors d'attaques applicatives par abus (au-delà d'un DDoS réseau classique).

**Recommandation :** voir Phase 5 §5.6 — ajouter des limiteurs dédiés sur ces deux familles d'endpoints en priorité.

---

## 6.3 Mécanismes anti-bot (captcha, détection comportementale)

**Constat :**
- **Recherche exhaustive** sur l'ensemble du dépôt (backend + frontend) des termes `captcha`, `turnstile`, `recaptcha`, `hcaptcha` : **0 occurrence**.
- **Aucun captcha** sur le formulaire d'inscription, ni sur le formulaire de mot de passe oublié.
- **Aucune détection comportementale** de type création de comptes en masse, vélocité anormale de follows/likes, ou fingerprinting anti-bot — recherche de termes (`suspicious`, `anomaly`, `abuse` côté heuristiques compte) infructueuse hors modération de texte (spam de messages).

**Risque : 🟠 Élevé** — l'inscription et la réinitialisation de mot de passe reposent uniquement sur le rate limiting IP/email (Phase 5 §5.1), ce qui ralentit mais n'empêche pas des campagnes de création de comptes automatisées distribuées sur de nombreuses IP (bien plus facile à contourner qu'un captcha).

**Recommandation :** intégrer Cloudflare Turnstile (gratuit, faible friction UX, cohérent avec la recommandation §6.1 d'activer Cloudflare) sur `/register` et `/forgot-password` au minimum ; envisager des vélocity checks applicatifs (ex. max N comptes créés depuis la même IP/24h, max N follows/likes par heure) en complément.

---

## 6.4 Stratégie de scaling en cas de pic de trafic

**Constat :**
- **PM2 configuré en `instances: 1`** (`commun/deploy/ecosystem.config.cjs:31-39`), volontairement limité à un seul worker car le store applicatif en mémoire n'est pas partagé entre workers (voir `DBI-1`/Phase 2) — remonter `instances` sans refonte réintroduirait des incohérences (401 aléatoires).
- **Aucun auto-scaling horizontal** opérationnel : 1 VPS unique, scaling vertical uniquement (redimensionnement manuel de l'instance Scaleway).
- Le code est **prêt techniquement** pour un scaling horizontal (adaptateur Redis pour Socket.io déjà implémenté — `lib/socketCluster.ts`, branché conditionnellement si `REDIS_URL` défini), mais **non exploitable tant que `instances: 1`** reste la contrainte de sécurité fonctionnelle.
- **Les composants réellement scalables sous forte charge de live streaming sont externalisés** (LiveKit Cloud, Cloudflare Stream) et gèrent nativement les pics d'audience côté flux vidéo. En revanche, **l'API applicative et Socket.io (chat live, présence, actions host)** restent bornés par la capacité d'un unique process Node sur un unique VPS.

**Risque : 🔴 Critique** pour un pic de trafic significatif (ex. live à forte audience avec chat actif, pic viral sur les reels) — le goulot d'étranglement n'est pas le flux vidéo (externalisé et scalable) mais l'API/chat applicatif, qui ne peut absorber une charge supérieure à la capacité d'une seule instance verticale.

**Recommandation :** prioriser la refonte du store applicatif (source de vérité partagée PostgreSQL/Redis, cf. Phase 2 `DBI-1`/`DBI-3`) pour permettre de repasser `instances` à une valeur > 1 en toute sécurité, puis activer l'adaptateur Redis Socket.io déjà présent dans le code.

---

## 6.5 HTTPS/TLS

Traité en détail en Phase 5 §5.7 (chiffrement du trafic, y compris live). Rappel synthétique : ✅ conforme sur le domaine principal et les flux live standard (RTMPS/HLS/WSS) ; 🟡 point d'attention sur le fallback RTMP clair et l'accès HTTP direct par IP.

---

## Synthèse des risques — Phase 6

| # | Sujet | Risque | Effort |
|---|---|---|---|
| DDOS-1 | Pas de CDN/WAF (Cloudflare) devant l'app principale (`API-2`) | 🟠 Élevé | M (accès DNS externe requis) |
| DDOS-2 | Pas de rate limiter dédié sur `lives/start` et recherche | 🟠 Élevé | S/M |
| DDOS-3 | Aucun captcha à l'inscription/reset password | 🟠 Élevé | S (une fois Cloudflare actif) |
| DDOS-4 | Aucune détection de comportement anormal (mass signup, mass follow/like) | 🟠 Élevé | M |
| DDOS-5 | Scaling horizontal bloqué par le store RAM (`instances: 1`), pas d'auto-scale | 🔴 Critique (à l'échelle) | XL |
