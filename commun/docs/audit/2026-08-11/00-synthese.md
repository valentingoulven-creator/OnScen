# Synthèse globale — Audit technique OnScen

**Date :** 2026-08-10 — rafraîchi le 2026-08-11 — **correctifs appliqués le 2026-08-11**
**Auditeur :** revue senior
**Méthode :** relecture des 12 rapports du 2026-08-10 ; `npm audit` (backend + web) et suites de tests (backend + web) ; vérification ciblée de code ; vérifications SSH read-only puis actions ciblées sur le VPS prod (voir détail par constat) ; requête PostgreSQL prod en lecture seule pour quantifier l'impact réel avant décision de correction (E15).

**Rapports détaillés :** [01-stack](./01-stack.md) … [12-divers](./12-divers.md) · Détail technique des correctifs : `modification.txt` (MODIF 1352)

---

## ⚠️ Point d'attention transverse — code vs. déployé

Les correctifs de code listés ci-dessous (MODIF 1349, 1350, 1352) **existent dans le working tree local mais ne sont ni commités ni déployés en production** au moment de la rédaction. Le site prod actuel (`getsoundy.com`) ne référence par exemple **pas encore** Turnstile ni les derniers correctifs géo/build dans son build livré. **Ne pas considérer un item « résolu (code) » comme clos tant qu'il n'est pas commité, buildé et déployé** (`deploy-prod.ps1`, sur demande explicite uniquement).

Les actions **infra directes sur le VPS prod** (E11 vérifié, E12 durci, E13 nettoyé) sont en revanche **déjà effectives en production** — ce ne sont pas des changements de code applicatif mais des vérifications/actions opérationnelles (config env déjà en place, privilèges DB, process pm2).

---

## Vue d'ensemble

