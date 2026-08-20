# P0-03 PhotoDNA — steps fondateur (pas de code ici)

Le gel lives `PHOTODNA_UNAVAILABLE` est **déjà dans le working tree** Soundy (`csamHashMatch.ts` + `lives.ts`). Il n’est **pas** sur `origin/master` ni en prod (`release` `ba60bdb1`).

Choisis **A ou B**. Les deux restent **À VALIDER AVOCAT** (PHAROS / NCMEC).

## Option A — Contrat PhotoDNA (recommandé pour un lancement UGC)

1. Compte Microsoft Content Moderator / PhotoDNA Hash Matching.
2. Obtenir `PHOTODNA_SUBSCRIPTION_KEY` (ne jamais la coller dans le chat ni Git).
3. Sur prod uniquement, dans `/opt/onscen/.env` :
   - `PHOTODNA_REQUIRED=1`
   - `PHOTODNA_SUBSCRIPTION_KEY=…`
   - laisser `PHOTODNA_MATCH_URL` par défaut sauf consigne Microsoft.
4. Recréer PM2 (`pm2 delete` + `start ecosystem.config.cjs` + `save`) — un `reload --update-env` a déjà ignoré des clés.
5. Test **nomatch** : upload image anodine (staging d’abord) → log `nomatch`, pas 503.
6. Test live caméra staging : start OK.
7. Tabletop `commun/docs/juridique/RUNBOOK-CSAM.md` avec l’avocat.
8. Dire **deploy prod** pour aligner le SHA (âge 18 + UI Google + gardes Resend).

## Option B — Assume écrite + gel lives déployé

1. Note écrite fondateur : « Je assume le gel des uploads **et** des lives caméra tant que PhotoDNA n’est pas configuré. Date. »
2. Commit le gel déjà présent (`isPhotoDnaBlockingLive` / `PHOTODNA_UNAVAILABLE`) **sur `origin/master`**.
3. Dire **deploy prod**.
4. Preuve : grep JS `/opt/onscen/dist` contient `PHOTODNA_UNAVAILABLE` ; `POST /lives/start` sans clé → 503 (tester **staging**, pas prod).
5. Uploads restent refusés (`PHOTODNA_REQUIRED=1` sans clé).
6. Même tabletop avocat + date runbook.

## Interdit

- Mettre `PHOTODNA_REQUIRED=0` sans dérogation écrite.
- Tester un start live **en production** pour « voir ».
- Coller la clé dans Git / Discord / ce chat.
