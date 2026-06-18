# Checklist Spotify — mise en production (Extended Quota Mode)

> **Action manuelle** — ne peut pas être automatisée dans le code. À réaliser dans le [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) avant une montée en charge significative.

## Contexte

Soundy utilise les **Web API Spotify** (recherche de morceaux, playlists, état de lecture, contrôle Spotify Connect). En mode développement standard, Spotify applique des **quotas restrictifs** qui peuvent bloquer les utilisateurs en production.

Le **Extended Quota Mode** lève ces limites après validation par Spotify.

---

## Prérequis

1. Application Spotify créée dans le Developer Dashboard.
2. **Redirect URI** exacte enregistrée :
   ```
   https://getsoundy.com/api/auth/spotify/callback
   ```
3. Variables d'environnement sur le VPS (`/opt/soundly/.env`) :
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_CALLBACK_URL=https://getsoundy.com/api/auth/spotify/callback`
4. Pages légales publiques accessibles (requis par Spotify) :
   - https://getsoundy.com/privacy
   - https://getsoundy.com/terms
5. Attribution **« Powered by Spotify »** visible dans l'app (recherche, création de salon, playlists).

---

## Étapes — demander l'Extended Quota Mode

### 1. Vérifier l'application

1. Connectez-vous à https://developer.spotify.com/dashboard
2. Ouvrez l'application Soundy / getsoundy.com
3. Vérifiez que le **Client ID** correspond à `SPOTIFY_CLIENT_ID` en production
4. Onglet **Settings** → **Redirect URIs** : `https://getsoundy.com/api/auth/spotify/callback`

### 2. Préparer la demande

Spotify exige notamment :

| Élément | Valeur Soundy |
|---------|---------------|
| Nom commercial | Soundy |
| Site web | https://getsoundy.com |
| Politique de confidentialité | https://getsoundy.com/privacy |
| CGU | https://getsoundy.com/terms |
| Description de l'usage API | Recherche de morceaux, lecture des playlists utilisateur, synchronisation d'état de lecture (Spotify Connect), création de salons d'écoute sociale |
| Nombre d'utilisateurs estimé | Indiquer une fourchette réaliste (ex. 100 → 10 000) |

### 3. Soumettre la demande Extended Quota

1. Dashboard → votre app → **Quota extension** ou **Request Extended Quota Mode**
2. Remplissez le formulaire en **anglais** (langue habituelle Spotify)
3. Décrivez clairement :
   - Soundy est une **application sociale musicale** (salons d'écute synchronisés)
   - **Pas** de streaming audio dans le navigateur — lecture via **Spotify Connect** sur l'appareil de l'utilisateur
   - Scopes utilisés : `user-read-email`, `user-read-private`, `user-library-read`, `user-top-read`, `playlist-read-private`, `playlist-read-collaborative`, `user-read-currently-playing`, `user-read-playback-state`, `user-modify-playback-state`
   - Affichage de **« Powered by Spotify »** conforme aux [Spotify Branding Guidelines](https://developer.spotify.com/documentation/design)
4. Joignez ou citez les URLs légales publiques ci-dessus
5. Soumettez et notez la **date de demande**

### 4. Suivi

- Délai de réponse : **plusieurs jours à plusieurs semaines**
- Surveillez l'e-mail du compte développeur Spotify
- En cas de refus ou questions complémentaires : répondre avec précision sur l'usage API et les mesures RGPD (suppression de compte, export de données)

### 5. Après approbation

1. Vérifiez dans le Dashboard que le statut est **Extended Quota Mode**
2. Testez en production :
   - Connexion compte Spotify
   - Recherche de morceaux dans un salon
   - Chargement d'une playlist privée à la création de salon
3. Surveillez les logs backend pour les erreurs `429` (rate limit)

---

## Branding obligatoire

Conformément aux [Spotify Branding Guidelines](https://developer.spotify.com/documentation/design) :

- Texte exact : **Powered by Spotify** (ne pas traduire)
- Visible à proximité des résultats de recherche Spotify et des sélecteurs de playlist
- Lien vers https://www.spotify.com recommandé

---

## En cas de quota non approuvé (staging)

- Limiter les tests Spotify aux comptes **allowlistés** dans le Dashboard (mode Development)
- Ne pas ouvrir l'inscription publique avec connexion Spotify réelle
- Surveiller les erreurs `spotify_oauth_not_configured` et `429` dans les logs

---

## Références

- [Spotify Developer Terms](https://developer.spotify.com/terms)
- [Spotify Platform Rules](https://developer.spotify.com/policy)
- [Spotify Branding Guidelines](https://developer.spotify.com/documentation/design)
- Runbook prod : `deploy/RUNBOOK-PROD.md` (section OAuth Spotify)