OnScen reste un **monolithe Node/React mature** pour son stade. Après le rafraîchissement du 08-11, une session de correctifs a traité **tous les points techniquement actionnables sans décision légale/business/produit** : vulnérabilité critique `jspdf`, un **build de production cassé** découvert au passage (bug bloquant non lié à l'audit initial), une régression géo mineurs qui aurait touché silencieusement 95 % des comptes actifs si déployée telle quelle, et plusieurs vérifications/durcissements infra (modération fail-closed, rétention logs, privilèges DB, process fantôme).

Les risques dominants restants pour une plateforme **live + UGC + geo + musique** sont désormais concentrés sur des sujets qui **ne peuvent pas être « corrigés » par du code** : **(1) légal/contenu (CSAM hash-matching, licences musique, mineurs live)**, **(2) scale & résilience (store RAM, WAF absent, SPOF)**, **(3) gouvernance ops (backups restore réel, secrets Git history, DPA, déploiement effectif des correctifs déjà codés)**.

---

## Critique — priorité absolue

| # | Constat | Domaine | Statut 08-11 | Effort correction |
|---|---------|---------|---------------|-------------------|
| C1 | **Pas de hash-matching CSAM** (PhotoDNA / NCMEC ou équivalent) — heuristique Sightengine `face-age` insuffisante seule | Modération / Légal [07](./07-moderation.md) | Inchangé — **hors scope code**, nécessite contrat fournisseur | **Élevé** (contrat fournisseur + intégration) |
| C2 | **Runbook CSAM / signalement PHAROS-NCMEC** — brouillon non validé avocat, jamais testé en exercice | Modération [07](./07-moderation.md) | Inchangé — **hors scope code**, nécessite validation juriste | **Moyen** (juridique + tabletop) |
| C3 | **Licences musique UGC / live** — pas de cadre SACEM/labels ; ACRCloud seul n'accorde pas de droits | Légal [10](./10-youtube.md) [11](./11-legalite-globale.md) | Inchangé — **hors scope code**, décision business/juridique | **Élevé** (business + juridique) |
| C4 | **Secrets dans historique Git** (commit ancien référencé audits antérieurs) — récupérables si accès repo | Sécurité [05](./05-securite.md) | Non traité — **purge = réécriture d'historique destructive**, nécessite accord explicite (force-push, invalide tous les clones) | **Moyen** (purge + rotation) |
| C5 | **Scaling API bloqué** — PM2 `instances: 1` + store applicatif RAM non partagé | DDoS / DB [06](./06-ddos.md) [02](./02-database.md) | Inchangé — **hors scope**, refonte d'architecture à planifier | **Élevé** (refonte architecture) |
| C6 | **Live WebRTC (LiveKit) sans modération vidéo** — seul Cloudflare Stream est échantillonné (~60 s) | Modération [07](./07-moderation.md) | Inchangé — **hors scope**, nécessite choix produit (egress LiveKit ou restriction) | **Élevé** (egress LiveKit ou restriction produit) |
| C7 | **WAF/CDN site non actif** — DNS direct OVH → VPS | DDoS [06](./06-ddos.md) | Inchangé — **hors scope**, bascule DNS = risque de coupure si mal exécutée, nécessite créneau dédié | **Moyen** (accès DNS) |
| ✅ C8 | ~~`jspdf` critique (CVSS jusqu'à 9.6)~~ | Stack [01](./01-stack.md) | **Résolu (code)** : upgrade `^3.0.4` → `^4.2.1`, `npm audit` → 0 vulnérabilité, build + tests web (576/576) ✅ | Fait |

---

## Élevé — traiter sous 2–8 semaines

| # | Constat | Domaine | Statut 08-11 | Effort |
|---|---------|---------|---------------|--------|
| E1 | OAuth Google / YouTube app probablement en **mode Testing** — bloque usage réel | API [08](./08-api-externes.md) [10](./10-youtube.md) | Non traité — **hors scope code**, process Google Console | **Élevé** (process Google) |
| ~~E2~~ | ~~Mineurs : vérif âge faible, geo fine non restreinte, live caméra non réservée majeurs~~ | Légal [11](./11-legalite-globale.md) [03](./03-postgis.md) | ✅ **Résolu (code, non déployé)** : DOB obligatoire à l'inscription, géo précise verrouillée <18 ans pour mineurs *confirmés* (avec grandfathering des comptes légacy à âge inconnu, cf. E15), dons verrouillés sur âge réel serveur, live verrouillé à 16 ans côté serveur. Reste ouvert : seuil live à 16 (E16) + déploiement prod | **Faible** restant (déploiement + arbitrage seuil live) |
| ~~E3~~ | ~~Aucun captcha (Turnstile/reCAPTCHA) inscription / reset password~~ | DDoS [06](./06-ddos.md) | ✅ **Résolu (code), non déployé** : Turnstile intégré front+back, clé secrète prod déjà en place, build prod actuel ne l'inclut pas encore | **Faible** (déployer) |
| E4 | **DPA RGPD art. 28** non signés (Scaleway, Cloudflare, Stripe, Resend…) | RGPD [09](./09-cgu-rgpd.md) | Non traité — **hors scope code**, démarche contractuelle | **Moyen** (contractuel) |
| ✅ E5 | ~~Rétention logs connexion — écart privacy vs implémentation~~ | RGPD [09](./09-cgu-rgpd.md) [12](./12-divers.md) | ✅ **Vérifié conforme** : `privacy.ts` annonce déjà « 6 mois » pour les logs techniques (la référence « 12 mois » d'un audit antérieur était obsolète) ; implémentation réelle (`app_diagnostic_logs`) = 5 mois ≤ promesse. Aucun correctif nécessaire | Fait (vérifié) |
| E6 | **Test restauration backup** non prouvé récemment | DB [02](./02-database.md) | Non traité — **hors scope**, exercice ops à planifier (impact/durée non négligeables) | **Moyen** (ops) |
| E7 | **SPOF** : 1 VPS, 1 PostgreSQL (prod+staging même instance), Redis local | Infra [12](./12-divers.md) | Inchangé — **hors scope**, refonte infra | **Élevé** |
| ~~E8~~ | ~~Sentry absent sur mobile Capacitor~~ | Observabilité [04](./04-observabilite.md) | ✅ **Résolu (code), non déployé en build store** : `@sentry/react` + `initNativeSentry()` dans `apptel` | **Faible** (build + vérif crash test) |
| ~~E9~~ | ~~npm audit : vulnérabilités high~~ | Stack [01](./01-stack.md) | ✅ **Résolu** (0 finding backend, 0 finding web y compris `jspdf`) | Fait |
| E10 | **Conformité stores IAP** — dons/abonnements via Stripe web dans app native | Légal [11](./11-legalite-globale.md) | Non traité — **hors scope code**, décision produit | **Moyen** (produit) |
| ✅ E11 | ~~Fail-open modération si Sightengine indisponible~~ | Modération [08](./08-api-externes.md) | ✅ **Vérifié conforme** : `SIGHTENGINE_FAIL_OPEN=0` explicitement configuré en prod (fail-closed sur erreur API). Rien à corriger | Fait (vérifié) |
| ✅ E12 | ~~Rôle DB applicatif sur-privilégié~~ | DB [02](./02-database.md) | ✅ **Corrigé (prod)** : `ALTER ROLE soundy NOCREATEROLE NOCREATEDB` appliqué sur PostgreSQL prod. Aucune migration ne requiert ces privilèges. Vérifié post-changement : `/health` → `db:ok` | Fait |
| ✅ E13 | ~~Processus `soundy-auth` non versionné en prod~~ | Divers [12](./12-divers.md) | ✅ **Corrigé (prod)** : identifié comme résidu de la migration de domaine (gate basic-auth, identifiant unique bcrypt codé en dur), confirmé non routé par Caddy et non exposé publiquement (`127.0.0.1:3001` uniquement), supprimé de pm2 (`pm2 delete` + `pm2 save`) | Fait |
| ~~E14~~ | ~~1 test backend en échec (`musicHome.test.ts`)~~ | Stack [01](./01-stack.md) | ✅ **Résolu** | Fait |
| ✅ E15 | ~~Régression `stories.test.ts` — politique géo mineurs vs comptes à âge inconnu~~ | Stack [01](./01-stack.md) / PostGIS [03](./03-postgis.md) | ✅ **Résolu (code)** : requête prod (lecture seule) → **418/439 comptes actifs (95 %) sans aucune donnée d'âge**. Politique corrigée : seuls les mineurs *confirmés* (âge connu < 18) sont restreints géographiquement ; les comptes à âge inconnu conservent leur précision géo existante. +3 tests dédiés. 513/513 tests backend ✅ | Fait |
| E16 | **Live caméra public autorisé dès 16 ans** (vs recommandation initiale de majorité vérifiée) | Légal [11](./11-legalite-globale.md) | Inchangé — **décision produit/légal**, ne peut pas être tranché unilatéralement en code | **Moyen** (arbitrage produit/légal + restrictions différenciées 16-17) |

---

## Détail des correctifs appliqués le 2026-08-11 (voir `modification.txt` MODIF 1352)

- **C8 — `jspdf`** : upgrade `^3.0.4` → `^4.2.1` (0 vulnérabilité `npm audit`), `jspdf-autotable` compatible sans changement. Build + 576 tests web ✅.
- **Bug bloquant découvert en cours de route** : `npm run build` (web) échouait (`tsc -b`) sur `AuthPage.tsx` / `SignupChatWizard.tsx` — appel double de `validateBirthDate()` non narrowable par TypeScript. Ce bug préexistant (introduit par MODIF 1349) n'avait pas été détecté car la vérification précédente utilisait `tsc --noEmit` (mode non-projet), qui ne reproduit pas l'erreur de `tsc -b`. **Corrigé** : valeur dérivée calculée une fois, réutilisée partout.
- **E15 — politique géo mineurs** : requête PostgreSQL prod en lecture seule → 95 % des comptes actifs sans âge connu. La politique « âge inconnu = traité comme mineur » (MODIF 1350) aurait dégradé silencieusement la précision géo de presque tous les comptes existants. Corrigé pour ne restreindre que les mineurs **confirmés** (âge connu < 18) ; les comptes légacy à âge inconnu gardent leur comportement actuel (grandfathering). Les nouvelles inscriptions renseignent obligatoirement `birthDate` donc ce cas ne concernera plus que les comptes créés avant cette obligation.
- **E11 — vérifié** : `SIGHTENGINE_FAIL_OPEN=0` déjà configuré en prod.
- **E5 — vérifié** : la politique de confidentialité publiée annonce déjà 6 mois (pas 12), conforme à l'implémentation réelle (5 mois).
- **E12 — corrigé (prod)** : privilèges `CREATEROLE`/`CREATEDB` retirés du rôle applicatif PostgreSQL.
- **E13 — corrigé (prod)** : process `soundy-auth` (résidu migration de domaine, non exposé publiquement) supprimé de pm2.

Toutes les modifications de code sont couvertes par les suites de tests (backend 513/513, web 576/576) et les builds (`tsc`, `vite build`) ont été revérifiés après coup.

---

## Ce qui reste **hors scope** de cette session de correctifs (et pourquoi)

Ces points ne peuvent pas être « corrigés » par un agent de développement sans une décision explicite du fondateur, un contrat externe, ou une opération infra à risque non réversible :

| Point | Nature du blocage |
|---|---|
| C1, C2 (CSAM) | Contrat fournisseur (PhotoDNA/NCMEC ou équivalent) + validation juriste du runbook |
| C3 (licences musique) | Décision business/juridique (SACEM, labels) |
| C4 (secrets Git history) | Purge = réécriture destructive de l'historique (force-push, invalide tous les clones) — nécessite accord explicite et coordination |
| C5 (scaling PM2/RAM) | Refonte d'architecture, nécessite conception dédiée |
| C6 (modération live WebRTC) | Décision produit (egress LiveKit payant vs restriction fonctionnelle) |
| C7 (Cloudflare WAF/CDN) | Bascule DNS — risque de coupure si mal exécutée, nécessite fenêtre de maintenance |
| E1 (OAuth Google mode test) | Process de vérification Google Console, hors code |
| E4 (DPA sous-traitants) | Démarche contractuelle avec chaque fournisseur |
| E6 (test restauration backup réel) | Exercice ops avec impact/durée à planifier (idéalement sur environnement de test dédié) |
| E7 (SPOF infra) | Refonte infra (multi-instance, réplication DB) |
| E10 (conformité IAP stores) | Décision produit (Stripe web vs achat intégré natif) |
| E16 (seuil âge live 16 vs 18) | Arbitrage produit/légal — impacte directement des utilisateurs actifs |

---

## Points positifs (à préserver)

- Requêtes SQL paramétrées ; sanitization HTML ; tests IDOR/auth nombreux.
- PostGIS GiST + flou coordonnées ~50 m.
- Pas de téléchargement YouTube serveur.
- CMP cookies avant Sentry web.
- CI : lint + tests + build prod sur chaque PR.
- Contrôle serveur de l'âge minimum pour lancer un live (16 ans) déjà en place de longue date.
- Modération Sightengine fail-closed en prod (vérifié).
- Rôle DB applicatif désormais sans privilèges `CREATEROLE`/`CREATEDB`.

---

## Prochaines étapes recommandées

1. **Commit + déploiement** des correctifs de code déjà présents dans le working tree (âge/mineurs, Turnstile, Sentry mobile, jspdf, fix build, npm audit) — actuellement **sans effet en prod** tant que non déployés. Demander confirmation explicite avant `deploy-prod.ps1`.
2. Partager **C1–C3** avec l'avocat (`commun/docs/juridique/RENDEZ-VOUS-AVOCAT.md`).
3. Planifier une session dédiée pour **C4** (purge secrets Git — nécessite accord explicite sur la réécriture d'historique et rotation des identifiants concernés).
4. Planifier **C7** (Cloudflare WAF/CDN — bascule DNS) sur une fenêtre de maintenance.
5. Planifier **E6** (test de restauration backup réel) sur un environnement de test.
6. **E16** : arbitrage produit/légal sur le seuil d'âge du live caméra public (16 vs 18 ans).
7. **E1, E4, E10** : démarches externes (Google Console, DPA fournisseurs, conformité stores) à mener en parallèle.
