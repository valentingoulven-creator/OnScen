# Audit technique complet OnScen — Synthèse globale

**Rédigé par :** auditeur technique senior (mode analyse — `@onscen-cto`), spécialisé applications sociales à fort trafic (live streaming, reels, musique, réseau social).
**Date :** 2026-08-07
**Méthode :** revue de code exhaustive sur `commun/backend/src/`, `web/app/src/`, `ios/apptel/src/`, `commun/deploy/`, `commun/docs/` ; exécution réelle des suites de tests (489 backend + 576 frontend, 100 % vertes) et de `npm audit` ; recherches ciblées via 6 sous-agents d'exploration très approfondie sur les périmètres non couverts par les audits précédents (PostGIS, observabilité, modération/CSAM, anti-abus, légal DSA/mineurs/stores, divers) ; consolidation avec `commun/docs/audit/AUDIT-CONSOLIDE.md` (2026-07-22) dont les findings SEC/STR/DBI/LEG/API/ARC ont été revérifiés et actualisés à ce jour.

**Rapports détaillés par phase :** [`01-stack.md`](./01-stack.md) · [`02-database.md`](./02-database.md) · [`03-postgis.md`](./03-postgis.md) · [`04-observabilite.md`](./04-observabilite.md) · [`05-securite.md`](./05-securite.md) · [`06-ddos.md`](./06-ddos.md) · [`07-moderation.md`](./07-moderation.md) · [`08-api-externes.md`](./08-api-externes.md) · [`09-cgu-rgpd.md`](./09-cgu-rgpd.md) · [`10-youtube.md`](./10-youtube.md) · [`11-legalite-globale.md`](./11-legalite-globale.md) · [`12-divers.md`](./12-divers.md)

---

## Vue d'ensemble

OnScen est un produit **techniquement mature pour son stade** : monolithe cohérent avec des composants scalables déjà externalisés (LiveKit, Cloudflare Stream, Stripe, S3), 489+576 tests automatisés tous verts, CI/CD avec déploiement continu vers staging et garde-fous prod, hashing de mots de passe conforme à l'état de l'art, 0 SQLi/XSS/IDOR trouvé sur plusieurs passes d'audit successives, PostGIS correctement indexé, RGPD documenté en profondeur (registre sous-traitants, DPIA, droits utilisateurs implémentés).

**Mais deux catégories de risques concentrent l'essentiel du danger réel :**
1. **Modération de contenu en direct et protection des mineurs** — pour une plateforme combinant live streaming ouvert, upload UGC et géolocalisation, l'absence de toute détection automatique sur le flux vidéo live et l'absence totale de dispositif CSAM dédié (hash-matching, signalement PHAROS/NCMEC opérationnel) sont les points de risque légal et réputationnel les plus graves identifiés.
2. **Écart ponctuel entre documentation/configuration et réalité opérationnelle** — un pattern récurrent déjà signalé par les audits précédents (correctifs codés mais non déployés) persiste sous une nouvelle forme : clé Stripe de test active malgré les dons activés, incohérence de taux de commission entre deux documents légaux, rétention de logs inférieure à la durée annoncée.

