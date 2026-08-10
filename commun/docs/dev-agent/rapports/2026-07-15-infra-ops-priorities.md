# Rapport Dev Agent — 2026-07-15 — Priorités infra ops

**Agent :** @onscen-dev-agent  
**Date :** 2026-07-15  
**Durée estimée :** 1 h  
**Statut global :** ⚠️ Partiel (doc + scripts ; exécution dashboard/SSH manuelle)

---

## Mission

Transformer les 10 recommandations infra (Cloudflare CDN, ACRCloud, backup, monitoring, nettoyage) en documentation actionnable et corriger la doc `/opt/onscen` → `/opt/soundily`.

---

## Contexte / problème

Demande fondateur avec priorités P1–P5 issues de l'audit infra/APIs externes. La plupart des actions sont **hors repo** (DNS Cloudflare, comptes tiers, SSH VPS) — le code ACRCloud et les scripts backup existent déjà ; il manquait des runbooks cohérents.

---

## Actions réalisées

- [x] Guide Cloudflare CDN/WAF (`CLOUDFLARE-CDN-WAF.md`) — DNS proxifié, SSL Full Strict, cache rules, tests staging
- [x] Checklist maître `OPS-PRIORITIES.md` (P1–P5, effort, coût, commandes)
- [x] Script `setup-s3-user-uploads.sh` (distinct de `SCW_BUCKET` backups)
- [x] Correction chemins `/opt/soundily` dans INFRA-SOUNDY, ENVIRONNEMENTS, RUNBOOK, verify-scaleway-backup
- [x] `audit-external-env.cjs` — groupes services externes
- [x] Section infra dans `TODO-MANUAL.md`
- [x] Entrée `modification.txt` MODIF 1034

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/deploy/OPS-PRIORITIES.md` | Nouveau — checklist P1–P5 |
| `commun/deploy/CLOUDFLARE-CDN-WAF.md` | Nouveau — guide P1 détaillé |
| `commun/deploy/setup-s3-user-uploads.sh` | Nouveau — helper S3_BUCKET |
| `commun/docs/INFRA-ONSCEN.md` | Chemins + liens priorités |
| `commun/docs/ENVIRONNEMENTS.md` | Chemin VPS corrigé |
| `commun/deploy/RUNBOOK-PROD.md` | Chemins + liens guides |
| `commun/deploy/verify-scaleway-backup.sh` | Chemins corrigés |
| `commun/scripts/audit-external-env.cjs` | Path défaut + groupe orphan |
| `TODO-MANUAL.md` | Tableau priorités infra |
| `modification.txt` | MODIF 1034 |

---

## Commandes exécutées

```text
(aucun build/test — changements documentation et scripts shell uniquement)
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Build frontend | Non requis |
| Tests backend | Non requis |
| Revue cohérence chemins VPS | ✅ onscen-root.sh + deploy PS1 alignés |

---

## modification.txt

- [x] MODIF 1034 ajoutée

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| P1 Cloudflare | Changer DNS / proxy sur dashboard (½ j) |
| P2 ACRCloud | Créer compte + renseigner `.env` prod |
| P3 Staging crons | `ssh onscen-staging` + install-backup-cron ×3 |
| P3 PG Scaleway | Console → vérifier backup + test restore trimestriel |
| P3 S3 uploads | Bucket + clés + `pm2 reload` |
| P4 Uptime | UptimeRobot free sur `/health` |
| P5 `.env` | `audit-external-env.cjs` sur VPS — clés sans référence code |

---

## Prochaines étapes

1. Exécuter P1 sur **staging** en premier (`CLOUDFLARE-CDN-WAF.md`).
2. SSH staging : installer les 3 crons backup (15 min).
3. Activer ACRCloud avant fin essai 14 j si uploads musicaux en prod.
4. UptimeRobot sur prod + staging.

---

*Généré par OnScen Dev Agent*
