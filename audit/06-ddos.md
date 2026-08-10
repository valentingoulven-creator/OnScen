# Phase 6 — Protection DDoS & abus

**Date :** 2026-08-10  
**Périmètre :** `commun/deploy/OPS-PRIORITIES.md`, `CLOUDFLARE-CDN-WAF.md`, rate limits, PM2

---

## 6.1 CDN / WAF

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Cloudflare site | Doc indique statut **bloqué** : zone DNS absente (OVH direct → VPS) | **élevé** | Exécuter guide `CLOUDFLARE-CDN-WAF.md` (proxy orange) |
| Cloudflare Stream | Déjà utilisé pour live video | faible | Distinct du WAF site |
| Caddy seul | Origin exposé ; pas de scrubbing L7 edge | **élevé** | WAF + rate limit edge |

---

## 6.2 Endpoints coûteux

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Live start | `liveStartLimiter` 8 / 10 min / user | faible | — |
| Search | `searchLimiter` 60/min | faible | Cache Redis résultats populaires |
| Upload média | Auth requise ; pas de WAF body size edge | **moyen** | Limite taille Caddy + S3 direct upload signé |
| Tiles map | `tileLimiter` présent | faible | — |

---

## 6.3 Anti-bot inscription / reset

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Captcha | Recherche `turnstile|recaptcha|hcaptcha` : **aucune intégration code** | **élevé** | Cloudflare Turnstile sur register + forgot-password |
| Access control prod | Inscriptions fermées par défaut (`ACCESS_CONTROL`) atténue le risque | **moyen** | Captcha avant ouverture registrations |
| Turnstile mention | `modification.txt` liste comme action manuelle restante | **élevé** | Compte CF + clés env |

---

## 6.4 Scaling & pics

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| PM2 | **`instances: 1`** volontaire (store RAM non partagé) | **critique** pour viralité | Refonte store ou sharding sessions |
| Socket.io | Redis adapter présent — scaling horizontal possible **après** store partagé | **élevé** | — |
| Live audience | LiveKit / Cloudflare absorbent flux vidéo | faible | Surveiller quota LiveKit 100 participants plan free |
| Auto-scaling | Aucun sur VPS | **élevé** | Second VPS + load balancer post-refonte store |

---

## 6.5 Détection comportementale

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Follow/like limits | Ajoutés 2026-08 | faible | Alertes admin si seuils 429 massifs |
| Comptes massifs | Pas de heuristique « 50 comptes / IP / jour » | **moyen** | Job batch + flag admin |

---

## 6.6 Synthèse phase 6

**WAF Cloudflare site** + **captcha** + **scaling API (store)** = triptyque anti-abus à fort trafic.
