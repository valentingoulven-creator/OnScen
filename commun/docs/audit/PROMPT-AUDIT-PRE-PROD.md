# Prompt — Audit GO / NO-GO pré-prod OnScen

**Lancement :** nouvelle conversation Agent → taper **`@audit`** (règle `.cursor/rules/onscen-audit.mdc`). Rien d’autre à coller.

**Agent :** `@audit` / `@onscen-cto` — analyse uniquement. **Ne pas coder. Ne pas déployer.**  
**Ensuite :** `@onscen-dev-agent` uniquement à partir des tickets P0.

**Autorité :** ce fichier **prévaut** sur `commun/docs/ONSCEN-CTO-PROMPT.md` pour un audit formel. En cas de divergence : **signaler** avant de trancher.

Date cible : jour de l’audit. Produit : **OnScen** (`onscen.com`). Surfaces : **web** + **app tel** (PWA `/tel/` + Capacitor iOS/Android).

---

# Mission

Réalise un audit **GO / NO-GO de mise en production d'OnScen**.

Analyse, vérifie, constate et recommande uniquement.

**Interdictions absolues :**

* Ne code pas.
* Ne modifie pas le code.
* Ne commit pas.
* Ne push pas.
* Ne déploie pas.
* Ne modifie pas l'infrastructure.
* Ne réécris pas l'historique Git.
* Ne supprime aucune donnée.
* Ne modifie aucune configuration de production.
* Ne lance aucune opération destructive.
* Ne redémarre pas volontairement un service de production.
* Ne révèle jamais de secret ou credential.

L'objectif est de déterminer si **OnScen est réellement prêt à être mis en production**, et non de produire une impression générale de qualité.

Chaque constat doit être ancré dans au moins une source vérifiable :

1. code/configuration du repository ;
2. documentation existante ;
3. audit précédent ;
4. vérification live sur staging/prod ;
5. test fonctionnel réellement effectué.

Si un élément ne peut pas être vérifié :

**NON VÉRIFIÉ**

et indique précisément :

* pourquoi il n'est pas vérifiable ;
* quel accès ou test serait nécessaire ;
* quel est le risque potentiel ;
* si cette absence de preuve influence le verdict GO/NO-GO.

**Principe fondamental :**

> `NON VÉRIFIÉ ≠ OK`

Ne transforme jamais une absence de preuve en conformité supposée.

Ne donne pas de conseil juridique définitif. Distingue toujours :

* **CONSTAT TECHNIQUE**
* **RISQUE**
* **À VALIDER PAR AVOCAT**

Avant de clore l'audit, **demande explicitement** si les clés ACRCloud :

* `ACRCLOUD_ACCESS_KEY`
* `ACRCLOUD_ACCESS_SECRET`

doivent être présentes en production ou restent **volontairement absentes**.

---

# 0. Préflight — accès réellement disponibles

**Avant toute analyse**, produire un inventaire explicite des accès demandés vs accès réellement obtenus. Ne jamais supposer un accès disponible parce qu'il est mentionné dans ce prompt.

| Accès requis | Nécessaire pour | Disponible ? | Preuve de disponibilité |
| --- | --- | --- | --- |
| Repository Git (lecture) | sections 1, 4, 5, 8, 17 | | |
| SSH `onscen-prod` (lecture seule) | sections 5, 7, 19, 23 | | |
| SSH `onscen-staging` (lecture seule + écriture test) | sections 5, 14, 15 | | |
| Accès Sentry (web/backend/natif) | section 7 | | |
| Accès Scaleway S3 (métadonnées backups) | section 5 | | |
| Accès dashboard PostgreSQL prod/staging | section 5, 6 | | |
| Accès GitHub Actions (workflows, historique runs) | section 17 | | |
| Accès dashboards APIs externes (Stripe, LiveKit, Sightengine, ACRCloud, etc.) | section 10 | | |
| Comptes de test staging (web, tel, mobile) | section 14, 15 | | |
| Build iOS/Android réel (TestFlight/internal track ou binaire) | section 13 | | |
| Documentation juridique interne | section 11 | | |

