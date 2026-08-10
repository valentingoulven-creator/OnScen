# Phase 12 — Points supplémentaires

**Date :** 2026-08-10

---

## 12.1 Accessibilité (WCAG)

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| UI | Tailwind + composants custom ; quelques `aria-*` | **moyen** | Audit axe-core sur Auth, Feed, Live |
| Carte | Leaflet — accessibilité clavier limitée | **moyen** | Alternative liste nearby |
| Contraste | Thème sombre — non vérifié AA | **moyen** | Test tokens couleur |

---

## 12.2 Disaster recovery

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Plan | `RUNBOOK-PROD.md`, backups — pas de DR multi-région | **élevé** | RTO/RPO documentés + drill restore |
| msdev | Reset scripts locaux | faible | — |

---

## 12.3 Single points of failure (SPOF)

| Composant | Constat | Risque | Recommandation |
|-----------|---------|--------|----------------|
| 1 VPS backend | Documenté | **élevé** | Standby froid ou k8s futur |
| 1 instance PG | Prod+staging même host | **élevé** | Réplica read ou instance staging séparée |
| Redis local VPS | Socket + rate limit | **élevé** | Redis managé HA |
| PM1 worker | Volontaire | **élevé** | cf. phase 6 |

---

## 12.4 Comptes admin / backdoors

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| create-admin script | CLI contrôlé | faible | MFA admin obligatoire |
| msdev demo | Mots de passe connus msdev only | faible | — |
| Process `soundy-auth` fantôme | Mention audit consolidé prod | **élevé** | Inventaire processus PM2 prod + retirer si obsolète |
| Default admin | Pas de admin hardcodé prod | faible | — |

---

## 12.5 Rétention logs & connexion

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Diagnostic logs | Migration `018_app_diagnostic_logs` | faible | TTL job |
| Connexion IP/UA | Rétention partielle vs privacy 12 mois | **élevé** | Harmoniser |
| PM2 logs | Rotation disque | **moyen** | logrotate |

---

## 12.6 Licences open source

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| MIT/Apache majorité | package.json | faible | — |
| heic2any / libheif | LGPL chain (audit antérieur) | **moyen** | Avis juridique dynamic linking mobile |
| GPL | Scan non automatisé | **moyen** | `license-checker` CI |

---

## 12.7 Synthèse phase 12

Prioriser **DR testé**, **SPOF infra**, **rétention logs**, **review licences mobile**.
