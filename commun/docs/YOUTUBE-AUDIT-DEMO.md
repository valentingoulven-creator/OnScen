# Démo YouTube API — audit / vérification OAuth

**Produit :** Soundy · https://getsoundy.com  
**Périmètre de la démo :** module **Salon YouTube uniquement** (pas lives, carte, reels, DMs, etc.)  
**Référence Google :** [Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)

---

## 1. Avant d’enregistrer (checklist)

| # | Action | Statut |
|---|--------|--------|
| 1 | Enregistrer sur **https://getsoundy.com** (pas localhost — Google doit voir la prod) | ✅ Compte `yt_audit_demo2` |
| 2 | Compte Google de test avec **chaîne YouTube** + au moins **1 playlist** (publique ou privée) | ☐ **À faire** (votre Gmail → Test users Google Cloud) |
| 3 | OAuth configuré en prod (`GOOGLE_CLIENT_ID`, `YOUTUBE_CALLBACK_URL`, YouTube Data API v3 activée) | ✅ Vérifié (`youtubeOAuthAvailable: true`) |
| 4 | Navigateur en **navigation privée** ou profil dédié (écran de consentement OAuth visible) | ☐ |
| 5 | Fenêtre **1920×1080** ou iPhone en portrait (montrer le flux mobile si cible mobile) | ☐ |
| 6 | Micro coupé ou voix off légère ; **pas de musique protégée** longue dans la vidéo (30 s max par extrait) | ☐ |
| 7 | Outil d’enregistrement : Loom, OBS, QuickTime, ou enregistrement d’écran Windows | ☐ |
| 8 | Durée cible : **3 à 5 minutes** | ☐ |

### Compte test à fournir à Google

**Credentials locaux :** `docs/youtube-audit-demo-credentials.local.txt` (non versionné)

Compte Soundy créé sur prod :

- **E-mail :** `yt.audit.demo2.soundy@gmail.com`
- **Mot de passe :** voir fichier credentials local
- **Pseudo :** `yt_audit_demo2`

Pour recréer un compte : `powershell -ExecutionPolicy Bypass -File commun/scripts/create-youtube-audit-demo-account.ps1`

> **YouTube OAuth :** connectez un **compte Google séparé** (avec chaîne + playlist) via Profil → Connecter YouTube. Ajoutez ce Gmail en **Test user** dans [Google Cloud Console → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent).

### URLs légales (à copier dans la console Google)

| Document | URL |
|----------|-----|
| Politique de confidentialité | https://getsoundy.com/legal/privacy?lang=fr |
| CGU | https://getsoundy.com/legal/terms?lang=fr |
| YouTube / API plateformes | https://getsoundy.com/legal/api-platforms?lang=fr |
| Application | https://getsoundy.com |

---

## 2. Script vidéo (storyboard)

Enregistrer **une seule vidéo continue** de préférence. Parler en **français** ou **anglais** (Google accepte les deux).

### Intro (0:00 – 0:20)

**À dire :**

> « This screencast demonstrates the **YouTube-only integration** in Soundy (getsoundy.com).  
> Soundy is a social music app; **this review covers only**: connecting a YouTube account, listing playlists, searching videos, and playback via the **official YouTube IFrame Player**. Other features (live streaming, map, chat) are out of scope. »

**À l’écran :** page d’accueil Soundy connectée, onglet Carte ou Accueil — **ne pas** montrer reels/live longuement.

---

### Étape A — Connexion Soundy (0:20 – 0:35)

1. Ouvrir https://getsoundy.com  
2. Se connecter avec le **compte test**  
3. (Si demandé) accepter CGU / âge minimum  

**À montrer :** login e-mail ou Google Sign-In **pour Soundy** (distinct du lien YouTube plus tard).

---

### Étape B — Lier YouTube (OAuth) (0:35 – 1:15)

1. Aller **Profil** (icône utilisateur)  
2. Section **Plateformes** / **Connecter YouTube**  
3. Cliquer **Connecter YouTube**  
4. **Pause sur l’écran Google OAuth** — montrer clairement :
   - Nom de l’app : Soundy  
   - Scope : **Voir votre compte YouTube** / `youtube.readonly`  
   - Pas d’accès en écriture  
5. Autoriser → retour sur Soundy → badge YouTube connecté (nom de chaîne visible)

**À dire :**

> « We request **youtube.readonly** only, so hosts can list their playlists when creating a YouTube salon. We do not upload or modify YouTube content. »

---

### Étape C — Créer un Salon YouTube (1:15 – 1:50)

1. Onglet **Carte** → bouton **Créer un salon** (FAB +)  
2. Choisir le flux **YouTube** (pas live, pas autre plateforme)  
3. Renseigner titre ex. « Demo audit YouTube »  
4. À l’étape playlist : **sélectionner une playlist** depuis le compte connecté (preuve du scope readonly)  
5. Valider → salon créé, entrée dans le salon  

**À montrer :** liste des playlists chargée via API (spinner puis noms de playlists réels).

---

### Étape D — Recherche & file d’attente (1:50 – 2:20)

1. Dans le salon, ouvrir la **recherche YouTube** (dock / file)  
2. Taper une requête ex. « jazz instrumental » ou un titre libre de droits  
3. Ajouter un morceau à la **file d’attente**  
4. Lancer la lecture  

**À dire :**

> « Search uses **YouTube Data API v3**. Results are metadata only; playback uses the embedded player. »

---

### Étape E — Lecteur officiel & attribution (2:20 – 2:50)

**Obligatoire pour l’audit — montrer clairement :**

