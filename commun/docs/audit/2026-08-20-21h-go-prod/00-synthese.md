# Audit GO / NO-GO pré-prod — OnScen (passe 21h)

**Date :** 2026-08-20  
**Heure de clôture :** ~21:10 CEST  
**Agent :** `@audit` / `@onscen-cto` (analyse uniquement — aucun code produit, commit, push, deploy, ni mutation / redémarrage prod **pendant cette passe**)  
**Produit :** OnScen (`onscen.com`) — web + PWA `/tel/` + Capacitor iOS/Android  
**Workspace :** `C:\Dev\Soundy` (working tree sale) ; historique GitHub lu via `C:\Dev\OnScen-golive` + `origin/master`  
**Prompt applicable :** `commun/docs/audit/PROMPT-AUDIT-PRE-PROD.md` (source de vérité ; prévaut sur `ONSCEN-CTO-PROMPT.md`)

**Divergence docs :** aucune contradiction de règles de verdict. Suivi du prompt d’audit.

**Périmètre :** re-vérification après la passe 18h (`2026-08-20-18h-go-prod/`) et le travail ops/Dev de soirée (OAuth Google, WAF Free, copie Resend, force-push `origin/master`, âge live 18 **non déployé**). Preuves LIVE (SSH lecture seule, HTTP public), repo, CI GitHub, `npm audit`. QA navigateur interactive, dashboards Sentry/Stripe/LiveKit/Sightengine/ACRCloud, builds store, charge, `psql`, rappel API Resend : **NON VÉRIFIÉ** cette passe. **0bis :** aucune donnée de test créée sur staging.

**Périmètre réduit (dit explicitement) :** les annexes `01-stack.md` … `12-cicd-recovery.md` ne sont pas recréées ; `00-synthese.md` reprend le format 18h. Relecture **ciblée** de `STACK-CIBLE.md` + `audit/README.md` + checklist avocat + tickets 18h. Lectures juridiques 08-11 / 08-15 : **delta vs 18h**, pas une re-preuve ligne à ligne.

---

## 1. Verdict

# 🔴 NO-GO

Tu **n’as pas le GO live**. OnScen **tourne**, ce n’est pas un lancement assumé.

Health public `https://onscen.com/health` → `OK`, `env: production`, `stripeMode: live`, `release: ba60bdb13e8a653e5d8997db8d57e556177043e0`, Redis/DB/LiveKit/SMTP OK, PM2 `onscen-backend` **online** (1 process, uptime ~11 min au moment du snapshot — process recréé plus tôt dans la soirée pour OAuth, **pas** par cette passe). `/tel/` → 200. Staging `preproduction` OK. CI `master` verte sur `b674da65`. Dump du jour `onscen-20260820-031501.sql.gz` présent.

**P0 STOP encore confirmé et non mitigé en production :**

| ID | Pourquoi c’est encore un P0 |
|----|----------------------------|
| **P0-03** | `PHOTODNA_REQUIRED=1` **LIVE** ; clé PhotoDNA **MISS**. Uploads fail-closed. Lives caméra **toujours possibles** : `PHOTODNA_UNAVAILABLE` **absent** du JS déployé (`/opt/onscen/dist`, hits = 0). `MIN_LIVE_AGE` **16** dans le JS prod. Pas de décision écrite A (contrat PhotoDNA) / B (assume + gel déployé). **CONSTAT TECHNIQUE** — **À VALIDER AVOCAT**. |

**P0-02 (secrets Git joignables depuis `origin/master`) : FERMÉ pour l’historique GitHub actuel.** `72370fc8` n’est **pas** ancêtre de `origin/master` (`b674da65`, `merge-base --is-ancestor` exit 1). Residual : objet encore présent dans le store Git **local** ; cache blobs GitHub **NON VÉRIFIÉ** → **P1-18**. Ce residual **n’est plus** un STOP « historique `master` contient le commit ».

**P0-01 (restore) : FERMÉ** depuis 18h — drill staging 2026-08-16. Residual **P1-16**.

