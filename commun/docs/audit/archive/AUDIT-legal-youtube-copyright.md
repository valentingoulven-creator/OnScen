# Audit RGPD / YouTube / Copyright — OnScen

## Résumé exécutif

OnScen n'utilise **pas** YouTube comme source de fichiers audio téléchargés : la musique est diffusée exclusivement via le **lecteur officiel YouTube IFrame Player API**, piloté par ses méthodes publiques (`playVideo`, `pauseVideo`, `seekTo`, `setVolume`, `setPlaybackRate`). Les métadonnées (titre, artiste, miniature) proviennent de la **YouTube Data API v3** officielle ou de l'**oEmbed** officiel. **Aucune trace de `ytdl-core`, `yt-dlp`, `youtube-dl`, de scraping `ytInitialData`, d'appel à `googlevideo.com`, ni de conversion ffmpeg d'un flux YouTube n'a été trouvée dans l'intégralité du monorepo** (recherche exhaustive sur tous les `package.json` et tout le code source). C'est le point le plus important du cahier des charges et il est **négatif avec preuve solide** (aucune violation de copyright constatée).

Le seul point de vigilance copyright/ToS est la présence de **code mort** (`youtubeRemote.ts`) implémentant un fallback vers des proxys tiers non officiels (Piped/Invidious) — mais celui-ci ne récupère que des **métadonnées** (jamais de flux audio/vidéo), est explicitement documenté comme « non conforme aux ToS YouTube » dans le code lui-même, et est **bloqué en dur en production** par un garde-fou runtime vérifié.

Côté RGPD, l'implémentation est globalement **sérieuse et au-dessus de la moyenne** pour ce stade de projet : suppression de compte en cascade réellement effective en base (RAM + PostgreSQL + purge stockage objet), export de données JSON complet, bannière de consentement cookies qui bloque effectivement Stripe.js et le lecteur YouTube tant que l'utilisateur n'accepte pas, floutage GPS réellement implémenté (~50 m), Sentry configuré sans PII par défaut des deux côtés. En revanche, un point **High** a été trouvé avec preuve directe : le fichier de configuration des mentions légales contient une **adresse postale non renseignée** (placeholder littéral) et un **e-mail de contact RGPD qui est une adresse Gmail personnelle**, ce qui contredit l'avertissement inscrit dans le code lui-même.

Côté YouTube, l'intégration technique est propre (scope OAuth minimal `youtube.readonly`, cache 1h documenté conforme, gestion de quota `search.list`), mais la documentation interne du projet indique que **l'app OAuth Google est encore en mode « Testing » non vérifié en production**, ce qui limite/bloque la fonctionnalité pour le grand public et constitue un point de conformité produit à traiter.

## Section 7 — Conformité RGPD

