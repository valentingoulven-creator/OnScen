# Audit CTO — Builds applications mobiles (iOS + Android)

**Auditeur :** @onscen-cto (lecture seule, pas d’implémentation)  
**Date :** 2026-08-16  
**Périmètre :** pipelines de build Capacitor (`ios/apptel`), CI GitHub, signing, versions, deep links, stores.  
**Méthode :** configs actuelles (`capacitor.config*.json`, `Info.plist`, `project.pbxproj`, `patch-android-native.mjs`, workflows, `.well-known`, scripts `android/*.ps1`), comparaison à l’audit du 22/07/2026.

---

## Verdict

**Les builds mobiles sont reproductibles en local (Android AAB 2.0.2 déjà produit le 15/08). Ils ne sont pas prêts pour une soumission store.**

| Canal | Build web/PWA | Build natif debug | Build store signé | Pipeline CI store |
|-------|---------------|-------------------|-------------------|-------------------|
| **PWA `/tel/`** | OK (`mobile:dev` :4082) | n/a | n/a | n/a |
| **Android** | OK (`capacitor:build:prod`) | OK (CI `assembleDebug`) | OK en local (AAB 15/08) | Debug seulement |
| **iOS** | OK (`cap sync ios`) | Squelette CI, **non signé** | **Aucun IPA / TestFlight** | Signature commentée |

---

## 1. Analyse

### Identité et versions (alignées)

| Champ | Valeur |
|-------|--------|
| Nom affiché | OnScen |
| `appId` / bundle | `com.soundy.app` (héritage Soundy) |
| Version marketing | **2.0.2** |
| Build / versionCode | **202** (iOS `project.pbxproj` + patch Android) |
| Capacitor | **8.4.2** (`@capacitor/core`, `ios`, `android`, CLI) |
| Cible Android | **API 36** (Play : obligatoire au 31/08/2026) |
| Domaine WebView prod | `onscen.com` (getsoundy décommissionné) |

### Architecture de build

`ios/apptel/` = second Vite qui **retombe** sur `web/app/src/` (plugin `apptelSrcFallback`). Les overrides tel sont ciblés (~40 fichiers : live theater, carte, share, création). **Plus de forks de pages** (`HomePage` / `DmPage` / `ActualiteTabPage` absents de `ios/apptel/src/pages/`) — amélioration majeure vs audit 22/07.

Chaîne :

1. `npm run capacitor:build:prod` → `ios/apptel/dist/` (API `https://onscen.com/api`)
2. `npx cap sync` → projets natifs
3. Android : `ios/apptel/android/` **gitignoré**, régénéré par `cap add android` + `patch-android-native.mjs`
4. iOS : projet Xcode **committé** (`ios/apptel/ios/`)

### CI

| Workflow | Runner | Ce qu’il fait vraiment |
|----------|--------|------------------------|
| `android-capacitor.yml` | ubuntu + JDK 21 | Build prod web, `cap add android`, patch, cert pins, **APK debug non signé**, artefact |
| `ios-capacitor.yml` | macos-latest | Build web, `cap sync ios`, **pas de `xcodebuild`**, artefact workspace nommé `melosong-ios-workspace` |
| `ci.yml` | ubuntu, **Node 20** | Backend + `web/app` seulement — **pas** `ios/apptel` |

CI iOS injecte un `.env` LAN placeholder (`127.0.0.1:4080`) même sur push `main` — incohérent avec un artefact « prod ».

### Signing

- **Aucun** `.p12` / `.jks` / `.mobileprovision` dans Git (correct).
- Android release : keystore local + `keystore.properties` (gitignoré). AAB local 15/08 : `android/OnScen-Mobile/OnScen-release-prod.aab` (12,4 Mo).
- iOS : `CODE_SIGN_STYLE = Automatic`, `ExportOptions.plist` **method = development**, Team ID via `$(TEAM_ID)`.
- Secrets CI Apple documentés mais **étapes commentées**.

### Deep links / AASA