Un **GO AVEC CONDITIONS** exigerait au minimum : (1) PhotoDNA contrat **ou** assume écrite + gel lives **déployé** + tabletop, (2) avocat / IAP selon le niveau de lancement, (3) acceptation écrite des P1 restants (SHA, Resend sandbox, live 16 en prod, AASA, staging 80 %). **(1) n’est pas LIVE.** Donc **NO-GO**, pas « GO avec conditions ».

**Accès manquants (§0) :** Sentry UI, consoles API, comptes test, TestFlight/Play, validation avocat, liste S3 Scaleway, `psql`.

---

## 0. Préflight — accès demandés vs obtenus

| Accès requis | Nécessaire pour | Disponible ? | Preuve |
| --- | --- | --- | --- |
| Repository Git (lecture) | 1, 4, 5, 8, 17 | **Oui** | Soundy HEAD `45fb733b` ; `origin/master` **`b674da65`** (golive + fetch) ; prod `release` = `ba60bdb1…` ; objet `72370fc8` **encore** `commit` en local, **pas** ancêtre de `origin/master` |
| SSH `onscen-prod` lecture seule | 5, 7, 19, 23 | **Oui** | PM2 online ; script Python **noms de variables seulement** ; `ageGates.js` `MIN_LIVE_AGE=16` |
| SSH `onscen-staging` lecture + HTTP | 5, 14, 15 | **Oui** | health `preproduction` ; `df` **80 %** |
| Accès Sentry | 7 | **Non** | Nom `SENTRY_DSN` **PRESENT** prod. Dashboard : pas d’accès |
| Scaleway S3 métadonnées | 5 | **Partiel** | Dumps VPS listés. Liste objets S3 **non** exécutée |
| Dashboard PostgreSQL | 5, 6 | **Non `psql`** | Health `db:ok`. PostGIS : preuve **log 18h**, non re-testé `psql` 21h |
| GitHub Actions | 17 | **Oui** | CI `master` success `32393915160` SHA `b674da65` (16:46 UTC). Uptime Health success `32405769951` (18:54 UTC). Deploy Preprod success `32394659216` (16:54 UTC) |
| Dashboards APIs | 10 | **Non** | Noms de variables seulement |
| Comptes test staging | 14, 15 | **Non** | 0bis : pas de QA interactive |
| Build iOS/Android store | 13 | **Non** | AASA : `APPLE_TEAM_ID manquant` |
| Documentation juridique | 11 | **Oui (brouillons)** | `CHECKLIST-VALIDATION-AVOCAT.md` : **aucune case cochée** |

**Scripts (lus avant exécution) :**

| Script | Lu | Exécuté ? | Motif |
| ------ | -- | --------- | ----- |
| `commun/scripts/verify-full-access.ps1` | Oui (passe 18h) | **Non cette passe** | Équivalent SSH + health + gh |
| `commun/scripts/audit-external-env.cjs` | Oui (passe 18h) | **Non cette passe** | Noms VPS via Python lecture seule |
| `commun/scripts/audit-external-env.sh` | Oui | **Non** | `source` le `.env` |
| `commun/scripts/audit-infra-access.ps1` | Oui | **Non** | Chemins obsolètes |

**0bis staging :** aucune donnée de test créée.

**Live ~21:03 CEST :**

- Health prod : `OK` / `stripeMode: live` / `release: ba60bdb1…` / services redis+stripe+smtp+livekit `ok`
- Health staging : `preproduction` OK (IP + loopback :3000)
- `GET /api/auth/providers` public : `google: true`, `youtube: true`, `apple: false`
- `GET /api/auth/google` → **302** vers `accounts.google.com` ; `client_id` préfixe **`233151018886`** ; `redirect_uri` `https://onscen.com/api/auth/google/callback` ; **pas** de `deleted_client` / `redirect_uri_mismatch` dans ce hop
- `POST /api/donations/webhook` → `Signature manquante`
- `GET /api/auth/me` (loopback prod) → 401
- AASA → `Universal Links non configurés (APPLE_TEAM_ID manquant)`
- `/tel/` → 200
- HSTS présent sur `/health`. En-tête `CF-RAY` **non capturé** dans le dump `-I` de cette passe (18h : **VÉRIFIÉ LIVE**)
- Env prod (noms) : `PHOTODNA_REQUIRED=1` ; PhotoDNA clé **MISS** ; `GOOGLE_OAUTH_PROD_ENABLED=1` ; ACRCloud keys **PRESENT** ; `ACRCLOUD_ENABLED` **MISS** ; Sentry DSN PRESENT ; Turnstile secret PRESENT ; `SIGHTENGINE_FAIL_OPEN=0` ; dons/abos **0** ; `ACCESS_REGISTRATION_MODE=open` ; `ALLOW_UNSAMPLED_LIVE` MISS ; `RESEND_FROM=OnScen <noreply@onscen.com>` ; `RESEND_API_KEY` PRESENT
- Dist prod : `MIN_LIVE_AGE_JS=16` ; `PHOTODNA_UNAVAILABLE` hits **0**
- Disque prod **2 %** ; staging **80 %**
- Backups : `onscen-20260820-031501.sql.gz` (+ 19, 18, …)
- `npm audit --omit=dev` backend + `web/app` : **0** vulnérabilités