**Règle :** tout accès listé comme « non disponible » doit se traduire, dans les sections concernées, par des constats **NON VÉRIFIÉ** explicites — jamais par une hypothèse favorable. Si un accès critique pour la sécurité, les données ou les paiements est absent, cela peut à lui seul justifier un **NO-GO** (voir section 1).

Si l'audit doit être interrompu avant d'être complet (contrainte de temps, d'accès ou de volume), respecter l'ordre de priorité suivant pour l'allocation de l'effort :

1. Sécurité, authentification, IDOR, secrets (section 8)
2. Données personnelles, RGPD, mineurs, géolocalisation (sections 5, 6, 11)
3. Paiements, webhooks Stripe, IAP (sections 8, 10, 11)
4. Modération / CSAM (section 9)
5. Base de données, migrations, backups, rollback (sections 5, 18)
6. Observabilité et exploitation (sections 7, 19)
7. Dépendances et supply chain (sections 4, 17)
8. Mobile, QA fonctionnelle, YouTube (sections 12, 13, 14)
9. Performance et charge (section 16)
10. Dette technique / P2 divers

Si l'audit s'arrête avant la fin, le dire explicitement dans `00-synthese.md`, indiquer jusqu'où il est allé, et lister les sections non traitées comme **NON VÉRIFIÉ — hors périmètre de cette passe**.

---

# 0bis. Politique de test sur staging

Distinction stricte entre production et staging :

* **Sur production** : aucune écriture, aucune création de compte de test, aucune action mutante. Lecture seule uniquement (voir section 23).
* **Sur staging** : la création de données de test (compte, publication, événement, etc.) est **autorisée** dans la mesure nécessaire à l'exécution des checklists des sections 14 et 15, à condition de :
  * utiliser des comptes/données clairement identifiables comme tests (préfixe, email dédié, etc.) ;
  * consigner dans le rapport chaque donnée de test créée (type, identifiant, date) dans une annexe dédiée (`10-qa.md`) ;
  * éviter toute action irréversible non nécessaire (ex. : pas de suppression de compte tiers, pas de modification de configuration staging) ;
  * signaler si le nettoyage des données de test n'a pas pu être effectué, pour que l'équipe puisse le faire.

Si staging n'est pas disponible ou n'est pas isolé de la production (base partagée, services partagés), le signaler explicitement — cela impacte directement la capacité à exécuter les sections 14 et 15 en toute sécurité, et donc potentiellement le verdict.

---

# 1. Règles de verdict

Le verdict doit suivre ces règles :

### 🔴 NO-GO

Déclarer **NO-GO** lorsqu'au moins un problème P0 confirmé et non mitigé existe.

Également NO-GO lorsqu'un risque critique ne peut pas être vérifié et que l'absence de preuve empêche raisonnablement de démontrer la sécurité ou la fiabilité de la mise en production.

Exemples :

* faille critique exploitable ;
* accès non autorisé à des données utilisateur ;
* secret compromis ;
* perte potentielle de données sans restauration démontrée ;
* paiement/webhook critique non sécurisé ;
* contournement critique des restrictions d'âge ;
* absence de protection critique des données personnelles ;
* migration DB dangereuse sans stratégie de récupération ;
* impossibilité de restaurer la production ;
* fonctionnalité critique annoncée mais cassée ;
* blocage critique App Store / Google Play ;
* vulnérabilité critique non mitigée ;
* accès requis pour vérifier un risque critique (sécurité, données, paiements) refusé ou indisponible.

### 🟠 GO AVEC CONDITIONS

Possible si :

* aucun P0 non mitigé n'existe ;
* les P1 restants sont connus ;
* une mitigation existe ;
* les risques sont explicitement acceptés (par qui, par écrit si possible) ;
* les actions post-production ont un propriétaire et une échéance.

### 🟢 GO

Uniquement si :

* aucun P0 n'est ouvert ;
* aucun P1 critique n'est ouvert ;
* les fonctions critiques sont vérifiées ;
* sécurité, données, paiements, authentification et infrastructure sont suffisamment démontrés ;
* monitoring et rollback sont opérationnels ;
* les éléments critiques ne reposent pas sur des suppositions.

---

# 2. STOP CONDITIONS

Le statut doit automatiquement être considéré comme **NO-GO** lorsqu'un des éléments suivants est confirmé et non mitigé :

* secret exposé ou credential compromis ;
* accès non autorisé à des données utilisateur ;
* IDOR exploitable ;
* élévation de privilèges ;
* vulnérabilité critique exploitable ;
* authentification contournable ;
* paiement ou webhook critique falsifiable ;
* perte de données possible sans restauration démontrée ;
* absence totale de rollback pour une mise en production critique ;
* migration destructive sans stratégie de récupération ;
* restriction d'âge critique contournable ;
* exposition grave de coordonnées géographiques sensibles ;
* absence de protection critique contre une fonctionnalité d'abus évidente ;
* production impossible à surveiller ;
* fonctionnalité essentielle cassée ;
* problème bloquant de publication mobile ;
* dépendance critique vulnérable sans mitigation ;
* autre risque clairement classifiable P0.

---

# 3. Protection absolue des secrets

Ne jamais afficher, copier ou écrire dans le rapport :

* mot de passe ;
* token ;
* JWT ;
* cookie de session ;
* clé API ;
* secret API ;
* clé privée ;
* credential SSH ;
* secret Stripe ;
* secret OAuth ;
* secret S3 ;
* clé ACRCloud ;
* secret GitHub ;
* valeur de variable d'environnement sensible.

Lorsqu'une valeur doit être mentionnée :

`****`

Vérifier uniquement :

* présence ;
* absence ;
* emplacement ;
* nom de variable ;
* validité fonctionnelle si possible.

**Ne jamais dumper un fichier `.env` dans le rapport.**

Si un secret est découvert exposé (Git, logs, CI), ne pas le reproduire même partiellement, même tronqué au-delà de 2-3 caractères : indiquer uniquement son emplacement, sa nature, et déclencher immédiatement une STOP CONDITION (section 2).

---

# Contexte à relire d'abord

Lire avant toute conclusion :

* `commun/docs/STACK-CIBLE.md`
* `commun/docs/INFRA-ONSCEN.md`
* `docs/ENVIRONNEMENTS.md`
* `commun/msdev/SCALABILITY.md`
* `commun/docs/audit/README.md`
* `commun/docs/audit/2026-08-11/`
* `commun/docs/audit/2026-08-15-cto-web-mobile.md`
* `commun/docs/audit/2026-08-15-cto-builds-ios-android.md`
* `commun/docs/audit/AUDIT-legal-youtube-copyright-v2.md`
* `commun/docs/juridique/`
* `TODO-MANUAL.md` s'il existe
* `modification.txt`

Scripts à examiner (lecture seule — ne jamais les exécuter s'ils peuvent muter un état) :

* `commun/scripts/verify-full-access.ps1`
* `audit-external-env.*`
* `audit-infra-access.ps1`

Pour chaque script : lire son contenu et documenter ce qu'il ferait s'il était exécuté, avant de décider de l'exécuter ou non. Si un script a un effet de bord même en apparence anodin (écriture de log, appel réseau externe, modification de fichier), le signaler et ne pas l'exécuter sans confirmation explicite du fondateur.

Comparer obligatoirement :

**code actuel vs audits 2026-08-11 et 2026-08-15**

Pour chaque problème historique :

* résolu ;
* toujours ouvert ;
* partiellement résolu ;
* régressé ;
* aggravé ;
* nouveau ;
* NON VÉRIFIÉ.

---

# 4. Stack et dépendances

Vérifier :

* Node ;
* React ;
* Vite ;
* Express ;
* Capacitor ;
* versions réelles ;
* écart avec `STACK-CIBLE.md` ;
* backend ;
* frontend ;
* mobile ;
* `npm audit` backend ;
* `npm audit` `web/app` ;
* dépendances mortes ;
* dépendances inutilisées ;
* dépendances vulnérables ;
* dépendances transitives ;
* licences OSS incompatibles ;
* lockfiles ;
* incohérences entre environnements.

Vérifier également :

* scripts `postinstall` ;
* scripts `preinstall` ;
* dépendances exécutant du code pendant l'installation ;
* packages non pinés ;
* provenance des dépendances lorsque vérifiable.

---

# 5. Base de données

PostgreSQL :

* production ;
* staging ;
* architecture ;
* instance commune ou séparée ;
* rôles ;
* permissions ;
* secrets ;
* schéma ;
* migrations ;
* intégrité ;
* contraintes ;
* index ;
* transactions ;
* requêtes critiques.

Analyser :

`commun/backend/src/db/migrations/`

Pour les migrations récentes :

* compatibilité avec les données existantes ;
* migration destructive ;
* downtime potentiel ;
* verrouillage ;
* idempotence ;
* ordre d'exécution ;
* possibilité de récupération ;
* stratégie de rollback ;
* backup avant migration.

## Backups

Scaleway S3 :

* backup réellement présent ;
* fréquence ;
* dernier backup ;
* taille cohérente ;
* rétention ;
* dernier restore réellement testé ;
* date du dernier restore ;
* résultat du restore.

Un backup jamais restauré doit être considéré comme :

**RECOVERY NON DÉMONTRÉE**

## Données

Analyser :

* données personnelles ;
* minimisation ;
* rétention ;
* suppression ;
* purge de compte ;
* restauration ;
* données orphelines ;
* exports ;
* suppression définitive.

---

# 6. PostGIS / géolocalisation

Vérifier :

* extension active prod ;
* extension active staging ;
* migration `023_postgis_geo.sql` ;
* `postgisConfig.ts` ;
* précision géographique ;
* stockage des coordonnées ;
* exposition API ;
* logs ;
* analytics ;
* cache ;
* données de mineurs.

Analyser :

* minimisation ;
* floutage ;
* conservation ;
* requêtes spatiales ;
* index géographiques ;
* performance ;
* injection ;
* fuite de coordonnées précises.

---

# 7. Sentry et observabilité

Vérifier :

* Sentry web ;
* backend ;
* natif ;
* `web/app/src/lib/sentry.ts` ;
* `ios/apptel/src/lib/sentryNative.ts` ;
* DSN ;
* environnement ;
* release ;
* source maps ;
* PII ;
* logs.

Vérifier réellement :

* `/health` ;
* PM2 ;
* logs ;
* APM ;
* alertes ;
* erreurs 5xx ;
* DB ;
* mémoire ;
* CPU ;
* disque ;
* certificats ;
* backups ;
* dépendances externes.

Répondre clairement :

> Qui est réveillé à 3 h du matin si OnScen tombe ?

Identifier :

* système d'alerte ;
* destinataire ;
* seuil ;
* canal ;
* procédure d'escalade.

---

# 8. Sécurité

Faire un audit inspiré OWASP.

Vérifier :

* JWT ;
* sessions ;
* cookies ;
* auth ;
* autorisations ;
* IDOR ;
* XSS ;
* CSRF ;
* injections ;
* uploads ;
* webhooks Stripe ;
* CORS ;
* headers ;
* rate limiting ;
* Turnstile ;
* WAF ;
* CDN ;
* DDoS ;
* PM2 ;
* stockage RAM ;
* anti-bot ;
* `ACCESS_REGISTRATION_MODE`.

## Secrets

Vérifier :

* `.env` prod ;
* `.env` staging ;
* `.env` msdev ;
* `.gitignore` ;
* Git ;
* historique Git ;
* CI ;
* logs.

Chercher les secrets exposés dans l'historique Git.

Ne jamais reproduire les secrets trouvés.

---

# 9. Modération / contenu / CSAM

Sightengine :

* fail-closed ;
* couverture images ;
* vidéos ;
* reels ;
* live ;
* WebRTC ;
* Cloudflare ;
* contournements possibles.

Vérifier précisément la différence entre :

**modération réellement exécutée**

et

**modération supposée par l'architecture**.

CSAM :

* hash matching ;
* PhotoDNA ;
* NCMEC ;
* PHAROS ;
* procédures ;
* runbook ;
* capacité opérationnelle ;
* tests ;
* trous éventuels.

Si un élément juridique est incertain :

**CONSTAT TECHNIQUE + À VALIDER AVOCAT**

Ne jamais conclure juridiquement à la place d'un avocat.

---

# 10. APIs externes

Inventorier :

* LiveKit ;
* Cloudflare Stream ;
* Cloudflare Turnstile ;
* Stripe Connect ;
* Sightengine ;
* Google ;
* YouTube ;
* Resend ;
* Scaleway S3 ;
* Nominatim ;
* géocodage ;
* ACRCloud ;
* autres.

Pour chaque API :

| API | Présente | Prod | Staging | Quota | Fail-open/closed | Coût scale | DPA | Risque |
| --- | -------- | ---- | ------- | ----- | ---------------- | ---------- | --- | ------ |

Vérifier :

* clés ;
* configuration ;
* quotas ;
* erreurs ;
* retries ;
* timeout ;
* fallback ;
* coûts ;
* dépendance critique.

OAuth Google :

* client valide ;
* redirect URI ;
* consent screen ;
* révocation ;
* absence de `deleted_client`.

---

# 11. Juridique / conformité technique

Tu n'es pas avocat.

Produire une **matrice de conformité technique**, jamais une conclusion juridique définitive.

| Sujet               | Dans le produit ? | Preuve | Trou | Risque | Action fondateur / avocat |
| ------------------- | ----------------- | ------ | ---- | ------ | -------------------------- |
| DSA                 |                   |        |      |        |                             |
| RGPD                |                   |        |      |        |                             |
| DPA art. 28         |                   |        |      |        |                             |
| Cookies             |                   |        |      |        |                             |
| CGU                 |                   |        |      |        |                             |
| Privacy             |                   |        |      |        |                             |
| Mentions            |                   |        |      |        |                             |
| Mineurs             |                   |        |      |        |                             |
| UGC                 |                   |        |      |        |                             |
| Hébergeur / éditeur |                   |        |      |        |                             |
| Paiements           |                   |        |      |        |                             |
| IAP                 |                   |        |      |        |                             |
| Musique UGC/live    |                   |        |      |        |                             |
| CSAM                |                   |        |      |        |                             |

Analyser notamment :

* DSA ;
* RGPD ;
* base légale ;
* DPA ;
* droits utilisateurs ;
* cookies ;
* mineurs ;
* DOB ;
* géolocalisation ;
* live ;
* dons ;
* âge 16/18 ;
* UGC ;
* modération ;
* paiements ;
* Stripe ;
* IAP ;
* SACEM ;
* labels ;
* CSAM ;
* PHAROS ;
* NCMEC.

Conclusion autorisée :

* prêt ;
* partiellement prêt ;
* non prêt ;
* à valider avocat.

Interdit :

> « L'application est légale. »

---

# 12. YouTube

Vérifier :

* YouTube Data API ;
* IFrame API ;
* OAuth ;
* quota ;
* consentement ;
* révocation ;
* branding ;
* lecture en salon ;
* téléchargement ;
* utilisation comme fond d'écran ;
* règles applicables ;
* risque de suspension.

Comparer avec :

`AUDIT-legal-youtube-copyright-v2.md`

et :

`commun/docs/YOUTUBE-AUDIT-DEMO.md`

---

# 13. Mobile iOS / Android

Analyser :

`ios/apptel/`

Android.

Comparer avec :

`web/app/src/`

Vérifier :

* overrides ;
* divergence web/mobile ;
* Capacitor ;
* permissions ;
* caméra ;
* micro ;
* géolocalisation ;
* tracking ;
* privacy nutrition ;
* IAP ;
* dons ;
* push ;
* deep links ;
* background audio ;
* safe area ;
* tailles tactiles ;
* comportement offline ;
* crash handling ;
* Sentry natif.

Vérifier si Sentry natif est réellement présent dans un **build store réel** (pas seulement dans le code source — un build TestFlight/internal track effectivement crashé et remonté dans Sentry constitue la seule preuve de niveau VÉRIFIÉ TEST ; l'absence d'un tel test doit être documentée comme NON VÉRIFIÉ, pas comme VÉRIFIÉ REPO).

Comparer avec :

`AUDIT-mobile-ios-android.md`

et :

`2026-08-15-cto-builds-ios-android.md`

Juger séparément :

* PWA `/tel/` ;
* application iOS ;
* application Android ;
* version web desktop.

---

# 14. QA fonctionnelle

Ce n'est pas du clic aléatoire.

Produire une checklist smoke :

* web `:5173` ;
* tel `:4082/tel/` ;
* binaire iOS si disponible ;
* binaire Android si disponible.

Pour chaque parcours :

**OK / KO / NON TESTÉ**

avec preuve.

Tester (voir section 0bis pour la politique de données de test sur staging) :

* inscription ;
* login ;
* OAuth ;
* reset mot de passe ;
* vérification email ;
* Turnstile ;
* profil ;
* onboarding ;
* âge ;
* géolocalisation ;
* fil Actualité ;
* publication ;
* événement ;
* tag ;
* favori ;
* suivi ;
* Maps ;
* modification ;
* suppression ;
* carte ;
* globe ;
* pins ;
* sponsorisation ;
* création salon ;
* live ;
* caméra ;
* tips ;
* chat ;
* fin de live ;
* YouTube ;
* file ;
* invités ;
* reels ;
* DM ;
* notifications ;
* settings ;
* paiement ;
* Connect ;
* admin ;
* parcours mineur ;
* parcours majeur.

Signaler :

* boutons morts ;
* mauvais labels ;
* états vides ;
* états erreur ;
* loading ;
* régressions ;
* différences web/mobile.

Annexer la liste des données de test créées (identifiants, type) conformément à la section 0bis.

---

# 15. Tests de sécurité négatifs

Ne pas uniquement tester le parcours normal.

Vérifier, lorsque possible sans action destructive et **uniquement sur staging** (jamais sur production, voir section 0bis) :

* utilisateur A → données utilisateur B ;
* modification d'un ID ;
* suppression d'un contenu tiers ;
* accès admin sans rôle ;
* accès à des endpoints non exposés par l'UI ;
* contournement des restrictions d'âge ;
* modification de paramètres frontend ;
* upload de fichiers inattendus ;
* replay de webhook Stripe ;
* webhook non authentifié ;
* spam inscription ;
* spam DM ;
* spam commentaires ;
* contournement des rate limits ;
* accès à des ressources supprimées ;
* accès après logout ;
* accès avec session expirée.

Tout test destructif doit être évité sur production.

Si un test ne peut être exécuté que sur production pour être concluant (ex. : comportement uniquement reproductible avec des données/volumes de prod), ne pas l'exécuter : le documenter comme **NON VÉRIFIÉ**, avec le risque associé et la raison de la non-exécution.

---

# 16. Performance et charge

Analyser :

* requêtes N+1 ;
* appels réseau ;
* DB ;
* index ;
* cache ;
* mémoire ;
* CPU ;
* WebSocket ;
* WebRTC ;
* LiveKit ;
* uploads ;
* images ;
* vidéos ;
* frontend ;
* rendering.

Identifier ce qui est :

* capacité démontrée ;
* capacité théorique ;
* NON VÉRIFIÉ.

Vérifier si un test de charge existe.

Si oui :

* date ;
* environnement ;
* scénario ;
* utilisateurs simultanés ;
* résultat ;
* limites observées.

Si non :

**NON VÉRIFIÉ / CAPACITÉ NON DÉMONTRÉE**

Analyser au minimum :

* connexions simultanées ;
* API ;
* DB ;
* WebSocket ;
* live ;
* uploads ;
* inscriptions ;
* paiements/webhooks.

---

# 17. CI/CD et supply chain

Vérifier :

* GitHub Actions ;
* workflows ;
* secrets CI ;
* permissions ;
* branche de production ;
* protections de branche ;
* approbations ;
* artefacts ;
* builds reproductibles ;
* migrations ;
* déploiement ;
* rollback.

Identifier :

* commit SHA actuellement en production ;
* branche ;
* version ;
* correspondance avec le repository ;
* correspondance avec build mobile ;
* artefact réellement déployé.

Vérifier les actions GitHub tierces et leurs permissions.

---

# 18. Rollback et Disaster Recovery

Vérifier :

* procédure de rollback application ;
* version précédente disponible ;
* procédure de rollback DB ;
* migrations irréversibles ;
* backup avant migration ;
* restauration S3 ;
* restauration DB ;
* documentation ;
* personne responsable ;
* procédure testée.

Déterminer :

### RPO

Combien de données peut-on perdre au maximum ?

### RTO

Combien de temps peut-on accepter avant retour au service ?

Si aucune valeur n'est définie :

**NON DÉFINI**

Si aucune restauration réelle n'a été testée :

**RECOVERY NON DÉMONTRÉE**

---

# 19. Exploitation production

Vérifier :

* uptime monitoring ;
* healthcheck ;
* PM2 ;
* logs ;
* rotation logs ;
* espace disque ;
* CPU ;
* RAM ;
* DB ;
* backups ;
* certificats ;
* DNS ;
* CDN ;
* WAF ;
* alertes ;
* incidents ;
* procédure d'escalade.

Identifier clairement :

* qui surveille ;
* qui intervient ;
* qui décide d'un rollback ;
* qui possède les accès ;
* où sont les procédures.

---

# 20. Registre des problèmes P0 / P1 / P2

Classer tous les problèmes dans un registre **unique** (ne pas dupliquer entre le rapport final et cette section — le tableau produit ici est celui réutilisé tel quel en section 22.2) :

### P0 — BLOQUANT

Risque critique ou impossibilité de mise en production.

### P1 — IMPORTANT

À corriger rapidement, idéalement avant ou immédiatement après production selon mitigation.

### P2 — DETTE

Amélioration ou dette technique non bloquante.

Pour chaque problème :

| ID | Priorité | Domaine | Constat | Preuve | Niveau de preuve | Risque | Recommandation | Propriétaire | Statut |
| -- | -------- | ------- | ------- | ------ | ----------------- | ------ | --------------- | ------------ | ------ |

---

# 21. Delta des audits précédents

Comparer explicitement :

* audit 2026-08-11 ;
* audit 2026-08-15 CTO web/mobile ;
* audit 2026-08-15 builds iOS/Android.

Pour chaque ancien problème :

| Problème | Ancien statut | Statut actuel | Preuve | Évolution |
| -------- | ------------- | -------------- | ------ | --------- |

Catégories :

* RÉSOLU ;
* TOUJOURS OUVERT ;
* PARTIELLEMENT RÉSOLU ;
* RÉGRESSÉ ;
* AGGRAVÉ ;
* NOUVEAU ;
* NON VÉRIFIÉ.

---

# 22. Rapport final — ordre strict

Le rapport final doit respecter exactement cet ordre :

## 1. Verdict

**GO / GO AVEC CONDITIONS / NO-GO**

Inclure :

* justification ;
* P0 ;
* P1 critiques ;
* éléments NON VÉRIFIÉS critiques ;
* conditions éventuelles ;
* rappel des accès non obtenus (section 0) ayant limité l'audit, s'il y en a.

## 2. Registre P0 / P1 / P2

Le tableau de la section 20, sans le reproduire ni le reformuler.

## 3. Delta

Comparer avec :

* 2026-08-11 ;
* 2026-08-15.

## 4. Analyse par phase

Pour chaque phase :

* constat ;
* preuve ;
* niveau de preuve ;
* risque ;
* recommandation ;
* statut.

## 5. Ce qui manque encore

Séparer :

* accès manquants (référencer la section 0) ;
* tests manquants ;
* preuves manquantes ;
* décisions business ;
* opérations ;
* avocat ;
* éléments hors scope.

## 6. Recommandations avant mise en production

Liste actionnable avec :

* action ;
* priorité ;
* propriétaire ;
* dépendance ;
* preuve attendue.

Propriétaires possibles :

* fondateur ;
* ops ;
* avocat ;
* `@onscen-dev-agent`.

## 7. Handoff `@onscen-dev-agent`

Uniquement les tickets **P0**.

Un fichier markdown par sujet, nommé `commun/docs/audit/YYYY-MM-DD-go-prod/tickets/NN-slug-du-sujet.md`.

Ne pas coder les corrections.

Chaque ticket doit contenir, dans cet ordre, avec ces titres de section :

```markdown
# [ID P0] Titre court du problème

## Contexte
## Problème
## Preuve
(chemins exacts, niveau de preuve)
## Impact
## Résultat attendu
## Critères d'acceptation
(liste vérifiable, testable)
## Fichiers concernés
(chemins réels)
```

## 8. Arbitrages obligatoires

Inclure :

* ACRCloud ;
* IAP ;
* live 16 ans ;
* WAF ;
* DNS ;
* autres décisions business critiques.

Terminer obligatoirement par :

> **Question ACRCloud : les variables `ACRCLOUD_ACCESS_KEY` et `ACRCLOUD_ACCESS_SECRET` doivent-elles être présentes en production, ou leur absence est-elle volontaire ?**

---

# 23. Accès production et staging

Production :

* `onscen.com`
* `ssh onscen-prod`

Staging :

* `staging.onscen.com`
* `ssh onscen-staging`

SSH production :

**lecture seule uniquement**.

Autorisé :

* health ;
* statut PM2 ;
* versions ;
* noms de variables ;
* logs non sensibles ;
* informations nécessaires à l'audit.

Interdit :

* dump de secrets ;
* modification ;
* suppression ;
* redémarrage volontaire ;
* déploiement ;
* migration ;
* changement de configuration.

Pour toute commande pouvant modifier l'état du système :

**NE PAS L'EXÉCUTER.**

En cas de doute sur le caractère mutant d'une commande (y compris une commande apparemment anodine comme un flush de cache ou un touch de fichier), s'abstenir et le documenter comme accès non exploité par prudence, plutôt que de l'exécuter.

---

# 24. Rapport sur disque

Écrire le rapport dans :

`commun/docs/audit/YYYY-MM-DD-go-prod/`

Créer au minimum :

`00-synthese.md` (doit contenir : verdict, registre P0/P1/P2 résumé, delta résumé, accès manquants ayant limité l'audit)

Puis, si nécessaire :

* `01-stack.md`
* `02-database.md`
* `03-postgis.md`
* `04-observability.md`
* `05-security.md`
* `06-apis.md`
* `07-legal.md`
* `08-youtube.md`
* `09-mobile.md`
* `10-qa.md` (inclut l'annexe des données de test créées sur staging — section 0bis)
* `11-performance.md`
* `12-cicd-recovery.md`
* `tickets/` (tickets P0 individuels — section 22.7)

Ne pas créer de fichiers inutiles si `00-synthese.md` suffit.

---

# 25. Principes finaux

Ne jamais :

* inventer une preuve ;
* inventer un statut conforme ;
* transformer une hypothèse en fait ;
* cacher un problème parce qu'il est difficile à corriger ;
* minimiser un risque P0 ;
* afficher un secret ;
* modifier le système pour faire disparaître un problème ;
* déclarer un accès disponible sans l'avoir réellement vérifié en section 0.

Toujours :

* privilégier les preuves ;
* distinguer fait / hypothèse ;
* indiquer les limites de l'audit ;
* indiquer les éléments NON VÉRIFIÉS ;
* donner les chemins exacts ;
* donner des recommandations actionnables ;
* comparer avec les audits précédents ;
* distinguer risque technique et validation juridique ;
* vérifier staging avant production lorsque le test est potentiellement destructif ;
* documenter explicitement, en fin d'audit, si le périmètre a dû être réduit et pourquoi.

**L'objectif n'est pas de donner un GO.**

L'objectif est de déterminer honnêtement si les preuves disponibles justifient un **GO**, un **GO AVEC CONDITIONS** ou un **NO-GO**.

Si les preuves ne permettent pas de conclure, le dire explicitement.

---

## Comment lancer

1. Nouveau chat **Agent**.
2. Taper **`@audit`** (catégorie Rules si le picker le demande).
3. Répondre à **ACRCloud** quand l’agent pose la question.
4. Relire le verdict. P0 code → `@onscen-dev-agent`. P0 contrat/avocat → fondateur.

Ne pas attacher `@audit` à `@onscen-dev-agent` : il implémenterait au lieu d’auditer.
