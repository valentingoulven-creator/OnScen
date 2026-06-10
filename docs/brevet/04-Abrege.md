# Abrégé

> **Limite INPI / EPO :** 150 mots maximum pour l'abrégé officiel.  
> **Comptage ci-dessous :** ~145 mots.

---

## Texte proposé

La invention concerne un système de synchronisation d'écoute multimédia entre un hôte et plusieurs auditeurs, sans re-streaming audio centralisé. Un serveur maintient un état de lecture comprenant une position de référence, un indicateur lecture/pause et des horodatages d'ancrage. Chaque client calcule localement une position courante à partir de cet état et d'une horloge locale. Les auditeurs corrigent périodiquement la position d'un lecteur multimédia local lorsque l'écart dépasse un seuil. L'hôte ne transmet une correction d'horodatage que si son lecteur local est en avance sur la position calculée, limitant les oscillations. Un module de fusion distingue les mises à jour temporelles des mises à jour de métadonnées. Des salons géolocalisés sont affichés sur une carte avec coordonnées à confidentialité graduée. Une interface compacte sur carte et une interface immersive partagent la même session de synchronisation. Un live vidéo optionnel utilise une signalisation WebRTC validée en parallèle de la diffusion de l'état musical.

---

## Version anglaise (pour recherche EPO / PCT éventuel)

*Draft abstract — not for filing without professional translation.*

The invention relates to a multi-client media playback synchronization system without centralized audio re-streaming. A server maintains a playback state comprising a reference position, a play/pause indicator, and anchor timestamps. Each client locally computes a current position from this state and a local clock. Listener clients periodically correct a local media player when drift exceeds a threshold. The host reports timestamp corrections only when its local player leads the computed position, reducing oscillation. A merge module distinguishes temporal updates from metadata-only updates. Geolocated listening sessions are displayed on a map with graduated location privacy. A compact map overlay and an immersive view share the same synchronization session. Optional host video uses validated WebRTC signaling in parallel with musical state broadcast.

---

*Vérifier le décompte de mots exact avant dépôt.*
