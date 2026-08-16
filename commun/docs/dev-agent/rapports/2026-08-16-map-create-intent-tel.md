# Handoff CTO — routeur création carte (tel)

**Date :** 2026-08-16  
**Périmètre :** `ios/apptel` uniquement  

## Mission

Implémenter le handoff CTO : une entrée pour live / event / salon, gates, skip Stripe tel.

## Fait

- `useMapCreateIntent` : `startCreate(kind)` + confirm si hôte salon→live ou live→salon
- `MapCreateActionFab` override : les 3 chats passent par le routeur
- `useStartLiveFlow` override : pourboires / Connect skippés par défaut (IAP)

## Hors scope (volontaire)

- Web `HomePage` inchangé (event flyTo + refresh déjà en place)
- Session viewer salon (minimisée) : toujours le garde `hasActiveSalon` existant
- Geo POV globe injectée dans les 3 modales (reste le centre nearby HomePage)

## Test

`http://localhost:4082/tel/` — FAB + → les 3 choix ; conflit hôte = modal.
