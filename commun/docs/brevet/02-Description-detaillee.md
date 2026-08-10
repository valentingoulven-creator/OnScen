# Description détaillée de l'invention

> **Brouillon technique** structuré selon les usages de description de brevet  
> Application : Soundly / OnScen — juin 2026

---

## Domaine technique

La présente invention concerne le domaine de la **synchronisation d'état de lecture multimédia** sur réseau, en particulier pour des terminaux clients exécutant chacun un lecteur local (navigateur web, application mobile), combinée à une **visualisation géospatiale** de sessions d'écoute et à un **relais vidéo en direct** entre pairs.

---

## État de la technique (background art)

Les systèmes connus de partage musical en ligne permettent :

- la diffusion unidirectionnelle (streaming radio, live vidéo) ;
- l'écoute synchronisée dans un écosystème fermé (ex. session propriétaire d'un seul service) ;
- la synchronisation vidéo par URL partagée et contrôle centralisé du timestamp.

Ces approches présentent des limitations techniques :

1. **Dérive temporelle** : lorsque chaque client exécute son propre lecteur (API YouTube, application Spotify), les horloges locales divergent ; les corrections brutales provoquent des artefacts audiovisuels.

2. **Mises à jour d'état hétérogènes** : un serveur peut envoyer des patches partiels (métadonnées, indicateur vidéo) qui ne doivent pas réinitialiser la base temporelle de synchronisation.

3. **Contraintes d'autoplay** : les navigateurs imposent des politiques d'autoplay ; les auditeurs peuvent être en pause locale tout en devant rester alignés sur l'état global.

4. **Absence d'intégration carte + sync + live** : les cartes sociales géolocalisées n'exposent pas typiquement un état de lecture synchronisable rejoignable en mode compact puis en mode immersif sans rupture de session.

---

## Exposé de l'invention (summary)

L'invention propose un **système** comprenant :

- un **serveur de coordination** (100) maintenant pour chaque salon d'écoute (200) un état de lecture structuré ;
- une pluralité de **clients** (300) connectés via canal temps réel bidirectionnel ;
- un module de **calcul de position** dérivant la position courante à partir d'une horloge ancrée ;
- un module de **fusion d'état** distinguant les modifications temporelles des modifications de métadonnées ;
- un module de **correction de dérive** côté lecteur multimédia ;
- un module de **cartographie** affichant les salons selon des coordonnées à confidentialité graduée ;
- optionnellement, un **relais WebRTC** (400) pour flux vidéo hôte avec signalisation validée.

L'invention permet une écoute synchronisée **sans re-streaming audio serveur**, en s'appuyant sur la propagation d'un état d'horloge léger.

---

## Brève description des dessins

| Fig. | Titre | Référence |
|---|---|---|
| Fig. 1 | Architecture globale serveur-clients | `05-Figures-description.md` §1 |
| Fig. 2 | Structure de l'état PlaybackState et horloge | §2 |
| Fig. 3 | Séquence synchronisation hôte → auditeurs | §3 |
| Fig. 4 | Fusion d'état distant (merge) | §4 |
| Fig. 5 | Correction de dérive lecteur YouTube | §5 |
| Fig. 6 | Petit salon / grand salon — transitions UI | §6 |
| Fig. 7 | API géographique et confidentialité | §7 |
| Fig. 8 | Live WebRTC + playback parallèle | §8 |

---

## Description détaillée

### 1. Architecture serveur (100)

Le serveur (100) implémente une couche Socket.IO (`setupSockets`) gérant des **rooms** nommées :

- `salon_{salonId}` — auditeurs d'un salon ;
- `live_{liveId}` — spectateurs d'un live ;
- `user_{userId}` — signalisation WebRTC point à point.

Lors d'un événement `join_salon`, le serveur (100) :

1. vérifie les droits (`canJoinSalon`, bannissements) ;
2. incrémente `listenersCount` ;
3. émet immédiatement `playback_sync` et `salon_playback` avec l'état courant ;
4. émet la file d'attente `salon_queue_updated`.

Seul l'**hôte** (identifié par `hostId`) peut émettre `sync_playback`. Le serveur fusionne le patch, met à jour `startedAt` / `updatedAt` selon les champs touchés, puis appelle `broadcastSalonPlayback`.

**Réf. numérales :** serveur 100, salon 200, room 210, hôte 220, auditeur 230.

### 2. État de lecture PlaybackState (250)

L'état (250) comprend au minimum :

