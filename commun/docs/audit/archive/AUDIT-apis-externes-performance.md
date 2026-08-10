# Audit senior — APIs externes & Performance (OnScen)

Méthode : lecture seule, grep + lecture de code, preuves fichier:ligne uniquement.

## Résumé exécutif

**APIs externes** : intégrations Sentry, LiveKit, Cloudflare Stream, ACRCloud et Sightengine globalement bien conçues (secrets côté serveur, fail-open/fail-closed explicites, `sendDefaultPii: false`, isolation de room LiveKit par live, rôle host/viewer déterminé serveur). Le point le plus sérieux est un mode WebRTC mesh P2P legacy encore actif en repli (`resolveStreamModeForHost` → `'webrtc'`) qui expose les IP publiques host/viewer par défaut. Absence de CDN/WAF Cloudflare devant l'app principale (Cloudflare n'est utilisé que pour Stream).

**Performance** : bundling et lazy-loading très matures (code-splitting manuel par vendor, 10 pages en `React.lazy`, zxcvbn/heic2any/globe chargés à la demande, Workbox avec `StaleWhileRevalidate` sur les assets et `NetworkOnly` sur l'API, `VirtualList` sur les feeds/DM). Points faibles : CSS bundle volumineux (391 Ko brut), compression gzip uniquement (pas de brotli/précompression), pas de conversion WebP/AVIF malgré un pipeline de compression client déjà en place.

- 0 Critical
- 1 High
- 7 Medium
- 3 Low

## Tableau des problèmes

| # | Gravité | Domaine | Fichier(s) / Ligne(s) | Description | Solution | Difficulté |
|---|---|---|---|---|---|---|
| 1 | **High** | WebRTC | `web/app/src/lib/liveVideoRelay.ts:57-65` (`iceTransportPolicy: opts?.relayOnly ? 'relay' : 'all'`) ; `web/app/src/hooks/useLiveVideoRelay.ts:354-368,490-508` (relay forcé seulement après échec ICE) | Mode `streamMode: 'webrtc'` (mesh P2P legacy, jusqu'à 30 viewers, `liveVideoRelay.ts:8`) utilisé en repli quand LiveKit/Cloudflare ne sont pas configurés ou non permis par le plan (`commun/backend/src/lib/platformPlans.ts:226-231`). Par défaut la politique ICE est `'all'` : les connexions réussies exposent les IP publiques du host et des viewers via candidats srflx/host, avant tout repli TURN. Le TURN est en plus optionnel et commenté par défaut (`commun/backend/.env.production.example:223-227`, `commun/backend/src/lib/iceServers.ts:19-32`) — donc en prod, `relayOnly` peut ne servir à rien faute de serveur TURN réel. | Forcer `iceTransportPolicy: 'relay'` pour tous les non-hôtes par défaut (host peut garder `'all'` si TURN dispo), ou déprécier ce mode au profit exclusif de LiveKit (SFU serveur, pas de P2P direct). | M–L |
| 2 | Medium | Cloudflare / infra | `commun/backend/src/lib/cloudflareStream.ts` (usage exclusif Stream) ; `commun/deploy/Caddyfile:1-64` (TLS Let's Encrypt direct sur le VPS, pas d'edge Cloudflare visible) | Cloudflare n'est utilisé que pour Stream (ingest RTMP live). Aucun CDN/WAF Cloudflare devant l'app principale — un seul PoP (VPS fr-par-2), pas de cache edge pour les assets statiques, pas de protection DDoS volumétrique réseau visible dans le repo (le rate-limiting est fait au niveau applicatif uniquement). | Activer le proxy Cloudflare (DNS orange cloud) devant Caddy + règles WAF de base + cache Argo pour `/assets/*`. | M (config dashboard) |
| 3 | Medium | ACRCloud | `commun/backend/src/lib/acrCloud.ts` / `acrCloudConfig.ts` (aucun compteur d'appels) | Pas de suivi de quota ACRCloud dans le code (pas de compteur de requêtes/mois, pas d'alerte proactive). En cas de dépassement de quota, l'API renverra une erreur que le code traite en fail-closed par défaut en prod (`acrCloudConfig.ts:57-60`) → tous les uploads audio bloqués silencieusement jusqu'à investigation manuelle. | Ajouter un compteur d'appels + alerte via `alertNotifier.ts` existant quand le taux d'erreur ACRCloud dépasse un seuil. | S |
| 4 | Medium | Sightengine | `commun/backend/src/lib/sightengineConfig.ts` (aucun compteur d'appels) | Même constat que #3 pour Sightengine : pas de suivi de quota, pas d'alerte proactive avant épuisement du plan. | Idem #3. | S |
| 5 | Medium | Performance / CSS | `commun/backend/public/assets/index-BoR7cAtq.css` = 391 612 octets non compressés | Bundle CSS unique de 391 Ko (Tailwind) chargé sur toutes les pages — élevé pour une SPA, impacte le temps de parsing CSS sur mobile bas de gamme (contrainte 390px du projet). | Vérifier les globs `content` Tailwind v4 (purge effective), envisager un split CSS par route ou du critical CSS above-the-fold. | M |
| 6 | Medium | Performance / compression | `commun/backend/src/server.ts:291` (`app.use(compression())` sans option) ; 0 fichier `.gz`/`.br` trouvé dans `commun/backend/public/assets/` | Compression uniquement gzip niveau par défaut, pas de Brotli (gain ~15-20% supplémentaire sur JS/CSS/HTML), pas de précompression statique au build. | Ajouter Brotli (zlib natif Node ≥ 11.7 ou plugin) en middleware, ou précompresser au build avec `vite-plugin-compression`. | S–M |
| 7 | Medium | Performance / images | `web/app/src/lib/imageConstraints.ts:63,76,93,115` (`outputFormat: 'image/jpeg'` partout : post, story, photo de profil) | Toutes les images uploadées sont recompressées côté client en JPEG (canvas `toBlob`), jamais en WebP/AVIF, alors que le pipeline de compression est déjà en place. | Passer `outputFormat` à `'image/webp'` (avec repli JPEG pour anciens Safari) dans les 3 fonctions `resizeTo*Specs`. | S |
| 8 | Medium | Performance / images | Sur ~34 fichiers composants avec `<img>`, seuls 14 utilisent `loading="lazy"` (ex. `LivesBrowseGrid.tsx`, `MapStoryRings.tsx`) ; pas de `srcset`/responsive images trouvé | Lazy-loading natif appliqué de façon partielle, pas de tailles responsives (`srcset`) — surcoût réseau/CPU sur mobile, contraire à la règle mobile-first du projet. | Ajouter `loading="lazy" decoding="async"` systématiquement sur les `<img>` hors above-the-fold. | S |
| 9 | Medium | Sightengine / confidentialité | `commun/backend/src/lib/sightengineModeration.ts:164-189,259-284` (`SIGHTENGINE_MODERATE_REMOTE` activé par défaut → `sightengineConfig.ts:72-74`) | Les URLs publiques de contenus utilisateurs (photos de profil, stories, posts) sont transmises à l'API tierce Sightengine qui les récupère elle-même. Flux standard pour ce type d'API, mais implique une exposition de contenu utilisateur à un tiers non documentée explicitement dans le code. | Documenter ce flux dans la politique de confidentialité OnScen si pas déjà fait (`content/legal/privacy.ts`) ; envisager désactiver `SIGHTENGINE_MODERATE_REMOTE` si un flux data-URL avant stockage est possible partout. | S (doc) |
| 10 | Low | Sentry | `web/app/.env.production.example:13` (`VITE_SENTRY_DSN=https://f4ae28ba9f6b498fc97027e5969e80cd@o4511654862258176.ingest.de.sentry.io/...` — valeur réelle, pas un placeholder) vs `web/app/.env.preproduction.example:7` (correctement commenté) | Un vrai DSN Sentry prod est committé dans le fichier `.example`. Un DSN client n'est pas un secret critique (conçu pour être exposé au bundle), mais l'incohérence avec le fichier preprod est une mauvaise pratique d'hygiène. | Remplacer par un placeholder commenté, comme pour le fichier preprod. | S |
| 11 | Low | LiveKit | `commun/backend/src/lib/livekit.ts:43-51` (`ttl: 9 * 60 * 60`) | Token LiveKit valide 9h — long comparé aux standards (souvent 1-2h), justifié par un commentaire (alignement sur `LIVE_MAX_DURATION_MS` 8h + marge). Pas un bug, mais un token intercepté reste exploitable longtemps (risque atténué par HTTPS + scope `roomJoin` limité au `roomName` du live). | Réduire le TTL et ajouter un refresh automatique côté client avant expiration. | S |
| 12 | Low | LiveKit / UX | `web/app/src/components/LiveKitVideoStage.tsx:327-334` | Seul `ConnectionState.Disconnected` est géré explicitement dans `LiveKitRoomInner` ; pas de traitement UI dédié pour `Reconnecting` (le SDK LiveKit gère la reconnexion technique en interne avec backoff, mais l'UI ne distingue pas cet état pour l'utilisateur). | Ajouter un état/texte "Reconnexion…" sur `ConnectionState.Reconnecting`. | S |

## Points validés (preuve à l'appui, pas de problème)

- **Sentry** (`web/app/src/lib/sentry.ts:11-73`, `commun/backend/src/lib/errorMonitoring.ts:57-115`) : `sendDefaultPii: false`, `beforeSend` filtrant (bruit navigateur / erreurs réseau transitoires via `sentryFilters.ts:1-14`), `tracesSampleRate` bas (0.05 par défaut), `environment` correctement séparé, Session Replay avec `maskAllText: true, blockAllMedia: true`.
- **LiveKit — rôles & isolation** (`commun/backend/src/routes/lives.ts:518-539`, `commun/backend/src/lib/livekit.ts:43-61`) : `canPublish` déterminé côté serveur uniquement (`live.hostId === me.id`), jamais fourni par le client ; room isolée par live (`live_${liveId}`) ; aucune désactivation DTLS-SRTP trouvée.
- **ACRCloud** : signature HMAC-SHA1 correcte (`acrCloud.ts:31-38`), host EU par défaut pour RGPD (`acrCloudConfig.ts:41-44`), échantillon plafonné à 5 Mo et jamais persisté au-delà du traitement synchrone en mémoire (`acrCloud.ts:59-111`), fail-closed par défaut en prod (`acrCloudConfig.ts:57-60`).
- **Sécurité HTTP backend** (`commun/backend/src/server.ts:290-505`) : CSP avec nonce par requête, HSTS 1 an en prod, `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment` sur `/uploads/`, cache `immutable` 1 an sur assets hashés vs `no-cache` sur `index.html`/`sw.js`, rate-limiting applicatif extensif.
- **Performance — bundling** (`web/app/vite.config.ts:264-297`) : chunks manuels par librairie lourde (react, socket.io, livekit, leaflet, three/globe, heic2any, zxcvbn, hls.js), `zxcvbn` (819 Ko) et `heic2any`/`globe` chargés en dynamic import uniquement à l'usage.
- **Service Worker** (`commun/backend/public/sw.js:1`, `vite.config.ts:165-224`) : precache limité à l'app-shell, `NetworkOnly` pour `/api` et `/socket.io`, `StaleWhileRevalidate` pour `/assets/` avec expiration.
- **Listes lourdes** : `VirtualList` utilisé sur `ActualiteTabPage.tsx` et `DmPage.tsx` ; `useDebouncedApiSearch.ts` (350ms) pour les recherches ; pagination présente sur le fil.
- **Cleanup hooks** : échantillon vérifié (`useSalonQueueSync.ts`, `useSalonPlaybackSync.ts`, `useLiveVideoRelay.ts`, `useCloudflareHlsPlayback.ts`, `SalonYouTubePlayer.tsx`) — tous les `setInterval`/listeners socket ont un cleanup correct.
- **Socket.io reconnection** (`web/app/src/lib/socket.ts:37-46`) : comportement par défaut socket.io (backoff exponentiel jusqu'à 5s), sain.

## Score APIs externes : 78 / 100

Justification : intégrations individuelles (Sentry, LiveKit, ACRCloud, Sightengine) rédigées avec un vrai souci de sécurité et de conformité. Le score est pénalisé par un problème High réel (fuite d'IP potentielle du mode WebRTC mesh), l'absence de CDN/WAF devant l'app principale, et l'absence totale de monitoring de quota sur les APIs de modération tierces.

## Score Performance : 82 / 100

Justification : architecture de bundling et de cache exemplaire (code-splitting, lazy routes, Workbox, virtualisation des listes), mais des gains simples et déjà à portée de main restent non exploités (Brotli, WebP/AVIF, lazy-loading systématique des images, taille du bundle CSS).

## Impossible à vérifier avec les informations disponibles

1. Configuration réelle Cloudflare (proxy DNS actif ou non, règles WAF, cache rules) — dashboard non versionné dans le repo.
2. Valeurs réelles des clés en production (`ACRCLOUD_*`, `SIGHTENGINE_*`, `LIVEKIT_*`, `TURN_URL`/`TURN_USERNAME`/`TURN_CREDENTIAL`, `CLOUDFLARE_*`) — impossible de confirmer si le mode WebRTC mesh est réellement atteint en prod aujourd'hui.
3. Quotas réels souscrits ACRCloud et Sightengine (plan, consommation actuelle, marge restante).
4. CGU / politique de rétention des données chez Sightengine et ACRCloud concernant les échantillons/images transmis pour analyse.
5. Taille réellement transférée sur le réseau (gzip/brotli au runtime) — seules les tailles brutes sur disque ont été mesurées.
6. Répartition géographique réelle des utilisateurs finaux, pertinente pour évaluer l'impact de l'absence de CDN.

## Synthèse rapide

- **Répartition** : 0 Critical, 1 High, 7 Medium, 3 Low.
- **Scores** : APIs externes 78/100 · Performance 82/100.
