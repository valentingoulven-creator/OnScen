# Descriptions des figures pour dessinateur / mandataire

> Diagrammes Mermaid fournis comme base — à convertir en figures noir et blanc conformes INPI (références numérales, pas de couleur obligatoire).

---

## Fig. 1 — Architecture globale du système

**Description :** Vue d'ensemble montrant le serveur de coordination (100), les salons (200), les clients hôte (220) et auditeurs (230), le module cartographique (500) et le relais WebRTC (700).

```mermaid
flowchart TB
    subgraph Serveur["100 — Serveur de coordination"]
        DB[(État salons / lives)]
        SIO[Socket.IO]
        GEO[API /geo/nearby]
    end

    subgraph Clients["300 — Clients"]
        H["220 — Hôte"]
        A1["230 — Auditeur 1"]
        A2["230 — Auditeur 2"]
        MAP["500 — Carte + petit salon 410"]
    end

    subgraph Live["700 — WebRTC"]
        SIG[Signalisation Socket.IO]
        P2P[Mesh P2P vidéo]
    end

    H <-->|sync_playback / playback_sync| SIO
    A1 <-->|join_salon / playback_sync| SIO
    A2 <-->|join_salon / playback_sync| SIO
    MAP <-->|nearby + join_salon| GEO
    MAP <-->|playback_sync| SIO
    H <-->|live_webrtc_signal| SIG
    A1 <-->|ICE / SDP| P2P
    H <-->|ICE / SDP| P2P
    SIO --- DB
    GEO --- DB
```

**Éléments à légender :** 100, 200, 210 (room), 220, 230, 300, 410, 500, 700.

---

## Fig. 2 — Structure PlaybackState et horloge (250, 260)

**Description :** Schéma de l'état de lecture et formule de calcul de position.

```mermaid
flowchart LR
    subgraph PS["250 — PlaybackState"]
        PM["progressMs"]
        SA["startedAt"]
        UA["updatedAt"]
        IP["isPlaying"]
        TID["trackId / métadonnées"]
    end

    subgraph CALC["260 — computePlaybackPositionMs"]
        Q{isPlaying ?}
        P1["position = progressMs"]
        P2["position = progressMs + (now - anchor)"]
    end

    PS --> CALC
    Q -->|non| P1
    Q -->|oui| P2
    SA -.->|ancre prioritaire| P2
    UA -.->|ancre secondaire| P2
```

---

## Fig. 3 — Séquence de synchronisation hôte → auditeurs

**Description :** Chronologie des messages lors d'un seek / play par l'hôte.

```mermaid
sequenceDiagram
    participant H as 220 Hôte
    participant S as 100 Serveur
    participant A as 230 Auditeur

    H->>S: sync_playback (patch horloge)
    S->>S: fusion état 250
    S->>H: playback_sync (broadcast)
    S->>A: playback_sync
    A->>A: mergeRemotePlaybackState 280
    A->>A: computePlaybackPositionMs 260
    loop toutes les 1200 ms
        A->>A: comparer lecteur local vs cible
        A->>A: seek si dérive > seuil
    end
    loop heartbeat hôte 4000 ms
        H->>H: si lecteur en avance > marge
        H->>S: sync_playback (reportHostProgress)
        S->>A: playback_sync
    end
```

---

## Fig. 4 — Module de fusion d'état (280)

**Description :** Décision remplacement total vs mise à jour métadonnées seules.

```mermaid
flowchart TD
    IN["État distant reçu"] --> CHK["shouldResetPlaybackFromInitial"]
    CHK -->|trackId différent| RST["Remplacer état local"]
    CHK -->|isPlaying différent| RST
    CHK -->|startedAt différent| RST
    CHK -->|pause + progressMs différent| RST
    CHK -->|updatedAt + horloge différente| RST
    CHK -->|métadonnées seules| META["Conserver horloge locale<br/>Mettre à jour title, showVideo, etc."]
    RST --> OUT["État client synchronisé"]
    META --> OUT
```

