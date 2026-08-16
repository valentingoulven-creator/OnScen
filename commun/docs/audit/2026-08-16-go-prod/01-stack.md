# Phase 1 — Stack et dépendances

**Date :** 2026-08-16 · **Statut :** OK technique local / P1 CI  
**Niveau de preuve :** VÉRIFIÉ REPO + `npm audit` local + `gh` CI

## Constat

Monolithe conforme à `commun/docs/STACK-CIBLE.md` : React 19 + Vite + Express + Capacitor 8. Pas de dérive vers Next/K8s/GraphQL.

| Couche | Version constatée | Cible | Écart |
| ------ | ----------------- | ----- | ----- |
| Node (poste audit) | 24.18.0 / npm 11.16.0 | non piné (`engines` backend absent) | CI = Node 20 |
| React | `^19.2.6` (`web/app/package.json`) | React 19 | OK |
| Vite | `^8.1.2` | Vite | OK |
| Express | `^4.19.2` (`commun/backend/package.json`) | Express | OK |
| Capacitor | `^8.4.2` (core/ios/android) | Capacitor 8 | OK |
| Backend name | `onscen-backend` 1.0.0 | — | — |

`npm audit --omit=dev` (2026-08-16) : **0 vulnérabilité** backend ; **0** `web/app`. C8 / E9 08-11 **toujours résolus**.

Lockfiles présents (`commun/backend/package-lock.json`, `web/app/package-lock.json`). Licences OSS incompatibles : **NON VÉRIFIÉ** (pas de scan licence dédié cette passe). Scripts `preinstall`/`postinstall` malveillants : **NON VÉRIFIÉ** au-delà de la lecture des `package.json` applicatifs (pas d’anomalie évidente).

CI `master` du 2026-08-16 08:52 (`31937576461`) : **échec lint** backend (5 errors ESLint : unused vars). Pas un finding `npm audit`. E2E CI pointe `https://staging.onscen.com` (DNS KO — voir `12-cicd-recovery.md`).

## Risque

Dérive Node 24 local vs 20 CI : builds non bit-identiques. CI rouge = Deploy Preprod skip (`workflow_run` skipped le même jour).

## Recommandation

Aligner `engines` + CI sur une seule major LTS ; corriger lint `master` (P1-06).
