# Audit GO / NO-GO pré-prod — OnScen

**Date :** 2026-08-16  
**Heure de clôture :** 13:25 CEST (re-vérification indépendante session `@audit`)  
**Agent :** `@audit` / `@onscen-cto` (analyse uniquement — aucun code, commit, push, deploy, ni mutation prod)  
**Produit :** OnScen (`onscen.com`) — web + PWA `/tel/` + Capacitor iOS/Android  
**Workspace :** `C:\Dev\Soundy`  
**Prompt applicable :** `commun/docs/audit/PROMPT-AUDIT-PRE-PROD.md` (source de vérité ; prévaut sur `ONSCEN-CTO-PROMPT.md`)

**Divergence docs :** aucune contradiction de verdict entre les deux prompts. Le prompt d’audit ajoute préflight d’accès, politique staging 0bis, et format disque — c’est ce qui a été suivi. Un brouillon du même jour mentionnait une « version étendue fondateur » : **non utilisée** ici.

**Périmètre de cette passe :** les 12 phases + QA HTTP + tests négatifs non destructifs (prod lecture seule, staging HTTP). QA navigateur interactif, dashboards Sentry/Stripe/LiveKit, et builds store réels : **NON VÉRIFIÉ** (accès absents — section 0).

---

## 1. Verdict

# 🔴 NO-GO

OnScen **tourne** en production (`https://onscen.com/health` → `OK`, PM2 online, Redis/DB/LiveKit/SMTP OK). Ce n’est **pas** une preuve de **prêt à une mise en production assumée** (inscriptions ouvertes, UGC, live, paiements, stores).

Trois P0 confirmés et **non mitigés** au sens du prompt (section 1–2) :

| ID | Pourquoi c’est un P0 |
|----|----------------------|
| **P0-01** | Backups quotidiens + offsite S3 **existent**. Aucun restore réel n’est prouvé. **RECOVERY NON DÉMONTRÉE.** STOP : perte de données possible sans restauration démontrée. |
| **P0-02** | Commit historique `72370fc8` toujours présent. Rotation des secrets concernés : **NON VÉRIFIÉE**. STOP : secret exposé dans l’historique Git. |
| **P0-03** | PhotoDNA / NCMEC **non configurés** en prod. Blocklist locale SHA-256 **vide au premier run**. Live WebRTC **sans** échantillonnage vidéo. Plateforme UGC + live + inscriptions `open`. Protection CSAM **supposée par l’architecture**, pas démontrée au niveau industrie. |

**P1 critiques** (ne suffisent pas seuls au NO-GO, mais interdisent un GO conditionnel « public ») : Stripe `sk_test` + dons/abos **désactivés** en prod ; OAuth Google/YouTube **coupés** ; WAF/CDN **absent** (origine Caddy directe) ; DNS staging **absent** (cassee le monitor uptime GitHub + e2e CI) ; checklist avocat **0 case cochée** ; IAP stores **absents**.

**Éléments NON VÉRIFIÉS critiques** (≠ OK) : dashboards Sentry (événements réels), dashboards Stripe/LiveKit/Sightengine, restore testé, rotation secrets, crash Sentry sur binaire store, QA parcours interactifs, charge.

**Un GO ou un GO AVEC CONDITIONS** exigerait au minimum : (1) restore staging réussi documenté, (2) rotation prouvée des secrets du commit historique **ou** acceptation écrite fondateur + repo resté privé, (3) décision écrite CSAM (contrat PhotoDNA **ou** restriction produit live/UGC) + exercice runbook. Rien de cela n’est démontré aujourd’hui.

**Rappel accès manquants** (section 0) : Sentry UI, consoles API externes, comptes test interactifs, TestFlight/Play internal, validation avocat. Ces absences **renforcent** le NO-GO : elles empêchent de démontrer observabilité, paiements live, et QA fonctionnelle.

---

## 0. Préflight — accès demandés vs obtenus

