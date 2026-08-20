# Audit GO / NO-GO pré-prod — OnScen

**Date :** 2026-08-20  
**Heure de clôture :** ~11:35 CEST  
**Agent :** `@audit` / `@onscen-cto` (analyse uniquement — aucun code, commit, push, deploy, ni mutation prod)  
**Produit :** OnScen (`onscen.com`) — web + PWA `/tel/` + Capacitor iOS/Android  
**Workspace :** `C:\Dev\Soundy`  
**Prompt applicable :** `commun/docs/audit/PROMPT-AUDIT-PRE-PROD.md` (source de vérité ; prévaut sur `ONSCEN-CTO-PROMPT.md`)

**Divergence docs :** aucune contradiction de verdict. Le prompt d’audit ajoute préflight, politique staging 0bis, et format disque — suivi ici.

**Périmètre de cette passe :** préflight accès, re-vérification des P0/P1 du 2026-08-16, preuves LIVE (SSH lecture seule, HTTP public), repo, CI GitHub, `npm audit`. QA navigateur interactive, dashboards Sentry/Stripe/LiveKit/Sightengine/ACRCloud, builds store, charge, PostGIS `psql` cette session : **NON VÉRIFIÉ** ou hors quoting SSH (voir §0 et §5).

---

## 1. Verdict

# 🔴 NO-GO

OnScen **tourne** en production (`https://onscen.com/health` → `OK`, `stripeMode: live`, `release: bce8ec5d…`, Redis/DB/LiveKit/SMTP OK, PM2 online). Ce n’est **pas** une preuve de **prêt à une mise en production assumée** (inscriptions `open`, UGC, live, stores, avocat).

Deux P0 **confirmés et non mitigés** au sens des sections 1–2 du prompt :

| ID | Pourquoi c’est un P0 |
|----|----------------------|
| **P0-02** | Commit historique `72370fc8` toujours présent. Rotation des secrets concernés : **NON VÉRIFIÉE**. STOP : secret exposé dans l’historique Git. |
| **P0-03** | PhotoDNA **absent** en prod (`PHOTODNA_SUBSCRIPTION_KEY` count=0). `PHOTODNA_REQUIRED` **non défini** → les uploads ne sont **pas** refusés. Blocklist locale absente sur le VPS. Hash-matching industrie **non démontré**. |

**P0-01 (restore) : FERMÉ** — exercice staging documenté le 2026-08-16 (`restore-drill.md`). Dumps quotidiens toujours présents (dernier `onscen-20260820-031501.sql.gz`). Residual → **P1-16** (pas de drill depuis, pas de cadence).

**P1 critiques** (interdisent un GO « public » même sans P0) : dons/abos **off** malgré `sk_live` ; OAuth Google flag absent ; WAF/CDN absent ; DNS staging absent ; checklist avocat **0 case** ; IAP / AASA non configurés ; CI `master` **rouge** (lint) ; pas d’astreinte démontrée.

**NON VÉRIFIÉS critiques** (≠ OK) : dashboard Sentry, dashboards API, rotation secrets, crash Sentry sur binaire store, QA parcours interactifs, charge, PostGIS cette session.

Un **GO AVEC CONDITIONS** exigerait au minimum : (1) rotation prouvée des secrets `72370fc8` **ou** acceptation écrite fondateur, (2) décision écrite CSAM (contrat PhotoDNA **ou** `PHOTODNA_REQUIRED=1` + restriction UGC/live) + exercice runbook. Rien de cela n’est démontré aujourd’hui.

**Accès manquants** (§0) : Sentry UI, consoles API, comptes test interactifs, TestFlight/Play, validation avocat. Ces absences **renforcent** le NO-GO.

---

## 0. Préflight — accès demandés vs obtenus