Aucun point de ce document n'a nécessité de modification de code — conformément au périmètre d'un audit CTO (analyse et recommandation, pas d'implémentation).

---

## 🔴 CRITIQUE — à traiter en priorité absolue (jours à 1-2 semaines)

| # | Constat | Domaine | Effort | Pourquoi maintenant |
|---|---|---|---|---|
| 1 | **`STRIPE_SECRET_KEY` en mode test (`sk_test_…`) alors que `APP_ENV=production` et `DONATIONS_ENABLED=1`** — reconfirmé inchangé à ce jour. Tout don réel produit une confirmation de succès fictive, sans mouvement d'argent réel. | Paiements / Légal (Phase 11) | **Faible** (config) + **décision business** | Risque de confusion/fraude perçue par les utilisateurs donateurs, déjà documenté en détail avec 3 options concrètes dans `AUDIT-CONSOLIDE.md` §5.1 |
| 2 | **Aucune détection technique CSAM dédiée, aucun runbook opérationnel de signalement aux autorités (PHAROS/NCMEC)** — seule une politique déclarative existe, admise comme lacune par le dossier juridique interne lui-même. | Modération / Légal (Phase 7) | **Moyen** (activation modèle mineur Sightengine + runbook) + **décision juridique** | Risque légal et réputationnel le plus élevé identifié dans tout l'audit pour une plateforme UGC + live |
| 3 | **Aucune modération automatique du flux vidéo pendant un live** (seul le chat texte et les pièces jointes image sont scannés). | Modération (Phase 7) | **Moyen** (échantillonnage périodique de frames) | Un contenu illicite diffusé en direct ne peut être stoppé qu'après signalement humain, jamais préventivement |
| 4 | **Historique Git non purgé** — 4 secrets réels (credentials compte prod, clé TLS, données perso/financières du fondateur) restent récupérables dans un commit antérieur (`72370fc8`), malgré un `HEAD` propre. | Sécurité (Phase 5) | **Moyen** (purge BFG/`git filter-repo`, destructif) | Fuite totale récupérable par quiconque accède/a accédé au dépôt privé ; décision différée depuis plusieurs audits |
| 5 | **Scaling horizontal bloqué** (`PM2 instances: 1` imposé par un store applicatif en mémoire non partagé) — aucun auto-scaling, SPOF applicatif complet en cas de pic de trafic significatif (live viral, croissance rapide). | DDoS/Scale (Phase 6), DB (Phase 2) | **Élevé** (XL — refonte du store) | Le goulot d'étranglement n'est pas le flux vidéo (externalisé, scalable) mais l'API/chat applicatif, qui plafonne à la capacité d'un seul process |
| 6 | Processus `soundy-auth` fantôme en production, non versionné dans Git, hash de mot de passe de repli en dur, sessions perdues à chaque redémarrage. | Sécurité / Infra (hérité `AUDIT-CONSOLIDE.md`) | **Moyen** | Surface d'attaque non auditable, fonction exacte inconnue après plusieurs audits successifs |
| 7 | Rotation du mot de passe du compte `yt.audit.demo2.soundy@gmail.com` (compte réel `getsoundy.com`) jamais confirmée. | Sécurité (hérité) | **Faible** (vérification manuelle) | Compte de production potentiellement toujours exposé |
| 8 | Rôle DB applicatif `onscen` sur-privilégié (`CREATEROLE`/`CREATEDB`). | Base de données (Phase 2, hérité `DBI-5`) | **Faible** (`REVOKE`, décision requise) | En cas de compromission applicative, privilèges d'administration de la base hérités au lieu d'être cantonnés |

---

## 🟠 ÉLEVÉ — à traiter à moyen terme (semaines)

| # | Constat | Domaine | Effort |
|---|---|---|---|
| 9 | Vérification d'âge purement déclarative (case à cocher, pas de date de naissance obligatoire à l'inscription), bypass `ageConfirmed` sur les dons, géolocalisation précise non restreinte pour les comptes 13-17 ans | Légal/Mineurs (Phase 11) | Moyen |
| 10 | Aucun rate limiting dédié sur `POST /lives/start`, `/search*`, follows, likes — couverts uniquement par le plafond global 300 req/min | Sécurité/DDoS (Phase 5, 6) | Faible/Moyen |
| 11 | Absence de CDN/WAF (Cloudflare) devant l'application principale — bloqué par l'accès DNS OVH manquant | DDoS (Phase 6, hérité `API-2`) | Moyen (accès externe requis) |
| 12 | Aucun captcha (Turnstile/hCaptcha/reCAPTCHA) sur inscription/mot de passe oublié | DDoS (Phase 6) | Faible (une fois Cloudflare actif) |
| 13 | Aucune détection de comportement anormal (création de comptes en masse, follow/like en masse) | DDoS (Phase 6) | Moyen |
| 14 | Modèles Sightengine limités à nudité/offensive (pas gore/weapon), uploads sponsors non scannés | Modération (Phase 7) | Faible (config) |
| 15 | Pas de notification automatique à l'équipe admin lors d'un signalement, pas d'escalade prioritaire pour la catégorie `illegal` | Modération (Phase 7) | Faible/Moyen |
| 16 | Rétention des logs de connexion : **12 mois annoncés dans la politique de confidentialité vs ~4-5 mois réellement implémentés**, pas de journal d'accès IP/UA dédié | Légal/Rétention (Phase 9, 12) | Moyen |
| 17 | **Incohérence de taux de commission sur les pourboires : 30 % affiché dans `creatorMonetization.ts` vs 50 % réellement configuré** (`DONATION_PLATFORM_FEE_PERCENT`) | Légal (Phase 9) | Faible (correction de texte) |
| 18 | TVA/DAC7 non traités dans les CGV de monétisation créateurs | Légal (Phase 11) | Moyen (juridique) |
| 19 | Conformité stores (Apple/Google) pour live streaming + UGC non formalisée en checklist avant soumission | Légal/Stores (Phase 11) | Moyen |
| 20 | Application OAuth Google toujours en mode « Testing » — bloque la liaison YouTube pour la quasi-totalité des utilisateurs réels | API externes/YouTube (Phase 8, 10, hérité `LEG-6`) | Élevé (délai Google, hors contrôle) |
| 21 | Aucune mesure de couverture de tests configurée (ni backend ni frontend), aucun test de composant React | Stack/Tests (Phase 1) | Faible (outillage) |
| 22 | Sentry absent sur mobile Capacitor (`ios/apptel`) | Observabilité (Phase 4) | Faible/Moyen |
| 23 | Logs applicatifs non structurés (~396 `console.*` backend), pas de logger type pino/winston | Observabilité (Phase 4) | Moyen |
| 24 | Triple SPOF confirmé (1 VPS, 1 PostgreSQL managé, 1 Redis local), prod/staging sur la même instance PostgreSQL physique | Infra (Phase 2, 12, hérité `DBI-6`/`DBI-7`) | Élevé (L) |
| 25 | Plan gratuit LiveKit Cloud (100 participants simultanés max) — risque de plafond/coût dès qu'un live dépasse cette audience | API externes/Coûts (Phase 8) | Moyen (anticipation budgétaire) |
| 26 | Dépendance `heic2any` embarquant `libheif` sous licence LGPL — conformité à clarifier pour un bundle client propriétaire | Propriété intellectuelle (Phase 12) | Faible/Moyen |
| 27 | Commentaires reels ne passant par aucun filtre (ni modération lexicale ni sanitization de base) | Modération (Phase 7) | Faible |
| 28 | DPA (art. 28 RGPD) non signés avec Scaleway/Cloudflare/Stripe/Resend — statut `pending` sur tous | Légal RGPD (Phase 9, hérité `LEG-5`) | Moyen (contractuel) |