| Accès requis | Nécessaire pour | Disponible ? | Preuve |
| --- | --- | --- | --- |
| Repository Git (lecture) | 1, 4, 5, 8, 17 | **Oui** | `package.json` + `git log` branche `fix/dm-history-postgres-data-loss` |
| SSH `onscen-prod` lecture seule | 5, 7, 19, 23 | **Oui** | `ssh onscen-prod` → host `soundly`, `pm2 status` online |
| SSH `onscen-staging` lecture + tests HTTP | 5, 14, 15 | **Oui** | host `soundly-staging`, health `preproduction` |
| Accès Sentry (web/backend/natif) | 7 | **Non** | DSN **présent** (nom de variable). Dashboard : pas d’accès. |
| Accès Scaleway S3 (métadonnées backups) | 5 | **Partiel** | `scw` CLI + config OK. Liste objets **non** exécutée. Preuve via logs VPS `offsite-cron.log` (sync 2026-08-16 04:00 OK). |
| Dashboard PostgreSQL | 5, 6 | **Partiel** | Pas de console. `psql` via VPS : extension `postgis` + index `users_geom_gist_idx` = true. |
| GitHub Actions | 17 | **Oui** | `gh` authentifié. Runs listés. Protections de branche : **403** (repo privé sans GitHub Pro). |
| Dashboards APIs externes | 10 | **Non** | Présence de **noms** de variables seulement. |
| Comptes de test staging | 14, 15 | **Non** | Aucun compte créé (pas de navigateur interactif). |
| Build iOS/Android store réel | 13 | **Non** | Audit builds 2026-08-16 (repo) seulement. Pas de TestFlight / crash Sentry natif. |
| Documentation juridique interne | 11 | **Oui (brouillons)** | `commun/docs/juridique/` + dossier avocat. Checklist **non validée**. |

`commun/scripts/verify-full-access.ps1` : **lu puis exécuté** (session 13:20 CEST). Lecture seule. **22 / 24 OK**. Échecs : DNS `staging.onscen.com` ; `psql` local (optionnel). API msdev `:4080` **up**.

`audit-external-env.cjs` : **lu puis exécuté** sur copies locales `.env` (msdev / production / preproduction). N’imprime que OK/MISS. Aucune valeur. ACRCloud **MISS** sur les 3. PhotoDNA non listé par le script (vérifié à part via **noms** VPS → `PHOTODNA_*` absents prod).

`audit-external-env.sh` : **lu, non exécuté** — `source` le `.env` (charge les secrets dans le shell). Remplacé par le `.cjs`.

`audit-infra-access.ps1` : **lu, non exécuté**. Chemins obsolètes (`c:\Dev\OnScen\...`). Remplacé par le script cjs + SSH noms de variables.

**Re-vérification live 13:20 CEST (cette session) :** health prod `OK` / Redis+DB+LiveKit+SMTP+Stripe `ok` ; PM2 `onscen-backend` cluster **1** process (uptime 19 h) ; dump `onscen-20260816-031501.sql.gz` 2,5 Mo ; offsite S3 `OK` 04:00:50 ; PostGIS + `users_geom_gist_idx` ; `STRIPE_PREFIX=sk_test` ; dons/abos `0` ; inscriptions `open` ; Turnstile `1` ; Sightengine fail-open `0` ; `GET /api/auth/me` → 401 ; `POST /api/donations/webhook` → 400 `Signature manquante` ; `/tel/` 200 ; AASA `TEAM_ID.com.soundy.app` ; `Via: 1.1 Caddy` ; `npm audit --omit=dev` backend+web = **0**.

---

## 2. Registre P0 / P1 / P2