| Accès requis | Nécessaire pour | Disponible ? | Preuve |
| --- | --- | --- | --- |
| Repository Git (lecture) | 1, 4, 5, 8, 17 | **Oui** | `package.json` ; `git log` HEAD `bce8ec5d` branche `fix/dm-history-postgres-data-loss` |
| SSH `onscen-prod` lecture seule | 5, 7, 19, 23 | **Oui** | host `soundly` ; `pm2 status` online ; health local 200 |
| SSH `onscen-staging` lecture + tests HTTP | 5, 14, 15 | **Oui** | host `soundly-staging` ; health `preproduction` |
| Accès Sentry (web/backend/natif) | 7 | **Non** | Nom `SENTRY_DSN` **PRESENT** prod. Dashboard : pas d’accès. |
| Accès Scaleway S3 (métadonnées backups) | 5 | **Partiel** | `scw` CLI OK. Liste objets **non** exécutée. Preuve VPS : dumps locaux + log offsite `2026-08-20 04:00:27 OK`. |
| Dashboard PostgreSQL | 5, 6 | **Non cette passe** | `psql` local absent. Requête SSH PostGIS **échouée** (quoting PowerShell). 08-16 : PostGIS + GiST **LIVE**. |
| GitHub Actions | 17 | **Oui** | `gh` authentifié. Uptime Health **vert**. CI `master` **rouge**. Protections de branche : non re-testées (403 historique). |
| Dashboards APIs externes | 10 | **Non** | Présence de **noms** de variables seulement. |
| Comptes de test staging | 14, 15 | **Non** | Aucun compte créé (politique 0bis : pas de QA interactive cette passe). |
| Build iOS/Android store réel | 13 | **Non** | AASA prod → erreur `APPLE_TEAM_ID manquant`. Pas de TestFlight. |
| Documentation juridique interne | 11 | **Oui (brouillons)** | `CHECKLIST-VALIDATION-AVOCAT.md` : **aucune case cochée**. |

**Scripts (lus avant exécution) :**

| Script | Lu | Exécuté ? | Motif |
| ------ | -- | --------- | ----- |
| `commun/scripts/verify-full-access.ps1` | Oui | **Oui** | Lecture seule. **21 / 24 OK**. Échecs : API msdev `:4080` down ; DNS `staging.onscen.com` ; `psql` local (optionnel). |
| `commun/scripts/audit-external-env.cjs` | Oui | **Oui** (copies **locales** seulement) | Imprime OK/MISS, **aucune valeur**. |
| `commun/scripts/audit-external-env.sh` | Oui | **Non** | `source` le `.env` (charge les secrets dans le shell). |
| `commun/scripts/audit-infra-access.ps1` | Oui | **Non** | Chemins obsolètes `c:\Dev\OnScen\...`. |

**0bis staging :** aucune donnée de test créée. QA = HTTP public / IP seulement.

**Live 11:32 CEST :** health prod `OK` / `stripeMode: live` / `release: bce8ec5d` ; PM2 cluster **1** process (uptime ~8 min post-deploy logo) ; dump `onscen-20260820-031501.sql.gz` ~2,5 Mo ; offsite S3 OK 04:00 ; `DONATIONS_ENABLED=0` `SUBSCRIPTIONS_ENABLED=0` ; inscriptions `open` ; Turnstile `1` ; Sightengine fail-open `0` ; ACRCloud keys **PRESENT** prod (noms) ; PhotoDNA **ABSENT** ; `GET /api/auth/me` → 401 ; `POST /api/donations/webhook` → `Signature manquante` ; `/tel/` 200 ; `Via: 1.1 Caddy` ; `npm audit --omit=dev` backend + web = **0**.

---

## 2. Registre P0 / P1 / P2

