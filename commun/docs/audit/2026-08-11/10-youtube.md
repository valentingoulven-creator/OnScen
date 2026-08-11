# Phase 10 — Conditions d’utilisation YouTube

**Date :** 2026-08-10  
**Périmètre :** `lib/youtubeSearch.ts`, `platformConnect.ts`, `salons.ts`, player front, seeds

---

## 10.1 Extraction / téléchargement interdit

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| ytdl / download | **Aucune** librairie type ytdl-core active ; pistes servies via métadonnées + embed / URLs platform | faible | Garder guard CI interdisant ytdl |
| Stockage persistant | Pas de cache MP3 YouTube côté serveur pour lectures salon (compositions user = uploads séparés) | faible | — |
| Fallback historique | Code mort supprimé (audits antérieurs) | faible | — |

---

## 10.2 YouTube Data API

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Quotas | Recherche serveur limitée (`youtubeSearchLimiter`) | faible | Monitoring quota Google Cloud |
| Attribution | UI doit afficher lien/logo YouTube sur pistes — vérifier composants player | **moyen** | Audit UI salon / now playing |
| Player | iframe YouTube — ne pas modifier player chrome | faible | Pas d’overlay masquant branding |

---

## 10.3 OAuth YouTube / Google

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Mode Testing | Audit antérieur : app OAuth en testing → utilisateurs non listés bloqués | **élevé** | Passer en **Production** + verification Google |
| Scopes | Scopes minimaux documentés prodSaasCatalog | faible | Revue annuelle |

---

## 10.4 Musique YouTube dans reels / lives UGC

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Droits voisins | Lecture YouTube dans salon ≠ licence sync pour reel/live UGC avec overlay | **critique** (juridique) | Catalogues licenciés (ACRCloud identifie commercial — **bloquer** ou mute si non licencié) |
| ACRCloud | Détection empreinte — politique d’action à clarifier | **élevé** | Workflow : match → retrait audio / strike |
| Alternative | TikTok/Instagram utilisent deals labels — OnScen n’a pas équivalent documenté | **critique** | Stratégie licences SACEM/labels ou UGC sans musique protégée |

---

## 10.5 Synthèse phase 10

**Point fort technique :** pas de rip YouTube. **Risque majeur business/légal :** musique protégée dans UGC/live sans licence claire + OAuth Google en testing.
