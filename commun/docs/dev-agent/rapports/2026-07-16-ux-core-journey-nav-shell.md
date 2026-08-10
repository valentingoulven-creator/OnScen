# Rapport Dev Agent — 2026-07-16 — UX Core Journey : coquille de navigation (dev)

**Agent :** @onscen-dev-agent
**Date :** 2026-07-16
**Durée estimée :** ~1h30
**Statut global :** ✅ Terminé (scope shell only)

---

## Mission

Implémenter en dev la proposition CTO de refonte UX « Core Journey » (`commun/docs/UX-REFONTE-TOTALE-CTO.md`), scope limité à la coquille de navigation (dock + FAB Créer), validé explicitement par le fondateur via question à choix multiples avant implémentation.

---

## Contexte / problème

Suite à l'audit CTO (`commun/docs/audit-cto-20260619.md`, UX-01…07) et à la proposition de refonte totale (`commun/docs/UX-REFONTE-TOTALE-CTO.md` + prototype HTML `commun/docs/ux-prototypes/core-journey.html`), le fondateur a demandé d'appliquer l'UX proposée en dev. Vu le risque (app en production, sessions salon/live complexes dans `App.tsx`), le scope a été négocié avant codage :

- Coquille de navigation seulement (pas de découpe des god pages).
- Profil reste un overlay (pas de vrai onglet).
- Music repliée dans Accueil (pas d'onglet dédié).
- Reels reste directement accessible (pas replié dans Créer).

---

## Actions réalisées

- [x] Lecture de `App.tsx`, `MainTabNav.tsx`, `TabNavIcons.tsx`, `appLayout.ts` pour comprendre le modèle de navigation existant (state machine `tab`/`view`, pas de routing URL).
- [x] Dock réduit à 4 destinations (Accueil · Monde · Social(dm) · Reels) + FAB central « Créer ».
- [x] Nouveau composant `CreateHubSheet` (bottom-sheet/dialog, focus trap) avec 5 actions : Salon, Live, Reel, Story, Événement.
- [x] Wiring des intents de création vers les pages existantes (`HomePage`, `ReelsTabPage`, `ActualiteTabPage`) via des clés incrémentées (pattern déjà utilisé dans le repo pour `reelsNavigateKey`).
- [x] Music repliée dans Accueil (bouton shortcut) + bouton retour ajouté à `MusicTabPage`.
- [x] Clés i18n `nav.social` et `create.hub.*` (fr/en).
- [x] Vérification TypeScript (`tsc -b --noEmit`) et lints.
- [x] Vérification dev server (HMR sans erreur, `curl` 200).

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `web/app/src/App.tsx` | État `createHubOpen` + 4 clés d'intent, `handleCreateHubSelect`, wiring `MainTabNav`/pages, montage `CreateHubSheet` |
| `web/app/src/components/MainTabNav.tsx` | Dock 4 tabs + `CreateFabButton` inséré en position centrale (remplace visuellement le slot Music) |
| `web/app/src/components/CreateHubSheet.tsx` | Nouveau — hub Créer (5 actions) |
| `web/app/src/pages/HomePage.tsx` | Props `createSalonRequestKey` / `startLiveRequestKey` → effects |
| `web/app/src/pages/ReelsTabPage.tsx` | Prop `createReelRequestKey` → effect |
| `web/app/src/pages/ActualiteTabPage.tsx` | Prop `createEventRequestKey` → effect ; prop `onOpenMusic` + bouton shortcut |
| `web/app/src/pages/MusicTabPage.tsx` | Prop `onBack` optionnelle → chevron retour |
| `web/app/src/locales/fr.json`, `en.json` | `nav.social`, bloc `create.hub.*` |

---

## Commandes exécutées

```text
cd web/app && npx tsc -b --noEmit    → ✅ (aucune erreur)
curl http://localhost:5173/          → ✅ 200 (dev server déjà lancé, HMR appliqué sans erreur)
```

Pas de `npm test` backend (aucun changement backend cette session).

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| TypeScript build (`tsc -b --noEmit`) | ✅ Aucune erreur |
| Lints (ReadLints, 9 fichiers touchés) | ✅ Aucune erreur |
| Dev server HMR (`npm run dev`, terminal existant) | ✅ Rechargé sans erreur console (App.tsx, MainTabNav.tsx, ActualiteTabPage.tsx) |
| Test manuel visuel (mobile 390px / desktop) | ⚠️ Non fait dans cette session — à valider par le fondateur |
| Test manuel apptel (Capacitor) | N/A — hors scope (ios/apptel non touché) |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1046 — UX Core Journey : dock 4 onglets + FAB Créer)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| Validation visuelle 390px / desktop | Tester le dock + FAB + hub Créer sur `localhost:5173`, confirmer que rien n'est cassé (notamment salon/live PiP, DM unread badge) |
| Story via hub Créer | Actuellement navigue vers Accueil sans ouvrir la caméra automatiquement (StoriesInlineBar n'expose pas d'intent externe) — accepter ou demander le fil supplémentaire |
| Phase suivante (P2 découpe god pages) | Décider si/quand lancer la décomposition de `HomePage`/`DmPage`/`ActualiteTabPage` (hors scope de cette session, volontairement) |

---

## Prochaines étapes

1. Validation manuelle mobile-first (390px, 768px, desktop) du nouveau dock et du hub Créer.
2. Si validé : décider du sort de `ios/apptel` (parity dock web ↔ apptel, actuellement non touché).
3. Si le fondateur veut aller plus loin : lancer P2 (décomposition `HomePage`/`DmPage`) en session dédiée, hors de cette réponse rapide.

---

## Notes techniques

- Le dock passe de 5 boutons (Actualité/Map/DM/Music/Reels) à 5 enfants toujours (4 tabs + 1 FAB) — **aucune CSS de breakpoint (`--tab-nav-btn-size`, media queries `@374px`/`@360px`) n'a dû être modifiée**, ce qui minimise le risque de régression visuelle sur petits écrans.
- `Music` reste un état `tab` valide en interne (`selectTab('music')` déjà utilisé ailleurs, ex. résultat de recherche globale album/son) — seule sa présence dans le dock a été retirée, pas le mécanisme de montage.
- Le hub Créer ne réinvente aucun flux de création : il déclenche les modals/sheets déjà existants sur chaque page via des clés incrémentées (pattern identique à `reelsNavigateKey` déjà présent dans `App.tsx`).
- `ios/apptel` (dock différent : Carte/Actualité/Live/DM/Reels, pas de Music) n'a pas été touché — mirroring volontairement hors scope.

---

*Généré par OnScen Dev Agent*
