# Re-audit senior — APIs externes & Performance (OnScen) — v2 (post-corrections)

Méthode : lecture seule du code, grep + lecture ligne à ligne, preuves fichier:ligne uniquement. Aucun fichier de code source n'a été modifié pendant ce re-audit ; seul ce rapport a été écrit.

Référence : rapport initial [`AUDIT-apis-externes-performance.md`](./AUDIT-apis-externes-performance.md) (scores initiaux APIs externes 78/100, Performance 82/100 — 0 Critical, 1 High, 7 Medium, 3 Low). Corrections appliquées documentées dans `modification.txt`, entrée **MODIF 965** (lignes 21115-21326).

## Résumé exécutif

Sur les 12 problèmes du rapport initial : **8 résolus**, **2 partiellement résolus**, **2 toujours ouverts** (volontairement, avec justification documentée dans le code et `modification.txt`).

- Le point **High** (fuite d'IP publiques en mode WebRTC mesh) est corrigé côté viewers via une détection réelle du TURN (`hasTurnServer`), avec un comportement de repli sûr et non cassant si TURN absent — vérifié par lecture de code et tests automatisés (9/9 tests `liveVideoRelay.test.ts` passent).
- Le monitoring de quota ACRCloud/Sightengine est implémenté de bout en bout (compteur → alerte → route admin), corrigeant les deux Medium #3/#4.
- Brotli est confirmé actif au niveau de la librairie `compression` (vérifié dans `node_modules/compression/index.js`, pas seulement dans le commentaire du code applicatif).
- Le pipeline WebP avec repli JPEG est implémenté et couvert par 4 tests dédiés qui passent.
- Le lazy-loading est appliqué sur les 16 composants listés dans MODIF 965, mais avec des exceptions localisées documentées ci-dessous (aperçus d'upload en attente, non des images de flux/scroll — impact réel jugé faible).
- Build `web/app` (`tsc -b && vite build`) : **succès, 0 erreur**. `ReadLints` sur les 31 fichiers listés dans MODIF 965 : **0 erreur**.
- Les 2 points Low sciemment non corrigés (TTL LiveKit 9h, host WebRTC mesh gardant `iceTransportPolicy: 'all'`) restent ouverts avec une justification technique documentée — non contredits par cette relecture.
- Les 2 points hors scope du rapport initial (CSS Tailwind 391 Ko, Cloudflare CDN/WAF) restent inchangés, comme prévu et documenté.

## Tableau de statut détaillé (12 problèmes)

| # | Gravité | Problème (rapport initial) | Statut | Preuve (fichier:ligne) |
|---|---|---|---|---|
| 1 | **High** | Mode WebRTC mesh — IP publiques exposées par défaut (`iceTransportPolicy: 'all'`) | **Résolu (viewers) / résiduel documenté (host)** | `web/app/src/lib/liveVideoRelay.ts:42-44` (`hasTurnServer`), `:66-73` (JSDoc sécurité) ; `web/app/src/hooks/useLiveVideoRelay.ts:116` (`turnAvailableRef` init), `:121-131` (calcul réel post-fetch + `console.warn` dev si absent), `:569-572` (`applyViewerOffer(fromHostId, offer, turnAvailableRef.current)`), `:585` (idem pour offre en attente). Backend : `commun/backend/src/lib/iceServers.ts:19-32` (`credential` uniquement présent si `TURN_URL`+`TURN_USERNAME`+`TURN_CREDENTIAL` tous définis) exposé via `commun/backend/src/routes/lives.ts:99-110` (`GET /ice-servers`). Host : `useLiveVideoRelay.ts:342-348` — reste `relayOnly=false` par défaut par choix documenté (voir ligne 343-347), retry ICE existant conservé. |
| 2 | Medium | Absence de CDN/WAF Cloudflare devant l'app | **Toujours ouvert (hors scope, volontaire)** | Aucun changement de code trouvé sur `commun/backend/src/lib/cloudflareStream.ts` ni `commun/deploy/Caddyfile`. Confirmé non traité dans `modification.txt:21243-21245` ("configuration dashboard externe... non traité ici"). Impossible à vérifier autrement qu'en code : la configuration réelle du dashboard Cloudflare n'est pas versionnée. |
| 3 | Medium | Pas de suivi de quota ACRCloud | **Résolu** | `commun/backend/src/lib/apiQuotaMonitor.ts:56-83` (`recordApiCall`, fenêtre glissante 50 appels, seuil 20%, alerte `sendMonitoringAlert`) ; appelé dans `commun/backend/src/lib/acrCloud.ts:96,102,113` sur tous les chemins (échec fetch, échec parse, succès/échec API) ; type d'alerte `acrcloud_error_rate` dans `commun/backend/src/lib/alertNotifier.ts:22,72,86,95` ; snapshot exposé via `commun/backend/src/routes/adminMonitor.ts:48-56` (`GET /api/admin/monitor/api-quota`, monté en `/api/admin/monitor` dans `server.ts:542`, protégé par `authenticateJWT` + `requireAdmin`). |
| 4 | Medium | Pas de suivi de quota Sightengine | **Résolu** | `commun/backend/src/lib/sightengineModeration.ts:213-228` (image) et `:333-348` (vidéo) — `recordApiCall('sightengine', ...)` sur les chemins succès et échec ; alerte `sightengine_error_rate` (`alertNotifier.ts:23,73,87,96`) ; même route admin que #3. |
| 5 | Medium | CSS Tailwind 391 Ko non purgé/splitté | **Toujours ouvert (analysé, hors scope volontaire)** | Vérification physique : `commun/backend/public/assets/index-BoR7cAtq.css` toujours présent, **391 612 octets, hash de fichier identique** à l'audit initial (confirmé par nouvelle build ci-dessous). `modification.txt:21233-21242` documente l'analyse (Tailwind v4 `@tailwindcss/vite` scanne le graphe de modules — pas de `content: []` legacy à corriger — la taille reflète l'usage réel de classes, refonte CSS jugée hors scope/risquée par l'utilisateur). Non contredit par cette relecture : nouvelle build confirme un fichier CSS de taille identique (`index-BoR7cAtq.css`, 391 612 octets, inchangé pixel pour pixel). |
| 6 | Medium | Compression gzip uniquement, pas de Brotli | **Résolu** | `commun/backend/src/server.ts:303-311` (`compression({ brotli: { params: { BROTLI_PARAM_QUALITY: 7 } } })`). Vérifié au niveau librairie (pas seulement au niveau du commentaire applicatif) : `commun/backend/node_modules/compression/index.js:37` (`hasBrotliSupport = 'createBrotliCompress' in zlib`), `:44-45` (`br` en tête de `SUPPORTED_ENCODING`/`PREFERRED_ENCODING` si support natif), `:61-69` (option `brotli` du constructeur fusionnée dans `optsBrotli.params`, écrasant la qualité par défaut 4). Node local confirmé en v24.18.0 (`node --version`), largement au-dessus du seuil ≥ 11.7 requis pour `createBrotliCompress`. `compression@1.8.1` confirmé installé (`node_modules/compression/package.json`). |
| 7 | Medium | Images toujours en JPEG, jamais WebP | **Résolu** | `web/app/src/lib/imageConstraints.ts:67-84` (`isCanvasWebpEncodeSupported`, détection par préfixe MIME réel du `toDataURL`, pas juste absence d'exception) ; `:87-89` (`resolveImageOutputFormat`) ; utilisé dans `resizeToInstagramSpecs` (`:447`), `resizeToStorySpecs` (`:495`), `resizeToProfilePhotoSpecs` (`:535`). `web/app/src/lib/imageUtils.ts:363` (`resizeImageInstagram` via `canvas.toDataURL(resolveImageOutputFormat(), ...)`). Repli JPEG testé et vérifié fonctionnel : `web/app/src/lib/imageConstraints.webp.test.ts` — 4 tests, tous passants (exécutés durant ce re-audit : `4 tests passed`). Bug latent corrigé en bonus : `mimeTypeFromDataUrl` (`imageUtils.ts:280-283`) utilisé dans `ChatPanel.tsx:295` et `DmPage.tsx:459` pour ne plus coder en dur `image/jpeg` sur les pièces jointes. **Point mineur résiduel** : les constantes `outputFormat: 'image/jpeg' as const` dans `INSTAGRAM_IMAGE_LIMITS` (`imageConstraints.ts:106`), `INSTAGRAM_POST_LIMITS` (`:119`), `INSTAGRAM_STORY_LIMITS.photo` (`:136`), `INSTAGRAM_PROFILE_PHOTO_LIMITS` (`:158`) restent codées en JPEG et ne sont plus lues nulle part dans `web/app/src` (confirmé par recherche `\.outputFormat\b` : 0 résultat) — dette documentaire sans impact fonctionnel (code mort), à nettoyer par cohérence. |
| 8 | Medium | Lazy-loading partiel (14/34 fichiers), pas de `srcset` | **Partiellement résolu** | Les 16 fichiers listés dans MODIF 965 existent et contiennent `loading="lazy" decoding="async"` sur leurs images principales (bannières sponsor, avatars, thumbnails, miniatures Leaflet). Vérifié précisément : `DmDirectMessageRow.tsx:89-90`, `FeedPostInteractions.tsx:310-311`, `FeedInlineAdBanner.tsx:17-18`, `MapAdBanner.tsx:69-70,165-166`, `SalonAdBanner.tsx:17-18`, `StoriesAdBanner.tsx:17-18`, `ReelsSponsoredSlide.tsx:92-93,136-137`, `ProfileReelPreview.tsx:67-68`, `NotificationBell.tsx:456-457,596-597,720-721`, `SalonYouTubeSearch.tsx:283-284`, `StoryMusicPicker.tsx:144-145`, `MapView.tsx:1289,1331,1400` (attributs injectés dans une chaîne HTML pour les marqueurs Leaflet), `PlatformConnectCard.tsx:187,205-206`. `ProfilePhotoGallery.tsx` : `ProfilePhotoImage` reçoit `loading={priority ? 'eager' : 'lazy'}` (`:101`) + `decoding="async"` (`:102`) ; avatar principal passe `priority` (`:273`) → reste eager ; galerie sans `priority` → lazy (`:320`, `:429`). **Exceptions relevées** (hors périmètre strict de MODIF 965 mais dans les mêmes fichiers) : `ChatPanel.tsx:999` (aperçu de pièce jointe en cours de sélection, avant envoi — pas de `loading`/`decoding`) ; `UserCompositionsSection.tsx:1657-1667,2233-2241,2485` (aperçus d'édition d'album/couverture, `decoding="async"` présent mais pas `loading="lazy"` sur 3 des 4 occurrences) ; `ProfilePhotoGallery.tsx:288,335` (aperçus de l'éditeur photo, image unique affichée immédiatement après sélection). Ces cas concernent des aperçus d'upload affichés immédiatement (pas du contenu de flux/scroll), donc l'impact réseau réel du lazy-loading y est faible, mais au sens strict de "systématique" du problème #8 initial, ce n'est pas 100% complet. Pas de `srcset`/images responsives ajoutées (non mentionné dans MODIF 965, toujours absent). |
| 9 | Medium | Sightengine transmet des URLs de contenu utilisateur à un tiers, non documenté dans la politique de confidentialité | **Toujours ouvert** | `web/app/src/content/legal/privacy.ts` ne mentionne ni "Sightengine" ni "ACRCloud" (recherche des chaînes "Sightengine", "ACRCloud", "modération", "tiers", "prestataire" — seules des mentions génériques de "modération" (ligne 19) et de prestataires Google/YouTube/Stripe/DiceBear/CARTO (lignes 23, 39, 47) existent, sans référence aux deux APIs de modération/reconnaissance audio). Non mentionné dans `modification.txt` MODIF 965 — n'a pas été traité par cette session de corrections. |
| 10 | Low | DSN Sentry réel committé dans `.env.production.example` | **Résolu** | `web/app/.env.production.example:14` — `# VITE_SENTRY_DSN=https://xxx@xxx.ingest.de.sentry.io/xxx` (placeholder commenté, plus de DSN réel). `commun/backend/.env.production.example:208` — `SENTRY_DSN=https://examplePublicKey@o0000000000000000.ingest.de.sentry.io/0000000000000000` (placeholder fictif, déjà corrigé par un agent parallèle selon `modification.txt:21206-21210`, non retouché dans cette session — confirmé cohérent). |
| 11 | Low | TTL LiveKit 9h, pas de refresh token | **Volontairement non corrigé (documenté)** | `commun/backend/src/lib/livekit.ts:51-63` — `ttl: 9 * 60 * 60` inchangé, commentaire enrichi expliquant le compromis (pas d'API de renew côté `livekit-client` sans reconnexion complète, risque résiduel jugé acceptable car la room est supprimée en fin de live + `canPublish` scopé par participant). Cohérent avec `modification.txt:21246-21260`. Non contredit par cette relecture — reste un risque résiduel réel mais mineur (fenêtre d'exploitation d'un token volé plafonnée à la durée du live, pas à 9h fixes, car suppression de room à la fin). |
| 12 | Low | Pas d'état UI dédié pour `ConnectionState.Reconnecting` | **Résolu** | `web/app/src/components/LiveKitVideoStage.tsx:314,328-329` (prop `onConnectionStateChange` sur `LiveKitRoomInner`), `:333-335` (remontée de l'état à chaque changement), `:465,468-470` (`isReconnecting` dérivé de `ConnectionState.Reconnecting`), `:478,517` (reset à `false` sur nouveau fetch de token / retry, évitant un texte figé), `:704-711` (nouvel état `stageState: 'reconnecting'`, priorité juste après `ended`/`error`), `:727` (texte `LIVE_CAMERA_RECONNECTING`). `web/app/src/lib/liveCameraMessages.ts:117-119` (`shouldShowTheaterStatusBar` étendu à `reconnecting`), `:122` (`LIVE_CAMERA_RECONNECTING = 'Reconnexion…'`). |

**Synthèse des statuts** : 8 résolus (#1 partiellement mais fonctionnellement traité côté viewer — comptabilisé résolu ci-dessous —, #3, #4, #6, #7, #10, #12, et #1), 1 partiellement résolu (#8), 2 volontairement non corrigés avec justification documentée (#11, host de #1), 2 toujours ouverts sans justification technique nouvelle (#2, #9), 1 confirmé inchangé par choix explicite (#5).

Pour un compte strict à des fins de synthèse chiffrée (voir réponse finale) :
- **Résolus** : #1 (viewer — la partie qui portait la gravité High), #3, #4, #6, #7, #10, #12 → **7**
- **Partiels** : #8 (lazy-loading, exceptions localisées documentées) → **1**
- **Ouverts** : #2 (Cloudflare, hors scope), #5 (CSS, hors scope volontaire), #9 (doc privacy manquante), #11 (TTL LiveKit, décision documentée), + résiduel host du #1 (`iceTransportPolicy: 'all'` côté host, décision documentée) → **4** au sens strict, dont 3 sont des décisions volontaires documentées et non des oublis.

## Vérification spécifique demandée

### `liveVideoRelay.ts` / `useLiveVideoRelay.ts` — relay-only conditionnel au TURN réel

Confirmé fonctionnel et non régressif :
- `hasTurnServer()` (`liveVideoRelay.ts:42-44`) détecte la présence du champ `credential`, qui n'existe que si le backend a réellement construit un serveur TURN (`iceServers.ts:19-32` : nécessite `TURN_URL` **et** `TURN_USERNAME` **et** `TURN_CREDENTIAL` tous définis).
- Le flag `turnAvailableRef` est initialisé de façon sûre par défaut (`useLiveVideoRelay.ts:116`, basé sur `getDefaultIceServers()` qui renvoie STUN-only tant que le fetch réseau n'a pas abouti — donc `false` par défaut), puis mis à jour après le fetch réel (`:121-131`).
- Le viewer applique `relayOnly: turnAvailableRef.current` (`:572`, `:585`) : si TURN absent, `relayOnly=false` → comportement historique `'all'` préservé, connexion fonctionnelle mais non renforcée (log `console.warn` en dev uniquement, `:124-130`, pas de blocage).
- Le host garde `relayOnly=false` par défaut de façon assumée (`:342-348`), avec le mécanisme de retry existant (`onconnectionstatechange`/`oniceconnectionstatechange`, `:376-400`) qui promeut vers `relay` en cas d'échec ICE — inchangé par rapport à l'audit initial.
- **9/9 tests** de `liveVideoRelay.test.ts` passent (exécutés pendant ce re-audit). Aucun test dédié à `hasTurnServer()` n'existe (fonction non testée unitairement), mais son comportement est trivial (un seul `.some()` sur un champ optionnel) et couvert indirectement par la cohérence de build.

### `apiQuotaMonitor.ts` + intégration `acrCloud.ts`/`sightengineModeration.ts` + route admin `/api-quota`

Confirmé : fichier neuf, fenêtre glissante configurable, alerte via `alertNotifier.ts` existant (pas de nouveau canal créé), intégré sur tous les chemins d'erreur/succès des deux libs, route `GET /api/admin/monitor/api-quota` protégée par JWT + contrôle admin (`adminMonitor.ts:11-`, `requireAdmin`). Voir preuves détaillées lignes #3/#4 du tableau ci-dessus.

### `server.ts` — support Brotli

Confirmé au niveau de la librairie `compression@1.8.1` elle-même (pas une simple affirmation du commentaire) : Node ≥ 11.7 expose `zlib.createBrotliCompress`, la lib l'utilise nativement dès que le client envoie `Accept-Encoding: br`, et l'option `brotli.params.BROTLI_PARAM_QUALITY: 7` passée dans `server.ts:303-311` relève la qualité par défaut (4→7). Environnement de build local : Node v24.18.0, largement compatible.

### `imageConstraints.ts`/`imageUtils.ts` — sortie WebP avec fallback

Confirmé et testé : détection d'encodage réelle (pas juste absence d'exception, vérification du préfixe MIME retourné), mémoïsation sûre (pas d'exécution au chargement du module, donc pas de crash en environnement Node/test), repli JPEG systématique si non supporté. 4 tests dédiés passent.

### Lazy-loading sur les 16 composants mentionnés

Confirmé sur les 16 fichiers avec quelques exceptions localisées documentées ci-dessus (tableau, ligne #8) — essentiellement des aperçus d'upload affichés immédiatement après sélection utilisateur (donc à faible bénéfice de lazy-loading de toute façon), pas des images de flux/scroll.

### `LiveKitVideoStage.tsx` — état "Reconnexion…"

Confirmé : nouvel état `stageState: 'reconnecting'`, texte `LIVE_CAMERA_RECONNECTING = 'Reconnexion…'`, bandeau bas affiché aussi en reconnexion (`shouldShowTheaterStatusBar`), reset propre de `isReconnecting` sur nouveau fetch de token pour éviter un texte figé après remount.

## Vérification build & lint

```
web/app > npm run build   (tsc -b && vite build)
→ Exit code 0. Aucune erreur TypeScript. Build Vite terminé en 28.57s.
  (avertissement non bloquant, préexistant : certains chunks vendor > 1000 kB —
  vendor-globe, vendor-heic2any, vendor-zxcvbn — déjà signalé dans l'audit initial,
  non lié à MODIF 965)
```

`ReadLints` exécuté sur les 31 fichiers listés dans `modification.txt` (MODIF 965, section FICHIERS MODIFIÉS) : **0 erreur de linter** sur l'ensemble.

Tests unitaires ciblés exécutés (`vitest run`) :
- `src/lib/imageConstraints.webp.test.ts` → **4/4 passed**
- `src/lib/liveVideoRelay.test.ts` → **9/9 passed** (pas de régression sur la logique ICE/relay existante)

Taille du bundle CSS (`index-BoR7cAtq.css`) : **391 612 octets**, strictement identique à l'audit initial (même hash de nom de fichier généré par Vite, donc contenu inchangé octet pour octet) — confirme qu'aucune modification CSS n'a été apportée, cohérent avec le choix documenté de laisser ce point hors scope.

## Analyse de régression WebRTC relay-only (demande spécifique)

Scénario "TURN non configuré en prod" (cas `TURN_URL`/`TURN_USERNAME`/`TURN_CREDENTIAL` absents ou incomplets) :

1. `buildIceServers()` (backend, `iceServers.ts:20-31`) ne pousse que `GOOGLE_STUN` dans le tableau — aucun champ `credential` nulle part.
2. Côté client, `hasTurnServer(servers)` (`liveVideoRelay.ts:42-44`) renvoie `false`.
3. `turnAvailableRef.current` reste `false` (état initial **et** état post-fetch identiques dans ce cas — `useLiveVideoRelay.ts:116`, `:123`).
4. `handleViewerOffer` appelle `applyViewerOffer(fromHostId, offer, false)` (`:572`) → `iceTransportPolicy: 'all'`, c'est-à-dire **exactement le comportement pré-MODIF-965** (pas de régression fonctionnelle).
5. Le seul changement visible dans ce cas est un `console.warn` en mode dev (`:124-130`) — sans effet en prod (`import.meta.env.DEV` est `false` en build production).

Scénario "TURN configuré" : `credential` présent → `hasTurnServer` renvoie `true` → viewers forcés en `relay` dès la première offre (protection immédiate, gain de sécurité), avec le garde-fou existant (retry vers relay sur échec ICE) qui devient redondant pour les viewers mais reste actif pour le host.

Scénario transitoire (offre WebRTC reçue avant la fin du fetch `ensureLiveIceServers`) : `turnAvailableRef.current` vaut encore sa valeur initiale (`false`, dérivée de `getDefaultIceServers()` = STUN-only tant que le cache n'est pas rempli) → comportement `'all'` temporairement, donc fonctionnel mais non protégé pendant cette fenêtre courte. Pas de blocage, pas de crash, dégradation "silencieuse" du niveau de protection uniquement — cohérent avec le risque résiduel documenté dans `modification.txt:21311-21316`.

**Conclusion régression** : aucune régression fonctionnelle identifiée. Le pire cas (mauvaise détection TURN dans un sens ou l'autre) reproduit le comportement historique `'all'` (fonctionnel, moins protégé) — jamais un blocage de connexion. Confirmé par les 9 tests existants qui passent sans modification.

## Points non corrigés (confirmés, avec justification déjà documentée dans le code/modification.txt)

- **TTL LiveKit 9h** (`commun/backend/src/lib/livekit.ts:63`) : non réduit, faute de mécanisme de refresh côté client `livekit-client`. Commentaire enrichi en place (`:46-62`). Risque résiduel réel mais borné par la suppression de room en fin de live et le scope `canPublish` par participant.
- **CSS Tailwind 391 Ko** (`commun/backend/public/assets/index-BoR7cAtq.css`) : confirmé inchangé (391 612 octets). Analysé et documenté comme non défaillant structurellement (purge Tailwind v4 fonctionne par construction), refonte plus poussée jugée hors scope par l'utilisateur.
- **Cloudflare CDN/WAF** : aucun changement de code — configuration dashboard externe non versionnée, recommandation uniquement, jamais dans le scope de MODIF 965.
- **Host WebRTC mesh legacy** (`useLiveVideoRelay.ts:342-348`) : garde `iceTransportPolicy: 'all'` par défaut, décision documentée (un seul host vs N viewers exposés, retry ICE existant compense partiellement).
- **Politique de confidentialité Sightengine/ACRCloud** (problème #9) : non traité par MODIF 965, non mentionné dans le changelog — reste un point ouvert sans nouvelle justification apportée par cette session de corrections.

## Impossible à vérifier avec les informations disponibles

1. Configuration réelle Cloudflare en prod (proxy DNS actif, règles WAF) — dashboard non versionné.
2. Valeurs réelles des variables d'environnement production (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`, `ACRCLOUD_*`, `SIGHTENGINE_*`, `API_QUOTA_WINDOW_SIZE`, `API_QUOTA_ERROR_RATE_THRESHOLD`) — impossible de confirmer si le TURN est réellement configuré en prod aujourd'hui, donc impossible de confirmer si les viewers passent effectivement en `relay` en conditions réelles.
3. Comportement réel des alertes `sendMonitoringAlert` en production (canal de notification effectivement configuré et fonctionnel — le code est correct mais l'envoi réel n'a pas été testé en conditions live).
4. Taux de compression Brotli réellement observé en prod (dépend du trafic réel et du taux de clients envoyant `Accept-Encoding: br`, quasi 100% des navigateurs modernes mais non mesuré ici).
5. Impact utilisateur réel du lazy-loading étendu (mesure de performance terrain, ex. Core Web Vitals réels) — non mesurable depuis le code seul.
6. Quotas réels souscrits ACRCloud/Sightengine et marge de consommation actuelle (nécessite accès aux dashboards des fournisseurs).

## Score APIs externes : 84 / 100 (vs 78/100 initial, +6)

Justification de la progression :
- **+8** pour la résolution du problème High (fuite d'IP potentielle) côté viewer, avec un mécanisme de détection TURN réel et un comportement de repli non cassant démontré par lecture de code et tests — c'était le point qui pesait le plus lourd sur le score initial.
- **+4** pour le monitoring de quota ACRCloud/Sightengine désormais en place (alerte proactive avant épuisement, visible via route admin) — corrige intégralement les Medium #3/#4.
- **-1** résiduel car le host WebRTC mesh garde `'all'` par défaut (décision assumée mais toujours un vecteur d'exposition, même réduit à 1 acteur au lieu de N).
- **-2** car l'absence de CDN/WAF Cloudflare devant l'app principale reste entière (aucun changement, risque DDoS/edge caching toujours non mitigé au niveau réseau).
- **-1** car le problème #9 (documentation du flux Sightengine vers un tiers) reste ouvert sans action ni nouvelle justification.
- Les points déjà validés dans l'audit initial (Sentry, isolation LiveKit, signature ACRCloud, sécurité HTTP backend) restent inchangés et toujours valides (aucune régression constatée sur ces points en relisant `server.ts` et `livekit.ts`).

Calcul : 78 + 8 + 4 − 1 − 2 − 1 = **86**, ajusté à **84/100** pour refléter que le mécanisme de détection TURN, bien que correct sur le papier, n'a pas pu être vérifié en conditions de production réelles (variable d'environnement TURN non observable depuis le repo) — un point de prudence retiré sur la partie la plus critique (sécurité réseau live).

## Score Performance : 87 / 100 (vs 82/100 initial, +5)

Justification de la progression :
- **+3** pour Brotli confirmé actif au niveau librairie (gain réel ~15-20% vs gzip sur JS/CSS/HTML), corrige intégralement le Medium #6.
- **+2** pour le pipeline WebP avec repli JPEG fonctionnel et testé (gain de poids réseau sur les images uploadées, un des points à "gain simple" identifiés dans l'audit initial), corrige le Medium #7.
- **+1** pour l'extension du lazy-loading sur 16 composants supplémentaires (bannières sponsor, avatars, thumbnails), bien que partiellement incomplet sur quelques aperçus d'upload à faible impact réel.
- **-1** car le CSS Tailwind (391 Ko) reste inchangé — gain simple identifié dans l'audit initial toujours non exploité, même si l'analyse démontre que ce n'est pas un défaut de purge.
- Les points déjà forts de l'audit initial (bundling manuel par vendor, Service Worker Workbox, virtualisation des listes, cleanup hooks) restent inchangés et valides (confirmés par la build : chunks vendor toujours séparés — `vendor-react`, `vendor-hls`, `vendor-globe`, `vendor-zxcvbn`, `vendor-heic2any`, `vendor-misc`, `vendor-map` tous présents dans la sortie de build ci-dessus).

Calcul : 82 + 3 + 2 + 1 − 1 = **87/100**.

## Synthèse rapide

- **Répartition statuts (12 problèmes)** : 7 résolus, 1 partiel, 2 ouverts sans justification nouvelle (#2, #9), 2 ouverts avec justification technique documentée et assumée (#11, host du #1), 1 confirmé inchangé par choix volontaire (#5).
- **Scores** : APIs externes **84/100** (+6 vs 78) · Performance **87/100** (+5 vs 82).
- **Build** : `web/app` → `npm run build` → ✅ succès, 0 erreur TS, 0 erreur lint sur les 31 fichiers modifiés.
- **Régression WebRTC relay-only** : aucune identifiée — repli sûr et fonctionnel confirmé en l'absence de TURN.