| ID | Priorité | Domaine | Constat | Preuve | Niveau de preuve | Risque | Recommandation | Propriétaire | Statut |
| -- | -------- | ------- | ------- | ------ | ----------------- | ------ | --------------- | ------------ | ------ |
| P0-01 | P0 | DB / DR | Restore jamais démontré. Backups quotidiens 2,5 Mo + offsite S3 OK. Script `restore-db-staging.sh` existe, jamais exécuté avec preuve. | SSH prod `/opt/onscen/backups/` (dump du 2026-08-16 03:15) ; `commun/deploy/restore-db-staging.sh` ; MODIF 1434 = script seulement | VÉRIFIÉ LIVE + REPO | Perte irréversible si corruption / mauvaise migration | Restore staging documenté (date, dump, résultat) | ops | **OUVERT** |
| P0-02 | P0 | Sécurité | Secrets historiques toujours dans Git (`72370fc8`, 2026-06-30). HEAD **propre** (fichiers gitignorés, absents de HEAD). Rotation : NON VÉRIFIÉ. | `git cat-file -t 72370fc8` → `commit` ; `git cat-file -e HEAD:…credentials.local.txt` → absent HEAD ; `AUDIT-CONSOLIDE` SEC-1 | VÉRIFIÉ REPO + DOCUMENT | Fuite si clone / ex-accès historique | Rotation **ou** acceptation écrite ; purge Git seulement avec accord fondateur | fondateur + ops | **OUVERT** |
| P0-03 | P0 | Modération / CSAM | PhotoDNA absent. Blocklist locale vide au boot. Live WebRTC non échantillonné. Runbook brouillon non exercé. | Noms env prod : pas de `PHOTODNA_*` ; `csamHashMatch.ts` ; `liveContentSampling.ts` (Cloudflare only) ; `RUNBOOK-CSAM.md` | VÉRIFIÉ LIVE + REPO | CSAM non détecté par hash ; live WebRTC aveugle | Contrat PhotoDNA **ou** restriction live/UGC + exercice PHAROS | fondateur + avocat | **OUVERT** |
| P1-01 | P1 | Paiements | Prod : `STRIPE=sk_test`, `DONATIONS_ENABLED=0`, `SUBSCRIPTIONS_ENABLED=0`. Health `stripe:ok` = clé test joignable, pas de live. | SSH flags prod 2026-08-16 | VÉRIFIÉ LIVE | Pas d’encaissement réel ; UI peut mentir | `sk_live` + webhooks live **ou** retirer toute UI paiement | fondateur | **OUVERT** |
| P1-02 | P1 | Auth | `GOOGLE_OAUTH_PROD_ENABLED` absent → OAuth Google/YouTube publics coupés (garde `deleted_client`). | Env names prod ; `productionStartup.ts` L119 | VÉRIFIÉ LIVE + REPO | Login Google / YouTube salon indisponibles | Recréer client Console + flag `=1` | fondateur | **OUVERT** |
| P1-03 | P1 | DDoS | Pas de WAF/CDN. `Via: 1.1 Caddy`, pas de `cf-ray`. DNS → VPS. | `curl.exe -sSI https://onscen.com` | VÉRIFIÉ LIVE | Surface publique inscriptions `open` | Proxy Cloudflare (fenêtre DNS) | fondateur / ops | **OUVERT** |
| P1-04 | P1 | Infra | `staging.onscen.com` ne résout pas. Staging joignable en HTTP IP. | `curl` DNS fail ; health IP 200 | VÉRIFIÉ LIVE | Uptime GH + e2e CI cassés ; staging « public » par IP | Enregistrement A + HTTPS | ops | **OUVERT** |
| P1-05 | P1 | Infra | Staging disque **82 %** (1,7 Go / 8,9 Go). Seuil alerte monitor = 80 %. | `df -h` staging | VÉRIFIÉ LIVE | Remplissage → crash staging | Nettoyage + agrandir volume | ops | **OUVERT** |
| P1-06 | P1 | CI | `master` CI rouge (lint ESLint, 5 errors). Uptime Health rouge (DNS staging). | `gh run list` + `gh run view 31937576461` | VÉRIFIÉ GH | Déploy preprod auto skip ; signal santé faux | Corriger lint ; pointer uptime vers IP ou DNS | `@onscen-dev-agent` | **OUVERT** |
| P1-07 | P1 | Modération | Lives `webrtc`/`livekit` sans frame sampling. Défaut `liveStreamMode.ts` = `webrtc`. | `liveContentSampling.ts` L10–13 ; `liveStreamMode.ts` | VÉRIFIÉ REPO | Contenu live illicite non coupé | Egress LiveKit ou interdire WebRTC public | fondateur | **OUVERT** |
| P1-08 | P1 | Musique | `ACRCLOUD_*` absents prod/staging/msdev. Scan copyright ignoré. | `audit-external-env.cjs` + noms env VPS | VÉRIFIÉ LIVE | UGC musical sans empreinte | Décision fondateur (question obligatoire) | fondateur | **OUVERT** |
| P1-09 | P1 | Mobile / stores | Pas d’IAP. AASA `TEAM_ID.com.soundy.app`. Pas d’IPA. AAB local seulement. | AASA prod 2026-08-16 ; audit `2026-08-16-builds-mobiles.md` | VÉRIFIÉ LIVE + REPO | NO-GO App Store / Play | IAP + Team ID + signing | fondateur | **OUVERT** |
| P1-10 | P1 | Légal | Checklist avocat : **aucune case cochée**. DPA art. 28 : modèles, pas de signatures. | `CHECKLIST-VALIDATION-AVOCAT.md` | VÉRIFIÉ DOC | Conformité **non prête** | RDV avocat + DPA | fondateur + avocat | **OUVERT** |
| P1-11 | P1 | Légal | Pas de cadre SACEM / labels. ACRCloud ≠ licence. | Audits 08-11 C3 ; 08-15 | VÉRIFIÉ DOC | Risque droits d’auteur | Cadre licence ou interdiction UGC musical | fondateur + avocat | **OUVERT** |
| P1-12 | P1 | Observabilité | Sentry DSN présent. Dashboard, alertes, Pager : **NON VÉRIFIÉ**. Pas d’astreinte. Email cron seulement. | Env `SENTRY_DSN` ; `monitor-alerts.sh` | VÉRIFIÉ PARTIEL | Incident 3 h : email seulement | Vérifier Sentry + canal 24/7 | fondateur / ops | **OUVERT** |
| P1-13 | P1 | CI/CD | Protections de branche **indisponibles** (403 GitHub Pro). SHA prod **inconnu** (pas de checkout git). | `gh api` 403 ; `git -C /opt/onscen` → `NO_GIT_CHECKOUT` | VÉRIFIÉ GH + LIVE | Push `master` non protégé ; rollback SHA impossible | GitHub Pro ou miroir ; marqueur VERSION au deploy | ops | **OUVERT** |
| P1-14 | P1 | Légal / produit | Live caméra dès **16 ans** (`MIN_LIVE_AGE`). | `ageGates.ts` | VÉRIFIÉ REPO | Écart vs majorité | Arbitrage 16 vs 18 | fondateur + avocat | **OUVERT** |
| P1-15 | P1 | Hygiène prod | Scripts debug / seed sur VPS prod (`seed_prod_testdata.js`, `query_prod.js`, `debug_*.js`). | `ls /opt/onscen` | VÉRIFIÉ LIVE | Surface ops / fuite si mal utilisés | Retirer du VPS prod | ops | **OUVERT** |
| P2-01 | P2 | Stack | Node local **24.18** vs CI **20** (déprécié sur runners). | `node -v` ; `ci.yml` | VÉRIFIÉ | Builds non reproductibles | Aligner engines + CI | `@onscen-dev-agent` | **OUVERT** |
| P2-02 | P2 | Runtime | `PM2_INSTANCES=2` mais **1** process cluster visible. | Env + `pm2 status` | VÉRIFIÉ LIVE | Incohérence scale | Aligner ecosystem / env | ops | **OUVERT** |
| P2-03 | P2 | Mobile | `sentryNative.ts` = `@sentry/react`, pas SDK natif. Crash store NON VÉRIFIÉ. | `ios/apptel/src/lib/sentryNative.ts` | VÉRIFIÉ REPO | Trous crash natifs | `@sentry/capacitor` + crash test | `@onscen-dev-agent` | **OUVERT** |
| P2-04 | P2 | Mobile | Bundle `com.soundy.app` ; CI artefacts noms legacy. | Audits 08-15 / 08-16 builds | VÉRIFIÉ DOC | Marque / review store | Renommer après comptes stores | fondateur | **OUVERT** |
| P2-05 | P2 | Perf | Aucun test de charge. Capacité **NON DÉMONTRÉE**. | Repo + SCALABILITY.md | VÉRIFIÉ DOC | Inconnu au-delà ~10 users | Load test staging | ops | **OUVERT** |
| P2-06 | P2 | Staging | Pas de HSTS ; `X-Frame-Options: SAMEORIGIN` (prod = DENY). | Headers IP staging | VÉRIFIÉ LIVE | Écart durcissement | Aligner Caddy staging | ops | **OUVERT** |
| P2-07 | P2 | APIs | Facebook / Instagram / OpenAI / PhotoDNA keys absents. | audit-external-env | VÉRIFIÉ | Features mortes | Retirer UI ou configurer | fondateur | **OUVERT** |