---

## 2. Registre P0 / P1 / P2

| ID | Priorité | Domaine | Constat | Preuve | Niveau de preuve | Risque | Recommandation | Propriétaire | Statut |
| -- | -------- | ------- | ------- | ------ | ----------------- | ------ | --------------- | ------------ | ------ |
| P0-01 | P0 | DB / DR | Restore staging 2026-08-16. Dump du jour présent. | `restore-drill.md` ; `ls` backups | VÉRIFIÉ DOC + LIVE | Dérive si pas de drill | Cadence | ops | **FERMÉ** (→ P1-16) |
| P0-02 | P0 | Sécurité | `72370fc8` **plus** ancêtre de `origin/master`. Objet encore en local. Cache GitHub **NON VÉRIFIÉ**. | `merge-base --is-ancestor` exit 1 ; `cat-file -t` → commit | VÉRIFIÉ REPO | Fuite via vieux clones / cache GH | Ticket GH support cache **ou** acceptation residual | fondateur + ops | **FERMÉ** (joignable `master`) → **P1-18** |
| P0-03 | P0 | Modération / CSAM | Uploads refusés LIVE. Clé PhotoDNA MISS. Lives **ouverts** en prod. Gel `PHOTODNA_UNAVAILABLE` **working tree Soundy seulement** (absent golive `origin/master`, absent dist prod). | env ; grep JS prod 0 ; grep repo | VÉRIFIÉ LIVE + REPO | CSAM hash industrie absent ; live hors PhotoDNA | Contrat **ou** assume + commit + **deploy** gel | fondateur + avocat + ops | **OUVERT** (mitigé uploads) |
| P1-01 | P1 | Paiements | Dons/abos prod **0**. Webhook unsigned → `Signature manquante`. | flags VPS ; HTTP | VÉRIFIÉ LIVE | Encaissement off prod | Activer webhooks **ou** laisser off | fondateur | **PARTIELLEMENT RÉSOLU** |
| P1-02 | P1 | Auth | Google OAuth **LIVE** : flag `1`, préfixe client `233151018886`, 302 Google, providers `google`+`youtube` true. Front prod SHA `ba60bdb1` peut encore griser le bouton. | env ; curl 302 ; providers | VÉRIFIÉ LIVE | UI prod peut rester grise | Deploy front après commit | ops | **RÉSOLU** (API) ; UI **P1-13** |
| P1-03 | P1 | DDoS | WAF Free managed ruleset **activé** en soirée (ops). `CF-RAY` 18h LIVE ; non recapturé 21h. | ops 20h ; curl 18h | VÉRIFIÉ LIVE (20h) + DOC | Paid WAF non entitled | Laisser Free ; token DNS Write si DNS CF | ops | **RÉSOLU** (Free) |
| P1-04 | P1 | Infra | `staging.onscen.com` / IP health `preproduction`. | curl | VÉRIFIÉ LIVE | — | — | ops | **RÉSOLU** |
| P1-05 | P1 | Infra | Staging disque **80 %** (était 78 % à 18h). | `df -h` | VÉRIFIÉ LIVE | Seuil alerte atteint | Volume / purge | ops | **OUVERT** (**aggravé**) |
| P1-06 | P1 | CI | CI `master` success `b674da65`. | `gh run list` | VÉRIFIÉ GH | — | Garder master verte | ops | **RÉSOLU** |
| P1-07 | P1 | Live | `ALLOW_UNSAMPLED_LIVE` MISS. LiveKit OK. Test live réel **NON VÉRIFIÉ**. | env + health | VÉRIFIÉ LIVE (flag) | Trou si egress KO | Test staging | fondateur / ops | **PARTIELLEMENT RÉSOLU** |
| P1-08 | P1 | Musique | ACRCloud keys **PRESENT** prod. `ACRCLOUD_ENABLED` MISS (le code s’appuie sur les clés). Scan **NON VÉRIFIÉ**. | noms env | VÉRIFIÉ LIVE | Empreinte **INFÉRÉE** | Confirmer intention + test | fondateur | **PARTIELLEMENT RÉSOLU** |
| P1-09 | P1 | Mobile | AASA : `APPLE_TEAM_ID manquant`. Pas d’IAP. | curl AASA | VÉRIFIÉ LIVE | NO-GO App Store | Team ID + IAP | fondateur | **OUVERT** |
| P1-10 | P1 | Légal | Checklist avocat : 0 case. | `CHECKLIST-VALIDATION-AVOCAT.md` | VÉRIFIÉ DOC | Conformité non prête | RDV avocat + DPA | fondateur + avocat | **OUVERT** |
| P1-11 | P1 | Légal | Pas de cadre SACEM. ACRCloud ≠ licence. | audits 08-11 C3 | VÉRIFIÉ DOC | Droits d’auteur | Cadre licence ou interdiction | fondateur + avocat | **OUVERT** |
| P1-12 | P1 | Observabilité | Uptime Health GH **vert** 18:54 UTC. Clé Resend PRESENT + `RESEND_FROM` prod. API domaines **403 sandbox** documentée ~20h (non rappelée 21h). Health `smtp:ok` **trompeur**. Sentry UI **NON VÉRIFIÉ**. | env ; DOC 20h ; gh | VÉRIFIÉ LIVE + DOC | Incident : health OK, e-mail Resend **sandbox** | **Nouvelle** clé Production Resend | fondateur / ops | **OUVERT** |
| P1-13 | P1 | CI/CD | SHA prod `ba60bdb1` ≠ `origin/master` `b674da65` ≠ Soundy HEAD `45fb733b` ≠ golive (âge 18 non commité). | health ; git | VÉRIFIÉ LIVE + REPO | Prod hors `master` ; Google UI / live 18 / gel PhotoDNA absents | Commit puis **deploy explicite** | ops | **OUVERT** |
| P1-14 | P1 | Légal | Live dès **16 ans en prod**. Golive local : `MIN_LIVE_AGE = 18` **non déployé**. | dist prod ; golive `ageGates.ts` | VÉRIFIÉ LIVE + REPO | Écart majorité | Arbitrage + deploy | fondateur + avocat | **OUVERT** |
| P1-15 | P1 | Hygiène | `NO_DEBUG` 17h RÉSOLU. Non re-testé 21h. | 17h | VÉRIFIÉ DOC | — | — | ops | **RÉSOLU** (17h) |
| P1-16 | P1 | DR | RPO 24 h écrite. Pas de 2ᵉ drill. RTO prod **NON DÉFINI**. | RUNBOOK ; dumps | VÉRIFIÉ DOC + LIVE | Dérive | Drill + signature | fondateur / ops | **PARTIELLEMENT RÉSOLU** |
| P1-17 | P1 | Observabilité | Log bootstrap « inscriptions fermées » vs `ACCESS_REGISTRATION_MODE=open`. Non re-lu 21h. | 18h `bootstrap.ts` | VÉRIFIÉ DOC (cette passe NON RE-VÉRIFIÉ) | Fausse impression ops | Corriger le log | `@onscen-dev-agent` | **OUVERT** |
| P1-18 | P1 | Sécurité | Residual Git : objet `72370fc8` local ; cache GitHub **NON VÉRIFIÉ**. Secrets concernés : TLS msdev roté local 18h ; Gmail démo **N/A** fondateur. | git ; ticket 18h | VÉRIFIÉ REPO + INFÉRÉ cache | Vieux clones | Support GH + ne plus pousser depuis Soundy objet-DB | fondateur / ops | **NOUVEAU** (ex-P0-02 residual) |
| P2-01 | P2 | Stack | CI Node 22 ; engines `>=20 <25`. Master CI verte. | ci.yml ; gh | VÉRIFIÉ GH | — | — | ops | **RÉSOLU** |
| P2-02 | P2 | Runtime | 1 process PM2. Écart `STACK-CIBLE` cluster. | pm2 | VÉRIFIÉ LIVE | Capacité | Cluster plus tard | ops | **RÉSOLU** (accepté scale) |
| P2-03 | P2 | Mobile | `sentryNative.ts` importe `@sentry/react`. Crash store NON VÉRIFIÉ. | 18h | VÉRIFIÉ DOC | Trous crash | `@sentry/capacitor` | `@onscen-dev-agent` | **OUVERT** |
| P2-04 | P2 | Mobile | Bundle `com.soundy.app` historique. | 08-15 | VÉRIFIÉ DOC | Marque store | Renommer | fondateur | **OUVERT** |
| P2-05 | P2 | Perf | Aucun test de charge. | repo | NON VÉRIFIÉ | Capacité inconnue | Load test staging | ops | **OUVERT** |
| P2-06 | P2 | Staging | Deploy Preprod GH success 16:54 UTC. SHA front staging **NON VÉRIFIÉ**. | gh | VÉRIFIÉ PARTIEL | Écart front | Aligner SHA | ops | **PARTIELLEMENT RÉSOLU** |
| P2-07 | P2 | APIs | PhotoDNA prod **MISS**. FB/IG/OpenAI hors scope lancement. | env | VÉRIFIÉ LIVE | P0-03 | Contrat PhotoDNA | fondateur | **OUVERT** |
| P2-08 | P2 | Staging | ACRCloud keys **PRESENT** (18h). Non re-grep 21h. | 18h | VÉRIFIÉ DOC | — | — | ops | **RÉSOLU** (18h) |

