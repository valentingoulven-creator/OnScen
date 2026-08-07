# Rapport Dev Agent — 2026-08-06 — Menu « ⋯ » du lecteur audio (playlist, file d'attente, partage, signalement)

**Agent :** @soundy-dev-agent
**Date :** 2026-08-06
**Durée estimée :** 1 h 30
**Statut global :** ✅ Terminé

---

## Mission

Demande utilisateur (verbatim, depuis la barre de lecture `MusicPlayerBar`) :

> « ajoute un bouton (3 points) qui permettra d'ajouter la musique dans une playlist (liste les playlist de l'utilisateur), ajouter à la file d'attente, partager, copier en lien, signaler (enverra un rapport au admin). »

Suite du chantier lecteur audio global (`2026-08-06-musique-lecteur-audio-global.md`).

---

## Contexte / analyse préalable

Avant d'implémenter, exploration du code existant pour éviter les doublons :

- **Pas d'entité « playlist » dédiée en base.** Les « Mes playlists » affichées dans l'onglet Musique (Pour toi) sont en réalité les **albums** possédés par l'utilisateur (`UserAlbum`) — cf. `MusicHomeContent.tsx` (`playlists: t('music.playlistsOnlyLabel', ...)`, alimenté par les albums de la bibliothèque).
- **Mécanique de copie déjà existante pour « Mes favoris »** (`musicFavorites.ts`) : au favori d'un morceau, une composition-copie légère (`sourceCompositionId` → morceau source) est créée dans un album « Mes favoris » auto-créé par utilisateur. Cette mécanique était câblée en dur sur l'album Favoris uniquement.
- **`ShareLinkMenu` + `ShareToUserSheet` déjà génériques** (utilisés pour profil/salon/album) — réutilisables tels quels pour un morceau, juste besoin d'une URL de partage dédiée.
- **Deep-link morceau déjà géré** côté lecture : `getCompositionPath(userId, compositionId)` (`?tab=compositions&track=<id>`) existait déjà et était déjà consommé par `UserCompositionsSection.tsx` pour ouvrir le morceau ciblé — mais aucune fonction ne générait l'URL absolue de partage (`getAlbumShareUrl` existait, pas son équivalent morceau).
- **`ReportContentModal` déjà générique** (`roomType: 'salon'|'live'|'dm'|'reel'|'profile'`) — il manquait juste la valeur `'track'`.

Décision produit : « Ajouter à une playlist » = généraliser la mécanique de copie des Favoris à **n'importe quel album possédé par l'utilisateur**, cohérent avec le libellé produit déjà en place (« Mes playlists » = mes albums).

---

## Actions réalisées

### Backend

- [x] `commun/backend/src/lib/musicFavorites.ts` : nouvelle fonction exportée `saveTrackToAlbum(userId, targetAlbumId, sourceCompositionId)` — généralisation de la copie `sourceCompositionId` à un album cible arbitraire (vérifie l'ownership de l'album + anti-doublon). `addTrackToFavorites` devient un simple wrapper (`ensureFavoritesAlbum` + `saveTrackToAlbum`) — comportement inchangé, zéro régression sur les favoris.
- [x] `commun/backend/src/routes/music.ts` : nouvelle route `POST /music/playlists/:albumId/tracks` (body `{ compositionId }`).
- [x] `commun/backend/src/lib/contentReports.ts` : `ContentReport.roomType` — ajout du type `'track'`.

### Frontend