| ID | Priorité | Domaine | Constat | Preuve | Niveau de preuve | Risque | Recommandation | Propriétaire | Statut |
| -- | -------- | ------- | ------- | ------ | ----------------- | ------ | --------------- | ------------ | ------ |
| P0-01 | P0 | DB / DR | Restore staging réussi le 2026-08-16. Dumps quotidiens + offsite OK au 2026-08-20. | `restore-drill.md` ; `ls -lt /opt/onscen/backups/` dump du 20/08 | VÉRIFIÉ DOC + LIVE | Perte si pas de drill périodique | Cadence trimestrielle | ops | **FERMÉ** (→ P1-16) |
| P0-02 | P0 | Sécurité | Secrets historiques toujours dans Git (`72370fc8`). HEAD propre. Rotation NON VÉRIFIÉE. | `git cat-file -t 72370fc8` → `commit` ; `git diff-tree` noms de fichiers | VÉRIFIÉ REPO | Fuite si clone / ex-accès | Rotation **ou** acceptation écrite | fondateur + ops | **OUVERT** |
| P0-03 | P0 | Modération / CSAM | PhotoDNA absent. `PHOTODNA_REQUIRED` non posé. Blocklist fichier absent VPS. Sightengine ≠ hash NCMEC. | grep count `PHOTODNA_SUBSCRIPTION_KEY`=0 ; `csamHashMatch.ts` | VÉRIFIÉ LIVE + REPO | CSAM non détecté par hash | Contrat PhotoDNA **ou** `PHOTODNA_REQUIRED=1` + geler UGC | fondateur + avocat | **OUVERT** |
| P1-01 | P1 | Paiements | Prod : `STRIPE_PREFIX=sk_live` (changement vs 08-16 `sk_test`) mais dons/abos **0**. Health `stripeMode: live` = clé live joignable, pas d’encaissement. | SSH flags + health public | VÉRIFIÉ LIVE | UI peut laisser croire à un paiement réel | Activer webhooks live **ou** retirer toute UI paiement | fondateur | **OUVERT** (mitigé clés) |
| P1-02 | P1 | Auth | `GOOGLE_OAUTH_PROD_ENABLED` **absent** du `.env` prod (grep sans ligne). | SSH grep | VÉRIFIÉ LIVE | Login Google / YouTube salon off | Recréer client + flag `=1` | fondateur | **OUVERT** |
| P1-03 | P1 | DDoS | Pas de WAF/CDN. `Via: 1.1 Caddy`, pas de `cf-ray`. | `curl -sSI https://onscen.com/` | VÉRIFIÉ LIVE | Surface inscriptions `open` | Proxy Cloudflare | fondateur / ops | **OUVERT** |
| P1-04 | P1 | Infra | `staging.onscen.com` ne résout pas. Staging OK en HTTP IP. | curl DNS fail ; IP 200 | VÉRIFIÉ LIVE | e2e DNS ; staging « public » par IP | Enregistrement A + HTTPS | ops | **OUVERT** |
| P1-05 | P1 | Infra | Staging disque **79 %** (1,9 Go / 8,9 Go). Était 82 % le 16/08. Sous le seuil 80 % mais étroit. | `df -h` staging | VÉRIFIÉ LIVE | Remplissage | Nettoyage + volume | ops | **OUVERT** (amélioré) |
| P1-06 | P1 | CI | `master` CI **rouge** (5 erreurs ESLint, run `31955895763` du 16/08). Uptime Health **vert** (fallback IP). | `gh run list` + `gh run view` | VÉRIFIÉ GH | Signal CI faux ; deploy auto skip | Corriger lint | `@onscen-dev-agent` | **OUVERT** (uptime RÉSOLU) |
| P1-07 | P1 | Modération live | WebRTC public refusé en prod si `ALLOW_UNSAMPLED_LIVE` absent (défaut). LiveKit → egress CF + sampling Sightengine. **Non testé en live réel.** | `liveSamplingPolicy.ts` ; `lives.ts` `startLiveKitSamplingRelay` ; flag absent prod | VÉRIFIÉ REPO + LIVE (flag) | Trou si flag posé ou egress KO | Test staging d’un live + frame sample | fondateur / ops | **PARTIELLEMENT RÉSOLU** |
| P1-08 | P1 | Musique | `ACRCLOUD_ACCESS_KEY` / `_SECRET` **PRESENT** prod (noms). `ACRCLOUD_ENABLED` absent → défaut code **true**. Scan **non testé** (dashboard / upload). Staging : clés **ABSENT**. | grep -c prod=1 ; staging=0 ; `acrCloudConfig.ts` | VÉRIFIÉ LIVE + REPO | Staging sans empreinte ; prod **INFÉRÉ** actif | Confirmer intention fondateur (question §8) + test upload | fondateur | **PARTIELLEMENT RÉSOLU** |
| P1-09 | P1 | Mobile / stores | AASA : `Universal Links non configurés (APPLE_TEAM_ID manquant)`. Pas d’IAP. | curl AASA 2026-08-20 | VÉRIFIÉ LIVE | NO-GO App Store | Team ID + IAP | fondateur | **OUVERT** |
| P1-10 | P1 | Légal | Checklist avocat : **aucune case cochée**. | `CHECKLIST-VALIDATION-AVOCAT.md` | VÉRIFIÉ DOC | Conformité **non prête** | RDV avocat + DPA | fondateur + avocat | **OUVERT** |
| P1-11 | P1 | Légal | Pas de cadre SACEM / labels. ACRCloud ≠ licence. | Audits 08-11 C3 ; 08-15 | VÉRIFIÉ DOC | Droits d’auteur | Cadre licence ou interdiction UGC musical | fondateur + avocat | **OUVERT** |
| P1-12 | P1 | Observabilité | Sentry DSN présent. Dashboard, alertes 24/7, Pager : **NON VÉRIFIÉ**. | `SENTRY_DSN=PRESENT` | VÉRIFIÉ PARTIEL | Incident 3 h : email cron seulement | Vérifier Sentry + canal | fondateur / ops | **OUVERT** |
| P1-13 | P1 | CI/CD | SHA prod **maintenant connu** (`release` health = `bce8ec5d`). Branche déployée ≠ `master` (`fix/dm-history-postgres-data-loss`). Protections de branche : NON VÉRIFIÉ cette passe. | health `release` ; `git log` | VÉRIFIÉ LIVE + REPO | Prod hors CI verte `master` | Déployer depuis `master` vert **ou** documenter la branche | ops | **PARTIELLEMENT RÉSOLU** |
| P1-14 | P1 | Légal / produit | Live caméra dès **16 ans**. | `ageGates.ts` `MIN_LIVE_AGE = 16` | VÉRIFIÉ REPO | Écart vs majorité | Arbitrage 16 vs 18 | fondateur + avocat | **OUVERT** |
| P1-15 | P1 | Hygiène prod | Scripts debug toujours sur VPS : `query_prod.js`, `seed_prod_testdata.js`, 3 `debug_*.js`. | `ls /opt/onscen` | VÉRIFIÉ LIVE | Surface ops | Retirer du VPS prod | ops | **OUVERT** |
| P1-16 | P1 | DR | Restore démontré une fois (16/08). Pas de drill depuis. RPO/RTO toujours **NON DÉFINIS** formellement. | PV 08-16 ; dumps 17–20/08 sans restore | VÉRIFIÉ DOC | Dérive procédure | Cadence + RPO/RTO écrits | ops | **NOUVEAU** (ex-P0-01) |
| P2-01 | P2 | Stack | Node local 24 vs CI Node 20 déprécié (warning GH). `engines`: `>=20 <25`. | `package.json` ; log CI | VÉRIFIÉ | Builds non reproductibles | Aligner CI sur 22/24 | `@onscen-dev-agent` | **OUVERT** |
| P2-02 | P2 | Runtime | `PM2_INSTANCES=2` mais **1** process cluster. | env + `pm2 status` | VÉRIFIÉ LIVE | Incohérence scale | Aligner ecosystem | ops | **OUVERT** |
| P2-03 | P2 | Mobile | `sentryNative.ts` = SDK JS. Crash store NON VÉRIFIÉ. | repo 08-16 | VÉRIFIÉ REPO (non re-lu ligne à ligne cette passe) | Trous crash natifs | `@sentry/capacitor` | `@onscen-dev-agent` | **OUVERT** |
| P2-04 | P2 | Mobile | Bundle `com.soundy.app` historique. | audits 08-15 | VÉRIFIÉ DOC | Marque store | Renommer après comptes | fondateur | **OUVERT** |
| P2-05 | P2 | Perf | Aucun test de charge. Capacité **NON DÉMONTRÉE**. | repo | VÉRIFIÉ DOC | Inconnu au scale | Load test staging | ops | **OUVERT** |
| P2-06 | P2 | Staging | Headers staging NON VÉRIFIÉS cette passe (IP health only). 08-16 : pas HSTS. | 08-16 | NON VÉRIFIÉ 08-20 | Écart durcissement | Aligner Caddy | ops | **NON VÉRIFIÉ** |
| P2-07 | P2 | APIs | Facebook / Instagram / OpenAI / PhotoDNA absents (local + prod PhotoDNA). | audit-external-env.cjs | VÉRIFIÉ | Features mortes | Retirer UI ou configurer | fondateur | **OUVERT** |
| P2-08 | P2 | Staging | Staging : `DONATIONS_ENABLED=1` mais ACRCloud keys **ABSENT**. | SSH staging | VÉRIFIÉ LIVE | Paiement test sans empreinte audio | Aligner flags / clés | ops | **NOUVEAU** |