**Totaux ouverts : 1 P0 · ~14 P1 · 5 P2.**  
Fermé vs 18h : **P0-02** (historique `master`), **P1-02** (API Google), **P1-03** (WAF Free).  
Nouveau : **P1-18**. Aggravé : **P1-05** 80 %. Inchangé LIVE : **P0-03**.

---

## 3. Delta vs 2026-08-11, 08-15, 08-16, matin / 14h / 17h / **18h 08-20**

| Problème | 18h (~18:15) | 21h (~21:10) | Évolution |
| -------- | -------------- | -------------- | --------- |
| P0-02 Git secrets | `72370fc8` présent, purge absente | `origin/master` `b674da65` **sans** ce commit comme ancêtre ; objet local restant | **FERMÉ** joignable GH ; residual **P1-18** |
| P0-03 PhotoDNA | Flag+refus LIVE ; gel local non déployé | **Identique LIVE** (`MIN_LIVE_AGE=16`, freeze hits 0) | **INCHANGÉ LIVE** |
| P1-02 OAuth | `deleted_client` | Client `233151018886`, 302 Google, providers true | **RÉSOLU** (API) |
| P1-03 WAF | CF proxy ; managed **NON VÉRIFIÉ** | WAF Free **activé** (ops soirée) | **RÉSOLU** (Free) |
| P1-12 Resend | Monitor 403 | Clé copiée **même** sandbox ; 403 documenté 20h | **INCHANGÉ** (copie ≠ Production) |
| P1-05 disque staging | 78 % | **80 %** | **AGGRAVÉ** |
| P1-13 SHA | `ba60bdb1` ≠ `df720959` | `ba60bdb1` ≠ `b674da65` ≠ HEAD Soundy | **TOUJOURS OUVERT** |
| P1-14 live âge | 16 repo+prod | Prod **16** ; golive **18** non déployé | **PROGRÈS REPO local golive seulement** |
| PostGIS | log boot actif | Non re-testé | **MAINTENU** (preuve 18h) |
| C8 npm audit | 0 | **0** | **MAINTENU** |
| CDN HSTS | LIVE | HSTS LIVE | **MAINTENU** |

