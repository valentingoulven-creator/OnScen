# Déclaration d'invention — Soundly / OnScen

> **Formulaire de divulgation** — à compléter par l'inventeur avant consultation CPI  
> **Statut :** BROUILLON — champs `[À COMPLÉTER]` à renseigner

---

## 1. Identification

| Champ | Valeur |
|---|---|
| **Titre provisoire de l'invention** | Système de synchronisation d'écoute musicale multi-clients avec cartographie géolocalisée et relais audiovisuel en direct |
| **Nom commercial** | Soundly / OnScen |
| **Inventeur(s)** | `[À COMPLÉTER : nom, prénom, adresse, nationalité]` |
| **Demandeur / titulaire envisagé** | `[À COMPLÉTER : personne physique ou morale, SIREN si société]` |
| **Date de conception** | `[À COMPLÉTER]` |
| **Date de première divulgation publique** | `[À COMPLÉTER — CRITIQUE]` |

### ⚠️ Alerte nouveauté

Si l'application a déjà été :

- publiée sur un store (App Store, Play Store, PWA publique) ;
- présentée en démo ouverte (réseaux sociaux, YouTube, pitch investisseurs non confidentiel) ;
- hébergée sur un dépôt Git **public** ;

→ la **nouveauté** pour un brevet européen est probablement **compromise** pour tout ce qui était divulgué. Indiquer les dates exactes. Envisager **e-Soleau immédiat** pour horodater les évolutions futures.

---

## 2. Domaine technique

L'invention relève des domaines :

- **traitement de données** et synchronisation d'état distribué en temps réel ;
- **réseaux de communication** (WebSocket / Socket.IO, signalisation WebRTC) ;
- **interfaces homme-machine** pour terminaux mobiles et web ;
- **géolocalisation** avec préservation de la vie privée ;
- **intégration de lecteurs multimédias tiers** (API YouTube IFrame, liens Spotify) sans redistribution du flux audio centralisé.

---

## 3. Problème technique résolu

### 3.1 Contexte

Les services de streaming musical (Spotify, YouTube Music) et les plateformes sociales (Discord, Twitch) permettent l'écoute ou la diffusion, mais :