1. **Lecteur vidéo YouTube embarqué** (IFrame, contrôles YouTube visibles)  
2. Badge **« Powered by YouTube »**  
3. Bouton **« Ouvrir sur YouTube »** / « Watch on YouTube » — cliquer une fois pour montrer l’ouverture vers youtube.com  
4. (Optionnel) Mention overlay **consentement cookies/lecteur** si affiché — accepter  

**À dire :**

> « We never use a custom audio-only player in production. Users can always open the video on YouTube. »

---

### Étape F — Synchronisation (optionnel, 2:50 – 3:15)

1. Ouvrir un **second onglet** ou le navigateur du téléphone  
2. Se connecter avec un **autre compte test auditeur**  
3. Rejoindre le même salon (lien ou carte)  
4. Montrer que la lecture est **alignée** (même morceau, même position approximative)  

**À dire :**

> « Each participant loads their **own** IFrame player; the server only syncs playback state, not video files. »

---

### Étape G — Déconnexion & révocation (3:15 – 3:35)

1. Retour **Profil** → **Déconnecter YouTube**  
2. Confirmer que le lien est retiré dans Soundy  

**À dire :**

> « Users can revoke access in Soundy or from their Google account settings. »

---

### Outro (3:35 – 3:45)

1. Ouvrir https://getsoundy.com/legal/privacy?lang=fr  
2. Scroller jusqu’à la section **« Autorisations OAuth YouTube »**  

**À dire :**

> « Privacy policy and API platform terms document scope, 1-hour API cache, and revocation. Thank you. »

---

## 3. Ce qu’il ne faut PAS montrer

- Lives vidéo (LiveKit / Cloudflare)  
- Globe 3D, filtres carte, événements  
- Reels, fil d’actualité, DMs  
- Dons Stripe, abonnements  
- Mode dev localhost (`:5173`)  
- Fallback Piped/Invidious (msdev uniquement, non conforme)  

---

## 4. Textes à coller dans les formulaires Google

### Champ « Application purpose » / « How do you use the API? »

```
Soundy (https://getsoundy.com) is a social music platform. This submission covers the YouTube module ONLY.

Use case:
- Hosts connect YouTube via OAuth (scope: youtube.readonly) to list their playlists.
- YouTube Data API v3: search videos, read playlist metadata (title, thumbnail, video ID).
- Playback: official YouTube IFrame Player API only — no download, re-encoding, or custom player.
- Optional: synchronized listening in "YouTube Salons" — each user has their own embedded player; we sync playback state only.

We do NOT use YouTube API for: upload, live streaming replacement, map, chat, or non-YouTube features.

Compliance:
- API data cached server-side max 1 hour (under 24h policy limit).
- "Open on YouTube" link and YouTube branding on all players.
- Users can disconnect YouTube in app settings; tokens revoked via Google revoke endpoint.
- Privacy: https://getsoundy.com/legal/privacy?lang=fr
- API platforms notice: https://getsoundy.com/legal/api-platforms?lang=fr
```

### Champ « Test credentials »

```
URL: https://getsoundy.com
Test user email: [VOTRE_EMAIL_DEMO]
Test password: [VOTRE_MOT_DE_PASSE]

Steps:
1. Log in
2. Profile → Connect YouTube → grant youtube.readonly
3. Map tab → Create salon → YouTube → select a playlist → create
4. Search a track, add to queue, play — verify IFrame player + "Open on YouTube"
5. Profile → Disconnect YouTube

Demo video: [LIEN LOOM / DRIVE / YOUTUBE UNLISTED]
```

### Version française (justification interne / support)

```
Soundy demande la vérification pour le module Salon YouTube uniquement.
Scope : youtube.readonly — lister les playlists de l'hôte.
Lecture via IFrame Player API officielle. Pas de téléchargement ni lecteur personnalisé.
Cache API 1 h. Révocation possible dans l'app.
Vidéo de démo : [lien]
```

---

## 5. Où soumettre

| Besoin | Formulaire |
|--------|------------|
| **Premier audit / extension de quota** | [YouTube API Services - Audit and Quota Extension Form](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits) (lien « Begin an audit ») |
| **Vérification OAuth** (écran consentement prod) | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **OAuth consent screen** → Submit for verification |
| **Quota déjà audité (< 12 mois)** | Formulaire « Audited Developer Requests » (même page doc) |

---

## 6. Après l’enregistrement

1. Héberger la vidéo : **Loom** (lien public), **Google Drive** (accès « anyone with link »), ou **YouTube non répertorié**  
2. Coller le lien dans le formulaire + e-mail test  
3. Vérifier les quotas : [Console → YouTube Data API v3 → Quotas](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas)  
4. Conserver une copie locale du MP4 (nom : `soundy-youtube-audit-demo-YYYY-MM-DD.mp4`)

---

## 7. Dépannage pendant la démo

| Problème | Solution |
|----------|----------|
| « Connecter YouTube » grisé | Vérifier OAuth prod + `YOUTUBE_CALLBACK_URL` sur getsoundy.com |
| Playlists vides | Compte Google doit avoir une chaîne YouTube + playlists |
| Lecteur ne démarre pas | Accepter le consentement cookies/YouTube dans le salon ; désactiver bloqueurs |
| Erreur quota | Quota `search.list` (100/j par défaut) — utiliser surtout playlists pour la démo |
| OAuth « app not verified » | Normal avant validation ; les test users ajoutés dans la console Google peuvent quand même se connecter |

### Test users (avant validation publique)

Google Cloud Console → OAuth consent screen → **Test users** → ajouter l’e-mail du compte démo.

## 8. Lancer la prep (script)

```powershell
# Vérifier prod + ouvrir le navigateur
powershell -ExecutionPolicy Bypass -File commun/scripts/prepare-youtube-audit-demo.ps1
```

Puis enregistrer l'écran (**Win+G** → Enregistrer) en suivant le script §2 ci-dessus.

---