---

## 4. Analyse par phase (résumé)

| Phase | Constat | Preuve | Niveau | Statut |
| ----- | ------- | ------ | ------ | ------ |
| 4 Stack | Aligné `STACK-CIBLE` (React/Vite/Express/Capacitor). `npm audit --omit=dev` 0. PM2 ×1 ≠ cible cluster. | package.json ; audit | VÉRIFIÉ | OK deps / CI master |
| 5 DB | Health `db:ok` ; dumps 11–20/08 ; restore 16/08 | health ; ls | LIVE + DOC | Restore démontré une fois |
| 6 PostGIS | Preuve log 18h. `psql` **NON VÉRIFIÉ** 21h | 18h | VÉRIFIÉ DOC cette passe | GiST **NON RE-TESTÉ** |
| 7 Observabilité | Health+PM2 OK ; Sentry DSN PRESENT ; Uptime Health GH ; Resend sandbox ; Sentry UI **NON VÉRIFIÉ** | health ; gh ; env | PARTIEL | 3 h du matin : GH Actions health. E-mail Resend **non démontré Production**. Qui est réveillé : **NON VÉRIFIÉ** (humain / Pager) |
| 8 Sécurité | Webhook sans sig → `Signature manquante` ; `/me` 401 ; HSTS ; historique `master` purgé | HTTP ; git | LIVE + REPO | P0-03 STOP CSAM ; P0-02 residual P1-18 |
| 9 CSAM | Uploads fail-closed ; PhotoDNA MISS ; Sightengine fail-open=0 ; lives sans PhotoDNA **prod** | env ; grep JS | LIVE | **P0-03 ouvert** |
| 10 APIs | Google/YouTube OAuth **LIVE**. Stripe live. Quotas dashboards **NON VÉRIFIÉ** | curl ; health | LIVE | PhotoDNA MISS |
| 11 Légal | Checklist 0 ; CGU brouillons ; **CONSTAT TECHNIQUE** | CHECKLIST | DOC | **non prêt** (pas « illégal » — avocat) |
| 12 YouTube | OAuth YouTube provider true ; même client Google. Test salon YT **NON VÉRIFIÉ** | providers | LIVE limité | Plus `deleted_client` |
| 13 Mobile | `/tel/` 200 ; AASA KO ; IAP absent | curl | LIVE + REPO | Stores **NO-GO** |
| 14 QA | NON TESTÉ interactif | 0bis | NON VÉRIFIÉ | N’infère pas OK |
| 15 Négatif | Webhook unsigned + 401 `/me` | HTTP | LIVE limité | Pas d’IDOR staging |
| 16 Charge | Aucun load test | repo | NON VÉRIFIÉ | Capacité non démontrée |
| 17 CI/CD | Prod SHA `ba60bdb1` ; `master` CI verte `b674da65` | gh ; health | LIVE + GH | Branche prod ≠ master |
| 18 DR | RPO cible 24 h ; RTO **NON DÉFINI** ; drill unique | RUNBOOK | DOC | P1-16 |
| 19 Exploit | PM2 online ; disque prod 2 % ; staging **80 %** | ssh | LIVE | Health OK ; Resend Production **NON VÉRIFIÉ** |