- Entitlements iOS : `applinks:` + `webcredentials:` `onscen.com` / `www.onscen.com`.
- Android intent-filters : `/salon`, `/live`, `/profile`, `/reels`, `/auth` (+ `/tel/…`).
- **AASA prod** : `TEAM_ID.com.soundy.app` — **placeholder**. Universal Links et WebAuthn iOS **ne peuvent pas** se vérifier tant que le Team ID Apple réel n’est pas publié.

### Stores / monétisation

- Stripe **bloqué** sur natif (UI `isNativeApp()` + header `X-OnScen-Client` → 403) — conforme App Store 3.1.1.
- **Pas d’IAP** StoreKit 2 / Play Billing (C1, décision produit).
- Sign in with Apple : entitlement + route API prêts ; **compte Apple Developer + secrets prod** manquants (C3).
- Push : `@capacitor/push-notifications` ; no-op sans `FIREBASE_SERVICE_ACCOUNT_JSON` prod.

---

## 2. Risques

| ID | Sévérité | Risque |
|----|----------|--------|
| B1 | P0 | AASA `TEAM_ID` → Universal Links + biométrie iOS cassés en prod |
| B2 | P0 | Aucun IPA signé / TestFlight — iOS non livrable hors Xcode local |
| B3 | P0 | CI iOS ne compile pas (pas de `xcodebuild`) — régression iOS non détectée |
| B4 | P1 | CI Android = debug only ; AAB store = machine locale uniquement |
| B5 | P1 | Soumission store sans IAP = OK **si** monétisation reste web ; rejet 3.1.1 si Stripe réactivé dans la WebView |
| B6 | P1 | `com.soundy.app` vs marque OnScen — friction App Store Connect / Play (changement d’ID = nouvelle app) |
| B7 | P1 | Pinning TLS Android seul ; rotation cert Cloudflare sans rebuild = brick API |
| B8 | P2 | `ios/apptel` TypeScript **sans `strict`** |
| B9 | P2 | Node 20 (CI principale) vs Node 22 (workflows mobile) |
| B10 | P2 | Artefact CI encore préfixé `melosong` |

---

## 3. Architecture recommandée

Garder Capacitor + fallback Vite (bon). Ne **pas** recréer des forks de pages.

Cible store :

1. **Une source de vérité version** (aujourd’hui dupliquée pbxproj + `VERSION_CODE` dans le patch Android) — extraire `2.0.2` / `202` dans un fichier unique.
2. **CI en deux étages** : (A) debug unsigned à chaque push (déjà Android) ; (B) release signé **manuel** (`workflow_dispatch`) avec secrets, upload TestFlight / Play internal.
3. **iOS** : décommenter signature + `xcodebuild archive` + `ExportOptions` `app-store`.
4. **Android** : garder `android/` gitignoré **si** le patch reste la seule source de vérité native (documenter « ne jamais éditer le Gradle généré »).

---

## 4. Sécurité

- JWT natif : Keychain/Keystore (`@aparajita/capacitor-secure-storage`) — correct.
- `allowBackup=false`, mixed content off, cleartext off en prod — correct.
- Permissions Info.plist / Manifest justifiées par des features réelles.
- `PrivacyInfo.xcprivacy` présent (email, localisation, audio, photos, pas de tracking).
- Stripe natif refusé côté API — ne pas relâcher ce garde-fou.
- Pinning Android : prévoir **2 pins** (actuel + backup) et un runbook de rotation.

---

## 5. Impacts légaux

- Mentions « Signaler » / stores : IAP, Sign in with Apple, privacy labels **avant** soumission (checklist avocat).
- Guideline Apple 4.8 : Sign in with Apple **obligatoire** si Google OAuth est proposé dans l’app iOS.
- Privacy Nutrition Labels App Store à aligner sur `PrivacyInfo.xcprivacy`.
- Conseil juridique définitif : hors périmètre CTO.

---

## 6. UX

- PWA tel (`:4082/tel/`) = canal de test quotidien. Le binaire store n’est pas le canal actuel des utilisateurs.
- Overrides live/carte récents : tester **sur binaire Capacitor**, pas seulement PWA (caméra, geo, back Android, push).

