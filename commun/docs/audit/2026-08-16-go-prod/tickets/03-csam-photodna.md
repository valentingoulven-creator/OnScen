# [P0-03] Activer un hash-matching CSAM réel ou restreindre UGC/live public

## Contexte
Le code a un hook PhotoDNA + une blocklist SHA-256 locale (`csamHashMatch.ts`). En prod le 2026-08-16, `PHOTODNA_SUBSCRIPTION_KEY` **n’existe pas**. La blocklist locale est vide au premier run. Sightengine `face-age` tourne en fail-closed — ce n’est **pas** du hash-matching. Les lives WebRTC (défaut) ne sont pas échantillonnés (`liveContentSampling.ts` = Cloudflare only).

## Problème
Plateforme inscriptions `open` + UGC + live sans filet hash industrie. Runbook `RUNBOOK-CSAM.md` : brouillon, jamais exercé. **CONSTAT TECHNIQUE** — **À VALIDER AVOCAT** (PHAROS / NCMEC).

## Preuve
- Noms de variables `/opt/onscen/.env` : pas de `PHOTODNA_*`.
- `commun/backend/src/lib/csamHashMatch.ts` (`isPhotoDnaConfigured` → skip).
- `commun/backend/src/lib/liveContentSampling.ts` L10–13.
- `commun/docs/juridique/RUNBOOK-CSAM.md` statut brouillon.
- Niveau : **VÉRIFIÉ LIVE + REPO**.

## Impact
NO-GO pour un lancement public UGC/live. Risque pénal et DSA. Sightengine réduit mais ne remplace pas PhotoDNA/NCMEC.

## Résultat attendu
Soit (A) PhotoDNA configuré en prod + test `nomatch` sur image bénigne + alerte email, soit (B) décision produit : pas de live caméra public / pas d’upload image-vidéo tant que (A) n’est pas vrai. Le Dev ne signe pas le contrat Microsoft.

## Critères d'acceptation
- [x] Code : fail PhotoDNA en prod si erreur API ; `PHOTODNA_REQUIRED=1` refuse les uploads si clé absente
- [x] Code : lives LiveKit relaient vers Cloudflare + sampling ; WebRTC public refusé en prod (`ALLOW_UNSAMPLED_LIVE`)
- [ ] Décision fondateur A ou B écrite
- [ ] Si A : `PHOTODNA_SUBSCRIPTION_KEY` **présent** (nom) en prod ; un scan test `nomatch` logué sans stocker le média
- [ ] Si A : fail PhotoDNA en prod = **refus** upload (pas skip silencieux) — à implémenter si encore `skip`
- [ ] Si B : flag serveur qui refuse start live WebRTC public et uploads médias
- [ ] Tabletop runbook 30 min (fondateur) : date dans `RUNBOOK-CSAM.md`
- [ ] Avocat : avis PHAROS/NCMEC (hors code)

## Fichiers concernés
- `commun/backend/src/lib/csamHashMatch.ts`
- `commun/backend/src/lib/contentModeration.ts`
- `commun/backend/src/lib/liveContentSampling.ts`
- `commun/backend/src/lib/liveStreamMode.ts`
- `commun/docs/juridique/RUNBOOK-CSAM.md`
- `commun/backend/src/lib/externalSecretsRegistry.ts`