---

## 5. Ce qui manque encore

**Accès (§0) :** Sentry dashboard, consoles Stripe/LiveKit/Sightengine/ACRCloud, comptes test, TestFlight/Play, avocat, S3 list, `psql`.

**Tests :** QA parcours web+tel ; live caméra bout-en-bout ; upload CSAM `nomatch` ; charge ; IDOR staging ; crash Sentry store ; POST inscription (prod interdit).

**Preuves :** PhotoDNA contrat **ou** assume + gel **déployé** ; clé Resend **Production** ( Domains API ≠ 403 ) ; AASA ; cases avocat ; cache GitHub ticket.

**Décisions business :** ACRCloud intention (clés **PRESENT**) ; PhotoDNA A vs B ; live 16 vs 18 ; IAP ; SHA de deploy.

**Ops :** `release` reste `ba60bdb1` — **aucun** des correctifs soirée (âge 18, gel PhotoDNA, UI Google, Caddy `trusted_proxies`, gardes Resend) n’est **LIVE** tant qu’il n’y a pas de deploy **explicite**. Staging 80 %.

**Avocat :** checklist 0 ; DPA ; CSAM PHAROS/NCMEC ; SACEM.

**Hors scope cette passe :** coding, deploy, mutation prod. Script temporaire `_tmp_prod_read.py` exécuté sur le VPS puis **supprimé** (noms seulement).

