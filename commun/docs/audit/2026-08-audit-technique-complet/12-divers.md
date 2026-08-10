# Audit technique OnScen — Phase 12 : Points supplémentaires

**Date :** 2026-08-07
**Méthode :** revue de l'accessibilité frontend (`web/app/eslint.config.js`, composants `.tsx`), documentation infra (`INFRA-ONSCEN.md`, `RUNBOOK-PROD.md`, `STACK-CIBLE.md`), comptes de démo/admin (`msdevDemoAccounts.ts`, `seed-production.ts`), rétention des logs (`userLoginRetention.ts`, `appDiagnosticLogs.ts`), licences des dépendances npm.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

---

## 12.1 Accessibilité (WCAG)

**Constat chiffré (grep sur `web/app/src`, ~319 fichiers `.tsx`) :**

| Indicateur | Valeur |
|---|---|
| Fichiers avec `aria-label=` | ~181 (~57 %) |
| Occurrences `aria-label=` | ~453 |
| Occurrences `alt=""` (vide) | ~102 |
| Surfaces `role="dialog"` | ~50 |
| Consommateurs effectifs de `useFocusTrap` | **2 seulement** |
| `eslint-plugin-jsx-a11y` dans les dépendances | ❌ Absent |
| Outil d'audit contraste/axe-core | ❌ Absent |

**Bons patterns identifiés :** navigation principale avec `aria-label`/`aria-current` (`MainTabNav.tsx`), modales avec `role="dialog"` + `aria-modal` (`ConfirmModal.tsx`), lecteur audio avec labels explicites (`MusicPlayerBar.tsx`), logo avec `alt` correctement géré (`OnScenLogo.tsx`).

