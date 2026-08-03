# AUDIT SENIOR COMPLET — SOUNDY
Date : 2026-07-07 · Méthode : 6 audits indépendants en lecture seule (preuves fichier+ligne obligatoires, aucune supposition), synthétisés ci-dessous.

Rapports détaillés sources :
- `commun/docs/audit/AUDIT-architecture-code.md`
- `commun/docs/audit/AUDIT-securite.md`
- `commun/docs/audit/AUDIT-stripe.md`
- `commun/docs/audit/AUDIT-db-infra.md`
- `commun/docs/audit/AUDIT-legal-youtube-copyright.md`
- `commun/docs/audit/AUDIT-apis-externes-performance.md`

---

## 0. ALERTE IMMÉDIATE (à traiter avant toute autre chose)

**Des identifiants réels de production sont actuellement présents et trackés par Git** dans `commun/docs/youtube-audit-demo-credentials.local.txt` (email + mot de passe en clair d'un compte réel sur getsoundy.com), confirmé indépendamment par `git ls-files`. Cause racine : plusieurs règles `.gitignore` ne sont pas ancrées avec `**/` et ne protègent plus les fichiers sous `commun/` depuis la restructuration en monorepo — la même cause a aussi laissé fuiter une clé privée TLS (`commun/msdev/certs/dev-key.pem`) et des données personnelles/financières confidentielles du fondateur (`commun/msdev/ceo-founder-context.json`, `legal-publisher.json`).

**Action recommandée avant tout déploiement ou publication du repo** : révoquer/changer le mot de passe du compte concerné, `git rm --cached` ces 4 fichiers, corriger `.gitignore`, et évaluer une purge d'historique Git si le repo a pu être cloné par un tiers.

---

## 1. Executive Summary

Soundy est un produit fonctionnellement riche et globalement bien construit sur le plan applicatif (sécurité HTTP, auth, paiements Stripe, intégration YouTube, LiveKit) — mais présente **un problème architectural transversal qui touche plusieurs domaines d'audit à la fois** : le backend utilise un store de données **en mémoire (RAM)** comme source de vérité, alors que la production tourne en **PM2 cluster à 2 workers** sans synchronisation entre eux. Ce même problème a été détecté indépendamment par l'audit Architecture *et* l'audit DB/Infra — c'est le risque n°1 du projet, avant même la sécurité applicative.

Le deuxième axe de risque est **la fiabilité financière** : absence d'idempotence sur les appels Stripe, un risque de double-crédit de dons en environnement cluster, aucun mécanisme de remboursement alors que les CGU en promettent un, et `ON DELETE CASCADE` sur les tables de paiement qui détruit l'historique financier à la suppression d'un compte.

Le troisième axe est la **fuite de secrets Git** (section 0 ci-dessus) — un incident de sécurité réel et actionnable immédiatement, distinct des failles applicatives classiques (dont Soundy est globalement exempt : 0 XSS, 0 injection SQL, 0 SSRF trouvé, CSRF/CORS/headers corrects).

**Point positif majeur, à souligner** : l'audit copyright — le point le plus sensible légalement pour ce produit — est **négatif avec preuve exhaustive**. Aucune trace de téléchargement, extraction, scraping ou cache de contenu YouTube n'a été trouvée dans l'intégralité du monorepo ; la musique est diffusée exclusivement via les mécanismes officiels (IFrame Player API + Data API v3).

## 2. Score global : 64/100

*(moyenne pondérée des 9 sous-scores de domaine, avec pénalité additionnelle pour cumul de risques Critical transversaux non résolus — voir méthodologie en fin de section)*

| Domaine | Score /100 |
|---|---|
| Architecture & qualité code | 60 |
| Sécurité (OWASP + secrets) | 78 |
| Stripe / paiements | 61 |
| Base de données & Infrastructure | 61 |
| RGPD | 72 |
| Conformité YouTube | 68 |
| Copyright | 93 |
| APIs externes | 78 |
| Performance | 82 |
| **Moyenne simple** | **72,6** |
| **Score global retenu (avec pénalité Critical)** | **64** |

**Méthodologie** : moyenne simple des 9 sous-scores = 72,6/100. Une pénalité de **-8,6 points** est appliquée car 5 problèmes **Critical** distincts (dont 2 réductibles à la même cause racine architecturale RAM/cluster, et 1 incident de sécurité actif — fuite de credentials) restent non résolus et touchent des fonctions cœur (authentification, paiements, intégrité des données). Un score global ne doit pas masquer un risque système qui pourrait provoquer un incident de production ou un incident de sécurité à tout moment.

## 3. Tableau des risques (consolidé, 66 problèmes documentés au total)

| Gravité | Nombre | Domaines concernés |
|---|---|---|
| **Critical** | **5** | Sécurité (1), Architecture (1), DB/Infra (3 — dont 1 recoupe l'Architecture) |
| **High** | **16** | Architecture (2), Sécurité (1), Stripe (4), DB/Infra (6), Légal/YouTube (2), APIs externes (1) |
| **Medium** | **27** | Architecture (4), Sécurité (2), Stripe (3), DB/Infra (7), Légal/YouTube (4), APIs/Perf (7) |
| **Low** | **18** | Architecture (4), Sécurité (3), Stripe (4), DB/Infra (2), Légal/YouTube (2), APIs/Perf (3) |

*Note : le Critical #1 (Architecture — store RAM/cluster) et un des 3 Critical de DB/Infra couvrent le même problème racine observé depuis deux angles différents (lecture applicative vs cohérence des données) ; ils sont comptés séparément par domaine mais représentent un seul chantier de correction.*

## 4. Détail par domaine — Architecture

**Score : 60/100** — 1 Critical, 2 High, 4 Medium, 4 Low. Voir `AUDIT-architecture-code.md`.

Points clés : store applicatif en RAM incompatible avec PM2 cluster 2 workers (Critical) ; TypeScript `strict` désactivé côté frontend/mobile (High) ; bug d'encodage mojibake visible utilisateur dans `auth.ts` (High) ; gestion d'erreur silencieuse généralisée (>200 `catch` sans log) ; fichiers god-component jusqu'à 3342 lignes (`DmPage.tsx`) ; 447 problèmes ESLint dont 2 erreurs bloquantes actuellement sur `main` (`MapView.tsx` no-useless-assignment). Positif : 0 vulnérabilité `npm audit`, pas de dette TODO, architecture mobile/web propre et outillée (`sync-src.js`).

## 5. Détail par domaine — Sécurité

**Score : 78/100** — 1 Critical, 1 High, 2 Medium, 3 Low. Voir `AUDIT-securite.md`.

Points clés : fuite de credentials de production actuellement trackée par Git (Critical, cf. section 0) causée par un `.gitignore` mal ancré (High) ; clé privée TLS dev + données perso/financières confidentielles également exposées (Medium). En revanche, l'ensemble OWASP classique est propre : Helmet/CSP par nonce, JWT HS256 whitelisté avec `tokenVersion`, cookies httpOnly/Secure/SameSite=Strict, CORS fail-closed, 8 routers admin homogènes et vérifiés, upload avec magic-bytes, 0 XSS/SQLi/SSRF trouvé, OAuth avec state anti-CSRF, webhooks Stripe signés.

## 6. Détail par domaine — Stripe / Paiements

**Score : 61/100** — 0 Critical, 4 High, 3 Medium, 4 Low. Voir `AUDIT-stripe.md`.

Points clés : aucune clé d'idempotence Stripe nulle part (High) ; déduplication de webhook uniquement en mémoire locale par process → risque de double-crédit en cluster PM2 (High, même cause racine que le Critical architecture) ; 0 remboursement implémenté alors que promis conditionnellement dans les CGU (High) ; incohérence de nommage `SOUNDY`/`SOUNDLY` entre code et scripts officiels de config (High). Positif : split 70/30 dons confirmé, `PaymentElement` exclusif (0 exposition carte), secrets non commités, Stripe Connect avec vérification `charges_enabled`.

## 7. Détail par domaine — Base de données & Infrastructure

**Score : 61/100** — 3 Critical, 6 High, 7 Medium, 2 Low. Voir `AUDIT-db-infra.md`.

Points clés : store RAM dupliqué entre workers (Critical, même racine qu'Architecture) ; `ON DELETE CASCADE` sur les tables de paiement — suppression de compte détruit l'historique Stripe (Critical) ; flush périodique en ré-upsert intégral, ne scale pas (Critical) ; rate-limiters critiques (login) non cluster-safe malgré Redis déjà disponible (High) ; ~90% des tables sans FK + rôle DB applicatif sur-privilégié (`rolcreaterole=t`) (High) ; prod et staging partagent la même instance PostgreSQL ; triple SPOF (1 VPS, 1 PG, 1 Redis) sans réplication ; `STRIPE_SECRET_KEY` en mode test sur `APP_ENV=production` (constaté en SSH).

## 8. Détail par domaine — Conformité légale (RGPD / YouTube / Copyright)

**Scores : RGPD 72/100 · YouTube 68/100 · Copyright 93/100.** Voir `AUDIT-legal-youtube-copyright.md`.

Points clés : mentions légales avec adresse postale non renseignée et email de contact RGPD personnel (High) ; app OAuth Google encore en mode "Testing" non vérifié, bloquant l'usage YouTube pour le grand public (High) ; code mort de fallback Piped/Invidious non conforme aux ToS YouTube (neutralisé en prod par garde-fou runtime, Medium) ; pas de révocation OAuth YouTube à la suppression de compte (Medium). **Copyright : aucune violation trouvée** — recherche exhaustive négative sur `ytdl-core`/`yt-dlp`/scraping/ffmpeg-sur-flux-YouTube dans tout le monorepo ; lecture exclusivement via IFrame Player API officielle. Positif RGPD : suppression de compte réellement effective en cascade (RAM+PG+stockage), export de données opérationnel, consentement cookies bloquant réellement Stripe.js/YouTube, floutage géo ~50m réel.

## 9. Détail par domaine — APIs externes & Performance

**Scores : APIs externes 78/100 · Performance 82/100.** Voir `AUDIT-apis-externes-performance.md`.

Points clés : mode WebRTC mesh P2P legacy expose les IP publiques par défaut en fallback (High) ; aucun CDN/WAF Cloudflare devant l'app principale ; aucun monitoring de quota ACRCloud/Sightengine (fail-closed silencieux possible) ; compression gzip seule (pas de Brotli) ; images toujours réencodées en JPEG jamais WebP/AVIF ; CSS bundle 391 Ko. Positif : Sentry sans PII des deux côtés, isolation LiveKit par room avec permissions déterminées serveur, bundling/lazy-loading très mature (code-splitting, Workbox, VirtualList), cleanup hooks vérifiés sains.

## 10. TOP 20 des problèmes les plus critiques (ordre de priorité recommandé)

| # | Gravité | Problème | Domaine | Gain attendu | Difficulté | Régression | Test avant correction |
|---|---|---|---|---|---|---|---|
| 1 | Critical | Credentials réels de prod trackés par Git | Sécurité | Élimine un incident de sécurité actif | S (fix) / M (purge historique) | Faible | Vérifier `git ls-files` avant/après |
| 2 | Critical | `.gitignore` mal ancré (cause racine fuite #1, #3, #4) | Sécurité | Empêche toute nouvelle fuite similaire | S | Faible | `git check-ignore -v` sur les 4 fichiers |
| 3 | Critical | Store RAM + PM2 cluster 2 workers sans sync (auth) | Architecture / DB-Infra | Élimine 401 aléatoires / incohérences de session | XL | Élevé (refonte de la source de vérité) | Tests de charge multi-worker, tests d'intégration auth |
| 4 | Critical | `ON DELETE CASCADE` sur tables de paiement | DB/Infra | Préserve l'historique financier/comptable | M | Moyen | Test de suppression de compte avec vérif. historique paiement conservé |
| 5 | Critical | Flush périodique = ré-upsert intégral (ne scale pas) | DB/Infra | Évite la dégradation à mesure que le volume grandit | L | Moyen | Test de charge avec volume simulé élevé |
| 6 | High | Pas d'idempotence Stripe (double charge possible) | Stripe | Élimine le risque de double facturation | S | Faible | Test de retry réseau simulé sur PaymentIntent |
| 7 | High | Dédup webhook Stripe en mémoire locale (double crédit) | Stripe | Cohérence financière en cluster | M | Moyen | Test webhook livré 2x sur 2 workers différents |
| 8 | High | 0 remboursement implémenté (promis dans les CGU) | Stripe | Conformité CGU + support client | M | Faible | Test remboursement admin sur don/abonnement test |
| 9 | High | Bug nommage env `SOUNDY`/`SOUNDLY` | Stripe | Fiabilise les montants Soundy+ | S | Faible | Vérifier montant affiché = montant Stripe réel |
| 10 | High | Rate-limiters login non cluster-safe | DB/Infra / Sécurité | Vraie protection anti-bruteforce | S | Faible | Test brute-force simulé multi-worker |
| 11 | High | ~90% tables sans FK + rôle DB sur-privilégié | DB/Infra | Intégrité référentielle + moindre privilège | L | Moyen | Test de migration FK sur environnement de test d'abord |
| 12 | High | TS `strict` désactivé front/mobile | Architecture | Réduit bugs `null`/`undefined` en prod | L | Élevé (pic d'erreurs initial) | Activer par étapes, corriger fichier par fichier |
| 13 | High | Mojibake encodage messages utilisateur (`auth.ts`) | Architecture | Corrige l'UX visible immédiatement | S | Faible | Vérification visuelle des messages d'erreur |
| 14 | High | Mentions légales incomplètes (adresse/email placeholder) | Légal | Conformité LCEN avant lancement public | S | Faible | Vérifier `verify-prod.sh` bloque bien si placeholder |
| 15 | High | OAuth Google en mode Testing non vérifié | YouTube | Débloque YouTube pour tous les utilisateurs | L (délai Google) | Faible | Soumission + suivi du dossier de vérification |
| 16 | High | WebRTC mesh legacy expose IP publiques | APIs externes | Protection vie privée host/viewer | M–L | Moyen | Test de connexion avec capture réseau (vérif IP masquée) |
| 17 | Medium | Pas de blocage boot si `STRIPE_WEBHOOK_SECRET` absent | Stripe | Empêche un déploiement mal configuré | S | Faible | Test de démarrage avec variable manquante |
| 18 | Medium | Prod + staging partagent la même instance PostgreSQL | DB/Infra | Isolation environnements | M (infra) | Moyen | Plan de migration avec fenêtre de maintenance |
| 19 | Medium | Aucun CDN/WAF devant l'app principale | APIs externes | Résilience DDoS + latence | M (config dashboard) | Faible | Activer en staging d'abord |
| 20 | Medium | Aucun monitoring de quota ACRCloud/Sightengine | APIs externes | Évite un blocage silencieux en prod | S | Faible | Simuler dépassement de quota en sandbox |

**Ordre optimal de correction recommandé** : 1 → 2 (sécurité immédiate, quelques heures) puis 6, 8, 9, 13, 17 (corrections Stripe/UX rapides à faible risque) puis 4, 10 (protection données/paiements à risque moyen) puis 3, 5, 11 (chantiers structurels XL nécessitant plus de tests) puis 12, 14, 15, 16 (dette + conformité, parallélisables sur plusieurs semaines).

## 11. Notes de gestion des risques

- Le chantier #3 (store RAM/cluster) est le plus risqué à corriger (refonte de la source de vérité) mais aussi le plus impactant : il est recommandé de d'abord **revenir à `instances: 1`** en PM2 (mitigation immédiate, difficulté S, pas de refonte) en attendant la refonte complète vers une source de vérité partagée (Postgres/Redis), plutôt que de laisser le risque actif pendant tout le développement du correctif XL.
- Les corrections Stripe (#6-#9) sont indépendantes entre elles et peuvent être livrées en parallèle par des développeurs différents sans risque de conflit.
- Toute correction touchant `auth.ts` (mojibake, JWT) doit être suivie d'un test de connexion complet (login, refresh, 2FA) avant déploiement, car ce fichier est cœur pour tous les utilisateurs.

## 12. Scores de synthèse /100

| Catégorie | Score |
|---|---|
| Architecture | 60 |
| Sécurité | 78 |
| Performance | 82 |
| Infrastructure | 61 |
| Maintenabilité (code quality) | 58 *(dérivé : god-components + ESLint debt + gestion d'erreur silencieuse)* |
| Conformité légale (RGPD) | 72 |
| Conformité YouTube | 68 |
| Gestion des APIs externes | 78 |
| Qualité du code | 60 |
| **État de préparation à la production** | **58** *(pénalisé par les 5 Critical actifs, notamment la fuite de secrets et le risque RAM/cluster)* |

## 13. Conclusion — Soundy est-il prêt pour une mise en production ?

**Soundy est déjà en production** (getsoundy.com) et fonctionne, mais **des corrections sont indispensables avant un lancement à plus grande échelle ou une croissance significative du trafic** :

1. **Immédiat (avant tout autre chose, quelques heures)** : traiter la fuite de credentials Git (section 0) — c'est un incident de sécurité actif, pas une dette technique.
2. **Avant scaling (semaines)** : résoudre le risque architectural RAM/cluster (au minimum revenir à `instances: 1` en mitigation immédiate), sécuriser la fiabilité des paiements Stripe (idempotence, dédup webhook, remboursements), corriger le `CASCADE DELETE` sur les paiements.
3. **Avant croissance publique de la fonctionnalité YouTube** : finaliser la vérification OAuth Google.
4. **En continu, non bloquant** : dette de code (strict mode, god-components, ESLint), optimisations performance (Brotli, WebP), renforcement infra (CDN/WAF, FK manquantes, réplication).

Le produit n'a **aucune violation de copyright** constatée (le risque légal le plus sensible pour ce type d'app est écarté avec preuve solide) et une base de sécurité applicative OWASP saine. Le risque dominant est **opérationnel et financier** (cohérence des données en cluster, fiabilité des paiements) plutôt que purement sécuritaire — mais la fuite de secrets Git doit être traitée en priorité absolue, indépendamment du reste de ce plan.
