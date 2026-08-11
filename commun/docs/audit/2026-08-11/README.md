# Audit technique OnScen (Soundy) — 2026-08-10 (rafraîchi 2026-08-11, correctifs 2026-08-11)

> **Emplacement :** `commun/docs/audit/2026-08-11/` (consolidé depuis la racine `audit/` le 2026-08-11).

Audit initialement **lecture seule** ; une session de correctifs a été menée le 2026-08-11 sur demande explicite du fondateur, limitée aux points techniquement actionnables sans décision légale/business ni opération infra irréversible.

**Rafraîchissement 2026-08-11 :** re-vérification `npm audit`, tests backend et plusieurs constats (mineurs/géo, captcha, Sentry mobile) sur l'état actuel du working tree (correctifs non commités depuis le 08-10).

**Correctifs 2026-08-11 (MODIF 1352) :** `jspdf` (C8), bug de build production bloquant découvert et corrigé, régression géo mineurs (E15, 95 % des comptes actifs concernés), vérifications/durcissements infra prod (Sightengine fail-closed, rétention logs, privilèges rôle DB, process `soundy-auth` supprimé). Voir [00-synthese.md](./00-synthese.md) pour le détail complet, le statut déployé/non déployé, et la liste des points **hors scope** (légal, business, infra à risque).

| Fichier | Phase |
|---------|--------|
| [00-synthese.md](./00-synthese.md) | Synthèse — risques critique & élevé |
| [01-stack.md](./01-stack.md) | Stack, dépendances, CI/CD, tests |
| [02-database.md](./02-database.md) | Schéma, perfs, backups, migrations |
| [03-postgis.md](./03-postgis.md) | Géolocalisation PostGIS / RGPD |
| [04-observabilite.md](./04-observabilite.md) | Sentry, logs, APM |
| [05-securite.md](./05-securite.md) | Auth, IDOR, injections, secrets |
| [06-ddos.md](./06-ddos.md) | CDN/WAF, rate limits, scaling |
| [07-moderation.md](./07-moderation.md) | NSFW, live, CSAM, signalements |
| [08-api-externes.md](./08-api-externes.md) | SaaS tiers, quotas, coûts |
| [09-cgu-rgpd.md](./09-cgu-rgpd.md) | CGU, privacy, cookies, suppression |
| [10-youtube.md](./10-youtube.md) | API YouTube & droits voisins |
| [11-legalite-globale.md](./11-legalite-globale.md) | DSA, mineurs, paiements, stores |
| [12-divers.md](./12-divers.md) | A11y, DR, SPOF, licences OSS |

Référence antérieure (même périmètre, 2026-08-07) : `commun/docs/audit/2026-08-audit-technique-complet/`.