- [x] `web/app/src/lib/api/music.ts` : `addTrackToPlaylist(token, albumId, compositionId)`.
- [x] `web/app/src/lib/shareLink.ts` : `getCompositionShareUrl(userId, compositionId)` (réutilise `getCompositionPath` déjà existant).
- [x] `web/app/src/context/MusicPlayerContext.tsx` : nouvelle méthode `addToQueue(track)` — ajoute en fin de file sans interrompre la lecture en cours.
- [x] `web/app/src/components/ReportContentModal.tsx` : `ReportContentContext.roomType` — ajout `'track'` (typage aligné backend).
- [x] `web/app/src/components/MusicTrackOptionsMenu.tsx` (**nouveau**) : bottom-sheet (mobile) / dialog (desktop), auto-suffisant, 2 vues :
  - **Menu principal** : Ajouter à une playlist · Ajouter à la file d'attente · Partager · Copier le lien · Signaler.
  - **Sous-vue playlists** : liste des albums de l'utilisateur (`api.getMyAlbums`, chargée à la demande), tap → `addTrackToPlaylist` + toast + `notifyMusicFavoritesChanged()` (déjà écouté par `useMusicHome`, rafraîchit « Mes playlists » sur l'accueil Musique).
  - Partage/copie de lien réutilisent `ShareLinkMenu`/`copyShareLink` (mêmes helpers que le partage d'album profil).
  - Signalement réutilise `ReportContentModal` (`roomType: 'track'`, `targetUserId: track.hostId`) — même comportement que reel/live (bloque automatiquement l'artiste signalé, cohérent avec le reste de l'app).
- [x] `web/app/src/components/MusicPlayerBar.tsx` : nouveau bouton « ⋯ » (`MoreIcon`) entre « suivant » et « fermer », monte `<MusicTrackOptionsMenu>`.
- [x] `web/app/src/locales/fr.json`, `en.json` : nouvelles clés `music.*` (playerMoreOptions, addToPlaylist(Title), addToQueue, trackAddedToQueue, trackAddedToPlaylist, trackAlreadyInPlaylist, playlistAddError, playlistsLoadError, noPlaylistsYet).

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/lib/musicFavorites.ts` | `saveTrackToAlbum` (généralisation copie favoris à tout album) |
| `commun/backend/src/routes/music.ts` | `POST /music/playlists/:albumId/tracks` |
| `commun/backend/src/lib/contentReports.ts` | `roomType: 'track'` |
| `web/app/src/lib/api/music.ts` | `addTrackToPlaylist` |
| `web/app/src/lib/shareLink.ts` | `getCompositionShareUrl` |
| `web/app/src/context/MusicPlayerContext.tsx` | `addToQueue` |
| `web/app/src/components/ReportContentModal.tsx` | `roomType: 'track'` |
| `web/app/src/components/MusicTrackOptionsMenu.tsx` | **Nouveau** — menu ⋯ |
| `web/app/src/components/MusicPlayerBar.tsx` | Bouton ⋯ + montage du menu |
| `web/app/src/locales/fr.json`, `en.json` | Clés `music.*` |

---

## Commandes exécutées

```powershell
cd commun/backend; npx tsc --noEmit    → ✅
cd web/app; npx tsc --noEmit           → ✅
cd web/app; npm run build              → ✅
```

Vérification manuelle backend (déjà démarré, `ts-node-dev --respawn` — rechargement à chaud) :
```
GET  http://localhost:4080/health                          → 200 OK
POST http://localhost:4080/api/music/playlists/test/tracks  → 401 (sans token) — route bien enregistrée
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Typecheck backend | ✅ |
| Typecheck frontend | ✅ |
| Build frontend (`vite build`) | ✅ |
| Lint (`ReadLints`) sur tous les fichiers touchés | ✅ aucune erreur |
| Backend msdev — rechargement à chaud sans crash | ✅ |
| Nouvelle route enregistrée (401 au lieu de 404) | ✅ |
| Test manuel dans le navigateur (clic ⋯, ajout playlist, file d'attente, partage, signalement) | Non fait — à valider par l'utilisateur |

---

## modification.txt

- [x] Entrée ajoutée — **MODIF 1383**

---

## Décisions produit à noter

1. **« Ajouter à une playlist » = ajouter à un de mes albums.** L'app n'a pas de playlists multiples indépendantes des albums ; ce choix respecte le vocabulaire déjà utilisé côté produit (Music tab « Pour toi » → « Mes playlists ») sans introduire une nouvelle entité de données. Si une vraie notion de playlist (indépendante de l'upload d'albums, incluant des morceaux d'autres artistes) est souhaitée à l'avenir, ce sera un chantier de modèle de données à part (au-delà du scope de cette demande).
2. **Signaler un morceau bloque automatiquement l'artiste ciblé** — comportement volontairement identique au signalement d'un reel ou d'un live (`ReportContentModal`), pas de traitement spécial pour rester cohérent dans toute l'app.
3. **Bouton ⋯ toujours visible**, mais chaque action interne (playlist/signaler) nécessite un token — dégradation silencieuse cohérente avec le reste de la barre (le cœur ❤️ favoris a le même comportement).

---

## Bloquers / décisions requises

Aucun bloquant.

---

## Prochaines étapes

1. Vérification manuelle utilisateur : clic ⋯ sur un morceau en cours de lecture → tester les 5 actions (playlist, file d'attente, partage natif/réseaux, copier le lien, signaler).
2. Si besoin produit ultérieur : vraies playlists multi-artistes indépendantes des albums (nouvelle entité de données, hors scope ici).

---

*Généré par Soundy Dev Agent*