| Champ | Rôle |
|---|---|
| `progressMs` | Position de référence en millisecondes |
| `startedAt` | Timestamp de début de segment en lecture |
| `updatedAt` | Timestamp de dernière mutation |
| `isPlaying` | Indicateur lecture / pause |
| `trackId` | Identifiant plateforme (ex. vidéo YouTube) |
| `platform` | `spotify` \| `youtube` |
| `showVideo` | Affichage vidéo (conformité YouTube) |

**Calcul de position (module 260)** — fonction `computePlaybackPositionMs` :

```
SI isPlaying = faux :
    positionMs ← max(0, progressMs)
SINON :
    ancre ← startedAt SI défini SINON updatedAt
    positionMs ← max(0, progressMs + (now - ancre))
```

Ce calcul est exécuté **côté serveur et côté chaque client** (300), permettant une interpolation locale entre deux messages réseau.

**Transitions d'horloge :**

- **Reprise** (`playbackStateAtResume`) : fige `progressMs` à la position courante, pose `startedAt = now`.
- **Pause** (`playbackStateAtPause`) : fige `progressMs`, efface `startedAt`.
- **Seek** (`playbackStateAtSeek`) : met à jour `progressMs`, réancre `startedAt` si en lecture.

### 3. Propagation réseau (270)

Lors d'une modification hôte, le client hôte (220) émet :

```json
{ "salonId": "...", "playbackState": { "patch partiel" } }
```

Le serveur (100) fusionne avec l'état existant. Si les champs d'horloge sont touchés (`progressMs`, `startedAt`, `isPlaying`, `updatedAt`, `trackId`), il normalise `updatedAt` et `startedAt` (effacement de `startedAt` en pause).

`broadcastSalonPlayback` émet vers `salon_{id}` et, si un live actif partage l'identifiant, vers `live_{id}` — garantissant la cohérence musique entre spectateurs live et auditeurs salon.

### 4. Module de fusion côté client (280)

Fonction `mergeRemotePlaybackState(local, remote)` :

1. Appelle `shouldResetPlaybackFromInitial(local, remote)`.
2. Si changement de piste, play/pause, seek (`startedAt`, `progressMs` en pause, `updatedAt` avec horloge différente) → **remplace** l'état local par `remote`.
3. Sinon → conserve l'horloge locale, met à jour uniquement métadonnées (`title`, `artist`, `albumArtUrl`, `showVideo`, etc.).

**Effet technique :** évite un désalignement lors d'un patch serveur qui ne concerne que l'affichage vidéo (`showVideo: true` imposé en production YouTube).

### 5. Hook de synchronisation client (290)

`useSalonPlaybackSync` :

- souscrit à `playback_sync` / `salon_playback` ;
- met à jour `displayPositionMs` toutes les 500 ms via `computePlaybackPositionMs` ;
- expose `play`, `pause`, `seek`, `reportHostProgress` (hôte seulement).

Pour l'hôte, les événements distants sont fusionnés sans reset si `shouldResetPlaybackFromInitial` est faux — évitant les conflits lorsque le serveur renvoie l'état echo.

### 6. Module lecteur et correction de dérive (300)

`SalonYouTubePlayer` instancie un lecteur IFrame API (310).

**Boucle auditeur (320)** — intervalle ~1200 ms (600 ms si onglet masqué) :

1. calcule `targetSec = computePlaybackPositionMs(state) / 1000` ;
2. lit `current = player.getCurrentTime()` ;
3. si `|current - targetSec| > DRIFT_SEC` → `seekTo(targetSec)` ;
4. si autoplay autorisé et `isPlaying` → `playVideo()`, sinon pause + mute.

**Heartbeat hôte (330)** — intervalle ~4000 ms :

1. si lecteur en `PLAYING` ;
2. `ms = floor(getCurrentTime() * 1000)` ;
3. `expected = computePlaybackPositionMs(state)` ;
4. **seulement si** `ms > expected + HOST_PROGRESS_LEAD_MS` → `reportHostProgress(ms)` qui réémet un `playbackStateAtSeek` vers le serveur.

Cette asymétrie évite que des corrections en retard de l'hôte ne tirent continuellement l'horloge globale vers l'arrière.

### 7. Interface double mode petit/grand salon (400)

**Petit salon (410)** — composants `MapSalonListenSheet`, `MapSalonListenControls` :

- affiché en surcouche carte (bottom sheet) ;
- maintient `join_salon` actif ;
- lecteur compact avec contrôles pause/volume ;
- bouton « Salon » ouvrant le grand salon.

**Grand salon (420)** — `SalonPage` + `RoomTheaterLayout` :

