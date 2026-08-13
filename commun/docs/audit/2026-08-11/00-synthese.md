# Synthèse globale — Audit technique OnScen

**Date :** 2026-08-10 — rafraîchi le 2026-08-11 (matin) — **correctifs appliqués et déployés le 2026-08-11 (soir)**
**Auditeur :** revue senior
**Méthode :** relecture des 12 rapports du 2026-08-10 ; `npm audit` (backend + web) et suites de tests (backend + web) ; vérification ciblée de code ; vérifications SSH read-only puis actions ciblées sur le VPS prod (voir détail par constat) ; requête PostgreSQL prod en lecture seule pour quantifier l'impact réel avant décision de correction (E15) ; **ce soir : re-vérification directe sur le build `dist/`/`public/` déployé en prod pour confirmer le statut réel (code vs déployé) de chaque correctif.**

**Rapports détaillés :** [01-stack](./01-stack.md) … [12-divers](./12-divers.md) · Détail technique des correctifs : `modification.txt` (MODIF 1352 → 1357)

---

## ⚠️ Changement de statut majeur depuis ce matin

Le point d'attention transverse du rafraîchissement du matin (« correctifs codés mais non déployés ») **ne s'applique plus**. Une session ultérieure le même jour a **commité et déployé en production** : Turnstile, le verrouillage géo/âge des mineurs, `jspdf`, ainsi que des correctifs supplémentaires découverts en cours de route (branding e-mail `RESEND_FROM`, renvoi d'e-mail de vérification, décommission complète de `getsoundy.com`, ouverture des inscriptions publiques). Ces éléments ont été **vérifiés directement sur le VPS prod** (fichiers `dist/`, `public/assets/`, `.env`) et non plus seulement dans le code source.

En contrepartie, un **nouveau changement de contexte** doit être noté : les inscriptions publiques sont désormais **ouvertes** (`ACCESS_REGISTRATION_MODE=open`), ce qui change la lecture de plusieurs constats (anti-bot, mineurs, modération, charge).

---

## Vue d'ensemble

OnScen reste un **monolithe Node/React mature** pour son stade. La journée du 08-11 a vu deux vagues de correctifs : une session technique matinale (jspdf, mineurs, build cassé, npm audit, infra) puis une session produit/légale (décommission `getsoundy.com`, ouverture des inscriptions prod, notification fondateur, hygiène des e-mails transactionnels). **Tous les correctifs de code de ces deux sessions sont désormais déployés et vérifiés en production.**

Les risques dominants restants pour une plateforme **live + UGC + geo + musique** restent concentrés sur des sujets qui **ne peuvent pas être « corrigés » par du code** : **(1) légal/contenu (CSAM hash-matching, licences musique, mineurs live)**, **(2) scale & résilience (store RAM, WAF absent, SPOF)**, **(3) gouvernance ops (backups restore réel, secrets Git history, DPA, client OAuth Google cassé)**. Un nouveau point s'ajoute : **(4) surveillance active de l'ouverture des inscriptions** (pas de plafond de rythme, dépendance à un seul mécanisme anti-bot).

---

## Critique — priorité absolue

| # | Constat | Domaine | Statut 08-11 (soir) | Effort correction |
|---|---------|---------|---------------------|-------------------|
| C1 | **Pas de hash-matching CSAM** (PhotoDNA / NCMEC ou équivalent) — heuristique Sightengine `face-age` insuffisante seule | Modération / Légal [07](./07-moderation.md) | Inchangé — **hors scope code**, nécessite contrat fournisseur | **Élevé** (contrat fournisseur + intégration) |
| C2 | **Runbook CSAM / signalement PHAROS-NCMEC** — brouillon non validé avocat, jamais testé en exercice | Modération [07](./07-moderation.md) | Inchangé — **hors scope code**, nécessite validation juriste | **Moyen** (juridique + tabletop) |
| C3 | **Licences musique UGC / live** — pas de cadre SACEM/labels ; ACRCloud seul n'accorde pas de droits | Légal [10](./10-youtube.md) [11](./11-legalite-globale.md) | Inchangé — **hors scope code**, décision business/juridique. **Aggravation contextuelle** : les inscriptions sont désormais ouvertes → plus d'UGC musical potentiel sans cadre légal | **Élevé** (business + juridique) |
| C4 | **Secrets dans historique Git** (commit `72370fc8` référencé audits antérieurs) — récupérables si accès repo | Sécurité [05](./05-securite.md) | **Vérifié toujours présent** (`git log` ce soir confirme le commit dans l'historique) — purge = réécriture d'historique destructive, nécessite accord explicite (force-push, invalide tous les clones) | **Moyen** (purge + rotation) |
| C5 | **Scaling API bloqué** — PM2 `instances: 1` + store applicatif RAM non partagé | DDoS / DB [06](./06-ddos.md) [02](./02-database.md) | Inchangé — **hors scope**, refonte d'architecture à planifier. **Aggravation contextuelle** : inscriptions ouvertes = croissance potentielle plus rapide de la charge | **Élevé** (refonte architecture) |
| C6 | **Live WebRTC (LiveKit) sans modération vidéo** — seul Cloudflare Stream est échantillonné (~60 s) | Modération [07](./07-moderation.md) | Inchangé — **hors scope**, nécessite choix produit (egress LiveKit ou restriction) | **Élevé** (egress LiveKit ou restriction produit) |
| C7 | **WAF/CDN site non actif** — DNS direct → VPS | DDoS [06](./06-ddos.md) | Inchangé — **hors scope**, bascule DNS = risque de coupure si mal exécutée, nécessite créneau dédié. **Aggravation contextuelle** : inscriptions ouvertes = surface d'attaque publique plus large sans WAF | **Moyen** (accès DNS) |
| ✅ C8 | ~~`jspdf` critique (CVSS jusqu'à 9.6)~~ | Stack [01](./01-stack.md) | **Résolu et déployé** : upgrade `^3.0.4` → `^4.2.1`, `npm audit` → 0 vulnérabilité (re-confirmé 08-11 soir), build + tests web (576/576) ✅ | Fait |

---

## Élevé — traiter sous 2–8 semaines

| # | Constat | Domaine | Statut 08-11 (soir) | Effort |
|---|---------|---------|---------------------|--------|
| ⚠️ E1 | **OAuth Google/YouTube cassé en prod** (`deleted_client`) — au-delà du « mode Testing » signalé ce matin, le client OAuth semble supprimé/désynchronisé côté Google Cloud Console, probablement lié à la migration de domaine `onscen.com`. Bouton Google déjà grisé côté frontend en prod (pas d'erreur visible utilisateur) | API [08](./08-api-externes.md) [10](./10-youtube.md) | **Aggravé** — hors scope code, process Google Console | **Élevé** (process Google + re-test) |
| ✅ E2 | ~~Mineurs : vérif âge faible, geo fine non restreinte, live caméra non réservée majeurs~~ | Légal [11](./11-legalite-globale.md) [03](./03-postgis.md) | ✅ **Résolu et déployé en prod** (vérifié directement sur `dist/lib/ageGates.js`) : DOB obligatoire à l'inscription, géo précise verrouillée <18 ans pour mineurs *confirmés* (grandfathering comptes legacy), dons verrouillés sur âge réel serveur, live verrouillé à 16 ans côté serveur. Reste ouvert : seuil live à 16 (E16, arbitrage produit/légal) | Fait (déployé) |
| ✅ E3 | ~~Aucun captcha (Turnstile/reCAPTCHA) inscription / reset password~~ | DDoS [06](./06-ddos.md) | ✅ **Résolu et déployé** : Turnstile confirmé présent dans le bundle prod (`TurnstileWidget-*.js`), couvre désormais aussi le renvoi d'e-mail de vérification | Fait (déployé) |
| E4 | **DPA RGPD art. 28** non signés (Scaleway, Cloudflare, Stripe, Resend…) | RGPD [09](./09-cgu-rgpd.md) | Non traité — **hors scope code**, démarche contractuelle | **Moyen** (contractuel) |
| ✅ E5 | ~~Rétention logs connexion — écart privacy vs implémentation~~ | RGPD [09](./09-cgu-rgpd.md) [12](./12-divers.md) | ✅ **Vérifié conforme** (inchangé depuis ce matin) : `privacy.ts` annonce « 6 mois » pour les logs techniques ; implémentation réelle = 5 mois ≤ promesse | Fait (vérifié) |
| E6 | **Test restauration backup** non prouvé récemment | DB [02](./02-database.md) | Non traité — **hors scope**, exercice ops à planifier | **Moyen** (ops) |
| E7 | **SPOF** : 1 VPS, 1 PostgreSQL (prod+staging même instance), Redis local | Infra [12](./12-divers.md) | Inchangé — **hors scope**, refonte infra | **Élevé** |
| ~~E8~~ | ~~Sentry absent sur mobile Capacitor~~ | Observabilité [04](./04-observabilite.md) | ✅ **Résolu (code)**, déploiement store toujours **non confirmé** (statut inchangé depuis ce matin — nécessite build store réel pour vérifier) | **Faible** (build + vérif crash test) |
| ✅ E9 | ~~npm audit : vulnérabilités high~~ | Stack [01](./01-stack.md) | ✅ **Résolu et re-confirmé 08-11 soir** (0 finding backend, 0 finding web) | Fait |
| E10 | **Conformité stores IAP** — dons/abonnements via Stripe web dans app native | Légal [11](./11-legalite-globale.md) | Non traité — **hors scope code**, décision produit | **Moyen** (produit) |
| ✅ E11 | ~~Fail-open modération si Sightengine indisponible~~ | Modération [08](./08-api-externes.md) | ✅ **Vérifié conforme** (inchangé) : `SIGHTENGINE_FAIL_OPEN=0` en prod | Fait (vérifié) |
| ✅ E12 | ~~Rôle DB applicatif sur-privilégié~~ | DB [02](./02-database.md) | ✅ **Corrigé (prod)**, inchangé depuis ce matin | Fait |
| ✅ E13 | ~~Processus `soundy-auth` non versionné en prod~~ | Divers [12](./12-divers.md) | ✅ **Corrigé (prod)**, inchangé depuis ce matin | Fait |
| ~~E14~~ | ~~1 test backend en échec (`musicHome.test.ts`)~~ | Stack [01](./01-stack.md) | ✅ **Résolu**, inchangé | Fait |
| ✅ E15 | ~~Régression `stories.test.ts` — politique géo mineurs vs comptes à âge inconnu~~ | Stack [01](./01-stack.md) / PostGIS [03](./03-postgis.md) | ✅ **Résolu et déployé**, inchangé depuis ce matin | Fait |
| E16 | **Live caméra public autorisé dès 16 ans** (vs recommandation initiale de majorité vérifiée) | Légal [11](./11-legalite-globale.md) | Inchangé — décision produit/légal | **Moyen** (arbitrage produit/légal) |
| 🆕 E17 | **Ouverture des inscriptions publiques sans plafond de rythme** — `ACCESS_REGISTRATION_MODE=open` activé le 08-11 ; seule protection anti-abus = Turnstile + notification fondateur manuelle par e-mail à chaque signup | DDoS [06](./06-ddos.md) | **Nouveau** — décision produit assumée, mais **sans garde-fou automatique de volume** (pas de plafond/jour, pas d'alerte si pic anormal) | **Faible** (ajouter un seuil d'alerte / plafond horaire) |
| 🆕 E18 | **`RESEND_FROM` affichait la marque legacy « Soundy »** dans tous les e-mails transactionnels envoyés aux utilisateurs (vérification, reset, activation) jusqu'au 08-11 soir | Sécurité/Brand [05](./05-securite.md) | ✅ **Corrigé et déployé** — `OnScen <onboarding@resend.dev>` | Fait |

---

## Détail des correctifs appliqués le 2026-08-11 (matin — `modification.txt` MODIF 1352)

- **C8 — `jspdf`** : upgrade `^3.0.4` → `^4.2.1` (0 vulnérabilité `npm audit`).
- **Bug de build production** découvert et corrigé (`AuthPage.tsx`/`SignupChatWizard.tsx`).
- **E15 — politique géo mineurs** : grandfathering des comptes à âge inconnu (95 % des comptes actifs).
- **E11, E5** vérifiés conformes sans correctif nécessaire.
- **E12, E13** corrigés directement en prod (privilèges DB, process fantôme).

## Détail des correctifs appliqués et déployés le 2026-08-11 (soir — MODIF 1353 → 1357)

- **MODIF 1353** — rangement monorepo (sans impact sécurité/légal).
- **MODIF 1354** — `ACCESS_REGISTRATION_MODE=open` en prod + `sendSignupNotificationEmail()` (notification fondateur à chaque inscription).
- **MODIF 1355/1356** — décommission complète de `getsoundy.com` : Caddy hard-stop, `WEB_APP_URL`/`CORS_ORIGIN` restreints à `onscen.com`, `legal-publisher.json` et `capacitor.config.json` resynchronisés.
- **MODIF 1357** — `RESEND_FROM` corrigé (`Soundy` → `OnScen`), nouvel endpoint `POST /auth/resend-verification-email` (Turnstile + rate limit + anti-énumération), e-mail d'activation de compte pour le flux `admin_approval`, `subscription_payment_failed` rendu visible dans la cloche de notifications in-app.
- **Déploiement confirmé** : `dist/` et `public/` synchronisés sur le VPS prod, `pm2 reload`, `/health` → OK à chaque étape.
- **Vérification indépendante ce soir** : Turnstile (chunk `TurnstileWidget-*.js`), âge/mineurs (`dist/lib/ageGates.js`), `npm audit` (0/0), tests backend (512/513, 1 flaky timeout non bloquant).

---

## Ce qui reste **hors scope** de toute session de correctifs (et pourquoi)

| Point | Nature du blocage |
|---|---|
| C1, C2 (CSAM) | Contrat fournisseur (PhotoDNA/NCMEC ou équivalent) + validation juriste du runbook |
| C3 (licences musique) | Décision business/juridique (SACEM, labels) |
| C4 (secrets Git history) | Purge = réécriture destructive de l'historique — nécessite accord explicite et coordination |
| C5 (scaling PM2/RAM) | Refonte d'architecture, nécessite conception dédiée |
| C6 (modération live WebRTC) | Décision produit (egress LiveKit payant vs restriction fonctionnelle) |
| C7 (Cloudflare WAF/CDN) | Bascule DNS — nécessite fenêtre de maintenance |
| E1 (OAuth Google cassé) | Process de reconfiguration Google Cloud Console, hors code |
| E4 (DPA sous-traitants) | Démarche contractuelle avec chaque fournisseur |
| E6 (test restauration backup réel) | Exercice ops avec impact/durée à planifier |
| E7 (SPOF infra) | Refonte infra (multi-instance, réplication DB) |
| E10 (conformité IAP stores) | Décision produit (Stripe web vs achat intégré natif) |
| E16 (seuil âge live 16 vs 18) | Arbitrage produit/légal — impacte directement des utilisateurs actifs |
| E17 (rythme inscriptions) | Décision produit déjà assumée ; ajout d'un garde-fou de volume reste une amélioration technique mineure disponible sur demande |

---

## Points positifs (à préserver)

- Requêtes SQL paramétrées ; sanitization HTML ; tests IDOR/auth nombreux.
- PostGIS GiST + flou coordonnées ~50 m.
- Pas de téléchargement YouTube serveur.
- CMP cookies avant Sentry web.
- CI : lint + tests + build prod sur chaque PR.
- Contrôle serveur de l'âge minimum pour lancer un live (16 ans) — **désormais déployé et confirmé, pas seulement codé**.
- Modération Sightengine fail-closed en prod.
- Rôle DB applicatif sans privilèges `CREATEROLE`/`CREATEDB`.
- **Nouveau** : Turnstile + âge/mineurs + `jspdf` + hygiène e-mails transactionnels déployés et vérifiés en production le même jour que leur correction (boucle courte code → prod).
- **Nouveau** : décommission propre de `getsoundy.com`, un seul domaine canonique désormais.

---

## Prochaines étapes recommandées (mises à jour)

1. **E1 — priorité immédiate parmi les items actionnables** : reconfigurer le client OAuth Google Cloud Console (redirect URIs `onscen.com`), sinon le login Google/YouTube reste indisponible indéfiniment.
2. **E17** : ajouter un garde-fou de volume sur les inscriptions (seuil horaire/jour + alerte) — effort faible, peut être fait rapidement si souhaité.
3. Partager **C1–C3** avec l'avocat (`commun/docs/juridique/RENDEZ-VOUS-AVOCAT.md`).
4. Planifier une session dédiée pour **C4** (purge secrets Git — accord explicite requis).
5. Planifier **C7** (Cloudflare WAF/CDN) sur une fenêtre de maintenance — plus pressant maintenant que les inscriptions sont ouvertes.
6. Planifier **E6** (test de restauration backup réel).
7. **E16** : arbitrage produit/légal sur le seuil d'âge du live caméra public (16 vs 18 ans).
8. **E4, E10** : démarches externes (DPA fournisseurs, conformité stores) à mener en parallèle.
9. Nettoyer/committer séparément le diff carte/globe en cours dans le working tree (hygiène de repo, sans lien avec la sécurité).
