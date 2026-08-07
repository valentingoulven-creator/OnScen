# Rapport Dev Agent — 2026-08-04 — Correctifs audit CTO P0/P1

**Agent :** @soundy-dev-agent
**Date :** 2026-08-04
**Durée estimée :** ~1h30
**Statut global :** ✅ Terminé (périmètre technique) — ⚠️ 3 points restent des décisions fondateur/avocat, non actionnables par l'agent

---

## Mission

Appliquer les correctifs P0/P1 techniques identifiés par l'audit CTO du 2026-08-04 (npm audit haute sévérité, doc stack obsolète), puis refaire un audit de vérification.

---

## Contexte / problème

Audit CTO du jour (voir chat) avait identifié :
- R1 `socket.io-parser` (DoS mémoire, haute sévérité)
- R4 `ip-address` (SSRF/trust-boundary via `express-rate-limit`)
- R5 `postcss` (path traversal `.map` via `sanitize-html`)
- P1 : `STACK-CIBLE.md`/`TODO-MANUAL.md` documentaient PostGIS et Cloudflare WAF comme « à faire » alors que déjà actifs en prod
- P1 : confirmer que `SENTRY_DSN` est réellement configuré en prod (pas juste le code)
- R2 Stripe test + dons actifs, R3 branche 40 commits, R6 âge 13-15 ans, R7 god-objects : hors périmètre agent (décision fondateur/avocat)

## Actions réalisées

- [x] `npm audit fix` backend → 0 vulnérabilité (était 3 high)
- [x] `npm audit fix` frontend → `socket.io-parser` client corrigé, `sharp` restant est devDependency only (0 vuln en `--omit=dev`)
- [x] Rebuild + tests backend après fix → ✅ 474/474
- [x] Rebuild frontend → 2 erreurs TS pré-existantes découvertes (`hostLabel` inutilisé, fixture `FeedPost` invalide dans un test) → corrigées
- [x] Tests frontend → 2 échecs pré-existants découverts (`localStorage is not defined` en environnement `node`, test de couleur de pin avec dates absolues devenues passées) → corrigés
- [x] `STACK-CIBLE.md` / `TODO-MANUAL.md` mis à jour (PostGIS, Sentry, Cloudflare marqués ✅ fait avec preuve)
- [x] Vérification SSH read-only prod : `SENTRY_DSN` réel confirmé configuré ; `DONATIONS_ENABLED=0` confirmé (R2 déjà résolu par le fondateur le 2026-08-03, backup `.env.bak.20260803-donations-disable`)
- [x] Vérification branche : toujours 40 commits devant `origin/master` (R3 inchangé)
- [x] `modification.txt` — entrée MODIF 1355

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/backend/package.json`, `package-lock.json` | `npm audit fix` → 0 vulnérabilité |
| `web/app/package.json`, `package-lock.json` | `npm audit fix` → 0 vulnérabilité prod |
| `web/app/src/components/globe3d/SoundyGlobeLiveMarkers.tsx` | Suppression variable inutilisée (fix build TS6133) |
| `web/app/src/lib/homeFeedFollowingWindow.test.ts` | Fixture `FeedPost` alignée sur le vrai type (fix build TS2352) |
| `web/app/src/lib/settings.ts` | `safeStorage()` défensif + guards `typeof window` |
| `web/app/src/i18n.ts` | Guards `typeof document`/`typeof window` au chargement module |
| `web/app/src/lib/mapEventDayColors.test.ts` | `vi.setSystemTime` pour figer l'horloge (test devenu flaky avec le temps réel) |
| `commun/docs/STACK-CIBLE.md`, `TODO-MANUAL.md` | Doc alignée sur l'état réel prod (PostGIS/Sentry/Cloudflare) |
| `modification.txt` | Entrée MODIF 1355 |

## Commandes exécutées

```text
cd commun/backend && npm audit fix        → ✅ 0 vulnérabilité
cd commun/backend && npm run build        → ✅
cd commun/backend && npm test             → ✅ 474/474 (97 fichiers)
cd web/app && npm audit fix               → ✅ 0 vulnérabilité prod (sharp devDep restant)
cd web/app && npm run build               → ✅ 0 erreur TS
cd web/app && npm test -- --run           → ✅ 560/560 (88 fichiers)
ssh soundy-prod (lecture seule)           → SENTRY_DSN réel + DONATIONS_ENABLED=0 confirmés
```

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| `npm audit --omit=dev` backend | ✅ 0 vulnérabilité |
| `npm audit --omit=dev` frontend | ✅ 0 vulnérabilité |
| Tests unitaires backend | ✅ 474/474 |
| Tests unitaires frontend | ✅ 560/560 |
| Build backend | ✅ |
| Build frontend | ✅ |
| SENTRY_DSN prod (SSH read-only) | ✅ Configuré (valeur réelle, non un placeholder) |
| DONATIONS_ENABLED prod | ✅ `0` — R2 déjà résolu par le fondateur (2026-08-03) |
| Divergence `master` | ⚠️ Toujours 40 commits (R3 inchangé) |

## modification.txt

- [x] Entrée ajoutée (MODIF 1355)

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| R3 — Branche `fix/dm-history-postgres-data-loss` 40 commits devant `master`, CI jamais exécutée dessus | Décider stratégie (PR vers master, ou accepter le risque) |
| R6 — Âge 13 ans déclaratif (RGPD art. 8 = 15 ans en France) | Trancher avec l'avocat (déjà dans le dossier PDF préparé) |
| R7 — `HomePage.tsx` (4066 lignes) / `DmPage.tsx` (3877 lignes) god-objects | Planifier un sprint dédié refactor |

## Prochaines étapes

1. Founder : décision branche `master` (P0 process)
2. Sprint dédié refactor `HomePage.tsx`/`DmPage.tsx` si priorisé
3. Continuer suivi dossier avocat (âge 13-15 ans, déjà dans le pipeline)

---

*Généré par Soundy Dev Agent*
