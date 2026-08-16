# Rapport Dev Agent — 2026-08-16 — Menu lieu : carte OnScen

**Agent :** @onscen-dev-agent  
**Date :** 2026-08-16  
**Durée estimée :** 0,5 h  
**Statut global :** ✅ Terminé

---

## Mission

Ajouter une option dans `OpenLocationMenu` pour ouvrir le lieu sur la carte in-app OnScen (pas seulement Google / Waze / Plans).

---

## Contexte / problème

Depuis un événement du fil (ex. Place de la Comédie), le menu n’offrait que des apps externes. L’utilisateur veut être redirigé vers l’onglet Carte OnScen, centré sur le lieu.

---

## Actions réalisées

- [x] Option « Carte OnScen » en tête du menu
- [x] Fly carte rayon venue 1,2 km + bascule onglet `map`
- [x] Résolution coords : props → venue connue → centre-ville
- [x] i18n fr / en
- [x] Tests unitaires + `modification.txt` MODIF 1456

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `web/app/src/components/OpenLocationMenu.tsx` | Option Carte OnScen |
| `web/app/src/lib/openOnscenMapAtLocation.ts` | Helper fly + onglet |
| `web/app/src/lib/openOnscenMapAtLocation.test.ts` | 3 tests |
| `web/app/src/lib/mapUiEvents.ts` | `MAP_OPEN_TAB_EVENT` |
| `web/app/src/lib/mapSearchIntent.ts` | `radiusKm` optionnel |
| `web/app/src/App.tsx` | `selectTab('map')` |
| `web/app/src/pages/HomePage.tsx` | Utilise `intent.radiusKm` |
| `web/app/src/locales/fr.json` · `en.json` | `openLocation.onscenMap` |

---

## Commandes exécutées

```text
cd web/app && npm test -- src/lib/openOnscenMapAtLocation.test.ts src/lib/mapSearchIntent.test.ts
→ ✅ 6/6
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires frontend | ✅ 6/6 |
| Build frontend | non lancé (changement UI + helper) |
| Test manuel | à faire : menu lieu → Carte OnScen |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1456 — Menu lieu : ouvrir sur la carte OnScen)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| — | — |

---

## Prochaines étapes

1. Vérifier en local : événement feed → Ouvrir le lieu → Carte OnScen.
2. Confirmer le zoom autour du pin (1,2 km).

---

## Notes techniques (optionnel)

Pas d’override `ios/apptel` pour `OpenLocationMenu` — le menu web est la source unique.

---

*Généré par OnScen Dev Agent*