---

## 6. Recommandations avant mise en production

| Action | Priorité | Propriétaire | Dépendance | Preuve attendue |
|--------|----------|--------------|------------|-----------------|
| PhotoDNA contrat **ou** assume écrite + **commit + deploy** gel lives | P0 | fondateur + avocat + ops | Demande **deploy prod** explicite | Clé PRESENT + log `nomatch` **ou** SHA health avec `PHOTODNA_UNAVAILABLE` + note |
| Créer une clé Resend **Production** (ne pas recopier la sandbox) | P1 | fondateur / ops | Compte Resend | Domains API ≠ 403 ; e-mail reçu |
| Aligner SHA prod sur `master` **après** P0-03 | P1 | ops | Deploy explicite | health `release` = SHA voulu |
| Purge / volume staging (80 %) | P1 | ops | — | `df` < 70 % |
| RDV avocat + cocher checklist | P1 | fondateur + avocat | — | Cases + CR RDV |
| `APPLE_TEAM_ID` + IAP | P1 | fondateur | Apple | AASA JSON team |
| Arbitrage `MIN_LIVE_AGE` 16 vs 18 + deploy | P1 | fondateur + avocat | Deploy | Constante prod = CGU |
| Residual Git : ne plus traiter Soundy comme source de vérité ; ticket cache GH | P1 | ops | — | `cat-file` absent des nouveaux clones |
| Alerte Sentry email | P1 | fondateur | Dashboard Sentry | Screenshot règle |
| Load test staging | P2 | ops | Disque < 80 % | Rapport |

---

## 7. Handoff `@onscen-dev-agent`

Uniquement P0. **Ne pas coder** dans cette passe. Le gel lives existe dans le **working tree Soundy** (`csamHashMatch.ts`, tests) — **absent** de `OnScen-golive` / `origin/master` / dist prod. Commit + deploy **seulement si le fondateur le demande**.

Ticket :

- `tickets/03-csam-photodna.md`

P0-02 n’est plus un ticket P0 (historique `master` purgé). Residual **P1-18** : pas de ticket Dev.

P1 (Google UI, âge 18, Resend, log bootstrap) : **pas** P0.

---

## 8. Arbitrages obligatoires

| Sujet | État 21h | Qui tranche |
|-------|----------|-------------|
| **ACRCloud** | Clés **PRESENT** prod ; `ACRCLOUD_ENABLED` MISS ; scan réel **NON VÉRIFIÉ** | fondateur (question ci-dessous) |
| **IAP / AASA** | `APPLE_TEAM_ID manquant` | fondateur |
| **Live 16 ans** | **16 LIVE** prod ; 18 uniquement golive local | fondateur + avocat |
| **WAF** | Free managed **LIVE** (soirée) | — (clos Free) |
| **DNS staging** | Health `preproduction` | — |
| **PhotoDNA** | Refus uploads LIVE ; pas de clé ; lives ouverts **prod** | fondateur + avocat |
| **Purge Git** | `origin/master` sans `72370fc8` ancêtre ; residual local + cache GH | fondateur (residual) |
| **Branche prod** | `ba60bdb1` vs `master` `b674da65` | ops (**deploy explicite**) |
| **Resend** | Même clé sandbox copiée ≠ Production | fondateur |

---

> **Question ACRCloud : les variables `ACRCLOUD_ACCESS_KEY` et `ACRCLOUD_ACCESS_SECRET` doivent-elles être présentes en production, ou leur absence est-elle volontaire ?**

**Constat 21h (noms seulement) :** elles sont **PRESENT** en production. `ACRCLOUD_ENABLED` est **MISS** (le runtime 18h loggait déjà `ACRCloud actif` sur la présence des clés). Ce n’est **pas** une absence. Confirme si c’est **volontaire** (empreinte audio voulue) ou un reliquat à retirer.