- vidéo plein cadre, chat, file d'attente, propositions ;
- bouton chevron ↓ (`RoomTheaterLayout`) réduit vers petit salon **sans** `leave_salon`.

**Transition (430)** : le même `salonId` et le même hook `useSalonPlaybackSync` garantissent que le changement de layout ne réinitialise pas la room socket ni l'état `PlaybackState`.

### 8. Module cartographique (500)

**Endpoint** `GET /api/geo/nearby` (510) :

- entrées : `latitude`, `longitude`, `radius`, `distanceFilter` ;
- sorties : listes `salons`, `lives`, `people` triées par distance.

**Confidentialité (520)** — `getPublicMapCoords(user, precise, blurred, viewerId)` :

- si `viewerId === user.id` → coordonnées précises ;
- si `locationPrecision === 'city'` → centroïde ville (`resolveCityCoordinates`) ;
- sinon → coordonnées floues `blurredLatitude/Longitude` (offset pseudo-aléatoire ~50 m via `blurCoordinate`).

Chaque salon (200) expose sur la carte : titre, plateforme, `listenersCount`, `playbackState` pour écoute immédiate.

### 9. Résolution cross-plateforme (600)

Route `GET /salons/:id/resolve-track?platform=` (610).

`resolveTrackForPlatform(title, artist, targetPlatform, hostPlatform, hostTrackId)` :

1. si plateformes identiques et `hostTrackId` valide → match `exact` ;
2. sinon recherche catalogue interne `findMockMatch` → `mock` ;
3. sinon URL de recherche plateforme → `search`.

Le client auditeur utilise `preferredParticipantPlatform` pour choisir YouTube ou Spotify selon les comptes connectés.

### 10. Live vidéo WebRTC (700)

**Signalisation (710)** — événements Socket.IO :

- `live_webrtc_viewer_ready` → serveur notifie hôte `live_webrtc_viewer_joined` ;
- `live_webrtc_signal` { type: offer|answer|ice, toUserId, payload } → relayé si `validateLiveWebrtcSignal` OK.

Règles de validation (720) :

- `offer` : uniquement hôte → spectateur ;
- `answer` : spectateur → hôte ;
- `ice` : hôte↔spectateur uniquement.

**Mesh (730)** : l'hôte (220) maintient une `RTCPeerConnection` par spectateur, limite 30 (`LIVE_WEBRTC_MESH_VIEWER_LIMIT`).

Le flux musical reste synchronisé par l'horloge (250), indépendamment du flux vidéo P2P.

### 11. File d'attente et propositions (800)

- `SalonQueueItem` : pistes en attente ;
- `SalonTrackProposal` : suggestions des auditeurs, modération hôte ;
- `hostSkipNext`, `enqueueItem`, `resolveTrackFromProposal` mettent à jour `playbackState` et broadcast.

---

## Exemples de modes de réalisation supplémentaires

### Embodiment A — Scaling production

Remplacement du stockage mémoire par PostgreSQL ; adaptateur Redis pour Socket.IO multi-workers (`msdev/SCALABILITY.md`). L'horloge (250) et les algorithmes (260–330) restent inchangés.

### Embodiment B — Plateforme hôte Spotify

L'hôte contrôle via lien Spotify Jam (`spotifyJamUrl`) ; les auditeurs sans Spotify utilisent la résolution (600) vers YouTube avec sync sur horloge (250).

### Embodiment C — Live autonome sans salon

`Live.salonId` optionnel ; live géolocalisé sur carte ; WebRTC (700) + `playbackState` propre au live.

---

## Références numérales récapitulatives

| Réf. | Élément |
|---|---|
| 100 | Serveur de coordination |
| 200 | Salon d'écoute |
| 210 | Room Socket.IO |
| 220 | Client hôte |
| 230 | Client auditeur |
| 250 | État PlaybackState |
| 260 | Module calcul de position |
| 270 | Propagation broadcast |
| 280 | Module fusion d'état |
| 290 | Hook synchronisation client |
| 300 | Module lecteur multimédia |
| 310 | API IFrame YouTube |
| 320 | Boucle correction dérive auditeur |
| 330 | Heartbeat hôte |
| 400 | Interface double mode |
| 410 | Petit salon (carte) |
| 420 | Grand salon (théâtre) |
| 500 | Module cartographique |
| 600 | Résolution cross-plateforme |
| 700 | Relais WebRTC live |

---

*Description préparatoire — les numéros de référence sont pour usage interne et dessins ; un mandataire les harmonisera avec les figures officielles.*
