# Deep Links — OnScen (getsoundy.com)

Universal Links (iOS) et App Links (Android) permettent d'ouvrir directement l'app Capacitor depuis une URL `getsoundy.com/salon/:id` ou `getsoundy.com/live/:id`.

---

## iOS — Universal Links (Apple App Site Association)

### Fichier AASA

Le fichier `app/public/.well-known/apple-app-site-association` est déployé automatiquement avec l'app web.

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.soundy.app",
        "paths": ["/salon/*", "/live/*", "/profile/*", "/"]
      }
    ]
  }
}
```

### Étapes à faire manuellement (portail Apple Developer)

1. **Remplacer `TEAM_ID`** dans le fichier `apple-app-site-association` par votre vrai Apple Team ID (ex: `AB12CD3EFG`).
   - Votre Team ID est visible sur [developer.apple.com/account](https://developer.apple.com/account) → Membership.

2. **Activer Associated Domains** dans Xcode :
   - Sélectionner la target `App`
   - Onglet **Signing & Capabilities**
   - Cliquer **+ Capability** → **Associated Domains**
   - Ajouter : `applinks:getsoundy.com`

3. **Activer Associated Domains** dans le portail Apple Developer :
   - [developer.apple.com](https://developer.apple.com) → Certificates, IDs & Profiles → Identifiers
   - Sélectionner `com.soundy.app`
   - Activer **Associated Domains**
   - Enregistrer et re-générer le provisioning profile

4. **Vérifier le déploiement AASA** :
   ```
   curl -I https://getsoundy.com/.well-known/apple-app-site-association
   # Content-Type doit être application/json
   ```
   Utiliser aussi [branch.io/resources/aasa-validator](https://branch.io/resources/aasa-validator/) pour valider.

5. **Test sur appareil réel** (les simulateurs ne supportent pas les Universal Links) :
   - Envoyer le lien `https://getsoundy.com/salon/TEST_ID` par iMessage
   - Appuyer sur le lien → l'app doit s'ouvrir

---

## Android — App Links (Digital Asset Links)

### Fichier assetlinks.json

Le fichier `app/public/.well-known/assetlinks.json` est déployé automatiquement.

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.soundy.app",
      "sha256_cert_fingerprints": ["REPLACE_WITH_SHA256_FINGERPRINT_FROM_KEYSTORE"]
    }
  }
]
```

### Étapes à faire manuellement

1. **Obtenir le SHA-256 de votre keystore de release** :
   ```bash
   keytool -list -v -keystore your-release-key.jks -alias your-alias
   ```
   Copier la valeur **SHA256** (format `AA:BB:CC:...`) et remplacer `REPLACE_WITH_SHA256_FINGERPRINT_FROM_KEYSTORE`.

2. **Configurer `AndroidManifest.xml`** dans `ios/apptel/android/app/src/main/AndroidManifest.xml` :
   ```xml
   <activity android:name="com.getcapacitor.BridgeActivity"
             android:launchMode="singleTask">
     <intent-filter android:autoVerify="true">
       <action android:name="android.intent.action.VIEW" />
       <category android:name="android.intent.category.DEFAULT" />
       <category android:name="android.intent.category.BROWSABLE" />
       <data android:scheme="https"
             android:host="getsoundy.com"
             android:pathPrefix="/salon" />
     </intent-filter>
     <intent-filter android:autoVerify="true">
       <action android:name="android.intent.action.VIEW" />
       <category android:name="android.intent.category.DEFAULT" />
       <category android:name="android.intent.category.BROWSABLE" />
       <data android:scheme="https"
             android:host="getsoundy.com"
             android:pathPrefix="/live" />
     </intent-filter>
   </activity>
   ```

3. **Vérifier** avec Google's Digital Asset Links tester :
   ```
   https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://getsoundy.com&relation=delegate_permission/common.handle_all_urls
   ```

---

## Gestion des deep links dans l'app (Capacitor)

Le code JavaScript côté app (`App.tsx`) gère déjà les URLs `/salon/:id` et `/profile/:id` via `salonDeepLink.ts` et `profileDeepLink.ts`.

Pour ajouter la gestion Capacitor native des App Links au lancement :

```typescript
// Dans ios/apptel/src/main.tsx ou App.tsx (Capacitor)
import { App as CapApp } from '@capacitor/app';

CapApp.addListener('appUrlOpen', (event) => {
  const url = new URL(event.url);
  // Géré par salonDeepLink.ts / profileDeepLink.ts via window.location
  window.history.pushState({}, '', url.pathname + url.search);
});
```

---

## Partage de liens

Les boutons "Partager" ajoutés dans `SalonPage.tsx` et `LivePage.tsx` utilisent :
- `navigator.share()` (API native Web Share) si disponible (mobile/PWA)
- Fallback : copie dans le presse-papier `navigator.clipboard.writeText()`

URLs partagées :
- Salon : `https://getsoundy.com/salon/:id`
- Live : `https://getsoundy.com/live/:id`
