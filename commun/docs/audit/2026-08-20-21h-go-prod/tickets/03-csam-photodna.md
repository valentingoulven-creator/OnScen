# [P0-03] Hash-matching CSAM réel ou assume écrite + gel lives déployé

## Contexte
`PHOTODNA_REQUIRED=1` est LIVE. Uploads images/vidéos refusés sans clé. `PHOTODNA_API_KEY` / `PHOTODNA_SUBSCRIPTION_KEY` **MISS**. Sightengine fail-open=0 ≠ PhotoDNA/NCMEC.

Le Dev a ajouté `POST /lives/start` → 503 `PHOTODNA_UNAVAILABLE` dans le **working tree Soundy** (`csamHashMatch.ts`, `lives.start.test.ts`). **Pas commité. Pas sur `origin/master` (`b674da65`). Pas dans `OnScen-golive`. Pas en prod** (grep JS `/opt/onscen/dist` hits = 0 ; SHA `ba60bdb1`).

## Problème
Inscriptions : `ACCESS_REGISTRATION_MODE=open`. Lives caméra publics **sans** hash industrie en production. Option B code **non LIVE**. **CONSTAT TECHNIQUE** — **À VALIDER AVOCAT**.

## Preuve
- Prod ~21:03 CEST : `PHOTODNA_REQUIRED=1` ; clés PhotoDNA MISS ; `MIN_LIVE_AGE` dist = **16**.
- `PHOTODNA_UNAVAILABLE` absent du JS déployé (hits 0).
- Soundy local : `commun/backend/src/lib/csamHashMatch.ts` + tests.
- Golive / `origin/master` : **pas** de `PHOTODNA_UNAVAILABLE`.
- Niveau : **VÉRIFIÉ LIVE + REPO**. Test upload réel : **NON VÉRIFIÉ**. Test start live prod : **non exécuté** (mutation).

## Impact
Mitige le trou **uploads**. Ne clôt pas un lancement UGC/live public. **NO-GO** tant que décision A/B + **déploiement du gel** (si B) manquent.

## Résultat attendu
(A) PhotoDNA + test `nomatch`, **ou** (B) assume écrite du gel uploads + lives + **commit + deploy** du code `PHOTODNA_UNAVAILABLE` + date runbook.

## Critères d'acceptation
- [x] Flag + code refus uploads en prod
- [ ] Code refus lives **déployé** (présent localement Soundy seulement)
- [ ] Décision fondateur A ou B écrite
- [ ] Si A : clé PRESENT (nom) + log `nomatch` test
- [ ] Tabletop `RUNBOOK-CSAM.md` validé avocat
- [ ] Avocat PHAROS/NCMEC

## Fichiers concernés
- `commun/backend/src/lib/csamHashMatch.ts` (Soundy working tree)
- `commun/backend/src/routes/lives.ts` / `lives.start.test.ts`
- `commun/docs/juridique/RUNBOOK-CSAM.md`
- VPS `/opt/onscen/.env` (noms seulement)
- Dist prod `/opt/onscen/dist` (gel absent)
