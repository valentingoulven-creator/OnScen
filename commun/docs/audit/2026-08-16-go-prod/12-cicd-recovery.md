# Phase 12 — CI/CD, exploitation, rollback, DR

**Date :** 2026-08-16 · **Statut :** P0-01 + P1-06 + P1-13  
**Niveau de preuve :** `gh` + SSH + repo

## GitHub Actions

| Workflow | État | Note |
| -------- | ---- | ---- |
| CI | **failure** `master` 08:52 | Lint ESLint 5 errors |
| Uptime Health | **failure** répété | `https://staging.onscen.com/health` NXDOMAIN |
| Deploy Preprod | **skipped** | Dépend CI verte |
| Android Capacitor | actif | APK debug only |
| iOS Capacitor | actif | Non signé |
| Dependabot | actif | PRs CI rouge |

Actions tierces : `actions/checkout@v4`, `actions/setup-node@v4` (permissions Contents/Metadata/Packages **read** sur le run inspecté). Pin SHA partiel (tag v4).  
Secrets CI : **NON LISTÉS** (valeurs interdites). Présence `STAGING_SSH_PRIVATE_KEY` documentée, non vérifiée.

Branche prod : `master` (runs). Protections : **403** GitHub Pro requis.  
Repo : `valentingoulven-creator/OnScen`.

## Artefact déployé

| Question | Réponse |
| -------- | ------- |
| SHA prod | **Inconnu** — `/opt/onscen` n’est pas un checkout git |
| Branche | Inconnue |
| Version fichier | Pas de `VERSION` / `CURRENT` |
| Date static | HTML prod `Last-Modified: Sat, 15 Aug 2026 15:56:34 GMT` |
| Correspondance mobile | AASA / public alignés 15/08 ; working tree local 16/08 **en avance** |

Rollback app : `dist.bak` / `public.bak` présents sur le VPS — **procédure non exercée** cette passe.  
Rollback DB : dump 14 j + script staging. **Restore non démontré.**

## Exploitation

| Sujet | Constat |
| ----- | ------- |
| Qui surveille | Cron VPS + GH Uptime (cassé) + fondateur email **supposé** |
| Qui intervient | Fondateur (single-operator, doc infra) |
| Qui décide rollback | **NON DÉFINI** formellement |
| Accès | Fondateur + agent (SSH) |
| Procédures | `commun/deploy/RUNBOOK-PROD.md` (non relu in extenso) |
| Logs | `pm2-logrotate` online |
| CDN / WAF | Absents |
| DNS prod | `onscen.com` → VPS (Caddy) |
| DNS staging | **Manquant** |

## RPO / RTO

| | Documenté | Démontré |
| | --------- | -------- |
| RPO | ≤ 24 h (`INFRA-ONSCEN.md`) | Dumps quotidiens **oui** |
| RTO | 30 min–2 h | **NON** — RECOVERY NON DÉMONTRÉE |

## Recommandation

Marqueur `REVISION` au deploy ; GitHub Pro ou rulesets ; CI verte ; DNS staging ; **restore drill** (P0-01).
