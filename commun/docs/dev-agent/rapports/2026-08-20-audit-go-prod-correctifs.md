# Rapport Dev Agent — 2026-08-20 — Audit GO prod : correctifs code + ops

**Agent :** @onscen-dev-agent  
**Date :** 2026-08-20  
**Durée estimée :** 2 h  
**Statut global :** PARTIEL

---

## Mission

Appliquer tous les correctifs **implémentables** du NO-GO `commun/docs/audit/2026-08-20-go-prod/00-synthese.md`. Ne pas inventer rotation Git, contrat PhotoDNA, IAP, WAF DNS, OAuth Google, SACEM ni checklist avocat.

**Source :** fondateur (« fait tout les correctif pour un go en prod ») + handoff `@audit`

---

## Contexte / problème

Audit **NO-GO** : P0-02 (secrets Git) + P0-03 (PhotoDNA absent, flag required non posé). P1 : UI dons, scripts debug VPS, PM2_INSTANCES, ACRCloud staging, CI master, avocat, stores.

---

## Actions réalisées

- [x] P0-03 option B **live** : `PHOTODNA_REQUIRED=1` prod + staging ; PM2 redémarré ; uploads images/vidéos refusés sans clé PhotoDNA
- [x] P0-03 code (à déployer) : `isPhotoDnaRequired()` défaut true en env déployé ; erreur PhotoDNA fail-closed aussi en préprod
- [x] Blocklist locale vide créée sur le VPS prod
- [x] P1-01 : UI pourboires live masquée si `donationsPlatformEnabled` est false (web + tel, composant partagé)
- [x] P1-06 : ESLint déjà vert sur cette branche (`locationPrivacy`, `auth`, `donations`/`subscriptions` simulate, `prefer-const`) — CI `master` reste rouge tant que non fusionné
- [x] P1-15 : scripts debug prod retirés (`query_prod.js`, `seed_prod_testdata.js`, 3× `debug_*.js`)
- [x] P2-02 : `PM2_INSTANCES=1` aligné ; restart ecosystem (plus de warn `=2`)
- [x] P2-08 / P1-08 staging : clés ACRCloud fusionnées (noms PRESENT) ; log `ACRCloud actif`
- [x] P1-05 : disque staging 79 % → **74 %** (`public.bak`, apt, journaux)
- [x] P1-16 : RPO 24 h / cadence drill trimestrielle documentés (`RUNBOOK-PROD.md`, prochain 2026-11-16)
- [ ] P0-02 rotation secrets `72370fc8` — **BLOQUÉ fondateur**
- [ ] P0-03 contrat Microsoft PhotoDNA + tabletop CSAM + avocat — **BLOQUÉ**
- [ ] P1-02 OAuth Google console — **BLOQUÉ fondateur**
- [ ] P1-03 WAF Cloudflare DNS — **BLOQUÉ fondateur**
- [ ] P1-04 DNS `staging.onscen.com` — **BLOQUÉ** (pas de credentials OVH)
- [ ] P1-09 / P1-10 / P1-11 / P1-14 IAP, avocat, SACEM, âge live 16 — **BLOQUÉ**
- [ ] Deploy du code PhotoDNA-défaut + UI dons — **non demandé** cette session

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/lib/csamHashMatch.ts` | Required PhotoDNA par défaut si env déployé |
| `commun/backend/src/lib/csamHashMatch.test.ts` | Prod / préprod / opt-out |
| `commun/backend/src/lib/contentModeration.test.ts` | Isolation Sightengine + test refus PhotoDNA |
| `commun/backend/src/lib/productionStartup.ts` | Warn uploads REFUSÉS |
| `web/app/src/components/StartLiveFlowModals.tsx` | `donationsEnabled` ∧ `donationsPlatformEnabled` |
| `commun/backend/.env.production.example` | `PHOTODNA_REQUIRED=1` |
| `commun/deploy/RUNBOOK-PROD.md` | RPO/RTO + cadence |
| VPS `/opt/onscen/.env` | Flags only (valeurs non dumpées) |

---

## Commandes exécutées

```text
npm run lint --prefix commun/backend
  → ✅
npx vitest run csamHashMatch + productionStartup + contentModeration
  → ✅ 29 tests
npm test --prefix commun/backend
  → 3 échecs contentModeration (corrigés ensuite) ; re-run ciblé ✅
curl https://onscen.com/health
  → ✅ status OK, release bce8ec5d, stripeMode live
ssh staging df
  → 74 %
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests exécutés | csamHashMatch (6), productionStartup (13), contentModeration (10) |
| Tests **non** exécutés | suite backend complète après le fix contentModeration ; `app:build` ; `mobile:check` ; QA upload réel |
| Build frontend (`web/app`) | NON FAIT |
| Web | Flag PhotoDNA **live** (env). UI dons **pas encore déployée** |
| Tel | Même composant `StartLiveFlowModals` ; hook apptel déjà lisait `config.enabled` |
| Migration DB | Non |
| NON VÉRIFIÉ | Upload image prod (refus attendu, non cliqué) ; scan ACRCloud réel ; live sampling bout-en-bout |
| CTO | Handoff : P0-02 rotation ; contrat PhotoDNA ; avocat ; Google OAuth ; WAF ; IAP |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1473)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| Secrets `72370fc8` | Rotation prouvée **ou** acceptation écrite |
| PhotoDNA | Contrat Microsoft + clé, **ou** assumer le gel UGC média actuel (`PHOTODNA_REQUIRED=1`) |
| Avocat | Checklist + PHAROS/NCMEC + SACEM + âge live 16 vs 18 |
| Google OAuth | Recréer le client (actuel `deleted_client`) + `GOOGLE_OAUTH_PROD_ENABLED=1` |
| Cloudflare WAF | DNS proxy orange |
| IAP / `APPLE_TEAM_ID` | Stores |
| Deploy | Demander **deploy prod** pour le défaut code PhotoDNA + UI dons |
| CI master | Fusionner cette branche (lint déjà vert ici) |

---

## Prochaines étapes

1. Décision écrite P0-02 et PhotoDNA (contrat vs gel UGC).
2. Commit + **deploy prod** quand demandé (code + UI).
3. Fusion `master` pour verdir la CI.
4. RDV avocat / WAF / OAuth / IAP.

---

## Notes techniques

`PHOTODNA_REQUIRED=1` est **déjà actif** sur le binaire actuel (`isPhotoDnaRequired` explicite). Les stories / posts image / reels image-vidéo doivent renvoyer *« Vérification PhotoDNA indisponible »*. Ce n’est pas un gel des lives caméra.

Le restart PM2 prod (delete + start ecosystem) a causé quelques secondes d’indisponibilité ; health OK ensuite.

---

*Généré par OnScen Dev Agent*
