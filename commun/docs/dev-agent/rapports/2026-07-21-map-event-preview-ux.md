# Rapport Dev — 2026-07-21 map-event-preview-ux

## Mission

Implémenter la Phase 1 CTO : refonte UX de l’aperçu événement sur carte (`MapEventMapInfoPanel`).

## Fichiers touchés

- `web/app/src/components/MapEventPreviewCard.tsx` (nouveau)
- `web/app/src/components/MapEventMapInfoPanel.tsx`
- `web/app/src/components/EventCardMapCompact.tsx`
- `web/app/src/components/FeedPostInteractions.tsx`
- `web/app/src/pages/HomePage.tsx`
- `web/app/src/locales/fr.json`, `en.json`
- `modification.txt` (MODIF 1074)

## Changements

- Nouveau composant dédié `MapEventPreviewCard` : header titre, hero 16:9 `object-cover`, chips type/heure, lieu, auteur, CTA Itinéraire + upvote, actions secondaires + « Voir plus ».
- Panneau ancré dans `ms-map-viewport` (plus de portal PiP) : bottom sheet mobile, coin haut-gauche desktop (~240px).
- « Voir plus » / commentaire → `MapEventDetailModal` via `selectedMapEvent`.
- Suppression de `pipPanel` sur `EventCardMapCompact`.

## Commandes

```powershell
cd web/app; npm run build
```

## Tests / build

- `npm run build` → ✅

## Statut

✅

## Suite (Phase 2 CTO)

- Sync sidebar carousel → ouvrir preview au clic.
- Offset si PiP salon/live actif.
- Animation entrée / swipe fermeture mobile.
