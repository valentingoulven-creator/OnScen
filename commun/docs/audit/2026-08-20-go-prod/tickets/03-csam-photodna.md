# [P0-03] Activer un hash-matching CSAM réel ou restreindre UGC/live public

## Contexte
Le code a un hook PhotoDNA + une blocklist SHA-256 locale (`csamHashMatch.ts`). En prod le **2026-08-20**, `PHOTODNA_SUBSCRIPTION_KEY` **n’existe pas** (grep count=0). `PHOTODNA_REQUIRED` **n’est pas défini** → les uploads ne sont pas refusés. Le fichier blocklist est **absent** du VPS. Sightengine `fail-open=0` tourne — ce n’est **pas** du hash-matching NCMEC.

Depuis le 16/08, le code refuse les lives WebRTC non échantillonnés en env déployé (`ALLOW_UNSAMPLED_LIVE` absent en prod) et relais LiveKit → Cloudflare + sampling Sightengine. **Test bout-en-bout d’un live : NON VÉRIFIÉ.**

## Problème
Plateforme inscriptions `open` + UGC + live sans filet hash industrie. Runbook CSAM : brouillon, pas d’exercice depuis le 16/08. **CONSTAT TECHNIQUE** — **À VALIDER AVOCAT** (PHAROS / NCMEC).

## Preuve
- SSH prod 2026-08-20 : `PHOTODNA_SUBSCRIPTION_KEY` count=0 ; pas de ligne `PHOTODNA_REQUIRED`.
- `ls` blocklist `/opt/onscen/data/csam-blocklist.json` : absent.
- `commun/backend/src/lib/csamHashMatch.ts` (`isPhotoDnaConfigured` → skip ; required seulement si flag).
- `commun/backend/src/lib/liveSamplingPolicy.ts` ; `lives.ts` `startLiveKitSamplingRelay`.
- Niveau : **VÉRIFIÉ LIVE + REPO**.

## Impact
NO-GO pour un lancement public UGC/live. Risque pénal et DSA. Sightengine réduit mais ne remplace pas PhotoDNA/NCMEC.

## Résultat attendu
Soit (A) PhotoDNA configuré en prod + test `nomatch` sur image bénigne + alerte email, soit (B) `PHOTODNA_REQUIRED=1` (refus uploads) **et/ou** décision produit : pas de live caméra public / pas d’upload image-vidéo. Le Dev ne signe pas le contrat Microsoft.

## Critères d'acceptation
- [x] Code : fail PhotoDNA en prod si erreur API ; `PHOTODNA_REQUIRED=1` refuse les uploads si clé absente
- [x] Code : lives LiveKit relaient vers Cloudflare + sampling ; WebRTC public refusé en prod (`ALLOW_UNSAMPLED_LIVE`)
- [x] **Prod :** `PHOTODNA_REQUIRED=1` **posé** le 2026-08-20 (grep count=1). `PHOTODNA_SUBSCRIPTION_KEY` toujours **ABSENT**.
- [ ] Décision fondateur A ou B écrite
- [ ] Si A : un scan test `nomatch` logué sans stocker le média
- [x] Si B : flag serveur actif en prod — uploads images/vidéos **refusés** tant que la clé PhotoDNA n’existe pas (code déployé `isPhotoDnaRequired` + env). Lives caméra **non** gelés (hors scope flag hash).
- [ ] Tabletop runbook 30 min (fondateur) : date dans `RUNBOOK-CSAM.md`
- [ ] Avocat : avis PHAROS/NCMEC (hors code)

### Suivi Dev 2026-08-20

- Env prod + staging : `PHOTODNA_REQUIRED=1`. Blocklist locale créée (`/opt/onscen/data/csam-blocklist.json`, vide).
- Code (branche, **pas encore déployé**) : défaut `isPhotoDnaRequired()` = true en env déployé ; `PHOTODNA_REQUIRED=0` seul opt-out.
- Contrat Microsoft / clé : **toujours BLOQUÉ fondateur**.

## Fichiers concernés
- `commun/backend/src/lib/csamHashMatch.ts`
- `commun/backend/src/lib/liveSamplingPolicy.ts`
- `commun/backend/src/routes/lives.ts`
- `commun/backend/src/lib/liveContentSampling.ts`
- `commun/docs/juridique/RUNBOOK-CSAM.md`
- VPS `/opt/onscen/.env` (noms de variables seulement)