| # | Gravité | Fichier(s) / ligne(s) | Description | Preuve | Solution | Difficulté |
|---|---------|------------------------|--------------|--------|----------|------------|
| RGPD-1 | **High** | `commun/msdev/legal-publisher.json` L4, L16-17 ; `web/app/src/content/legal/legalConfig.ts` L162-165, L174-176 ; `commun/backend/src/lib/legalPublisher.ts` L26-44 | Les mentions légales (obligation LCEN art. 6) utilisent un système de templating (`{{address}}`, `{{contactEmail}}`...). Dans la config locale, `address` est un placeholder non résolu et `contactEmail`/`privacyEmail` pointent vers un Gmail personnel — contraire à l'avertissement du code lui-même. Si non résolu, le texte affiché à l'utilisateur final devient littéralement `[À compléter : address — voir acompleter.txt]`. | `"address": "France — adresse postale complète à renseigner (voir acompleter.txt)"`, `"contactEmail": "valentin.goulven@gmail.com"` | Renseigner une adresse postale réelle + adresse pro dédiée (`privacy@getsoundy.com` déjà prévue comme constante mais pas utilisée dans ce fichier local) avant toute mise en production publique. Un script `verify-prod.sh` existe déjà et bloque le déploiement si placeholders détectés — s'assurer qu'il tourne bien avant chaque déploiement prod. | S |
| RGPD-2 | Medium | `commun/backend/src/db/migrations/018_app_diagnostic_logs.sql` L1-14 ; `commun/backend/src/lib/dataRetention.ts` L41-66 | La table `app_diagnostic_logs` stocke `username`, `user_agent`, `url`, `context` (JSONB, potentiellement PII) sans limite, alors que `runDataRetentionPass()` ne purge que `stories`, `notifications` et `resetTokens` — aucune purge programmée pour cette table. | Colonnes `user_id`, `username`, `user_agent`, `url`, `context` sans TTL ; fonction de purge n'y fait pas référence. | Ajouter une purge périodique (ex. 90-180 j) pour `app_diagnostic_logs`, cohérente avec le registre RGPD qui annonce « 12 mois max » pour les logs techniques. | S |
| RGPD-3 | Medium | `commun/backend/src/routes/auth.ts` L724-760 vs `commun/backend/src/routes/platforms.ts` L242 ; `commun/backend/src/lib/youtubeOAuth.ts` L261-270 | Lors de la suppression de compte (`DELETE /account`), le jeton OAuth YouTube n'est jamais révoqué auprès de Google (`revokeAndDisconnectYoutube`) — il est seulement supprimé de la base. Cette fonction n'est appelée que lors d'une déconnexion manuelle de plateforme, pas lors d'une suppression de compte. | `deleteUserAccountCascade(userId)` (L757) ne référence jamais `revokeAndDisconnectYoutube`. | Appeler `revokeAndDisconnectYoutube(user)` avant `deleteUserAccountCascade` si un compte YouTube est connecté. | S |
| RGPD-4 | Low | `commun/backend/src/lib/msdevDemoAccounts.ts` L38,61 ; `create-admin-user.ts` L73,95 ; `seed-production.ts` L45 ; `seed-msdev.ts` L216 | E-mails en clair dans des `console.log` — limité à des scripts d'administration/seed exécutés manuellement (pas de logs de requêtes utilisateurs), mais reste une mauvaise pratique si ces logs sont centralisés en prod. | `console.log(\`[msdev] Mot de passe démo réinitialisé pour ${user.email}\`)` | Masquer partiellement l'e-mail dans les logs ou les retirer des scripts susceptibles de tourner en environnement partagé. | S |
| RGPD-5 | Low | `web/app/src/content/legal/dpa.ts` L51,70,86,104 | Les DPA (art. 28 RGPD) avec Scaleway, Cloudflare, Stripe, Resend sont documentés dans le code mais leur statut est littéralement `'pending'` / `[À SIGNER]` — programme de conformité contractuelle non finalisé. | `dpaStatus: 'pending'` répété pour 4 sous-traitants | Finaliser la signature des DPA standards (démarche hors code, contractuelle). | M |

**Points positifs vérifiés avec preuve (pas de faille) :**
- Endpoint `DELETE /account` (`commun/backend/src/routes/auth.ts` L724) avec vérification mot de passe/confirmation `SUPPRIMER`, cascade RAM complète (`accountDeletion.ts`), purge SQL directe additionnelle (`accountDeletionPg.ts` : webauthn, push, subscriptions, donations), et synchronisation snapshot Postgres avec `DELETE FROM ... WHERE NOT (id = ANY(...))` (`pgStoreSocialSync.ts`, `pgStoreFeedSync.ts`, `pgStories.ts`, `pgDirectMessages.ts`) — le droit à l'effacement (art. 17) est réellement effectif, pas juste en RAM.
- Endpoint d'export JSON complet (`accountDataExport.ts`) — droit à la portabilité (art. 20) opérationnel.
- Bannière cookies (`CookieConsentBanner.tsx`) qui bloque effectivement le chargement de Stripe.js (`LiveDonationSheet.tsx` L360) et de l'IFrame YouTube (`useYouTubeIframeApi.ts` L20-49) tant que le choix « Tout accepter » n'est pas fait — consentement avant dépôt de cookies non essentiels, conforme.
- Sentry configuré `sendDefaultPii: false` + `beforeSend` filtrant, côté front (`sentry.ts` L53) et back (`errorMonitoring.ts` L81).
- Floutage géolocalisation réellement implémenté : `blurCoordinate()` (`geo.ts` L16-19) applique un offset aléatoire de ±0,00045° (~50 m), cohérent avec la doc RGPD.
- Aucun champ téléphone dans le schema `User` (`schema.ts`) — pas de collecte de numéro de téléphone constatée.
- Purge automatique programmée : stories expirées, notifications (90j lues / 180j non lues), tokens de reset expirés (`dataRetention.ts`).

## Section 8 — Conformité YouTube