**Totaux : 3 P0 · 15 P1 · 7 P2.**

---

## 3. Delta vs audits 2026-08-11 et 2026-08-15

| Problème | Ancien statut | Statut 2026-08-16 | Preuve | Évolution |
| -------- | ------------- | ----------------- | ------ | --------- |
| C1 CSAM hash-matching | Ouvert / « mitigé » code 08-15 | PhotoDNA **absent** ; hook code présent | Env prod | **TOUJOURS OUVERT** |
| C2 Runbook CSAM | Brouillon | Brouillon, 0 exercice | `RUNBOOK-CSAM.md` | **TOUJOURS OUVERT** |
| C3 Licences musique | Ouvert | Inchangé + ACRCloud absent | Env | **TOUJOURS OUVERT** |
| C4 Secrets Git `72370fc8` | Ouvert | Commit toujours là | `git cat-file` | **TOUJOURS OUVERT** |
| C5 PM2 ×1 + store RAM | Ouvert | Redis **OK** prod ; PM2 cluster **1** process ; `PM2_INSTANCES=2` | Health + pm2 | **PARTIELLEMENT RÉSOLU** |
| C6 Live WebRTC sans modération | Ouvert | Inchangé (sampling Cloudflare only) | Code | **TOUJOURS OUVERT** |
| C7 WAF/CDN | Ouvert | Toujours origine Caddy | Headers | **TOUJOURS OUVERT** |
| C8 jspdf / npm audit | Résolu 08-11 | `npm audit` backend + web = **0** | Local 2026-08-16 | **RÉSOLU** |
| E1 OAuth Google `deleted_client` | Aggravé | Coupé volontairement (flag absent) | Env | **MITIGÉ / TOUJOURS OUVERT** (feature off) |
| E2 Mineurs geo/dons/live | Résolu 08-11 | Code `ageGates` + `enforceMinorGeoPolicy` toujours là | Repo | **RÉSOLU** (code) ; QA interactive **NON VÉRIFIÉ** |
| E3 Turnstile | Résolu | `TURNSTILE_REQUIRED=1` prod | Env | **RÉSOLU** |
| E4 DPA | Ouvert | Checklist avocat vide | Doc | **TOUJOURS OUVERT** |
| E6 Restore backup | Ouvert | Dumps + offsite OK ; restore **non** | SSH | **TOUJOURS OUVERT** |
| E7 SPOF 1 VPS / 1 PG | Ouvert | Inchangé (prod+staging même instance PG d’après doc) | `ENVIRONNEMENTS.md` | **TOUJOURS OUVERT** |
| E8 Sentry mobile | Code OK, store non | Toujours JS Sentry ; store NON VÉRIFIÉ | `sentryNative.ts` | **PARTIELLEMENT RÉSOLU** |
| E10 IAP stores | Ouvert | Stripe natif bloqué ; pas d’IAP | Code + AASA | **PARTIELLEMENT RÉSOLU** (garde) / **TOUJOURS OUVERT** (IAP) |
| E11 Sightengine fail-closed | Conforme | `SIGHTENGINE_FAIL_OPEN=0` ; code ignore fail-open hors msdev | Env + `sightengineConfig.ts` | **RÉSOLU** |
| E16 Live 16 ans | Ouvert | `MIN_LIVE_AGE = 16` | Code | **TOUJOURS OUVERT** |
| E17 Plafond inscriptions | Nouveau 08-11 ; corrigé 08-15 | Code `REGISTRATION_DAILY_CAP` défaut 200 | Repo | **RÉSOLU** (code) ; Redis prod OK |
| Stripe `sk_test` prod | Corrigé 08-15 (503) | Toujours `sk_test` + dons **off** | Flags | **MITIGÉ** (off) / **TOUJOURS OUVERT** (pas de live) |
| Redis | Cible STACK | **Présent et `ok`** prod + staging | Health | **NOUVEAU POSITIF** |
| CI `master` | Vert historiquement | **Rouge** lint + uptime | `gh` | **NOUVEAU / RÉGRESSÉ** |
| Staging DNS | Documenté à faire | Toujours KO | curl | **TOUJOURS OUVERT** |
| Staging disque | — | 82 % | `df` | **NOUVEAU** |
| Scripts debug VPS prod | — | Présents | `ls` | **NOUVEAU** |