**Totaux ouverts : 2 P0 · 16 P1 · 8 P2.** (P0-01 fermé.)

---

## 3. Delta vs audits 2026-08-11, 2026-08-15 et 2026-08-16

| Problème | 08-16 | Statut 2026-08-20 | Preuve | Évolution |
| -------- | ----- | ----------------- | ------ | --------- |
| C1 / P0-03 PhotoDNA | Ouvert | Clé toujours absente ; `PHOTODNA_REQUIRED` non posé | grep prod | **TOUJOURS OUVERT** |
| C2 Runbook CSAM | Brouillon | Non re-exercé | doc | **TOUJOURS OUVERT** |
| C3 Licences musique | Ouvert | ACRCloud keys **présentes prod** (noms) ; licence SACEM inchangée | grep -c ; doc | **PARTIELLEMENT RÉSOLU** (outil) / **TOUJOURS OUVERT** (licence) |
| C4 / P0-02 Secrets Git | Ouvert | `72370fc8` toujours là | `git cat-file` | **TOUJOURS OUVERT** |
| E6 / P0-01 Restore | Ouvert le matin 16/08 ; drill 13:38 | PV + dumps 17–20/08 | `restore-drill.md` | **RÉSOLU** (P0) |
| C6 / P1-07 Live sans sample | Ouvert | Relais LiveKit + interdiction WebRTC unsampled en deployed | `lives.ts` ; flag absent | **PARTIELLEMENT RÉSOLU** (code ; test live NON VÉRIFIÉ) |
| C7 WAF/CDN | Ouvert | Toujours Caddy origine | headers | **TOUJOURS OUVERT** |
| C8 npm audit | 0 | backend + web **0** | `npm audit --omit=dev` | **RÉSOLU** (maintenu) |
| Stripe `sk_test` | Ouvert | **`sk_live`** + dons **off** | STRIPE_PREFIX + flags | **PARTIELLEMENT RÉSOLU** |
| ACRCloud absent | P1-08 | Prod PRESENT ; staging ABSENT | grep -c | **PARTIELLEMENT RÉSOLU** |
| Redis | OK | Health `redis:ok` prod + staging | health | **MAINTENU** |
| CI `master` | Rouge lint + uptime | Lint **toujours rouge** ; Uptime **vert** | `gh` | **PARTIELLEMENT RÉSOLU** |
| Staging DNS | KO | Toujours KO | curl | **TOUJOURS OUVERT** |
| Staging disque | 82 % | **79 %** | `df` | **AMÉLIORÉ** |
| SHA prod inconnu | P1-13 | Health `release: bce8ec5d` | health | **RÉSOLU** (marqueur) |
| AASA placeholder | `TEAM_ID.com.soundy.app` | Erreur explicite Team ID manquant | curl | **CHANGÉ** (toujours bloquant stores) |
| Scripts debug VPS | Présents | Toujours présents | `ls` | **TOUJOURS OUVERT** |
| E16 Live 16 ans | Ouvert | `MIN_LIVE_AGE = 16` | repo | **TOUJOURS OUVERT** |
| E4 DPA / avocat | 0 case | 0 case | checklist | **TOUJOURS OUVERT** |

