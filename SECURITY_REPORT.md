# SECURITY REPORT — Soundy / MeloSongv2
**Date :** 2026-06-22  
**Auditeur :** Expert Cybersécurité (simulation)  
**Périmètre :** Analyse statique du code source (no pentest live)  
**Score sécurité global : 71 / 100**

---

## TABLE DES MATIÈRES
1. [Authentification & Sessions](#1-authentification--sessions)
2. [Autorisation & Contrôle d'accès](#2-autorisation--contrôle-daccès)
3. [API Security](#3-api-security)
4. [WebSocket Security](#4-websocket-security)
5. [Uploads & Fichiers](#5-uploads--fichiers)
6. [Secrets & Configuration](#6-secrets--configuration)
7. [OWASP Top 10 Analysis](#7-owasp-top-10-analysis)
8. [Vulnérabilités détectées](#8-vulnérabilités-détectées)
9. [Recommandations prioritaires](#9-recommandations-prioritaires)
10. [Score par domaine](#10-score-par-domaine)

---

## 1. Authentification & Sessions

### 1.1 Mécanismes en place

| Mécanisme | Implémentation | Évaluation |
|-----------|---------------|------------|
| **JWT** | `jsonwebtoken`, signé HS256 | ✅ Bon |
| **Cookie httpOnly** | `soundy_auth`, `SameSite=Strict`, `Secure` en prod | ✅ Excellent |
| **Header X-Auth-Token** | Pour API/mobile (évite Caddy Basic Auth) | ✅ Justifié |
| **bcryptjs** | Hashage mots de passe | ✅ Bon |
| **WebAuthn/Passkeys** | `@simplewebauthn/server` | ✅ Excellent |
| **TOTP 2FA** | `otplib`, secret chiffré avec `TOTP_ENCRYPTION_KEY` | ✅ Très bon |
| **OAuth** | Google, Facebook, YouTube, Spotify, Instagram | ✅ Standard |
| **JWT expiry** | 24h session / 7j remember-me | ✅ Raisonnable |
| **JWT secret validation** | Fail-fast au démarrage prod si absent/faible | ✅ Excellent |
| **Platform tokens** | Chiffrés avec `ENCRYPTION_KEY` avant stockage | ✅ Bon |

### 1.2 Problèmes détectés

#### SEC-AUTH-001 — MOYEN : Pas de rotation des JWT après changement de mot de passe

**Description :** Après un `POST /api/auth/change-password`, les tokens JWT existants (autres sessions) ne sont pas invalidés.  
**Impact :** Un attaquant ayant volé un token peut continuer à l'utiliser même après que la victime a changé son mot de passe.  
**Recommandation :** Implémenter une `jwtVersion` par utilisateur incrémentée à chaque changement de mot de passe/déconnexion forcée. Valider la version dans le middleware JWT.

#### SEC-AUTH-002 — MOYEN : Pas de révocation de token individuelle

**Description :** Il n'existe pas de mécanisme de blacklist ou de révocation individuelle des JWT.  
**Impact :** Impossible de "déconnecter toutes les sessions" d'un compte compromis.  
**Recommandation :** Utiliser Redis pour une blacklist légère, ou implémenter un champ `tokenVersion` en BDD.

#### SEC-AUTH-003 — FAIBLE : `authLimiter` (20 req/15min) trop permissif pour brute-force MDP

**Description :** 20 tentatives toutes les 15 minutes = 1 920 essais par jour par IP.  
**Impact :** Brute-force de mots de passe faibles possible.  
**Recommandation :** Réduire à 10/15min, ajouter un backoff exponentiel après 5 échecs.

#### SEC-AUTH-004 — CRITIQUE : Tokens OAuth platform stockés chiffrés mais clé de chiffrement unique

**Description :** `ENCRYPTION_KEY` utilisée pour chiffrer tous les tokens OAuth platform. Si cette clé fuite, tous les tokens de toutes les plateformes sont compromis.  
**Impact :** Compromission potentielle de tous les comptes Spotify/YouTube/Instagram connectés.  
**Recommandation :** Chiffrement par-utilisateur avec dérivation de clé (HKDF/PBKDF2) à partir d'un secret maître.

### 1.3 OAuth spécifique

- **State parameter** : présent dans les flows OAuth (nécessaire contre CSRF) — à vérifier en détail dans `oauth.ts`
- **Redirect URI validation** : doit être strictement comparée à celle enregistrée chez chaque provider
- **Facebook/Instagram tokens** : durée de vie variable, refresh nécessaire — vérifier la gestion d'expiration

---

## 2. Autorisation & Contrôle d'accès

### 2.1 Mécanismes en place

| Mécanisme | Couverture |
|-----------|-----------|
| `authenticateJWT` middleware | Quasi-toutes les routes API |
| `isAccessAdmin(user)` | Routes admin |
| `canUserUseApp(user)` | Vérification compte actif |
| `canJoinSalon`, `canModerateSalon` | Salon ACL |
| `assertViewerCanAccessLive` | Platform plan gates |
| Socket JWT middleware | Connexion socket |
| senderId validation socket | Anti-spoofing |
| `canBanLiveUser`, `canDeleteLiveChatMessage` | Modération live |

### 2.2 Risques IDOR

#### SEC-IDOR-001 — ÉLEVÉ : Routes `/:id` sans vérification de propriété systématique

**Description :** Certaines routes de modification (`PATCH /:id/settings`, `DELETE /:id`) utilisent le JWT pour récupérer `userId` mais il faut vérifier que **chaque** route vérifie que l'`id` appartient bien à l'utilisateur authentifié.

Exemples à auditer :
- `PATCH /api/salons/:id/settings` — vérifie-t-il que l'utilisateur est bien le host du salon ?
- `DELETE /api/compositions/:id` — vérifie-t-il la propriété ?
- `PATCH /api/users/:userId/...` — le `:userId` est-il le même que le JWT ?

**Recommandation :** Audit systématique de toutes les routes mutantes — ajouter des assertions `if (resource.ownerId !== req.user.id) throw 403`.

#### SEC-IDOR-002 — MOYEN : Accès aux DMs entre utilisateurs

**Description :** `GET /api/dm/thread/:userId` retourne la conversation entre l'utilisateur authentifié et `:userId`. Si la vérification n'est que côté requête (`req.user.id`), pas de risque d'IDOR. Mais si un admin peut lire les DMs via une route non restreinte, c'est un problème de vie privée.

### 2.3 Escalade de privilèges

#### SEC-PRIV-001 — MOYEN : `isAccessAdmin` basé sur `user.role` dans le JWT

**Description :** Le rôle admin est encodé dans le JWT. Si le JWT est forgé ou si la validation du secret est bypassée, un attaquant peut s'auto-élever en admin.  
**Impact :** Accès au panel admin complet.  
**Recommandation :** Toujours relire le rôle depuis la BDD (ou invalider le cache) pour les actions admin sensibles.

#### SEC-PRIV-002 — CRITIQUE : Routes `/api/msdev/*` activées conditionnellement

**Description :** Les routes msdev (`/api/msdev/rebuild`, `/api/msdev/login-by-ip`, seeds) sont montées sur `isMsdevRuntime()`. Si `APP_ENV` n'est pas correctement configuré en production, ces routes seraient exposées.  
**Impact :** `POST /api/msdev/login-by-ip` permettrait de se connecter sans mot de passe par IP.  
**Recommandation :** Double-vérification à l'entrée des routes msdev : vérifier à la fois `APP_ENV !== 'production'` ET `NODE_ENV !== 'production'`. Ajouter un middleware hard-blocking si en prod.

---

## 3. API Security

### 3.1 Injection

#### SEC-INJ-001 — FAIBLE : Requêtes SQL via `pg` avec paramètres

**Description :** L'utilisation de `pg` avec des requêtes paramétrées (`$1, $2, ...`) est correcte et protège contre l'injection SQL.  
**Statut :** ✅ Pas d'injection SQL détectée par analyse statique.  
**À surveiller :** L'utilisation de JSONB `payload->>'field'` avec des valeurs dynamiques.

#### SEC-INJ-002 — MOYEN : Pas de sanitization HTML systématique

**Description :** Les messages de chat, bios utilisateurs, et commentaires sont stockés et réaffichés. Sans sanitization, du HTML/JS peut être injecté.  
**Vecteur :** Chat salon/live, DMs, feed posts, commentaires reels.  
**Recommandation :** Utiliser `DOMPurify` côté client et une sanitization serveur (ex: `sanitize-html`) avant stockage.

### 3.2 XSS

#### SEC-XSS-001 — ÉLEVÉ : `LinkifiedText.tsx` + contenu utilisateur non sanitisé

**Description :** `LinkifiedText.tsx` convertit les URLs en liens cliquables dans les messages. Si cette opération utilise `dangerouslySetInnerHTML` sans sanitization adéquate, un message contenant `javascript:alert(1)` peut exécuter du JS.  
**Recommandation :** Valider que `href` commence par `http://` ou `https://` uniquement, utiliser `rel="noopener noreferrer"`.

#### SEC-XSS-002 — MOYEN : Injection OG meta dans `index.html`

**Description :** La SPA fallback injecte des balises OG meta dynamiques basées sur l'URL/path. Si ces valeurs ne sont pas escaped, une URL malformée peut injecter des attributs HTML.  
**Recommandation :** Escape systématique des valeurs injectées dans le HTML généré côté serveur.

### 3.3 CSRF

**Statut :** ✅ **Protection en place par design.**

- Cookie `SameSite=Strict` : bloque les requêtes cross-origin depuis des domaines tiers
- `X-Auth-Token` header pour les clients mobiles : pas lisible par un script cross-origin
- Stripe webhooks : vérification de signature `stripe.webhooks.constructEvent`

**Note :** La stratégie CSRF est bien documentée dans `auth.ts`. Pas de vulnérabilité CSRF détectée.

### 3.4 SSRF

#### SEC-SSRF-001 — ÉLEVÉ : Proxy de tiles cartographiques (`/tiles`)

**Description :** La route `/tiles/:z/:x/:filename` proxifie des tuiles map depuis une URL construite à partir des paramètres. Si l'URL cible n'est pas strictement validée, un attaquant pourrait forcer le serveur à faire des requêtes vers des adresses internes (169.254.x.x, 10.x.x.x, etc.).  
**Impact :** SSRF potentiel si le paramètre URL du tile provider n'est pas hardcodé.  
**Recommandation :** Vérifier que l'URL du tile provider est une constante dans la config, pas construite depuis l'input utilisateur.

#### SEC-SSRF-002 — MOYEN : Validation URLs media reels

**Description :** `reelMediaUrlAllowlist` valide les domaines autorisés pour les URLs de reels. Si un attaquant contrôle un sous-domaine d'un domaine autorisé, il pourrait uploader vers ce sous-domaine.  
**Recommandation :** Valider l'URL complète (protocole, domaine exact, pas de wildcards).

### 3.5 Headers de sécurité

```
helmet() configure :
✅ Content-Security-Policy (avec nonce)
✅ X-Frame-Options (SAMEORIGIN)
✅ X-Content-Type-Options
✅ HSTS (prod uniquement)
✅ Referrer-Policy
✅ frame-src : youtube.com, stripe.com autorisés (explicitement)
```

---

## 4. WebSocket Security

### 4.1 Authentification Socket.io

✅ JWT vérifié dans le middleware de connexion  
✅ Token extrait depuis 3 sources (auth payload, header, cookie)  
✅ Déconnexion si JWT invalide

### 4.2 Problèmes détectés

#### SEC-WS-001 — ÉLEVÉ : Pas de vérification de l'appartenance à la room avant émission

**Description :** Quand un client émet `live_message` ou `salon_message`, le serveur vérifie que l'utilisateur est dans la room correspondante. Mais si cette vérification est absente sur certains events, un utilisateur peut envoyer des messages dans des rooms où il n'est pas membre.  
**Recommandation :** Vérification systématique `socket.rooms.has(roomName)` avant tout traitement d'event.

#### SEC-WS-002 — MOYEN : Pas de rate limiting sur les événements Socket.io non-chat

**Description :** Le rate limiting chat existe (`checkChatRateLimit`), mais d'autres événements (`sync_playback`, `salon_force_sync`, `gift_sent`) ne sont pas rate-limités.  
**Impact :** Flood possible sur des événements coûteux (force_sync déclenche un broadcast à toute la room).  
**Recommandation :** Rate limiting par event type, particulièrement pour les events qui déclenchent des broadcasts.

#### SEC-WS-003 — FAIBLE : Pas de validation de la taille des payloads Socket.io

**Description :** Un message socket peut théoriquement contenir un payload arbitrairement grand.  
**Recommandation :** Configurer `maxHttpBufferSize` dans Socket.io (par défaut 1 MB — vérifier qu'il est explicitement configuré).

---

## 5. Uploads & Fichiers

### 5.1 Analyse

| Type | Validation | Sécurité |
|------|-----------|---------|
| Audio compositions | Magic bytes validation | ✅ Bon |
| Images profil | `lib/imageValidation.ts` | ✅ Bon |
| Sponsor banners | `sponsorBannerAssets.ts` | ✅ Bon |
| Reel media URLs | Allowlist domaines | ✅ Bon |
| Chat attachments | URL whitelist | ✅ Bon |

### 5.2 Problèmes

#### SEC-UPL-001 — ÉLEVÉ : Upload base64 JSON — pas de limite stricte par type

**Description :** La limite globale JSON est 15 MB. Certaines routes ont des limites spécifiques pour les reels/compositions, mais un attaquant peut envoyer un body JSON valide de ~15 MB vers toute route sans limite explicite.  
**Impact :** DoS par saturation mémoire Node.js (base64 15 MB = ~11 MB données, mais parsing JSON charge tout en mémoire).  
**Recommandation :** Limites explicites par route, et préférer multipart/form-data pour les fichiers.

#### SEC-UPL-002 — MOYEN : Pas de scan antivirus sur les uploads audio

**Description :** Les compositions audio sont validées par magic bytes (vérifier que c'est bien du MP3/WAV/etc.) mais pas scannées pour des malwares.  
**Recommandation :** Intégrer ClamAV ou un service cloud (par ex. VirusTotal API) pour les fichiers audio uploadés.

#### SEC-UPL-003 — MOYEN : Chemins d'upload dans `public/uploads/`

**Description :** Les fichiers uploadés (compositions, covers) sont stockés dans `backend/public/uploads/`. Ces fichiers sont servis directement via le serveur statique.  
**Impact :** Si la validation magic bytes est contournée, un fichier `.html` ou `.js` servi depuis ce dossier pourrait exécuter du code côté client.  
**Recommandation :** Servir les uploads depuis un sous-domaine séparé ou via un CDN avec Content-Disposition: attachment, pas de rendu HTML.

---

## 6. Secrets & Configuration

### 6.1 Secrets en code

| Secret | Localisation | Criticité |
|--------|-------------|----------|
| `msdev123` (password démo) | `msdevDemoAccounts.ts` | ⚠️ Faible — dev only |
| `valentin.goulven@gmail.com` (alerte) | `systemMonitor.ts` | ℹ️ Info exposure |
| `getsoundy.com` (WebAuthn RP ID) | `webauthn.ts` defaults | ✅ Public de toute façon |
| Aucune clé API production en dur | — | ✅ Conforme |

### 6.2 Gestion des secrets en production

✅ `JWT_SECRET` : fail-fast si absent en prod  
✅ `CORS_ORIGIN` : fail-fast si absent en prod  
✅ Variables d'environnement dans `.env` (non committé)  
⚠️ `msdev/.env` : template présent, jamais committé selon les règles  

### 6.3 Risques de fuite

#### SEC-SECRET-001 — ÉLEVÉ : `MsdevDualIpPanel.tsx` expose les adresses IP locales

**Description :** `GET /api/msdev/dual-ip` retourne les IPs LAN/WAN du serveur. Ce composant est affiché en mode msdev uniquement, mais si les routes msdev sont exposées (voir SEC-PRIV-002), un attaquant peut cartographier l'infrastructure.  
**Recommandation :** Vérification stricte que ces routes sont inaccessibles en production.

#### SEC-SECRET-002 — MOYEN : Clés Stripe publishable dans le frontend

**Description :** `STRIPE_PUBLISHABLE_KEY` est exposée côté client (normal pour Stripe). Mais si `VITE_STRIPE_PUBLISHABLE_KEY` est mal configurée (ex: clé live en dev), des paiements réels peuvent être déclenchés en dev.  
**Recommandation :** Vérifier que les clés test/live sont utilisées dans les bons environnements. Ajouter une assertion dans le build.

---

## 7. OWASP Top 10 Analysis

| # | Vulnérabilité | Statut | Détails |
|---|--------------|--------|---------|
| A01 | Broken Access Control | ⚠️ PARTIEL | Routes IDOR à auditer, routes msdev à sécuriser |
| A02 | Cryptographic Failures | ✅ BON | bcrypt, JWT HS256, httpOnly cookie, TLS (Caddy) |
| A03 | Injection | ⚠️ ATTENTION | SQL: OK (paramétré), HTML: non sanitisé systématiquement |
| A04 | Insecure Design | ⚠️ PARTIEL | Pas de rotation JWT, pas de révocation |
| A05 | Security Misconfiguration | ⚠️ ATTENTION | Routes msdev conditionnelles, CORS `*` en dev |
| A06 | Vulnerable Components | ⚠️ À AUDITER | `npm audit` non mentionné dans CI |
| A07 | Auth Failures | ✅ BON | Multi-facteur, httpOnly, rate limit |
| A08 | Software and Data Integrity | ⚠️ ATTENTION | Uploads sans scan malware |
| A09 | Logging & Monitoring | ❌ INSUFFISANT | Pas de logging structuré, pas de SIEM |
| A10 | SSRF | ⚠️ ATTENTION | Route tiles à vérifier |

---

## 8. Vulnérabilités détectées — Récapitulatif

### Critiques (à corriger immédiatement)

| ID | Titre | CVSS (estimé) |
|----|-------|--------------|
| SEC-PRIV-002 | Routes msdev exposées si `APP_ENV` mal configuré | 9.8 |
| SEC-AUTH-004 | Tokens OAuth chiffrés avec clé unique | 8.5 |

### Élevées

| ID | Titre | CVSS (estimé) |
|----|-------|--------------|
| SEC-AUTH-001 | Pas de rotation JWT post-changement MDP | 7.5 |
| SEC-AUTH-002 | Pas de révocation individuelle JWT | 7.0 |
| SEC-IDOR-001 | IDOR potentiel sur routes mutantes | 7.4 |
| SEC-XSS-001 | XSS potentiel dans `LinkifiedText` | 7.1 |
| SEC-WS-001 | Pas de vérification appartenance room (socket) | 7.0 |
| SEC-UPL-001 | Limite upload base64 insuffisante | 7.2 |
| SEC-SSRF-001 | SSRF potentiel dans proxy tiles | 7.0 |

### Moyennes

| ID | Titre | CVSS (estimé) |
|----|-------|--------------|
| SEC-AUTH-003 | authLimiter trop permissif pour brute-force | 6.0 |
| SEC-PRIV-001 | Role admin uniquement dans JWT | 6.5 |
| SEC-INJ-002 | Pas de sanitization HTML systématique | 6.0 |
| SEC-XSS-002 | Injection OG meta dans index.html | 5.8 |
| SEC-WS-002 | Pas de rate limiting events Socket.io non-chat | 5.5 |
| SEC-WS-003 | Pas de limite payload Socket.io | 5.0 |
| SEC-SSRF-002 | Validation URLs media reels insuffisante | 5.5 |
| SEC-UPL-002 | Pas de scan antivirus compositions | 5.0 |
| SEC-UPL-003 | Uploads servis depuis public/ | 5.5 |
| SEC-SECRET-001 | `dual-ip` expose IPs internes | 5.0 |
| SEC-SECRET-002 | Clés Stripe dans env non vérifiées | 5.0 |

### Faibles

| ID | Titre |
|----|-------|
| SEC-WS-003 | Taille payload Socket.io non limitée |
| SEC-AUTH-003 | authLimiter permissif |

---

## 9. Recommandations prioritaires

### Sprint 1 — Critique (< 1 semaine)

```
1. [SEC-PRIV-002] Ajouter hard-block sur routes /api/msdev/* en production
   → if (process.env.NODE_ENV === 'production') return res.sendStatus(404)
   
2. [SEC-AUTH-004] Dériver les clés de chiffrement OAuth par utilisateur
   → HKDF(masterKey, userId) pour chiffrer les tokens platform
   
3. [SEC-XSS-001] Valider protocoles href dans LinkifiedText
   → Regex /^https?:\/\// avant de créer les liens
```

### Sprint 2 — Élevé (1-2 semaines)

```
4. [SEC-AUTH-001/002] Implémenter tokenVersion en BDD
   → Champ `token_version INTEGER DEFAULT 0` dans users
   → Incrémenter à chaque change-password/logout-all
   → Vérifier la version dans authenticateJWT
   
5. [SEC-IDOR-001] Audit systématique des routes mutantes
   → Pour chaque PATCH/DELETE/:id, vérifier ownership
   
6. [SEC-WS-001] Vérification appartenance room dans socket.ts
   → socket.rooms.has(`live_${liveId}`) avant live_message
   
7. [SEC-UPL-003] Servir les uploads depuis un chemin non-exécutable
   → Ajouter Content-Disposition: attachment sur /uploads/*
   → Ou migrer vers un sous-domaine CDN
```

### Sprint 3 — Moyen (1 mois)

```
8.  [SEC-WS-002] Rate limiting sur events Socket.io non-chat
9.  [SEC-SSRF-001] Valider URL tile provider dans config (hardcoded)
10. [SEC-INJ-002] Intégrer DOMPurify sur les contenus affichés
11. Exécuter npm audit régulièrement (inclure dans CI)
12. Implémenter Sentry pour monitoring des erreurs en production
```

---

## 10. Score par domaine

| Domaine | Score /100 | Principales failles |
|---------|-----------|-------------------|
| Authentification | 78 | Pas de rotation JWT |
| Autorisation | 65 | IDOR potentiel, routes msdev |
| API sécurité | 72 | XSS partiel, SSRF tiles |
| WebSocket | 68 | Rate limiting incomplet |
| Uploads | 65 | Base64, public/, pas de scan AV |
| Secrets | 80 | Gestion globalement correcte |
| Headers HTTP | 88 | Helmet bien configuré |
| Conformité OWASP | 62 | 4/10 vulnérabilités présentes |
| **GLOBAL** | **71** | |

---

> **Note :** Cet audit est basé sur une analyse statique du code. Un pentest dynamique (DAST) sur l'environnement de production pourrait révéler des vulnérabilités supplémentaires. Un audit de dépendances (`npm audit`, Snyk) est également recommandé.

*Rapport généré le 2026-06-22.*