---

## 4. Analyse par phase (résumé)

Détail : `01-stack.md` … `12-cicd-recovery.md`.

| Phase | Statut | Une ligne |
| ----- | ------ | --------- |
| Stack | OK technique / P1 CI | Versions alignées STACK-CIBLE ; audit 0 vuln ; CI rouge |
| DB | Backups OK / **P0 restore** | Dumps quotidiens + S3 ; restore non prouvé ; PG partagée prod/staging (doc) |
| PostGIS | OK prod | Extension + index GiST **vérifiés** `psql` prod |
| Observabilité | Partiel | Health/PM2/Sentry DSN OK ; dashboard + astreinte NON VÉRIFIÉ |
| Sécurité | P0 secrets + bases saines | Headers, webhooks, authz HTTP OK ; historique Git P0 |
| APIs | Partiel | Clés présentes sauf ACRCloud/PhotoDNA/Facebook ; quotas dashboards NON VÉRIFIÉ |
| Légal | **Non prêt** | Docs internes oui ; avocat 0 ; DPA 0 |
| YouTube | Mitigé off | OAuth coupé ; embed IFrame ; pas de download serveur (audits antérieurs) |
| Mobile | NO-GO stores | PWA 200 ; iOS/Android non soumissibles |
| QA | Partiel HTTP | Pages 200 ; parcours interactifs NON TESTÉS |
| Perf | NON DÉMONTRÉE | Pas de load test |
| CI/CD / DR | P0 + P1 | CI rouge ; pas de SHA prod ; RPO doc 24 h / RTO théorique |