---

## 4. Analyse par phase

| Phase | Statut | Constat | Preuve | Niveau | Risque | Reco |
| ----- | ------ | ------- | ------ | ------ | ------ | ---- |
| Stack | OK technique / P1 CI | React 19.2, Vite 8, Express 4.19, Capacitor 8.4. Aligné STACK-CIBLE (garder Express). `npm audit` 0. CI lint rouge. | package.json ; npm audit ; gh | VÉRIFIÉ REPO + GH | CI non verte | Corriger ESLint |
| DB | Backups OK / restore démontré une fois | Dumps 16–20/08 ~2,5 Mo ; offsite 20/08 04:00. Drill 16/08. PG prod+staging **même instance** (doc 08-16, non re-prouvé). | SSH ls ; restore-drill.md | VÉRIFIÉ LIVE + DOC | SPOF PG | Isoler staging ; cadence restore |
| PostGIS | NON VÉRIFIÉ 08-20 | 08-16 : extension + GiST OK. Cette passe : `psql` SSH KO quoting. | 08-16 | NON VÉRIFIÉ (cette passe) | Index manquant = perf geo | Rejouer `psql` |
| Observabilité | Partiel | Health/PM2/Sentry DSN/SHA release OK. Dashboard + astreinte NON VÉRIFIÉ. **Qui à 3 h :** email cron monitor seulement — **NON VÉRIFIÉ** destinataire réel. | health ; env name | VÉRIFIÉ PARTIEL | Incident silencieux | Vérifier Sentry + on-call |
| Sécurité | P0 Git + bases HTTP saines | Headers HSTS/DENY/nosniff ; webhook 400 sans sig ; auth 401. Inscriptions `open`. Turnstile on. Historique Git P0. | curl ; SSH flags | VÉRIFIÉ LIVE | Secrets historiques | Rotation |
| APIs | Partiel | LiveKit/Stripe/SMTP/Redis OK health. ACRCloud noms prod OK. PhotoDNA/Facebook MISS. Quotas dashboards NON VÉRIFIÉ. | health ; audit-external-env ; grep | VÉRIFIÉ PARTIEL | Dépendance aveugle | Dashboards + DPA |
| Légal | **Non prêt** | Docs internes oui ; avocat 0 ; DPA 0. **Pas « l’app est légale ».** | checklist | VÉRIFIÉ DOC | Campagne / stores | Avocat |
| YouTube | Mitigé off | OAuth flag absent. Embed IFrame (audits antérieurs). | grep flag | VÉRIFIÉ LIVE (flag) | Suspension si réactivation sans consent | Recréer client proprement |
| Mobile | NO-GO stores | PWA `/tel/` 200. AASA KO. IAP absents. Sentry natif NON VÉRIFIÉ store. | curl | VÉRIFIÉ LIVE | Review reject | Team ID + IAP |
| QA | HTTP seulement | Pages 200, auth 401, webhook signé. Parcours interactifs **NON TESTÉS**. 0 donnée staging créée. | curl | VÉRIFIÉ HTTP | Bugs UX | QA staging comptes `audit-…` |
| Perf | NON DÉMONTRÉE | Pas de load test. | SCALABILITY.md | VÉRIFIÉ DOC | Inconnu | Load staging |
| CI/CD / DR | P0 Git + CI rouge | Deploy zero-downtime existe. SHA dans health. Branche ≠ master. Restore démontré 1×. RPO/RTO **NON DÉFINIS**. | health ; gh ; PV | VÉRIFIÉ | Rollback master vs branche | Politique branche prod |