---

## Fig. 5 — Correction de dérive lecteur YouTube (300, 320, 330)

**Description :** Boucles auditeur et hôte dans SalonYouTubePlayer.

```mermaid
flowchart TB
    subgraph Auditeur["230 — Boucle 320"]
        T1["Calcul targetSec depuis 260"]
        T2["Lecture currentTime IFrame 310"]
        T3{|écart| > DRIFT_SEC ?}
        T4["seekTo(targetSec)"]
        T5["play/pause selon isPlaying"]
    end

    subgraph Hote["220 — Heartbeat 330"]
        H1["currentTime si PLAYING"]
        H2{"ms > expected + LEAD_MS ?"}
        H3["reportHostProgress → serveur"]
    end

    T1 --> T2 --> T3
    T3 -->|oui| T4 --> T5
    T3 -->|non| T5
    H1 --> H2
    H2 -->|oui| H3
```

---

## Fig. 6 — Petit salon (410) et grand salon (420)

**Description :** Transition UI sans rupture de session socket.

```mermaid
stateDiagram-v2
    [*] --> Carte: Utilisateur sur carte 500
    Carte --> PetitSalon: Clic salon / personne
    PetitSalon --> GrandSalon: Bouton Salon / plein écran
    GrandSalon --> PetitSalon: Chevron ↓ RoomTheaterLayout
    PetitSalon --> Carte: Fermer sheet

  note right of PetitSalon
    join_salon actif
    MapSalonListenSheet
    useSalonPlaybackSync
  end note

  note right of GrandSalon
    même salonId
    SalonPage + chat + queue
    même hook sync
  end note
```

---

## Fig. 7 — Confidentialité géolocalisation (520)

**Description :** Sélection des coordonnées exposées selon le viewer.

```mermaid
flowchart TD
    REQ["Requête carte / nearby"] --> WHO{"viewerId == sujet ?"}
    WHO -->|oui| PRE["Coordonnées précises"]
    WHO -->|non| CITY{"locationPrecision == city ?"}
    CITY -->|oui| CEN["Centroïde ville resolveCityCoordinates"]
    CITY -->|non| BLU["Coordonnées floues blurCoordinate ~50m"]
    PRE --> OUT["Position affichée"]
    CEN --> OUT
    BLU --> OUT
```

---

## Fig. 8 — Live WebRTC + playback parallèle (700)

**Description :** Deux canaux : signalisation vidéo P2P et bus musical Socket.IO.

```mermaid
flowchart LR
    subgraph Socket["100 — Socket.IO"]
        RS["room salon_{id}"]
        RL["room live_{id}"]
        RU["room user_{id}"]
    end

  H["220 Hôte"] -->|playback_sync via broadcastSalonPlayback| RS
  H -->|playback_sync| RL
  H -->|offer / ice| RU
  V["230 Spectateur"] -->|viewer_ready| Socket
  RU -->|relay validateLiveWebrtcSignal| V
  V <-->|RTP média P2P| H
  RS -->|état musical 250| V
```

---

## Liste des figures pour dépôt INPI

| N° | Titre suggéré | Format |
|---|---|---|
| Fig. 1 | Architecture globale | Schéma bloc |
| Fig. 2 | État de lecture et horloge | Schéma données |
| Fig. 3 | Séquence synchronisation | Diagramme séquence |
| Fig. 4 | Fusion d'état client | Organigramme |
| Fig. 5 | Correction de dérive | Organigramme |
| Fig. 6 | Modes petit/grand salon | Diagramme états |
| Fig. 7 | Confidentialité géographique | Organigramme |
| Fig. 8 | Live WebRTC et playback | Schéma bloc |

**Consignes dessin :** traits continus, références numérales (100, 220…), pas de capture d'écran couleur obligatoire ; les captures UI peuvent compléter en annexe.

---

*Les diagrammes Mermaid peuvent être rendus via [mermaid.live](https://mermaid.live) pour export PNG/SVG.*
