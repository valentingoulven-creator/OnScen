# Audit technique OnScen — Phase 5 : Sécurité applicative

**Date :** 2026-08-07
**Méthode :** revue de `routes/auth.ts`, `twoFactor.ts`, `webauthn.ts`, `lib/loginAttemptLimit.ts`, `uploadRateLimits.ts`, `accessControl.ts`, `server.ts` (Helmet/CSP/CORS), croisement avec les findings SEC-1 à SEC-9 de `commun/docs/audit/AUDIT-CONSOLIDE.md` (2026-07-22) revérifiés à ce jour.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

---

## 5.1 Authentification

### Hashing des mots de passe
✅ `bcrypt`, coût **12** en production (`routes/auth.ts:5,193`). Conforme (voir aussi Phase 2 §2.5).

### 2FA
✅ Disponible via **TOTP** (`otplib`, `routes/twoFactor.ts`) et **WebAuthn/Passkeys** (`@simplewebauthn/server`, `routes/webauthn.ts`) :
- Secrets TOTP chiffrés AES-256-GCM (`TOTP_ENCRYPTION_KEY`, obligatoire en prod).
- Codes de secours hashés bcrypt coût 8.
- Login avec 2FA active → JWT de portée restreinte `2fa_pending` (5 min) avant validation du second facteur (`auth.ts:327-335`).
- Rate limit dédié sur la validation 2FA : **5 req / 15 min**.

🟡 **Optionnelle pour tous les comptes, y compris les comptes admin.** La DPIA du produit liste elle-même « 2FA obligatoire pour l'accès admin » comme un point **non réalisé** (`web/app/src/content/legal/dpia.ts:126`).

