# Rapport Dev Agent — 2026-08-06 — Lecteur audio global façon Spotify

**Agent :** @onscen-dev-agent
**Date :** 2026-08-06
**Durée estimée :** 1 h
**Statut global :** ✅ Terminé

---

## Mission

Demande utilisateur (verbatim, depuis l'onglet Musique, carte album) :

> « si je clique sur un son, cela lance la musique et créer une bar de lecture comme sur Spotify »

---

## Contexte / problème

Dans l'onglet Musique, les cartes d'albums (`MusicAlbumCard`), les lignes de morceaux (`MusicTrackRow`) et la mise en avant `MusicSpotlight` n'avaient qu'une seule action au clic : ouvrir le profil de l'auteur. Le bouton « play » affiché au survol était purement décoratif (commentaire dans le code : *« le tap ouvre le profil »*). Aucune lecture audio réelle n'existait pour la Musique communautaire (le seul lecteur audio existant était local à l'onglet Discographie du profil, `UserCompositionsSection.tsx`, sans barre persistante ni file d'attente).

---

## Actions réalisées

### Backend

- [x] `commun/backend/src/lib/musicHome.ts` : `MusicTrackItem` expose désormais `fileUrl` (le fichier audio de la composition, déjà stocké côté `UserComposition.fileUrl`) — republié par `/api/music/home` et `/api/music/search`
- [x] Aucune nouvelle route : réutilisation de `POST /api/compositions/:id/play` (déjà utilisé par la Discographie profil, alimente le classement « Populaire ») et de `GET /api/users/:userId/albums/:albumId/tracks` (déjà utilisé pour afficher la discographie d'un profil tiers) pour récupérer la liste des morceaux d'un album à la volée

### Frontend — lecteur global

- [x] `web/app/src/context/MusicPlayerContext.tsx` (nouveau) : `MusicPlayerProvider` — un seul `<audio>` monté une fois pour toute l'app, file d'attente (`queue`), morceau courant, `isPlaying`, actions `playTrack/togglePlay/next/prev/seek/close`
- [x] Choix d'architecture : `position`/`duration` (mise à jour ~60×/s) ne sont **pas** dans le contexte partagé pour éviter de re-render toutes les cartes musique à chaque tick — seule `MusicPlayerBar` s'abonne aux events `timeupdate`/`loadedmetadata` de l'élément audio exposé via `audioRef`
- [x] `web/app/src/components/MusicPlayerBar.tsx` (nouveau) : barre de lecture persistante façon Spotify (cover, titre/artiste, temps, barre de progression cliquable, précédent/pause-lecture/suivant, fermer)
- [x] `main.tsx` : `<MusicPlayerProvider>` ajouté (sous `AuthProvider`/`DmUnreadProvider`, au-dessus de `<App />`)
- [x] `App.tsx` : `<MusicPlayerBar />` montée une fois, entre `</main>` et la tab-nav du bas — `shrink-0` dans le flex-column du shell : quand un morceau joue, `<main class="flex-1">` se réduit automatiquement, sans variable CSS supplémentaire à orchestrer

### Frontend — branchement des cartes Musique

- [x] `MusicTrackRow` : le clic lance/mets en pause le morceau (file = les morceaux de la rangée affichée, pour lecture continue suivant/précédent) ; surbrillance violette + icône pause quand c'est le morceau en cours
- [x] `MusicAlbumCard` : la carte (`<button>` unique) devient un `<div>` avec 2 zones cliquables distinctes — la pochette lance la lecture de l'album entier (récupération des morceaux via l'API, lecture en file), le bloc avatar+nom ouvre toujours le profil de l'auteur
- [x] `MusicSpotlight` (mise en avant « Tendance #1 ») : lecture directe si c'est un morceau, récupération+lecture si c'est un album, ouverture du profil si c'est un reel (inchangé, les reels ne sont pas lus par ce lecteur)
- [x] `PlayBadge` : nouveau prop `playing` pour afficher l'icône pause quand l'élément est en cours de lecture

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/lib/musicHome.ts` | `MusicTrackItem.fileUrl` |
| `web/app/src/lib/musicTypes.ts` | `MusicTrackItem.fileUrl` (miroir) |
| `web/app/src/context/MusicPlayerContext.tsx` | **Nouveau** — lecteur global |
| `web/app/src/components/MusicPlayerBar.tsx` | **Nouveau** — barre persistante |
| `web/app/src/components/MusicHomeContent.tsx` | Branchement lecture (rows, cartes, spotlight) |
| `web/app/src/main.tsx`, `App.tsx` | Provider + montage de la barre |
| `web/app/src/locales/fr.json`, `en.json` | Clés `music.player*` |

---

## Commandes exécutées

```powershell
cd commun/backend; npx tsc --noEmit                                          → ✅
cd commun/backend; npx vitest run src/lib/musicHome.test.ts src/lib/compositionPlays.test.ts → ✅ (6 tests)
cd web/app; npx tsc --noEmit                                                 → ✅
cd web/app; npm run build                                                    → ✅
cd web/app; npx vitest run                                                   → ✅ 89 fichiers / 565 tests
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Typecheck backend | ✅ |
| Tests unitaires backend (musicHome, compositionPlays) | ✅ 6/6 |
| Typecheck frontend | ✅ |
| Build frontend (`vite build`) | ✅ |
| Suite de tests frontend complète | ✅ 565/565 |
| Lint (`ReadLints`) sur tous les fichiers touchés | ✅ aucune erreur |
| Test manuel dans le navigateur | Non fait — à valider par l'utilisateur (clic album/morceau → lecture + barre visible) |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1372 — Lecteur audio global façon Spotify)

---

## Correctif post-livraison — 2026-08-06

**Symptôme signalé par l'utilisateur :** « remonte la bar au dessus des boutons d'accueil » — la barre de lecture apparaissait cachée derrière la tab-nav du bas au lieu d'être visible au-dessus.

**Cause :** `nav.ms-tab-bar-bottom` (la navigation du bas) est en `position: fixed` (voir `index.css`) — elle ne participe pas au flux flex. Insérer la barre en `shrink-0` juste avant elle ne la « pousse » donc pas vers le haut comme supposé initialement.

**Fix :** `MusicPlayerBar` passe elle aussi en `position: fixed`, ancrée à `bottom: var(--tab-nav-total-h)` (juste au-dessus de la tab-nav fixe), ou `bottom: 0` pour le layout `appa2` sans tab-nav bottom (avec sa propre marge de zone sûre). `z-index: 75` (au-dessus des 70 de la tab-nav).

Vérifié : `tsc --noEmit` ✅, `npm run build` ✅ (classe `bottom-[var(--tab-nav-total-h)]` confirmée dans le CSS généré), suite de tests complète ✅ 565/565. Entrée `modification.txt` : **MODIF 1373**.

---

## Correctif post-livraison #2 — 2026-08-06

**Symptôme signalé par l'utilisateur :** « descends le player mais laisse les boutons d'accueil visible » — avec un DOM path pointant la barre de lecture, invitant à vérifier plus finement son alignement avec le dock d'onglets.

**Cause (confirmée par lecture du CSS) :** `--tab-nav-total-h` a deux usages différents selon le mode :
- Mode classique (`:root`, desktop / PWA large) : `float-gap + btn-size + safe-area` = exactement le bord haut réel des boutons du dock → la barre de lecture était déjà pile au ras, sans écart ni recouvrement.
- Mode `design-quick-wins` (dock flottant, **mode mobile/PWA — cible principale réelle de l'app**) : cette variable est une **heuristique plus petite** (`hub-size * 0.55 + 0.75rem`), pensée pour le *padding de contenu scrollable* sous le dock, **pas** pour la position exacte du dock. Le dock flottant réel (`.ms-tab-rail`) a `min-height: var(--tab-nav-hub-size)` (62px) + `margin-bottom: safe-area + float-gap` — son bord haut réel est donc **~16px plus haut** que l'heuristique. En calant la barre de lecture sur `--tab-nav-total-h`, elle recouvrait donc environ 7 à 16px du haut des boutons ronds du dock en mode mobile (zone cliquable partiellement cachée).

**Fix :** nouvelle variable CSS `--tab-nav-dock-top`, distincte de `--tab-nav-total-h`, représentant le bord haut **réel** du dock dans chaque mode :
- `:root` : `--tab-nav-dock-top: var(--tab-nav-total-h);` (déjà exact en mode classique)
- `[data-design-quick-wins="1"]` : `--tab-nav-dock-top: calc(env(safe-area-inset-bottom, 0px) + var(--tab-nav-float-gap) + var(--tab-nav-hub-size));` (bord haut réel du `.ms-tab-rail` flottant)

`MusicPlayerBar.tsx` utilise désormais `bottom-[var(--tab-nav-dock-top)]` au lieu de `bottom-[var(--tab-nav-total-h)]` — colle pile au bord haut réel des boutons, dans les deux modes, sans jamais les recouvrir.

Vérifié : `tsc --noEmit` ✅, lints (`MusicPlayerBar.tsx`, `index.css`) ✅ aucune erreur, `npm run build` ✅ (variable `--tab-nav-dock-top` confirmée dans le CSS généré). Entrée `modification.txt` : **MODIF 1374**.

---

## Correctif post-livraison #3 — 2026-08-06

**Demande utilisateur :** « le nom de l'utilisateur doit être clickable ce qui va ouvrir son profil. Le player reste visible tant que l'utilisateur n'a pas fermer le player. »

**1. Nom de l'artiste clickable :**
- `MusicPlayerBar.tsx` : nouveau prop `onOpenProfile?: (userId: string) => void` ; le nom de l'artiste devient un `<button>` (hover souligné, `stopPropagation`) qui appelle `onOpenProfile(currentTrack.hostId)` (`hostId` déjà présent sur `PlayerTrack`, alimenté par `fileUrl`/host de la composition).
- `App.tsx` : `<MusicPlayerBar onOpenProfile={openProfile} .../>` — réutilise le callback `openProfile` déjà utilisé par toutes les autres pages (Feed, Reels, DM, notifications…).

**2. Persistance du lecteur (vérification, pas de fix nécessaire) :**
- `MusicPlayerProvider` (monté une fois dans `main.tsx`, au-dessus de `<App/>`) et `<MusicPlayerBar>` (rendu une seule fois dans `App.tsx`, juste après `</main>`, hors de tout conditionnel de tab/profil/plein-écran) confirment que le lecteur ne se ferme **que** via le bouton ✕ (`close()`). Changer d'onglet, ouvrir un profil, ou afficher le salon/live en plein écran ne démonte ni la barre ni le contexte audio — comportement déjà conforme à la demande, aucune régression trouvée.

Vérifié : `tsc --noEmit` ✅, lints (`MusicPlayerBar.tsx`, `App.tsx`) ✅ aucune erreur. Entrée `modification.txt` : **MODIF 1375**.

---

## Correctif post-livraison #4 — 2026-08-06

**Demande utilisateur :** « descend le player mais les boutons d'accueil doit être en premier plan. »

**Changement d'approche :** les 2 correctifs précédents (#1, #2) cherchaient un offset *pixel-parfait* pour que le lecteur touche le dock d'onglets sans jamais le recouvrir — ce qui ne laissait aucune marge pour « descendre » davantage sans empiéter sur les boutons. La demande révèle le vrai besoin : accepter le chevauchement visuel et le résoudre par l'empilement (z-index) plutôt que par la géométrie.

- `nav.ms-tab-bar-bottom` : `z-index: 70` → `80` (au-dessus de `.ms-music-player-bar`, `z-[75]`) — les boutons d'accueil (icônes de la pastille flottante) restent donc **toujours** au premier plan, visibles et cliquables, même si le lecteur passe visuellement derrière eux.
- `MusicPlayerBar.tsx` : la barre est désormais collée au vrai bas d'écran (`bottom-0`) dans tous les layouts (au lieu de `bottom-[var(--tab-nav-dock-top)]` calé pile au-dessus du dock) — avec padding `safe-area-inset-bottom` systématique. Prop `reserveSafeAreaBottom` devenu inutile, retiré (un seul comportement désormais).
- Suppression de la variable CSS `--tab-nav-dock-top` (introduite en correctif #2, devenue obsolète avec cette approche).

Vérifié : `tsc --noEmit` ✅, lints ✅, `npm run build` ✅, suite de tests complète ✅ 565/565. Entrée `modification.txt` : **MODIF 1376**.

---

## Bloquers / décisions requises

Aucun bloquant. Limitations connues, acceptées pour ce périmètre :

1. **Chevauchement rare avec les floats fixes** (mini-lecteur salon/live PiP) : ces éléments sont `position: fixed` avec un `bottom` calculé sur `--tab-nav-total-h`, qui n'inclut pas la hauteur de la nouvelle barre musique. Si un utilisateur écoute un salon/live en PiP **et** lance un morceau depuis l'onglet Musique en même temps, les deux barres peuvent se chevaucher visuellement. Cas d'usage marginal, non traité pour rester dans le scope de la demande.
2. **Pas de Media Session API** (contrôles lecture depuis l'écran verrouillé / notifications OS) — hors périmètre de la demande, amélioration future possible.
3. **Reels** : non concernés par ce lecteur (ils ont leur propre lecteur vidéo dédié).

---

## Prochaines étapes

1. Vérifier manuellement sur mobile (390px) et desktop après `npm run dev` : cliquer un morceau (`MusicTrackRow`), un album (`MusicAlbumCard`), le spotlight, vérifier lecture continue suivant/précédent, fermeture de la barre.
2. Si pertinent : intégrer la Media Session API (contrôles écran verrouillé) et gérer le chevauchement avec les floats salon/live PiP.

---

*Généré par OnScen Dev Agent*
