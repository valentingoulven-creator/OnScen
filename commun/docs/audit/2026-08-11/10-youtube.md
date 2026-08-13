# Phase 10 — Conditions d’utilisation YouTube

**Date :** 2026-08-10  
**Périmètre :** `lib/youtubeSearch.ts`, `platformConnect.ts`, `salons.ts`, player front, seeds

> **🔄 Rafraîchissement 2026-08-11 (soir)** : voir §10.3 mis à jour — le problème OAuth Google est plus grave que « mode Testing » (client OAuth supprimé côté Google Cloud, probablement lié à la migration de domaine `onscen.com`).

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
| Client OAuth cassé | ⚠️ **Aggravation 08-11** : erreur `deleted_client` rapportée en prod — au-delà du mode « Testing » déjà signalé, le client OAuth semble avoir été supprimé/désynchronisé côté Google Cloud Console (probablement lors de la migration `getsoundy.com` → `onscen.com`). Bouton Google grisé côté frontend en prod (`googleOAuthDisabled`), donc pas d'erreur visible utilisateur, mais **connexion Google et YouTube indisponibles** | **élevé** | Recréer le client OAuth avec les redirect URIs `onscen.com`, passer en **Production** + vérification Google dans la même opération |
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

**Point fort technique :** pas de rip YouTube. **Risque majeur business/légal :** musique protégée dans UGC/live sans licence claire.

**Mise à jour 2026-08-11 (soir) :** le problème OAuth Google/YouTube s'est **aggravé** — de « mode Testing » à un client potentiellement supprimé (`deleted_client`), à traiter en priorité avant toute réactivation du bouton de connexion Google en prod.
