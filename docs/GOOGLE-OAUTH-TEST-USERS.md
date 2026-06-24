# Google OAuth — utilisateurs de test (YouTube / getsoundy.com)

> Corrige l'erreur **`403 access_denied`** lors de la liaison compte YouTube sur [getsoundy.com](https://getsoundy.com) quand l'écran de consentement OAuth est en mode **Testing** (non vérifié).

## Contexte

| Élément | Valeur |
|---------|--------|
| Domaine prod | `https://getsoundy.com` |
| Client ID OAuth | `522947046161-l5bvl70k83jd1k98rc675k6nk8vravhb.apps.googleusercontent.com` |
| Numéro de projet GCP | `522947046161` (préfixe du Client ID) |
| Callback YouTube | `https://getsoundy.com/api/auth/youtube/callback` |
| Compte à autoriser | `admin@getsoundy.com`, `kev.sainto@hotmail.fr` (Dye) |

Symptôme typique : Google affiche *« Access blocked »* ou renvoie `error=access_denied` après le consentement OAuth, car l'app n'est pas en production vérifiée et l'utilisateur n'est pas dans la liste des **test users**.

## Automatisation

**Impossible via CLI sur cette machine** : `gcloud` n'est pas installé, et Google ne propose pas de commande `gcloud` pour ajouter des test users sur l'écran de consentement OAuth (configuration manuelle console uniquement).

## Procédure manuelle (≈ 2 min)

1. Se connecter à [Google Cloud Console](https://console.cloud.google.com) avec le compte propriétaire du projet GCP lié au Client ID ci-dessus.

2. Ouvrir la page **Audience** (utilisateurs de test) :
   - **Lien direct** : [Audience — projet 522947046161](https://console.cloud.google.com/auth/audience?project=522947046161)
   - Lien alternatif (ancienne UI) : [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent?project=522947046161)

3. Vérifier que le **User type** est **External** et le statut de publication **Testing** (pas « In production » sans vérification).

4. Section **Test users** → **Add users** → saisir (un par ligne ou séparés) :
   ```
   admin@getsoundy.com
   kev.sainto@hotmail.fr
   ```
   → **Save**.

   Compte Soundy associé : **Dye** (`user_1781987745291_b2b1b`, pseudo `Dye`).

5. (Recommandé) Vérifier les redirect URIs du client OAuth :
   - [Credentials — projet 522947046161](https://console.cloud.google.com/apis/credentials?project=522947046161)
   - Ouvrir le client `522947046161-l5bvl70k83jd1k98rc675k6nk8vravhb`
   - **Authorized redirect URIs** doit contenir :
     - `https://getsoundy.com/api/auth/youtube/callback`
     - `https://getsoundy.com/api/auth/google/callback` (connexion compte Google, optionnel)

6. Tester sur prod :
   - [getsoundy.com](https://getsoundy.com) → Profil → **Connecter YouTube**
   - Si Google affiche *« Google hasn't verified this app »* : **Advanced** → **Go to Soundy (unsafe)** (normal en mode Testing).

## Si le lien direct échoue

Le paramètre `project=` accepte le **numéro** (`522947046161`) ou l'**ID** texte du projet (ex. `soundy-prod`). Si la console affiche « projet introuvable » :

1. Console → sélecteur de projet (barre du haut) → choisir le projet qui contient le Client ID ci-dessus.
2. Menu **Google Auth Platform** → **Audience** → ajouter le test user.

## Variables serveur (rappel)

Voir `backend/.env.production.example` :

```env
GOOGLE_CLIENT_ID=522947046161-l5bvl70k83jd1k98rc675k6nk8vravhb.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<secret>
YOUTUBE_CALLBACK_URL=https://getsoundy.com/api/auth/youtube/callback
```

## Connexion démo (secours testeurs)

Si l’OAuth Google n’est pas encore autorisé pour un testeur, vous pouvez activer la **connexion YouTube simulée** (playlists publiques de démo) pour des pseudos précis :

```env
MOCK_PLATFORM_CONNECT_USERNAMES=dye
```

Sur le VPS : ajouter la ligne dans `/opt/soundly/.env`, puis `pm2 reload melosong-backend --update-env`.

Le compte **Dye** verra alors le bouton « Connexion démo (sans Google) » sous « Connecter YouTube ».

## Références

- [`backend/.env.production.example`](../backend/.env.production.example) — configuration Google / YouTube
- [`deploy/RUNBOOK-PROD.md`](../deploy/RUNBOOK-PROD.md) — ops production