**Recommandation :** rendre la 2FA obligatoire pour tout compte `isAdmin`/staff (garder l'opt-in pour les comptes standards).

### Gestion des sessions / tokens JWT
- JWT HS256, whitelistage strict, révocation par version (`tokenVersion`) — confirmé stable par `AUDIT-CONSOLIDE.md` (points positifs reconfirmés), correspond à `TODO-MANUAL.md ELEV-01 ✅`.
- Cookies httpOnly/Secure/SameSite=Strict côté web (`TODO-MANUAL.md CRIT-01 ✅`).
- Fallback JWT hardcodé en dev/msdev **supprimé** (`jwtSecret.ts` — `throw` strict hors `NODE_ENV==='test'`) — **SEC-3 ✅ résolu**.

### Protection brute-force sur le login
✅ Deux couches complémentaires, conformes :

| Couche | Limite | Fichier |
|---|---|---|
| Par IP | **8 req / 15 min** sur `/login`, `/register`, `/change-password`, `/forgot-password`, `/reset-password` | `server.ts:455-474` |
| Par email | **10 échecs / 15 min** (compteur Redis/mémoire, reset au succès) | `lib/loginAttemptLimit.ts:5-6,39-58`, `auth.ts:282-307` |

🟡 Pas de **verrouillage de compte** après N échecs (seulement un throttling temporaire des tentatives) — le blocage définitif reste une action admin manuelle (`accountStatus`/`blockedUntil`). Acceptable pour la volumétrie actuelle, mais pas de mécanisme de type « compte suspendu après 20 échecs consécutifs, déblocage par email » qui limiterait davantage le credential stuffing distribué sur des dizaines d'IP différentes.

**Recommandation :** conforme pour un usage courant ; envisager un verrou temporaire de compte (indépendant de l'IP) en complément si des campagnes de credential stuffing distribué sont observées.

---

## 5.2 Autorisation — IDOR

**Constat (hérité, reconfirmé) :** `AUDIT-CONSOLIDE.md` rapporte **« 0 IDOR trouvé »** sur les deux passes d'audit successives, avec un pattern homogène `authenticateJWT` + `requireAdmin` sur 8+ routers admin. Cette phase n'a pas identifié de nouveau pattern IDOR sur les routes ajoutées récemment (modération chat, monétisation, follow notifications).

**Risque : 🟢 Faible** sur la base des vérifications disponibles. Ce point mériterait un test d'intrusion ciblé (remplacement d'ID dans l'URL sur les routes DM/reels/profils) pour une confirmation exhaustive au-delà de la revue de code statique — non réalisable depuis ce poste sans environnement de test dédié.

---

## 5.3 Injections (SQL/NoSQL)

**Constat (hérité, reconfirmé) :** `AUDIT-CONSOLIDE.md` rapporte **« 0 SQLi trouvé »** sur les deux passes, requêtes paramétrées via `pg` (`$1, $2...`) de façon homogène.

**Point résiduel connu (DBI-10, non nouveau) :** interpolation de nom de **table** (pas de valeur utilisateur) dans `pruneCompositePairs()` (`lib/pgStoreSocialSync.ts`) — paramètres internes uniquement, pas d'entrée utilisateur actuellement injectable, mais pattern fragile si réutilisé un jour avec une entrée externe.

**Risque : 🟢 Faible** actuellement, 🟡 **par hygiène de code** pour le pattern résiduel.

**Recommandation :** corriger le pattern d'interpolation de nom de table par une liste blanche explicite, même en l'absence d'exploitation actuelle.

---

## 5.4 XSS / CSRF

**Constat (hérité, reconfirmé) :** `AUDIT-CONSOLIDE.md` rapporte **« 0 XSS trouvé »**, upload avec vérification magic-bytes, CORS fail-closed, OAuth avec `state` anti-CSRF, webhooks Stripe signés.

**Nuance identifiée lors de la Phase 7 (modération) de cet audit :** certaines surfaces de texte utilisateur ne passent **que** par une sanitization HTML générique (`sanitizeUserText`/`sanitizePlainText`), sans passer par la politique de modération lexicale complète : bio profil, commentaires feed, et surtout **commentaires reels qui ne passent ni par le sanitizer ni par la policy de modération** (`reels.ts:235-244`, `addReelComment` stocke `content` brut — voir Phase 7 §7.3). Ce n'est pas un XSS confirmé (à vérifier si le rendu frontend échappe correctement le HTML), mais une incohérence de traitement qui mérite vérification.

**Risque : 🟢 Faible pour XSS/CSRF confirmé** ; 🟡 **Moyen** sur le point spécifique des commentaires reels stockés bruts (à vérifier côté rendu React — si le contenu est affiché via `{content}` JSX standard, React échappe par défaut et le risque XSS reste nul ; le risque réel porte alors sur l'absence de modération de contenu, traité en Phase 7).

**Recommandation :** confirmer que le rendu des commentaires reels utilise un affichage texte échappé (pas de `dangerouslySetInnerHTML`), puis aligner `addReelComment` sur le même pipeline `sanitizeUserText`/`prepareChatText` que les autres surfaces de texte.

---

## 5.5 Secrets

**Constat (hérité, reconfirmé — SEC-1) :**
- Le `HEAD` actuel et `origin/master` sont **propres** (4 fichiers sensibles untrackés et confirmés absents).
- **L'historique Git contient toujours** un commit antérieur (`72370fc8`) avec les credentials réels (compte prod `getsoundy.com`, clé privée TLS, données perso/financières du fondateur) — la purge d'historique (BFG/`git filter-repo`) n'a **jamais été effectuée**, décision explicitement différée à l'utilisateur dans plusieurs audits successifs.
- Rotation du mot de passe du compte `yt.audit.demo2.soundy@gmail.com` toujours **non confirmée** (🔍 vérifiable uniquement manuellement, hors accès code).
- Aucune nouvelle fuite de secret identifiée dans les fichiers modifiés depuis le 22/07 (chat moderation, follow notifications, monetization summary — grep négatif sur clés/secrets dans ces nouveaux fichiers).

**Risque : 🟡 Moyen** (repo privé = facteur atténuant réel, mais l'historique reste une fuite totale récupérable par quiconque accède ou a accédé au dépôt).

**Recommandation (priorité déjà identifiée, toujours valable) :** (a) confirmer la rotation du mot de passe Gmail compte démo YouTube ; (b) purger l'historique Git après validation explicite utilisateur (opération destructive, réécrit tous les hash de commit — à planifier hors heures de forte activité de développement).

---

## 5.6 Rate limiting

**Constat détaillé (nouvelle recherche, cette phase) :**

### Couvert par un rate limiter dédié
| Zone | Limite |
|---|---|
| Auth sensible (login/register/reset) | 8 / 15 min / IP |
| Login par email | 10 échecs / 15 min |
| Upload reels/compositions/stories | 12 / 15 min |
| Photo profil | 20 / 15 min |
| Pièce jointe chat | 25 / 5 min |
| Messages (HTTP + Socket) | 12 / 10 s / utilisateur |
| Recherche YouTube (salons) | 40 / 5 min |
| Geo update/nearby/geocode | 30/min, 10-20/min, 30/15 min |
| Donations/subscriptions/reports | 15-30 / 20 min |
| Global (`/api`) | 300 req / 60 s (hors health/webhooks) |
| 2FA validate | 5 / 15 min |
| WebAuthn | 30 / 15 min |
| Export RGPD | 3 / heure |

### 🟠 Sans rate limiter dédié identifié (gaps confirmés)
| Endpoint | Constat |
|---|---|
| `POST /api/lives/start` | Aucun rate limiter (seule garde : anti-doublon host) |
| `GET /api/search`, `/api/users/search`, `/api/music/search` | Aucun rate limiter dédié |
| `POST /:id/follow` | Aucun |
| Likes feed/reels | Aucun |
| `feed.ts` (posts) | Pas de limiteur d'upload dédié |

Ces endpoints restent couverts uniquement par le rate limiter global (300 req/60s/IP sur tout `/api`), ce qui est **trop large** pour des actions coûteuses individuellement (démarrage d'un live consomme des ressources LiveKit/Cloudflare réelles, une recherche peut déclencher des requêtes DB non triviales).

**Risque : 🟠 Élevé** — un compte compromis ou un script pourrait démarrer/arrêter des lives en boucle, ou spammer la recherche/les follows, sans déclencher de protection dédiée avant le plafond global de 300 req/min (qui reste élevé pour ces actions spécifiques).

**Recommandation :** ajouter des limiteurs dédiés sur `POST /lives/start` (ex. 3-5/heure/utilisateur), `/search*` (ex. 30-60/min/utilisateur), follows et likes (ex. 60-120/min/utilisateur).

---

## 5.7 Chiffrement du trafic (HTTPS/TLS, WebRTC/RTMP)

**Constat :**
- **Domaines de production** (`getsoundy.com`, `staging.getsoundy.com`) : HTTPS avec certificats Let's Encrypt automatiques via Caddy, HSTS actif.
- **Lives** : LiveKit attend `wss://` (WebRTC chiffré DTLS-SRTP nativement par le protocole), Cloudflare Stream : ingest en **RTMPS** par défaut, lecture en HLS via HTTPS.
- 🟡 **Point d'attention :** un **fallback RTMP non chiffré** est exposé volontairement pour les logiciels de streaming externes (OBS) qui ne supportent pas RTMPS (`cloudflareStream.ts` — `CLOUDFLARE_RTMP_INGEST_URL`), et l'accès **HTTP simple par IP** reste actif sur le VPS en parallèle du HTTPS par domaine (transition documentée dans `Caddyfile`).
- La validation de `LIVEKIT_URL` accepte encore `ws://` en plus de `wss://` — risque de mauvaise configuration non détectée si un déploiement utilise par erreur une URL non chiffrée.

**Risque : 🟡 Moyen-Faible** — le chiffrement est correct par défaut sur les chemins critiques (domaine web, HLS, RTMPS, WebRTC natif), mais deux échappatoires existent (RTMP clair pour OBS, accès HTTP direct par IP) qui restent des surfaces d'interception possible si un attaquant est positionné sur le réseau entre le streamer/l'utilisateur et le VPS.

**Recommandation :** décourager fortement (ou retirer) le fallback RTMP clair en documentant uniquement RTMPS pour les créateurs ; supprimer l'accès HTTP par IP dès que possible ; valider strictement `wss://` en production dans `externalSecretsRegistry.ts`.

---

## Synthèse des risques — Phase 5

| # | Sujet | Risque | Effort |
|---|---|---|---|
| SEC-A | 2FA optionnelle y compris pour les comptes admin | 🟡 Moyen | S |
| SEC-B | Pas de verrouillage de compte après N échecs (indépendant de l'IP) | 🟢 Faible | S |
| SEC-C | Interpolation de nom de table interne (`pgStoreSocialSync.ts`) | 🟡 Moyen (hygiène) | S |
| SEC-D | Commentaires reels sans sanitization/modération dédiée | 🟡 Moyen | S |
| SEC-E | Historique Git non purgé (secrets réels dans un commit antérieur) | 🟡 Moyen | M |
| SEC-F | Rotation mdp compte YouTube démo non confirmée | 🟡 Moyen | S (vérif. manuelle) |
| SEC-G | Rate limiting absent sur `lives/start`, `search*`, follows, likes | 🟠 Élevé | S/M |
| SEC-H | Fallback RTMP clair + accès HTTP par IP en parallèle du HTTPS | 🟡 Moyen | S |

*Findings SEC-1 à SEC-9 hérités de `commun/docs/audit/AUDIT-CONSOLIDE.md` (2026-07-22) et reconfirmés inchangés à ce jour sauf mention contraire.*
