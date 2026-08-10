# Google OAuth — utilisateurs de test (YouTube / getsoundy.com)

> Corrige l'erreur **`403 access_denied`** lors de la liaison compte YouTube sur [getsoundy.com](https://getsoundy.com) quand l'écran de consentement OAuth est en mode **Testing** (non vérifié).

## Contexte

| Élément | Valeur |
|---------|--------|
| Domaine prod | `https://getsoundy.com` |
| Client ID OAuth | `522947046161-l5bvl70k83jd1k98rc675k6nk8vravhb.apps.googleusercontent.com` |
| Numéro de projet GCP | `522947046161` (préfixe du Client ID) |
| Callback YouTube | `https://getsoundy.com/api/auth/youtube/callback` |
| Comptes à autoriser (test users) | `admin@getsoundy.com`, `kev.sainto@hotmail.fr` (Dye), `valentin.goulven@gmail.com` (Val) |

Symptôme typique : Google affiche *« Access blocked »* ou renvoie `error=access_denied` après le consentement OAuth, car l'app n'est pas en production vérifiée et l'utilisateur n'est pas dans la liste des **test users**.

## Dépannage — « non éligible » / not eligible for test user

Google refuse parfois un Gmail avec :

```
The following email addresses are either not associated with a Google Account
or the account is not eligible for designation as a test user
```

| Cause probable | Vérification / action |
|----------------|----------------------|
| **App OAuth en mode Internal** | [Audience](https://console.cloud.google.com/auth/audience?project=522947046161) → User type doit être **External**. En Internal, seuls les comptes du domaine Workspace (`@getsoundy.com`) sont éligibles — un `@gmail.com` personnel sera **toujours** refusé. |
| **Protection avancée Google** | Sur le compte concerné : [myaccount.google.com/advanced-protection](https://myaccount.google.com/advanced-protection) — si activée, bloque la plupart des apps tierces. Désactiver temporairement ou utiliser un autre compte Google. |
| **Compte Google incomplet / restreint** | Se connecter sur [accounts.google.com](https://accounts.google.com) avec `valentin.goulven@gmail.com`, accepter les CGU, vérifier que ce n’est pas un alias sans compte propre. |
| **Mauvais projet / session navigateur** | Navigation privée, un seul compte Google connecté, projet GCP `522947046161` sélectionné en haut de la console. |
| **Compte enfant / Family Link** | Non éligible comme test user — utiliser un compte adulte. |

**Cas Val (`valentin.goulven@gmail.com`)** : en prod, le compte OnScen **Val** a déjà une liaison YouTube OAuth active (chaîne `UCv-zjYnw9-_qH5cA8jdhGPQ`, connectée récemment). L’ajout en test user n’est **pas obligatoire** tant que la session est valide. En cas d’échec OAuth à la reconnexion, utiliser **Connexion démo (sans Google)** (`MOCK_PLATFORM_CONNECT_USERNAMES` inclut `val`).

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
   valentin.goulven@gmail.com
   ```
   → **Save**.

   Comptes OnScen : **Dye** (`Dye`, id `user_1781987745291_b2b1b`) · **Val** (`Val`, id `user_1781025111633_ipv5l`, Gmail `valentin.goulven@gmail.com`).

5. (Recommandé) Vérifier les redirect URIs du client OAuth :
   - [Credentials — projet 522947046161](https://console.cloud.google.com/apis/credentials?project=522947046161)
   - Ouvrir le client `522947046161-l5bvl70k83jd1k98rc675k6nk8vravhb`
   - **Authorized redirect URIs** doit contenir :
     - `https://getsoundy.com/api/auth/youtube/callback`
     - `https://getsoundy.com/api/auth/google/callback` (connexion compte Google, optionnel)

6. Tester sur prod :
   - [getsoundy.com](https://getsoundy.com) → Profil → **Connecter YouTube**
   - Si Google affiche *« Google hasn't verified this app »* : **Advanced** → **Go to OnScen (unsafe)** (normal en mode Testing).

## Si le lien direct échoue

Le paramètre `project=` accepte le **numéro** (`522947046161`) ou l'**ID** texte du projet (ex. `onscen-prod`). Si la console affiche « projet introuvable » :

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
MOCK_PLATFORM_CONNECT_USERNAMES=dye,val
```

Sur le VPS : ajouter la ligne dans `/opt/onscen/.env`, puis `pm2 reload onscen-backend --update-env`.

Le compte **Val** (`Val`, id `user_1781025111633_ipv5l`) verra alors le bouton « Connexion démo (sans Google) » sous « Connecter YouTube ».

**Note :** Google Workspace n’est **pas** requis pour héberger un salon YouTube — un compte Google/YouTube personnel suffit. L’erreur « vous ne pouvez pas encore utiliser … avec ce compte » vient du mode **Testing** OAuth (compte Gmail absent de la liste test users), pas d’un manque d’abonnement Workspace.

## Références

- [`backend/.env.production.example`](../backend/.env.production.example) — configuration Google / YouTube
- [`commun/deploy/RUNBOOK-PROD.md`](../commun/deploy/RUNBOOK-PROD.md) — ops production