| # | Gravité | Fichier(s) / ligne(s) | Description | Preuve | Solution | Difficulté |
|---|---------|------------------------|--------------|--------|----------|------------|
| YT-1 | **High** (produit) | `commun/docs/GOOGLE-OAUTH-TEST-USERS.md` L1-34, L48 | Le client OAuth Google utilisé en production (`getsoundy.com`) est en mode « Testing » non vérifié/publié. Seuls des comptes explicitement whitelistés peuvent lier YouTube ; tout autre utilisateur voit un écran « Google hasn't verified this app » ou une erreur `access_denied`. | « Symptôme typique : Google affiche *Access blocked*... l'app n'est pas en production vérifiée » | Soumettre l'app à la vérification OAuth Google (scope `youtube.readonly`) avant lancement public à grande échelle. | L (délai de review Google, hors contrôle direct) |
| YT-2 | Medium | `commun/backend/src/lib/youtubeRemote.ts` L3-15 ; `youtubeCompliance.ts` L2,L20 ; `youtubeSearch.ts` L115-134 ; `youtubePlaylists.ts` L55-58 | Fallback vers des proxys tiers non officiels Piped/Invidious présents en dur dans le code de production (URLs codées en dur). Le code documente lui-même : « non conforme aux ToS YouTube ». Garde-fou runtime solide (`isYoutubeRemoteFallbackAllowed()` force `false` si `NODE_ENV`/`APP_ENV === 'production'`), mais le code reste présent et exécutable si mal configuré. Ne récupère QUE des métadonnées (titre/artiste/miniature), jamais de flux audio/vidéo. | `youtubeCompliance.ts` L2 : « Piped/Invidious ... non conforme aux ToS YouTube » | Supprimer ce code du bundle de production (exclusion au build) plutôt que de reposer uniquement sur un garde-fou runtime. | S-M |
| YT-3 | Low | `web/app/src/components/SalonYouTubePlayer.tsx` L501-509 | `playerVars: { controls: 0, modestbranding: 1, ... }` — les contrôles natifs YouTube sont masqués au profit de contrôles personnalisés (Pause/Son/volume/vitesse via l'API officielle). Attribution compensatoire présente (`PoweredByYouTube`, `OpenOnYoutubeButton`). Zone grise des Branding Guidelines YouTube (autorisée techniquement par l'API, mais recommandations de branding sensibles à la personnalisation de l'UI). | `controls: 0, ... modestbranding: 1` (L505,508) | Revue légale formelle des Branding Guidelines si volume d'utilisateurs important ; à défaut, envisager `controls: 1`. | S |
| YT-4 | — (positif) | `commun/backend/src/lib/youtubeDataApi.ts` L7-31 | Cache serveur des réponses API YouTube limité à 1h de TTL — conforme au maximum généralement toléré (24h-30j selon type de donnée) et documenté explicitement dans `apiPlatforms.ts` et `privacy.ts`. | `YOUTUBE_DATA_API_CACHE_TTL_MS = 60 * 60 * 1000` | — | — |

**Points positifs vérifiés avec preuve :**
- Scope OAuth minimal : `YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'` (`youtubeOAuth.ts` L13) — pas de scope d'écriture/upload demandé.
- Gestion du quota `search.list` (bucket dédié 100 appels/jour) avec marge de sécurité et bascule automatique (`youtubeQuotaBudget.ts`).
- Erreurs API typées avec distinction quota/rate-limit/auth (`youtubeApiErrors.ts`).
- Révocation effective du jeton Google lors d'une déconnexion manuelle de la plateforme (`platforms.ts` L242 → `revokeAndDisconnectYoutube`, `youtubeOAuth.ts` L247-270 appelle `oauth2.googleapis.com/revoke`).
- Lecteur exclusivement piloté via le script officiel `https://www.youtube.com/iframe_api` (`useYouTubeIframeApi.ts` L43).

## Section 9 — Copyright (point critique) — Aucune violation trouvée

**Méthodologie** : recherche exhaustive (insensible à la casse) dans l'intégralité du repo (`commun/backend`, `commun/msdev`, `web/app`, `ios/apptel`, `android`, tous les `package.json`) des patterns suivants : `ytdl-core`, `yt-dlp`, `youtube-dl`, `youtube-dl-exec`, `node-ytdl-core`, `googlevideo.com`, `ytInitialData`, `ytInitialPlayerResponse`, `streamingData`, `adaptiveFormats`, `ffmpeg`.

| Vérification | Résultat | Preuve |
|---|---|---|
| Librairies de téléchargement YouTube (`ytdl-core`, `yt-dlp`, etc.) dans les 6 `package.json` du monorepo | **0 résultat** | Grep global + lecture des 6 `package.json` (racine, `commun/backend`, `commun/msdev`, `web/app`, `ios/apptel`, `commun/tests/agents`) |
| Fetch vers `googlevideo.com` / manifest HLS-DASH YouTube / `streamingData` / `adaptiveFormats` | **0 résultat** | Grep global sur tout le repo |
| Scraping `ytInitialData` / `ytInitialPlayerResponse` (HTML de youtube.com/watch) | **0 résultat** | Grep global sur tout le repo |
| Conversion ffmpeg d'un flux YouTube | **0 résultat** — la seule mention « ffmpeg » du repo est un commentaire dans `videoDuration.ts` (L1-12) qui explique explicitement ne pas utiliser ffmpeg, pour sonder la durée de vidéos uploadées par les utilisateurs (reels), sans rapport avec YouTube | `videoDuration.ts` L1-12 |
| Cache local de fichiers audio/vidéo YouTube (disque, S3, service worker) | **0 résultat** | Grep de `youtube`/`googlevideo`/`ytimg` dans `commun/backend/public/sw.js` → aucun match |
| Lecture vidéo | Exclusivement via l'IFrame Player API officielle (`youtube.com/iframe_api`), pilotée par ses méthodes publiques | `SalonYouTubePlayer.tsx`, `useYouTubeIframeApi.ts` |
| Métadonnées | Exclusivement via YouTube Data API v3 officielle (`googleapis.com/youtube/v3/*`) ou oEmbed officiel (`youtube.com/oembed`) | `youtubeDataApi.ts`, `youtubeSearch.ts` L28-44 |
| Point de vigilance résiduel | Fallback métadonnées-only vers Piped/Invidious (voir YT-2), jamais de flux audio/vidéo, bloqué en dur en production | `youtubeRemote.ts`, `youtubeCompliance.ts` |

**Conclusion Copyright : aucune preuve de téléchargement, extraction, cache permanent, conversion ou diffusion non autorisée de contenu YouTube.** OnScen respecte le mécanisme officiel (IFrame Player API + Data API v3). Le seul point à corriger par hygiène de code est la suppression du fallback Piped/Invidious mort (YT-2), qui n'est pas lui-même une violation de copyright (pas de média téléchargé) mais une dépendance de principe à des outils non-officiels.

## Scores /100

### RGPD : 72/100
Justification : suppression/export de données réellement effectifs en base (pas seulement en RAM), consentement cookies fonctionnel et bloquant, floutage géo réel, Sentry sans PII — mais un problème High avéré (mentions légales avec adresse placeholder + email personnel dans la config locale), une révocation OAuth incomplète à la suppression de compte, et une table de logs sans purge automatique.

### YouTube : 68/100
Justification : intégration technique propre (scope minimal, cache conforme, gestion de quota), mais l'app OAuth n'est pas encore vérifiée par Google en production (bloque l'usage grand public de la fonctionnalité), et présence de code mort non conforme aux ToS (Piped/Invidious) même s'il est neutralisé en prod.

### Copyright : 93/100
Justification : aucune violation trouvée avec des preuves de recherche exhaustive et négative sur tous les patterns à risque (ytdl-core, yt-dlp, scraping, ffmpeg, cache média). Les 7 points ne sont pas retirés en totalité uniquement à cause du code mort Piped/Invidious qui, bien que neutralisé, représente un résidu de risque si mal configuré (dépendance de conception, pas de violation active).

## Impossible à vérifier avec les informations disponibles

- Contenu réel du fichier `/opt/onscen/legal-publisher.json` en production (audité uniquement la copie locale `commun/msdev/legal-publisher.json`, utilisée en dev ; un script `verify-prod.sh` est censé bloquer le déploiement si des placeholders sont détectés, mais accès VPS non effectué pour cet audit).
- Statut réel et actuel de vérification de l'app OAuth Google dans la Google Cloud Console (le document `GOOGLE-OAUTH-TEST-USERS.md` date d'une session antérieure, l'état a pu changer).
- Signature effective des DPA avec Scaleway, Cloudflare, Stripe, Resend (le code documente un statut `'pending'`, mais l'état contractuel réel est hors du repo).
- Durée de rétention réelle appliquée par Cloudflare sur ses logs (mentionnée « 7 jours par défaut » dans `dpa.ts`, non vérifiable techniquement depuis le code).
- Conformité stricte aux YouTube API Branding Guidelines du choix `controls: 0` — nécessite une revue/validation Google formelle, non tranchable uniquement par lecture de code.
- Application réelle et fréquence effective de la purge (snapshot Postgres) en production.

## Synthèse rapide

- **Problèmes par gravité** : 2 High (RGPD-1 mentions légales, YT-1 OAuth non vérifié) · 4 Medium (RGPD-2, RGPD-3, YT-2, RGPD-5) · 2 Low+ (RGPD-4, YT-3)
- **Scores** : RGPD 72/100 · YouTube 68/100 · **Copyright 93/100**
- **Conclusion copyright : aucune violation trouvée.**