---

## 5. Ce qui manque encore

**Accès manquants** (section 0) : Sentry UI, consoles Stripe/LiveKit/Sightengine/ACRCloud, comptes test, TestFlight, avocat.

**Tests manquants :** QA interactive web/tel/binaire ; IDOR authentifié user A→B ; restore ; tabletop CSAM ; charge ; crash Sentry natif.

**Preuves manquantes :** rotation secrets `72370fc8` ; SHA déployé ; alertes Sentry réellement reçues ; DPA signés.

**Décisions business :** ACRCloud ; IAP ; live 16 vs 18 ; WAF DNS ; PhotoDNA contrat ; ouverture publique vs cercle fermé.

**Ops :** restore drill ; DNS staging ; disque staging ; retirer scripts debug prod ; astreinte.

**Avocat :** checklist entière ; CSAM/PHAROS/NCMEC ; SACEM ; DSA ; mentions.

**Hors scope cette passe :** exploit destructif ; dump secrets ; modification infra.

---

## 6. Recommandations avant mise en production

| Action | Priorité | Propriétaire | Dépendance | Preuve attendue |
| ------ | -------- | ------------ | ---------- | --------------- |
| Restore dump → `onscen_staging` + PV | P0 | ops | Fenêtre staging | Date, dump, `psql` OK, app staging up |
| Inventaire + rotation secrets commit `72370fc8` | P0 | fondateur + ops | Accord purge | Liste rotée (sans valeurs) |
| Décider PhotoDNA **ou** geler live/UGC public | P0 | fondateur + avocat | Budget contrat | Clé présente **ou** feature flag off |
| `sk_live` + dons **ou** UI paiement retirée | P1 | fondateur | Compte Stripe live | Health + intent test live |
| Recréer OAuth Google | P1 | fondateur | Console Google | Login staging puis `GOOGLE_OAUTH_PROD_ENABLED=1` |
| A `staging.onscen.com` + libérer disque staging | P1 | ops | OVH | Uptime GH vert |
| Corriger lint CI `master` | P1 | `@onscen-dev-agent` | — | Run CI vert |
| Bascule DNS Cloudflare WAF | P1 | fondateur | Fenêtre | `cf-ray` sur `onscen.com` |
| RDV avocat + DPA | P1 | fondateur + avocat | Dossier PDF | Checklist datée |
| Décision ACRCloud | P1 | fondateur | — | Réponse écrite à la question §8 |
| IAP / Team ID avant stores | P1 | fondateur | Comptes Apple/Play | AASA sans `TEAM_ID` placeholder |
| Retirer scripts debug VPS prod | P1 | ops | — | `ls /opt/onscen` propre |