---

## 5. Ce qui manque encore

**Accès manquants :** Sentry UI, consoles Stripe/LiveKit/Sightengine/ACRCloud, comptes test, TestFlight, avocat.

**Tests manquants :** QA interactive web/tel/binaire ; IDOR authentifié A→B ; tabletop CSAM ; charge ; crash Sentry natif ; live sampling bout-en-bout ; PostGIS `psql` 08-20.

**Preuves manquantes :** rotation `72370fc8` ; alertes Sentry réellement reçues ; DPA signés ; `PHOTODNA_REQUIRED` ou clé.

**Décisions business :** ACRCloud (présent prod — volontaire ?) ; IAP ; live 16 vs 18 ; WAF DNS ; PhotoDNA contrat ; ouverture publique vs cercle fermé.

**Ops :** cadence restore ; DNS staging ; disque staging ; retirer scripts debug prod ; astreinte ; aligner `PM2_INSTANCES`.

**Avocat :** checklist entière ; CSAM/PHAROS/NCMEC ; SACEM ; DSA ; mentions.

**Hors scope :** exploit destructif ; dump secrets ; modification infra ; QA interactive.

---

## 6. Recommandations avant mise en production

| Action | Priorité | Propriétaire | Dépendance | Preuve attendue |
| ------ | -------- | ------------ | ---------- | --------------- |
| Inventaire + rotation secrets `72370fc8` | P0 | fondateur + ops | Accord purge | Liste rotée (sans valeurs) |
| PhotoDNA **ou** `PHOTODNA_REQUIRED=1` + geler live/UGC | P0 | fondateur + avocat | Budget / produit | Clé présente **ou** uploads refusés |
| Cadence restore staging | P1 | ops | Fenêtre | Prochain PV daté |
| UI paiement retirée **ou** dons live testés | P1 | fondateur | Stripe live déjà en place | Intent test **ou** UI absente |
| Recréer OAuth Google | P1 | fondateur | Console | Flag `=1` staging puis prod |
| A `staging.onscen.com` | P1 | ops | OVH | DNS + HTTPS |
| Corriger lint CI `master` | P1 | `@onscen-dev-agent` | — | Run CI vert |
| Bascule DNS Cloudflare WAF | P1 | fondateur | Fenêtre | `cf-ray` |
| RDV avocat + DPA | P1 | fondateur + avocat | Dossier | Checklist datée |
| Confirmer ACRCloud prod + copier staging | P1 | fondateur | — | Réponse §8 + grep staging PRESENT |
| IAP / Team ID avant stores | P1 | fondateur | Apple/Play | AASA sans erreur |
| Retirer scripts debug VPS prod | P1 | ops | — | `ls` propre |

