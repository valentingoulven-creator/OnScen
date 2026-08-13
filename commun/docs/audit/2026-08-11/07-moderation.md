# Phase 7 — Modération de contenu

**Date :** 2026-08-10  
**Périmètre :** `sightengine*`, `contentModeration`, `liveContentSampling.ts`, `contentReports.ts`, `chatModerationPolicy.ts`

> **🔄 Rafraîchissement 2026-08-11 (soir)** : aucun changement de modération identifié depuis ce matin. Point de vigilance indirect : l'ouverture des inscriptions publiques (`ACCESS_REGISTRATION_MODE=open`, cf. [06-ddos](./06-ddos.md)) augmente le volume potentiel de nouveaux comptes/contenus à modérer — aucune mesure de scaling modération spécifique identifiée en réaction à ce changement.

---

## 7.1 Modération automatisée UGC (images / vidéos / reels)

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Fournisseur | Sightengine si `SIGHTENGINE_API_*` | faible | Activer prod + budget |
| Modèles | Défaut : nudity, offensive + **gore, weapon, face-age** (post-audit MOD-1/MOD-8) | faible | Ajuster seuils via env |
| Vidéo upload | Scan sync / frames (`sightengineModeration.ts`) | faible | — |
| Sponsors | Scan sponsors ajouté (modification.txt MOD) | faible | Vérifier en prod |
| Reels commentaires | Filtre texte ajouté post-audit (`chatTextFilter` / policy reels — vérifier couverture route) | **moyen** | Test E2E commentaire toxique |

---

## 7.2 Modération live (temps réel)

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Chat live | Filtre lexique + modération policy ; suppression messages | faible | — |
| Vidéo live | **`liveContentSampling.ts`** : frame Cloudflare toutes **60 s** par défaut ; coupe stream + alerte | **moyen** | Réduire intervalle sur lives « sensitive » ; couvrir LiveKit egress |
| LiveKit pur | **Non couvert** par échantillonnage (doc explicite) | **élevé** | Egress + modération ou restreindre live caméra aux comptes vérifiés |
| Latence | Jusqu’à 60 s avant détection frame | **élevé** | Ne pas présenter comme « modération temps réel continue » |

---

## 7.3 Signalement utilisateur

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| UI | Bouton Signaler + catégories incl. `csam_risk`, `illegal` | faible | — |
| Priorité | `URGENT_REPORT_CATEGORIES`, `computeReportPriority` | faible | — |
| Notification admin | Alertes email signalements urgents (post-audit) | faible | SLA modération |
| Délais CGU | 24 h graves / 7 j ouvrés autres — texte légal | **moyen** | KPI admin dashboard |

---

## 7.4 Escalade humaine

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Admin | `AdminReportsTab`, actions suspend/ban | faible | Former modérateurs |
| Runbook | `RUNBOOK-CSAM.md` **brouillon** — validation avocat pending | **élevé** | Valider avec avocat + exercice tabletop |
| PHAROS / NCMEC | Procédure décrite runbook §4 — **pas d’outil hash-matching** | **critique** | PhotoDNA/Thorn ou partenariat ; ne pas se limiter à Sightengine |

---

## 7.5 CSAM — détection & obligations légales

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Détection auto | Combinaison `face-age` + nudité → bloc + `csam_risk_detected` | **moyen** | Faux positifs / faux négatifs — pas substitut hash DB |
| Hash matching | **Absent** (PhotoDNA, NCMEC CyberTipline API) | **critique** | Évaluer fournisseur reconnu ; conservation preuves encadrée |
| Signalement autorités | Runbook mentionne PHAROS (FR) / NCMEC (US) — process **non exécuté/testé** | **critique** | Désigner référent légal ; log horodaté chaque signalement |
| Preuve | Rapports JSONL `content-reports` — ne pas supprimer avant procédure | faible | Chiffrement accès admin |

---

## 7.6 Synthèse phase 7

Progrès **significatifs depuis 2026-08-07** (live frames CF, CSAM heuristique, alertes). Lacunes **critiques** : **hash-matching CSAM**, **live WebRTC non scanné**, **runbook non validé**, **latence échantillonnage**.