---

## 7. Handoff `@onscen-dev-agent`

Tickets P0 uniquement (ne pas coder dans cet audit) :

- [`tickets/01-restore-drill.md`](./tickets/01-restore-drill.md) — P0-01
- [`tickets/02-git-secrets-rotation.md`](./tickets/02-git-secrets-rotation.md) — P0-02
- [`tickets/03-csam-photodna.md`](./tickets/03-csam-photodna.md) — P0-03

Le Dev n’implémente **que** le P0, et seulement la partie **code/runbook** (le contrat PhotoDNA, la purge Git et l’exercice restore restent fondateur/ops).

---

## 8. Arbitrages obligatoires

| Sujet | État constaté | Décision requise |
| ----- | ------------- | ---------------- |
| **ACRCloud** | Clés **absentes** prod / staging / msdev. Audit 08-15 CTO : absence **documentée** comme décision fondateur — à **reconfirmer** (cette question est obligatoire). | Présentes en prod **ou** absence volontaire ? |
| **IAP** | Stripe web bloqué natif ; pas de StoreKit/Play | Stores maintenant (IAP) **ou** PWA only ? |
| **Live 16 ans** | `MIN_LIVE_AGE = 16` | 16 **ou** 18 ? |
| **WAF** | DNS direct VPS | Bascule Cloudflare **quand** ? |
| **DNS staging** | A manquant | Créer A → `51.159.170.181` ? |
| **PhotoDNA** | Non contracté | Contrat **ou** restriction produit ? |
| **Paiements prod** | `sk_test` + flags 0 | Live Stripe **ou** rester off ? |
| **GO public** | Inscriptions `open` | Rester cercle fermé jusqu’aux P0 ? |

---

> **Question ACRCloud : les variables `ACRCLOUD_ACCESS_KEY` et `ACRCLOUD_ACCESS_SECRET` doivent-elles être présentes en production, ou leur absence est-elle volontaire ?**

---

*Fin synthèse — 2026-08-16. Lisible seule. Phases : `01`–`12` + `tickets/`.*