---

## 7. Handoff `@onscen-dev-agent`

Tickets **P0 uniquement** (ne pas coder dans cet audit) :

- [`tickets/02-git-secrets-rotation.md`](./tickets/02-git-secrets-rotation.md) — P0-02  
- [`tickets/03-csam-photodna.md`](./tickets/03-csam-photodna.md) — P0-03  

P0-01 restore : **pas de ticket Dev** — fermé (ops : cadence = P1-16).

Le Dev n’implémente **que** la partie code/runbook. Contrat PhotoDNA, purge Git, acceptation du risque : **fondateur**.

---

## 8. Arbitrages obligatoires

| Sujet | État 2026-08-20 | Qui tranche |
| ----- | --------------- | ----------- |
| **ACRCloud** | Clés **présentes** en prod (noms) et dans `.env.production` local. Staging **absent**. Défaut code `ACRCLOUD_ENABLED=true`. Scan fonctionnel : **NON VÉRIFIÉ**. | fondateur |
| **IAP** | Absents. AASA KO. | fondateur |
| **Live 16 ans** | `MIN_LIVE_AGE = 16` inchangé. | fondateur + avocat |
| **WAF** | Toujours origine Caddy. | fondateur / ops |
| **DNS staging** | Toujours absent. | ops |
| **PhotoDNA** | Toujours absent ; fail-closed **non activé**. | fondateur + avocat |
| **Paiements** | `sk_live` mais flags 0. | fondateur |
| **Branche prod** | SHA `bce8ec5d` sur `fix/dm-history-postgres-data-loss`, pas `master`. | ops |

---

> **Question ACRCloud : les variables `ACRCLOUD_ACCESS_KEY` et `ACRCLOUD_ACCESS_SECRET` doivent-elles être présentes en production, ou leur absence est-elle volontaire ?**

**Constat technique (sans valeurs) :** en production VPS, les **noms** de ces deux variables sont **PRESENT** (grep count=1). En staging VPS, elles sont **ABSENT**. Cette passe ne peut pas dire si le scan copyright s’exécute réellement (pas de dashboard, pas d’upload test).
