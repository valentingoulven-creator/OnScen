# Audit légal Soundy — Phase 10 : Conditions d'utilisation YouTube

**Date :** 2026-08-07
**Méthode :** croisement avec `LEG-6` à `LEG-10` de `AUDIT-CONSOLIDE.md` (recherche exhaustive `ytdl-core`/`yt-dlp`/scraping/ffmpeg-sur-YouTube reproduite historiquement sur tout le monorepo), revue de `lib/youtubeRemote.ts`, `components/SalonYouTubePlayer.tsx`, `commun/docs/GOOGLE-OAUTH-TEST-USERS.md`.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

---

## 10.1 Extraction/téléchargement audio ou vidéo depuis YouTube

**Constat : ✅ conforme — aucune violation identifiée.**

- Recherche exhaustive de bibliothèques d'extraction (`ytdl-core`, `yt-dlp`, scraping HTML, `ffmpeg` appliqué à des flux YouTube) reproduite à l'identique sur l'ensemble du monorepo, y compris tous les fichiers créés depuis l'audit initial — **aucune occurrence trouvée** (`LEG-10`, statut « confirmé propre, sans régression »).
- Un **code mort de fallback** vers des proxies non officiels (Piped/Invidious — eux-mêmes construits sur de l'extraction non autorisée) avait été identifié dans `lib/youtubeRemote.ts` lors d'un audit précédent ; sa **suppression physique du build de production** a été **confirmée par exécution réelle** de `npm run build:prod` (absence du fichier dans `dist/`), avec un garde-fou runtime + try/catch en défense en profondeur (`LEG-7 ✅`).
- Soundy utilise YouTube **exclusivement via lecture intégrée** (player officiel embarqué) et l'**API YouTube Data v3** (recherche, import de playlists publiques) — pas d'extraction de flux média.

**Risque : 🟢 Faible — point fort confirmé du produit, à maintenir en vigilance à chaque nouvelle intégration touchant YouTube.**

---

## 10.2 Usage de l'API YouTube Data — quotas, attribution, player

**Constat :**

| Exigence | Statut |
|---|---|
| Respect des quotas API | Clé restreinte recommandée (IP + scope) dans la documentation d'exemple ; pas de dépassement documenté |
| Attribution obligatoire (logo/lien YouTube visible) | 🔍 Non vérifié explicitement dans cette phase — à confirmer sur le rendu UI du player salon |
| Interdiction de modifier le player YouTube | 🟡 **Zone grise identifiée** : `controls: 0` configuré sur le lecteur YouTube embarqué (`web/app/src/components/SalonYouTubePlayer.tsx`) — masque les contrôles natifs du player, ce qui touche aux **YouTube Branding Guidelines** sans les violer frontalement (le player reste le player officiel embarqué, seule l'affichage des contrôles est modifié via l'API IFrame officielle, ce qui est techniquement permis par l'API elle-même mais peut être questionné sous l'angle des guidelines de branding) — `LEG-8`, toujours ouvert, effort faible, risque faible mais non nul si le volume d'utilisateurs devient significatif |

**Risque : 🟡 Faible-Moyen** sur le point `controls: 0` — reconfirmé inchangé (`LEG-8`).

**Recommandation :** revue légale formelle du point `controls: 0` si le volume d'utilisateurs de la fonctionnalité salon YouTube devient significatif ; confirmer la présence effective de l'attribution YouTube sur l'interface.

---

## 10.3 Musique YouTube utilisée dans les reels/lives — risque de droits d'auteur

**Constat :**
- Soundy ne permet **pas** l'extraction de pistes audio YouTube pour les intégrer dans des reels/compositions utilisateur (confirmé §10.1).
- La protection anti-upload de musique commerciale non autorisée repose sur **ACRCloud** (empreinte audio, voir Phase 8) pour les **compositions/reels uploadés directement** par les utilisateurs (fichiers audio propres), pas sur un mécanisme lié à YouTube.
- **Point de vigilance opérationnel (recoupement Phase 8) :** le compte/les clés ACRCloud en production restent, selon `TODO-MANUAL.md`, à finaliser — si cette protection anti-copyright musical n'est pas activement configurée, le risque de droits d'auteur sur les uploads audio directs (indépendamment de YouTube) reste ouvert.

**Risque : 🟢 Faible** sur le vecteur spécifique YouTube (pas d'extraction) ; 🟡 **Moyen** sur le vecteur plus large de la protection anti-copyright musical général si ACRCloud n'est pas actif en prod (voir Phase 8 §8.4, `API-3b`).

**Recommandation :** confirmer l'activation d'ACRCloud en production comme garde-fou anti-copyright général sur les uploads audio, indépendamment du sujet YouTube spécifique. Envisager, si le produit veut permettre l'usage de musique sous licence dans les créations UGC (reels/lives), une intégration avec un catalogue sous licence de synchronisation UGC (type Epidemic Sound, Artlist, ou accords SACEM directs) plutôt que toute dépendance à YouTube pour ce besoin.

---

## 10.4 App OAuth Google en mode Testing

**Constat (hérité, reconfirmé — `LEG-6`) :** l'application OAuth Google (scope `youtube.readonly`) est toujours en mode **« Testing »** non vérifié par Google, ce qui **bloque la liaison YouTube pour tout utilisateur non explicitement whitelisté** (`commun/docs/GOOGLE-OAUTH-TEST-USERS.md`).

**Risque : 🟠 Élevé pour l'usage produit** — ce n'est pas un risque de conformité (l'app respecte les règles du mode Testing), mais un **bloqueur fonctionnel** : la fonctionnalité de liaison de compte YouTube est de facto inutilisable pour la quasi-totalité des utilisateurs réels tant que la vérification Google n'est pas obtenue.

**Recommandation :** soumettre l'application à la vérification Google (processus externe avec délai hors contrôle de l'équipe, effort L) — action déjà identifiée en priorité « IMPORTANT » dans `AUDIT-CONSOLIDE.md`.

---

## Synthèse des risques — Phase 10

| # | Sujet | Risque | Effort |
|---|---|---|---|
| YT-1 | Extraction/téléchargement YouTube | 🟢 Conforme (point fort confirmé) | — |
| YT-2 | `controls: 0` sur le player YouTube (zone grise branding) | 🟡 Faible-Moyen | S |
| YT-3 | Pas d'extraction musicale YouTube dans les reels/lives | 🟢 Conforme | — |
| YT-4 | ACRCloud (protection copyright général, non spécifique YouTube) potentiellement inactif en prod | 🟡 Moyen | S (une fois décidé) |
| YT-5 | App OAuth Google en mode Testing — bloque YouTube pour la majorité des utilisateurs | 🟠 Élevé (produit) | L (délai Google) |

*Findings LEG-6 à LEG-10 hérités de `commun/docs/audit/AUDIT-CONSOLIDE.md` (2026-07-22), reconfirmés inchangés à ce jour.*
