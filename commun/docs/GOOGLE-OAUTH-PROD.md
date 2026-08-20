# Google OAuth — recréer le client OnScen (prod)

Le client Google actuel est **`deleted_client`**. Login Google et liaison YouTube sont **coupés en production** tant que `GOOGLE_OAUTH_PROD_ENABLED` n’est pas à `1`.

**Ne pas** mettre `GOOGLE_OAUTH_PROD_ENABLED=1` avant qu’un nouveau client Console fonctionne (sinon les utilisateurs voient encore `deleted_client`).

L’agent ne peut pas recréer le client : c’est uniquement la [Google Cloud Console](https://console.cloud.google.com).

## 1. Projet GCP

1. Ouvrir [console.cloud.google.com](https://console.cloud.google.com) avec le compte propriétaire OnScen.
2. Sélectionner (ou créer) le projet **OnScen** — pas un ancien projet Soundy / getsoundy.
3. **APIs & Services → Library** → activer **YouTube Data API v3** et **Google Identity** / Google+ (si proposé).

## 2. Écran de consentement (Google Auth Platform)

1. **Google Auth Platform → Branding / Audience**.
2. User type : **External**.
3. App name : `OnScen`.
4. Support email + developer contact : `admin@onscen.com`.
5. Domaines autorisés : `onscen.com`.
6. Scopes :
   - `openid`, `email`, `profile` (connexion compte)
   - `https://www.googleapis.com/auth/youtube.readonly` (liaison YouTube / playlists)
7. Statut :
   - **Testing** : uniquement les e-mails listés en *Test users* peuvent se connecter. Ajouter `admin@onscen.com` et les comptes Google des testeurs.
   - **In production** : tout compte Google (après revue Google si scopes sensibles). Pour un go-live interne, Testing + test users suffit.

Si Google refuse un Gmail en test user : Audience doit être **External** (pas Internal / Workspace-only) ; pas de compte Family Link ; pas Advanced Protection bloquant les apps non vérifiées.

## 3. Identifiants — client Web

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Type : **Web application**.
3. Name : `OnScen web prod`.
4. **Authorized JavaScript origins** :
   - `https://onscen.com`
   - `https://www.onscen.com`
   - (optionnel) `https://staging.onscen.com`
   - (dev) `http://localhost:5173` et `http://localhost:4080` si vous testez en local avec ce même client — sinon créer un client **dev** séparé.
5. **Authorized redirect URIs** (obligatoires, copier-coller exact) :

```
https://onscen.com/api/auth/google/callback
https://onscen.com/api/auth/youtube/callback
```

Staging si utilisé :

```
https://staging.onscen.com/api/auth/google/callback
https://staging.onscen.com/api/auth/youtube/callback
```

6. **Create** → copier **Client ID** (`….apps.googleusercontent.com`) et **Client secret** (`GOCSPX-…`).  
   Ne jamais les committer dans Git.

## 4. Coller sur le VPS

Tester **staging d’abord** si le DNS `staging.onscen.com` est OK.

```bash
ssh onscen-staging   # puis, une fois validé : ssh onscen-prod
sudo nano /opt/onscen/.env
```

Renseigner (sans quotes bizarres) :

```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_CALLBACK_URL=https://onscen.com/api/auth/google/callback
YOUTUBE_CALLBACK_URL=https://onscen.com/api/auth/youtube/callback
```

Sur staging, remplacer `onscen.com` par `staging.onscen.com` dans les deux callback.

**Ne pas encore** ajouter `GOOGLE_OAUTH_PROD_ENABLED=1` sur **prod**.

```bash
pm2 reload onscen-backend --update-env
# staging : pm2 reload onscen-backend-staging --update-env
```

## 5. Test (staging ou prod avec flag encore off)

Sur staging, le flag n’est pas requis (OAuth public dès que les clés sont là).

1. Ouvrir `https://staging.onscen.com` → Connexion Google **ou** Profil → Connecter YouTube.
2. Consentement Google → revient sur OnScen, session OK.
3. Si *Access blocked* / `access_denied` : le compte n’est pas test user, ou l’app est Internal.
4. Si `redirect_uri_mismatch` : l’URI callback n’est pas **exactement** celle du `.env`.
5. Si `deleted_client` : l’ancien ID est encore dans le `.env` — coller le nouveau.

## 6. Ouvrir Google/YouTube en production

Quand le test staging (ou un test avec le nouveau client) est vert :

```env
GOOGLE_OAUTH_PROD_ENABLED=1
```

dans `/opt/onscen/.env` **prod**, puis :

```bash
pm2 reload onscen-backend --update-env
pm2 logs onscen-backend --lines 40
```

Le warning startup `Google / YouTube OAuth publics coupés` doit **disparaître**. Une tentative de login ne doit plus logger `deleted_client`.

## 7. Après go-live public

Publier l’écran de consentement **In production** et, si Google le demande, passer la vérification OAuth (scopes YouTube = sensibles). En attendant, garder Testing + liste de test users.

## Références

- Callbacks : `commun/backend/.env.production.example`
- Kill-switch code : `commun/backend/src/lib/googleOAuthPublic.ts`
- Ancien doc test users (domaine Soundy, obsolète) : `GOOGLE-OAUTH-TEST-USERS.md`
