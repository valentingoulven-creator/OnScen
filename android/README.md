# Stack Android — Soundy

Build APK/AAB et export PWA standalone pour Android.

## Contenu

| Dossier / fichier | Rôle |
|-------------------|------|
| `MeloSong-Mobile/` | Export web mobile (`www/`) + APK/AAB générés |
| `build-android-apk-prod.ps1` | Build APK debug (API prod) |
| `build-android-aab-prod.ps1` | Build AAB release |
| `generate-android-keystore.ps1` | Keystore Play Store |
| `config/` | `mobile-store.env` (secrets locaux, gitignored) |

## Commandes (depuis la racine)

```bash
npm run mobile:build            # apptel build + export → MeloSong-Mobile/www
npm run android:apk:prod        # APK → android/MeloSong-Mobile/Soundy-debug-prod.apk
npm run android:aab:prod        # AAB → android/MeloSong-Mobile/Soundy-release-prod.aab
npm run msdev:mobile            # serveur LAN pour tester sur tel
```

## Projet Gradle natif

Généré par Capacitor dans `ios/apptel/android/` (partagé avec la stack iOS Capacitor).