**Mauvais patterns identifiés :** images de contenu informatif avec `alt=""` vide (bannière d'événement `EventCard.tsx:296-299`, miniature de live `UserLivesSection.tsx:76`) — devraient porter un texte alternatif descriptif. Piège focus trap quasi inexistant : ~50 surfaces `role="dialog"` pour seulement 2 consommateurs de `useFocusTrap`.

**Risque : 🟡 Moyen** — conformité **partielle niveau WCAG 2.1 A** (labels de navigation, quelques dialogues), **non conforme AA** (pas d'outil CI, contrastes non audités, `alt` descriptifs rares, piège de focus non généralisé aux ~50 modales).

**Recommandation :** ajouter `eslint-plugin-jsx-a11y` en CI, généraliser `useFocusTrap` à toutes les modales, corriger les `alt` vides sur les images de contenu informatif (événements, lives, actualités).

---

## 12.2 Disaster Recovery

**Constat :**
- Un plan existe, **embarqué** dans `INFRA-ONSCEN.md` et `RUNBOOK-PROD.md` (pas un document DR dédié séparé) : RPO ≤ 24h, RTO 30 min – 2h (restore base de test), procédure de restauration PostgreSQL documentée pas à pas (`gunzip | psql`), test de restauration **trimestriel recommandé** mais **non prouvé exécuté** dans le dépôt (cf. Phase 2 §2.3).
- Scénarios de panne documentés avec RTO estimé : perte VPS complète (2-4h), corruption DB dump VPS (1-3h), corruption DB Scaleway (15min-1h via snapshot console).
- **Lacune ouverte dans la politique de confidentialité elle-même** : la mention « sauvegardes chiffrées et plan de reprise » est encore marquée comme un point à compléter (`rgpd.ts:43`).
- Pas de second VPS hot-standby — la bascule décrite implique de **provisionner un nouveau VPS** en cas de panne totale, pas un failover automatique.

**Risque : 🟡 Moyen** — plan documenté et raisonnable pour la taille actuelle, mais absence de preuve d'exercice réel et absence de haute disponibilité (RTO de plusieurs heures en cas de perte totale du VPS).

**Recommandation :** exécuter et journaliser un exercice de restauration daté (trimestriel) ; envisager un second VPS froid pré-provisionné pour réduire le RTO « perte VPS complète » à mesure que la criticité du service augmente.

---

## 12.3 Dépendance à un seul point de défaillance (SPOF)

**Constat — inventaire des SPOF :**

| Composant | SPOF ? | Impact en cas de panne |
|---|---|---|
| VPS de production unique | ✅ Oui | App + API + Socket.io + TURN + uploads locaux = **panne totale** |
| PostgreSQL managé unique | ✅ Oui | Authentification, données sociales, persistance = **panne totale** ; staging partage la même instance physique |
| Redis (si activé) | ✅ Oui | Cluster Socket.io/rate-limits dégradés ; actuellement optionnel, un seul process local sur le VPS |
| Caddy (reverse proxy/TLS) sur le VPS | ✅ Oui (lié au VPS) | HTTPS/edge indisponible |
| PM2 (1 worker, `instances: 1`) | Mitigé par autorestart | Pas de haute disponibilité process, mais crash isolé auto-redémarré |
| LiveKit Cloud / Cloudflare Stream | Tiers externalisé | Dégradation des lives, mais **découplé** du reste de l'app — bon point architectural |

**Risque : 🟠 Élevé (à moyen terme)** — triple SPOF confirmé (1 VPS, 1 PostgreSQL, 1 Redis local) déjà identifié dans les audits précédents (`DBI-7`), reconfirmé inchangé. Les composants **externalisés** (live vidéo, paiement) sont eux correctement découplés et résilients par nature.

**Recommandation :** priorité progressive à mesure que le trafic croît — séparation PostgreSQL prod/staging (déjà recommandée), Object Storage S3 obligatoire pour les uploads (actuellement optionnel avec repli disque local, donc lié au VPS), Redis managé, second VPS ou load balancer.

---

## 12.4 Comptes de test/admin par défaut et backdoors

**Constat :**
- **Comptes de démo msdev** avec mot de passe en dur (`msdev123`) — mais protégés par un garde d'environnement strict (`assertMsdev` → 404 si `isDefinitelyProduction()` ou hors runtime msdev) — **pas accessibles en production** tant que `APP_ENV`/`NODE_ENV` sont correctement positionnés.
- **Aucun mot de passe admin en dur en production** — le premier compte admin est créé via `PROD_ADMIN_EMAIL`/`PROD_ADMIN_PASSWORD` (variables d'environnement, pas de valeur par défaut codée), avec `mustChangePassword: true` forcé à la création. Un garde-fou explicite alerte si un placeholder type `changez_moi` est laissé (`externalSecretsAlerts.ts`).
- Routes de debug (`/msdev-mobile`, `/phone-preview`, `/api/msdev/*`) toutes protégées par le même garde d'environnement, retournant 404 hors contexte msdev.

**Risque : 🟢 Faible** — la protection par garde d'environnement est cohérente et défendable ; le seul risque résiduel serait une mauvaise configuration de `APP_ENV`/`NODE_ENV` sur le VPS de production (non vérifiable depuis le code local).

**Recommandation :** conforme. Vérifier périodiquement, via un test automatisé en CI/CD post-déploiement, que ces routes retournent bien 404 sur l'environnement de production réel.

---

## 12.5 Politique de rétention des logs et données de connexion

**Constat :**

| Mécanisme | Données | Durée réellement implémentée |
|---|---|---|
| `userLoginRetention.ts` | Jours de connexion par utilisateur (**pas d'IP, pas de user-agent**) | **120 jours max** |
| `appDiagnosticLogs.ts` | Message, stack, user_id, username, **user-agent**, URL, contexte | **~5 mois** |
| Politique de confidentialité déclarée | Logs techniques | **« 12 mois max en production »** (`privacy.ts:27`, `rgpd.ts:15`) |

**Écart identifié : la durée réellement implémentée (~4-5 mois) est inférieure de moitié à la durée annoncée dans la politique de confidentialité (12 mois).** Par ailleurs, **aucune table de journal d'accès dédiée** (IP + user-agent + horodatage systématique à chaque connexion) n'a été identifiée dans `routes/auth.ts` — la donnée de connexion la plus complète disponible est le diagnostic d'erreur (`appDiagnosticLogs`), pas un log d'accès exhaustif.

**Risque : 🟠 Élevé** — au-delà de l'écart doc/code (déjà un problème de transparence RGPD), la conformité à l'obligation française de conservation des données de connexion (Code des postes et communications électroniques / ex-LCEN, historiquement ~1 an selon la qualification du service) **n'est pas démontrée techniquement** par le code actuel, qui conserve moins longtemps et sans IP systématique. La qualification juridique exacte du service au regard de cette obligation reste à valider par un avocat (déjà en question ouverte dans le dossier juridique interne).

**Recommandation :** (a) mettre en place un journal d'accès applicatif dédié (IP — éventuellement hashée pour minimisation —, user-agent, userId, horodatage) avec rétention 365 jours et purge automatique ; (b) aligner la politique de confidentialité sur la durée réellement implémentée si la rétention 12 mois n'est pas jugée nécessaire, ou l'implémenter si elle l'est ; (c) faire trancher par un avocat la qualification exacte du service au regard des obligations de conservation.

---

## 12.6 Propriété intellectuelle du code — licences open source

**Constat :**
- **Backend** (`commun/backend/package.json`) : dépendances quasi exclusivement **MIT/Apache-2.0/BSD** (Express, Socket.io, `pg`, Redis client, Stripe, `bcryptjs`, Helmet, `jsonwebtoken`, `@aws-sdk/client-s3`, `livekit-server-sdk`, `google-auth-library`, `sanitize-html`, `nodemailer`) — **aucune dépendance copyleft forte identifiée**.
- **Frontend** (`web/app/package.json`) : globalement permissif également, avec **une alerte notable** :
  - `heic2any` (`^0.0.4`) — annoncé MIT mais embarque `libheif` sous licence **LGPL** (sujet de discussion publique connu sur le dépôt GitHub du projet) — potentiellement problématique pour un bundle client propriétaire selon l'interprétation stricte du linking LGPL en JavaScript/WASM.
  - `@fontsource/plus-jakarta-sans` — licence **SIL OFL 1.1** (police de caractères), pas un problème de copyleft logiciel classique, juste une obligation de notice.
- Pas de `ffmpeg`/`fluent-ffmpeg`/`ffmpeg-static` (souvent GPL selon la configuration de build) identifié dans les dépendances directes des deux `package.json`.

**Risque : 🟡 Moyen** — concentré sur `heic2any`/`libheif` (LGPL). Le reste de la stack est propre.

**Recommandation :** clarifier la conformité LGPL de `heic2any` (linking dynamique vs statique dans le bundle Vite) ou le remplacer par une conversion HEIC côté serveur via `sharp`/`libvips` (déjà une dépendance backend) ; générer un SBOM (`license-checker` ou équivalent) avant toute soumission aux stores, qui exigent parfois une liste de licences tierces affichée in-app.

---

## Synthèse des risques — Phase 12

| # | Sujet | Risque | Effort |
|---|---|---|---|
| DIV-1 | Accessibilité WCAG partielle, pas d'outil CI, focus trap sous-généralisé | 🟡 Moyen | M |
| DIV-2 | Disaster Recovery documenté mais test de restauration non prouvé, pas de HA | 🟡 Moyen | M |
| DIV-3 | Triple SPOF (VPS/PostgreSQL/Redis) | 🟠 Élevé (LT) | L |
| DIV-4 | Comptes de test/admin et backdoors | 🟢 Faible (bien gardé) | — |
| DIV-5 | **Rétention logs de connexion : 12 mois annoncés vs ~4-5 mois implémentés, pas de journal d'accès IP dédié** | 🟠 Élevé | M |
| DIV-6 | `heic2any`/`libheif` — licence LGPL à clarifier | 🟡 Moyen | S/M |