1. **Pas de synchronisation fine** entre clients hétérogènes utilisant chacun leur propre lecteur local (dérive temporelle, latence réseau, politiques d'autoplay navigateur).
2. **Pas d'association native** entre une **carte géographique** de sessions d'écoute actives et un **mode d'écoute synchronisé** continuable en interface compacte puis plein écran.
3. **Pas de combinaison** dans un même flux : écoute synchronisée + chat + live vidéo hôte (WebRTC) + file d'attente collaborative, avec **résolution de piste** lorsque l'auditeur utilise une plateforme différente de l'hôte.

### 3.2 Problème technique (formulation brevet)

Comment maintenir, sur un réseau à latence variable et des terminaux aux capacités d'autoplay différentes, une **position de lecture cohérente** entre un hôte et N auditeurs **sans serveur de mixage audio**, tout en permettant une **transition fluide** entre une interface cartographique compacte (« petit salon ») et une interface immersive (« grand salon »), et en relayant optionnellement un **flux vidéo hôte** vers les spectateurs via WebRTC ?

---

## 4. Solution technique (description synthétique)

### 4.1 Horloge de lecture partagée (cœur de la synchronisation)

État `PlaybackState` propagé via Socket.IO :

- `progressMs` : position ancrée ;
- `startedAt` : horodatage de reprise en lecture ;
- `updatedAt` : horodatage de dernière modification ;
- `isPlaying`, `trackId`, métadonnées.

**Position calculée côté client :**

```
positionMs = progressMs + (now - (startedAt ?? updatedAt))   si isPlaying
positionMs = progressMs                                       sinon
```

Implémentation : `backend/src/lib/playbackClock.ts`, `app/src/lib/salonPlayback.ts`.

### 4.2 Fusion d'état sans reset d'horloge

Fonction `mergeRemotePlaybackState` : applique les mises à jour distantes **sans réinitialiser l'horloge** lorsque seules les métadonnées changent (ex. `showVideo`, titre, pochette). Évite les sauts de position lors de patches non temporels.

### 4.3 Correction de dérive côté lecteur

- **Auditeurs** : boucle périodique (~1,2 s) comparant position YouTube locale vs position calculée ; seek si écart > seuil (`DRIFT_SEC`).
- **Hôte** : heartbeat `reportHostProgress` — n'avance l'horloge serveur que si le lecteur local est **en avance** de plus de `HOST_PROGRESS_LEAD_MS` sur la position attendue (évite les resets cycliques ~1 s).

### 4.4 Architecture « petit salon » / « grand salon »

- **Petit salon** (`MapSalonListenSheet`, `MapSalonListenControls`) : écoute synchronisée depuis la carte, contrôles compacts, maintien de la session Socket.IO `join_salon`.
- **Grand salon** (`SalonPage`, `RoomTheaterLayout`) : même `salonId`, même état de lecture, UI théâtre plein écran ; réduction via chevron ↓ vers le petit salon **sans quitter la room**.

Effet recherché : continuité de synchronisation lors du changement de présentation UI (problème technique d'état client, pas simple choix graphique).

### 4.5 Carte géolocalisée et API de proximité

Endpoint `GET /api/geo/nearby` :

- agrège **salons**, **lives actifs** et **personnes** dans un rayon ;
- applique `getPublicMapCoords` : coordonnées précises pour soi-même, **floues** (~50 m via `blurCoordinate`) ou **ville seule** pour les autres ;
- retourne `playbackState` pour écoute depuis la carte.

### 4.6 Live + WebRTC + synchronisation musique parallèle

- Signalisation Socket.IO : `live_webrtc_viewer_ready`, `live_webrtc_signal`, validation `validateLiveWebrtcSignal` (offers hôte→spectateur uniquement).
- Mesh P2P hôte→spectateurs (limite `LIVE_WEBRTC_MESH_VIEWER_LIMIT = 30`).
- **Même horloge de lecture** diffusée aux rooms `salon_{id}` et `live_{id}` via `broadcastSalonPlayback`.

### 4.7 Résolution cross-plateforme

`resolveTrackForPlatform` : pour un auditeur sur plateforme différente de l'hôte, résolution titre/artiste → `trackId` cible (exact, catalogue mock, ou URL de recherche).

---

## 5. Effet technique revendiqué (à valider par CPI)

| Effet | Mécanisme |
|---|---|
| Réduction de dérive inter-clients | Horloge ancrée + correction périodique + heartbeat hôte unidirectionnel |
| Stabilité lors de mises à jour partielles | `mergeRemotePlaybackState` / `shouldResetPlaybackFromInitial` |
| Continuité d'écoute lors du changement de mode UI | Session socket persistante + double vue petit/grand salon |
| Confidentialité géolocalisation | Coordonnées floues / ville + précision pour le sujet seul |
| Synchronisation musique + vidéo live découplée | Bus Socket.IO distinct pour WebRTC et playback |

---

## 6. État de l'art et différenciation

| Produit / service | Similitudes | Différences techniques OnScen |
|---|---|---|
| **Spotify** / Jam | Écoute partagée | Jam = écosystème Spotify fermé ; pas de carte géo + double UI ; pas de YouTube natif |
| **Discord** | Activités, voix, écran | Pas de salons géolocalisés synchronisés sur carte ; sync via activités tierces |
| **Twitch** | Live + chat | Flux centralisé RTMP ; pas d'écoute Spotify/YouTube synchronisée multi-plateforme locale |
| **TikTok** | Live, carte | Pas de salons d'écoute synchronisée hôte/auditeurs avec horloge partagée |
| **Watch2Gether** / **Teleparty** | Sync vidéo | Sync par URL unique ; pas de géolocalisation ; pas de WebRTC hôte intégré |
| **Zenly** / **Snap Map** | Carte sociale | Pas de synchronisation de lecture musicale |

**Note honnête :** chaque brique prise isolément a des antécédents. La **combinaison** et les **algorithmes de sync** doivent être validés par recherche d'antériorité.

---

## 7. Modes de réalisation (embodiments)

### 7.1 Embodiment principal (implémenté)

- Backend Node.js + Socket.IO (`backend/src/socket.ts`)
- Frontend React PWA (`app/src/`)
- Plateformes musicales : YouTube (IFrame API), Spotify (liens / Jam URL)
- Stockage : mémoire (msdev) — **production** : PostgreSQL + Redis documenté dans `msdev/SCALABILITY.md`

### 7.2 Variantes envisageables

- Autres plateformes (Apple Music, Deezer) via même mécanisme `resolveTrackForPlatform`
- Serveur TURN pour WebRTC derrière NAT strict
- Adaptateur Redis Socket.IO pour scaling horizontal
- Seuil de dérive et intervalles adaptatifs selon RTT client

### 7.3 Données structurantes (schéma)

Entités clés : `Salon`, `Live`, `PlaybackState`, `SalonQueueItem`, `SalonTrackProposal` — voir `backend/src/models/schema.ts`.

---

## 8. Code source de référence (extraits)

| Composant | Fichier(s) |
|---|---|
| Horloge playback | `backend/src/lib/playbackClock.ts`, `app/src/lib/salonPlayback.ts` |
| Hook sync client | `app/src/hooks/useSalonPlaybackSync.ts` |
| Lecteur + dérive | `app/src/components/SalonYouTubePlayer.tsx` |
| Broadcast serveur | `backend/src/lib/salonPlaybackOps.ts`, `backend/src/socket.ts` |
| Géo + proximité | `backend/src/routes/geo.ts`, `backend/src/lib/nearbyPeople.ts` |
| Vie privée coords | `backend/src/lib/locationPrivacy.ts`, `backend/src/lib/geo.ts` |
| WebRTC live | `app/src/hooks/useLiveVideoRelay.ts`, `backend/src/lib/liveVideoRelay.ts` |
| Résolution piste | `backend/src/lib/trackResolver.ts` |
| UI petit/grand salon | `app/src/components/MapSalonListenSheet.tsx`, `app/src/pages/SalonPage.tsx`, `app/src/components/RoomTheaterLayout.tsx` |

---

## 9. Pièces jointes suggérées pour le CPI

- [ ] Extraits de code commentés (≤ 50 pages)
- [ ] Captures d'écran petit salon / grand salon / carte / live
- [ ] Diagrammes de `05-Figures-description.md`
- [ ] Résultats recherche antériorité (`06`)
- [ ] Chronologie des versions et divulgations

---

*Document préparatoire — ne pas déposer tel quel à l'INPI sans relecture professionnelle.*