---

## Ce qui va bien (points positifs à ne pas perdre de vue)

- **0 SQLi/XSS/IDOR/SSRF confirmé** sur plusieurs passes d'audit successives (revue de code + cette phase).
- **489/489 tests backend et 576/576 tests frontend passent** (exécution réelle vérifiée le 2026-08-07).
- **PostGIS correctement indexé** (GIST sur les 3 tables géographiques utilisées), aucune position brute exposée directement à un tiers via l'API publique.
- **2FA (TOTP + WebAuthn/Passkeys) disponible**, secrets chiffrés AES-256-GCM, rate limiting brute-force conforme sur le login.
- **Aucune extraction/téléchargement YouTube** — point fort confirmé, code mort de fallback non officiel supprimé physiquement du build.
- **CI/CD mature** : build + lint + tests + typecheck sur chaque push, déploiement continu vers staging avec vérification de santé post-déploiement, prod jamais automatisée.
- **PCI-DSS conforme par délégation totale à Stripe** — aucune donnée de carte ne transite ni n'est stockée côté OnScen.
- **RGPD documenté en profondeur** (registre sous-traitants avec localisation, DPIA, droits utilisateurs implémentés y compris suppression de compte avec purge de médias S3/local).

---

## Note méthodologique

Ce document et les 12 rapports de phase associés constituent un audit **d'analyse de code et de documentation**, en lecture seule (aucune modification de code applicatif effectuée). Certains points restent **non vérifiables depuis ce poste** et nécessitent une action humaine complémentaire :
- Statut réel de vérification de l'app OAuth Google (console Google Cloud).
- Configuration effective des sauvegardes automatiques Scaleway et test de restauration réel (console Scaleway).
- Rotation effective du mot de passe du compte de démonstration YouTube (accès Gmail).
- Signature contractuelle effective des DPA.
- Valeurs réelles des variables d'environnement sur le VPS de production (les fichiers `.env` locaux consultés sont des copies synchronisées, pas nécessairement identiques en temps réel au VPS).

**Prochaine étape recommandée :** partager ce document avec l'avocat déjà mandaté (`commun/docs/juridique/RENDEZ-VOUS-AVOCAT.md`) en priorité sur les points #1, #2 et #9 de la section Critique/Élevé, qui relèvent autant d'une décision produit/juridique que d'une correction technique pure. Pour l'implémentation des correctifs purement techniques (rate limiting, Sentry mobile, logs structurés, activation de modèles Sightengine, etc.), transmettre ce document à `@onscen-dev-agent`.