---

## 7. Infrastructure

- API prod : `https://onscen.com` — cohérent avec `capacitor.config.prod.json`.
- Push FCM + APNs : dépend Firebase + profils Apple.
- CI mobile **ne déploie pas** sur les stores (pas de Fastlane / `upload-to-testflight`).

---

## 8. Base de données

Sans impact direct. Les IAP futurs impliqueront des tables receipts / `originalTransactionId` — hors scope tant que C1 n’est pas tranché.

---

## 9. Sauvegarde

Keystore Android et certificat Apple : **hors Git**. Perte du keystore = **impossibilité de mettre à jour** l’app Play. Vérifier qu’une copie chiffrée existe hors machine de build (gestionnaire de secrets / coffre).

---

## 10. Plan de développement (handoff)

### Fondateur (humain / comptes)

1. Apple Developer Program + Team ID réel → remplacer `TEAM_ID` dans AASA + `mobile-store.env`.
2. Trancher **IAP natif vs monétisation web-only**.
3. Confirmer si **ACRCloud** (`ACRCLOUD_ACCESS_KEY` / `SECRET`) doit être en prod ou reste volontairement absent (exigence audit GO).
4. Firebase prod pour push, ou accepter no-op.
5. Calendrier TestFlight / Play internal.

### @onscen-dev-agent (code / CI)

1. Publier AASA avec Team ID réel + vérifier `https://onscen.com/.well-known/apple-app-site-association`.
2. CI iOS : `xcodebuild` (même unsigned d’abord) ; renommer artefact `onscen-ios-workspace`.
3. `ExportOptions.plist` : variante `app-store` pour release.
4. Option : `workflow_dispatch` AAB signé (secrets `ANDROID_KEYSTORE_*` déjà documentés).
5. Fichier version unique 2.0.2 / 202.
6. `strict: true` sur `ios/apptel/tsconfig.app.json` (ARC-2).
7. Aligner Node CI (20 vs 22).

---

## 11. Code (constats, pas de patch)

```text
ios-capacitor.yml          → xcodebuild commenté ; artefact "melosong-*"
ExportOptions.plist        → method = development
apple-app-site-association → TEAM_ID.com.soundy.app
patch-android-native.mjs   → VERSION_CODE 202 / targetSdk 36
capacitor.config.prod.json → hostname onscen.com, cleartext false
```

---

## 12. Optimisations

- Fastlane ou `softprops` upload une fois les secrets en place.
- Cache Gradle + DerivedData en CI.
- Smoke Capacitor (geo, camera, deep link) sur émulateur CI.

---

## 13. Bonnes pratiques

- Ne jamais committer keystore / p12.
- Ne pas éditer `ios/apptel/android/` à la main (gitignoré).
- Toute feature UI = `web/app` + override tel si besoin (`onscen-web-et-tel`).
- Tester le **binaire** avant une review store (PWA ≠ WKWebView / Chrome WebView).

---

## 14. Évolutions

- Changer `com.soundy.app` → `com.onscen.app` **uniquement** avant la 1re soumission (après = nouvelle fiche store).
- IAP si le fondateur veut abonnements / dons **dans** l’app.
- Pinning iOS (TrustKit / `NSPinnedDomains`) si le pinning Android est conservé.

---

## Question ouverte (GO)

Les clés **ACRCloud** doivent-elles être configurées en prod, ou restent-elles volontairement absentes ?

---

## Handoff Dev (2026-08-16)

Implémenté par `@onscen-dev-agent` — voir `commun/docs/dev-agent/handoffs/2026-08-16-builds-mobiles.md` :

- CI iOS : `xcodebuild` unsigned + artefact `onscen-ios-project`
- `ExportOptions.app-store.plist` (développement local inchangé)
- Version unique `ios/apptel/app-version.json` (2.0.2 / 202)
- **APPLE_TEAM_ID** non inventé — AASA runtime déjà branché sur `process.env.APPLE_TEAM_ID`
