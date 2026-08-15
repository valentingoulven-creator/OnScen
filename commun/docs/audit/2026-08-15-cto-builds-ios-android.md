# Audit CTO — builds iOS / Android — 15 août 2026

**Méthode :** lecture des projets natifs **sur disque** (pas seulement Git) : Xcode `ios/apptel/ios/`, Gradle `ios/apptel/android/` (gitignoré), artefacts APK/AAB, CI, Capacitor.  
**Pas de build Xcode** (poste Windows). Android : artefacts existants inspectés, pas de `assemble` relancé.

---

## Verdict

| Store | Build inspecté | Soumissible ? |
|-------|----------------|---------------|
| **Android** | APK debug **aujourd’hui** (15/08 09:24, 21,5 Mo) + AAB release **périmé** (30/06, 5,1 Mo) | **NO-GO Play** — AAB trop vieux, package `com.soundy.app`, pas de `google-services.json`, IAP absent |
| **iOS** | Projet Xcode 2.0.1 (build 201), **aucun IPA** | **NO-GO App Store** — pas de Team ID, `aps-environment=development`, CI non signée, IAP absent |

L’audit web+tel du matin n’avait **pas** ouvert ces projets de build. C’est fait ici.

---

## Android (Gradle réel)

Présent localement : `ios/apptel/android/` (gitignoré, régénérable via `cap add android` + `patch-android-native.mjs`).

| Point | Constat |
|-------|---------|
| `applicationId` | `com.soundy.app` (marque Soundy) |
| version | `2.0.2` / `versionCode` 202 |
| SDK | `min 24` · `compile/target 36` — OK Play (API 36 au 31/08/2026) |
| Nom affiché | OnScen |
| Backup | `allowBackup=false` |
| Cleartext | interdit (prod Capacitor + pin config) |
| Pins TLS | leaf + intermédiaire, expiration **2026-11-08** (régénérés ce jour) |
| Deep links | `/salon` `/live` `/profile` `/reels` `/auth` (+ `/tel/…`) — aligné AASA (MODIF 1435) |
| Push | `google-services.json` absent → plugin FCM non appliqué |
| Keystore | `soundy-release.jks` local, gitignoré. Certificat AAB : CN=Valentin Goulven, OU=**Soundy**, O=**MeloSong** |
| APK debug | `OnScen-debug-prod.apk` = `app-debug.apk` · 21,5 Mo · **15/08/2026 09:24** |
| AAB release | `OnScen-release-prod.aab` · **12,4 Mo** · **15/08/2026 13:35** · v**2.0.2** (202) |
| CI | `.github/workflows/android-capacitor.yml` → APK debug only ; artefact encore nommé `soundy-android-debug` |

---

## iOS (Xcode)

| Point | Constat |
|-------|---------|
| Bundle ID | `com.soundy.app` |
| Version | marketing `2.0.2` · `CURRENT_PROJECT_VERSION` 202 |
| Déploiement | iOS **15.0** · iPhone + iPad |
| Display name | OnScen |
| Permissions | micro, caméra, localisation, photothèque, Face ID — textes OnScen |
| Privacy Manifest | email, géoloc précise, audio, photos ; UserDefaults + file timestamp. **Manque** crash (Sentry), identifiant utilisateur, paiements |
| Associated domains | `applinks` + `webcredentials` `onscen.com` et `www.onscen.com` |
| Sign in with Apple | entitlement présent |
| Push | `aps-environment` = **`development`** — à passer `production` pour l’App Store |
| Signing | Automatic, `iPhone Developer`, **pas de `DEVELOPMENT_TEAM`** |
| IPA | **aucun** sur disque |
| CI | `ios-capacitor.yml` : skeleton non signé ; artefact encore nommé `melosong-ios-workspace` |

---

## Capacitor

- Prod : `hostname: onscen.com`, `cleartext: false`, `allowMixedContent: false`.
- Dev : cleartext autorisé (LAN) — normal.
- `appId` toujours `com.soundy.app`.

---

## Écarts bloquants stores

1. Pas d’IAP StoreKit / Play Billing (Stripe déjà bloqué dans le WebView).
2. Identifiants encore Soundy / MeloSong (bundle, keystore DN, noms CI).
3. iOS : Team ID + profils + `aps-environment` production.
4. Android : nouvel AAB **après** les correctifs d’août (celui du 30/06 est obsolète).
5. Deep links Android incomplets vs AASA (`/reels`, `/auth`).
6. Firebase / `APPLE_TEAM_ID` pour push et Universal Links.

---

## Ce que cet audit n’a pas fait

- Compiler un IPA (pas de Mac ici).
- Relancer `assembleRelease` / uploader sur Play.
- Tester Universal Links / App Links sur device.
