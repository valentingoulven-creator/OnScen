# AUDIT-mobile-ios-android — OnScen

> **CORRECTIF (2026-07-22, session `@onscen-dev-agent` ultérieure)** : le constat R1
> ci-dessous (« Projet Android natif absent ») est **erroné**. `ios/apptel/android/`
> existe réellement sur le disque de dev (permissions, deep links, targetSdk déjà à
> 36, keystore release) — l'inspection de cet audit a utilisé un outil qui respecte
> silencieusement `.gitignore` (le dossier `android` entier est gitignoré), d'où le
> faux « dossier vide ». Un build Gradle réel (`assembleDebug`) a été exécuté avec
> succès (APK 12 Mo, `BUILD SUCCESSFUL`) le même jour. Les vrais gaps restants étaient :
> aucun script pour **reproduire** ces personnalisations sur un poste vierge/en CI
> (corrigé : `ios/apptel/scripts/patch-android-native.mjs` + workflow
> `.github/workflows/android-capacitor.yml`), Capacitor 8.4.1→8.4.2 (corrigé), et le
> cert pinning Android avec un **pin déjà expiré/obsolète** au moment de l'audit
> (corrigé : pin de secours + bug de chemin dans `fetch-cert-pins.mjs`). Voir
> `docs/dev-agent/rapports/2026-07-22-audit-mobile-corrections.md` pour le détail.
> Les autres constats de cet audit (R2 Apple Team ID, R3 targetSdk — déjà 36 en
> réalité, IAP natif, TS non strict) restent valides.

**Auditeur :** @onscen-cto (lecture seule, aucun fichier applicatif modifié)
**Date :** 2026-07-22
**Périmètre :** `ios/apptel/` (Capacitor iOS + Android), `android/` (build/keystore/export), `.well-known/*`, backend push natif, CI mobile, docs stores.
**Méthode :** lecture intégrale des fichiers de config (`package.json`, `capacitor.config*.json`, `Info.plist`, `App.entitlements`, `project.pbxproj`, `Package.swift`, scripts `commun/scripts/*mobile*`, `android/*.ps1`), comparaison de taille/structure `ios/apptel/src` vs `web/app/src`, recherche web version Capacitor/exigences Google Play 2026, vérification `git ls-files` (aucun secret signing tracké), inspection disque du dossier `android/` généré (vide).

---

## 1. Résumé exécutif

**État réel : app mobile en développement avancé, jamais publiée.** Aucune trace de soumission App Store / Play Store, de build TestFlight actif, ni d'AAB/APK release livré. Le dernier rapport dev-agent daté du 2026-06-30 (`commun/docs/dev-agent/rapports/2026-06-30-stores-mobile-conformite.md`) confirme un blocage sur le rebuild (JDK 21 absent, Mac requis pour l'IPA) — rien n'indique qu'il ait été levé depuis.

Points forts marquants :
- Architecture d'override Capacitor (`apptelSrcFallback` dans `vite.config.ts`) **élégante et bien conçue** : tout fichier non présent dans `ios/apptel/src/` retombe automatiquement sur `web/app/src/` — pas de copie manuelle silencieuse.
- Sécurité du stockage token native (Keychain/Keystore via `@aparajita/capacitor-secure-storage`) et garde-fous App Store 3.1.1 (Stripe bloqué sur natif) déjà en place.
- Aucun secret de signing (`.p12`, `.jks`, `.mobileprovision`) tracké par git — vérifié.
- Deep linking, Sign in with Apple, push natif (FCM) : code prêt côté client et serveur.

Lacunes/risques principaux :
1. **Projet Android natif absent** (dossier `ios/apptel/android/` existe mais vide sur disque — `npx cap add android` n'a jamais été (re)exécuté après la restructuration monorepo du 09/07). Aucun build Android possible en l'état.
2. **`APPLE_TEAM_ID` toujours en placeholder** dans l'AASA prod (`TEAM_ID.com.soundy.app`) → Universal Links iOS non fonctionnels tant que non renseigné.
3. **Certificate pinning Android non fonctionnel** : script `fetch-cert-pins.mjs --write` cible un fichier XML dans un dossier Android qui n'existe pas ; un seul pin sans pin de secours (risque de brick applicatif si rotation certificat Cloudflare).
4. **CI iOS = squelette non signé** (`ios-capacitor.yml`) ; **aucune CI Android**. Pas de pipeline store automatisé.
5. **Divergence de contenu sur les gros overrides** (`HomePage`, `DmPage`, `ActualiteTabPage`, `LivePage` — 23 % à 67 % de la taille de leur équivalent web) : simplification mobile volontaire pour partie (carte simplifiée, pas de globe 3D), mais **aucun mécanisme de suivi de parité fonctionnelle** — risque de dérive silencieuse à chaque nouvelle feature livrée côté web.
6. **Capacitor 8.4.1 vs 8.4.2** (patch du 14/07/2026, fix permissions URI capture image Android — pertinent car `@capacitor/camera` utilisé). Retard mineur, non critique.
7. **IAP natif (StoreKit/Play Billing) non implémenté** — seul un garde-fou bloquant Stripe est en place (conforme App Store 3.1.1 mais aucune monétisation native possible tant que non fait) — déjà connu (`TODO-MANUAL.md` C1).
8. **`targetSdkVersion` Android inconnu** (projet non généré) — à vérifier dès régénération face à l'exigence Google Play **API 36 (Android 16) au 31/08/2026** pour toute nouvelle app/mise à jour.

---

## 2. Analyse

### 2.1 Architecture technique mobile

`ios/apptel/` est un **second projet Vite/React 19 sibling de `web/app/`**, pas un simple wrapper Capacitor. Il partage le même backend (`commun/backend/`) et repose sur un mécanisme original :

```12:88:ios/apptel/vite.config.ts
function apptelSrcFallback() {
  const apptelSrc = path.resolve(__dirname, 'src');
  const appSrc = path.resolve(__dirname, '../../web/app/src');
  ...
```

Un plugin Vite `resolveId` fait qu'un import relatif dans `App.tsx` (ou n'importe quel fichier apptel) qui n'a pas d'override dans `ios/apptel/src/` est transparemment résolu vers `web/app/src/`. C'est **conforme à la règle repo** (`web/app/src/` source de vérité, `ios/apptel/src/` = overrides) au niveau du mécanisme.

En pratique, `ios/apptel/src/` ne contient que **~19 fichiers** contre **700+** dans `web/app/src/` — le ratio confirme que l'override reste l'exception, pas la norme. Cas légitimes et bien justifiés :
- `authStorage.ts` (105 lignes, Keychain/Keystore réel) vs web (82 lignes, cookie httpOnly) — implémentations **différentes par nature**, pas un fork.
- `MainTabNav.tsx`, `useAndroidBackButton.ts`, `nativeDeepLink.ts`, `nativeBoot.ts`, `useNativePushRegistration.ts` — code **spécifiquement natif**, sans équivalent web direct.
- `socket.ts` (185 vs 190 lignes) — quasi identique, écart mineur probable (URL socket).

Cas à surveiller (dette potentielle) — **fichiers entièrement réécrits**, pas de petits diffs :

| Fichier override | Lignes apptel | Lignes web | Ratio |
|---|---|---|---|
| `pages/HomePage.tsx` | 857 | 3 749 | 23 % |
| `pages/DmPage.tsx` | 1 824 | 3 877 | 47 % |
| `pages/ActualiteTabPage.tsx` | 835 | 2 118 | 39 % |
| `pages/LivePage.tsx` | 1 242 | 1 851 | 67 % |
| `pages/SalonPage.tsx` | 508 | 783 | 65 % |
| `components/ChatPanel.tsx` | 740 | 1 058 | 70 % |
| `components/RoomTheaterLayout.tsx` | 398 | 988 | 40 % |
| `components/NotificationBell.tsx` | 449 | 711 | 63 % |

Vérification sur `HomePage.tsx` : la version apptel n'importe ni `MapEventSearchBar`, ni `MapOrganizerEventsPopup`, ni `MapCityEventsPanel`, ni `StartLiveFlowModals`/`useStartLiveFlow`, ni `MapEventsBrowseSheet` — c'est une **carte simplifiée volontairement** (cohérent avec `canUseGlobeView()` qui exclut le natif, mentionné dans `vite.config.ts`). C'est donc en bonne partie un choix produit délibéré (UX mobile allégée), **pas une simple négligence** — mais rien ne garantit qu'un bugfix ou une feature critique (sécurité, modération, paiement) ajoutée côté web sur ces mêmes pages soit systématiquement évaluée pour portage vers apptel. Aucune checklist, aucun test de parité, aucun commentaire `// TODO: porter vers apptel` retrouvé.

**Build process** : documenté et cohérent.
- `npm run apptel:dev` / `apptel:build` → PWA `backend/public/tel/`.
- `npm run capacitor:build[:prod]` → `ios/apptel/dist/` (base relative, pas de service worker, cible réelle `getsoundy.com` en config prod pour que WebAuthn/rp.id fonctionne — bien documenté en commentaire dans `capacitor-build-prod.mjs`).
- `npm run capacitor:sync[:prod]` → `npx cap sync` vers `ios/` et `android/`.
- `npm run capacitor:android:apk[:prod]`, `android:aab:prod` → scripts PowerShell dédiés (`android/build-android-*-prod.ps1`), gérés proprement (JDK 21 requis, `local.properties` généré dynamiquement, jamais committé).
- CI : `.github/workflows/ios-capacitor.yml` (macOS runner) — build web + `cap sync ios` fonctionnels, mais **étape de signature commentée** (attend les secrets Apple). Pas d'équivalent Android en CI.

### 2.2 Version Capacitor

`@capacitor/core`, `cli`, `ios`, `android` : **8.4.1** (package.json). Dernière stable : **8.4.2** (14/07/2026, fix Android « explicitly grant URI permissions for image capture intent » — directement pertinent car `@capacitor/camera` est utilisé pour lives/photos de profil). Écart mineur, non bloquant, mais à absorber au prochain `npm update` avant un build de production (bug potentiel de capture caméra sur Android sinon).

### 2.3 iOS spécifique

- Projet Xcode présent et committé (`ios/apptel/ios/App/App.xcodeproj`), généré par Capacitor **et maintenu** (`ios/.gitignore` n'exclut que build/Pods/DerivedData — conforme à la pratique recommandée quand des overrides natifs Swift/entitlements sont maintenus manuellement, comme ici avec `AppDelegate.swift` custom).
- Version app : **2.0.1 (build 201)** — cohérent entre `Info.plist` (via `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`) et `project.pbxproj`.
- `Info.plist` : permissions déclarées et **toutes justifiées par une feature réelle** :
  - `NSMicrophoneUsageDescription` (lives/salons audio) ✅
  - `NSCameraUsageDescription` (lives vidéo/photo profil) ✅
  - `NSLocationWhenInUseUsageDescription` (carte/salons proches) ✅
  - `NSPhotoLibraryUsageDescription` + `NSPhotoLibraryAddUsageDescription` (profil/reels/export) ✅
  - `NSFaceIDUsageDescription` — **vérifié câblé** : `BiometricSetup.tsx` (partagé via fallback) utilise WebAuthn (`@simplewebauthn/browser`), rendu possible par `capacitor.config.prod.json` qui fixe `server.hostname = getsoundy.com` pour que le rp.id WebAuthn corresponde au domaine réel (déjà documenté en commentaire dans `capacitor-build-prod.mjs`). Pas de permission déclarée sans usage (risque de rejet Apple 5.1.1 écarté).
  - `UIBackgroundModes: [audio, remote-notification]` — cohérent avec lecture audio en arrière-plan (`AppDelegate.swift` configure `AVAudioSession.playback`) et push natif.
- **Associated domains** : `applinks:getsoundy.com`, `webcredentials:getsoundy.com` déclarés dans `App.entitlements` — mais l'**AASA prod contient toujours `TEAM_ID` en placeholder** (`commun/backend/public/.well-known/apple-app-site-association`, régénéré par `update-well-known-mobile.mjs` seulement si `APPLE_TEAM_ID` est renseigné dans `android/config/mobile-store.env`, gitignoré). Tant que ce n'est pas fait : Universal Links et WebAuthn cross-domain iOS ne fonctionneront pas correctement en production.
- **Paths AASA incomplets** : seuls `/salon/*`, `/live/*`, `/profile/*`, `/` sont couverts. `nativeDeepLink.ts` ne filtre que par hostname (pas par path), donc le routing React fonctionnera pour n'importe quel chemin ouvert via `appUrlOpen` — mais **iOS lui-même n'ouvrira l'app que pour les chemins listés dans l'AASA** (`/reels/*`, `/feed/*`, pas de deep link DM listés) → les liens profonds vers reels/feed ne déclencheront pas l'app depuis Safari/Messages tant que l'AASA n'est pas étendu.
- **Signing** : `CODE_SIGN_STYLE = Automatic`, pas de Team ID en dur dans `project.pbxproj` (variable Xcode) — aucun secret committé. `ExportOptions.plist` en méthode `development` (attendu, à changer en `app-store` pour un vrai export TestFlight).
- `aps-environment = development` dans l'entitlement — normal en dev, Xcode le bascule automatiquement en production au moment de la signature App Store avec le bon profil.
- `PrivacyInfo.xcprivacy` **présent et cohérent** (email, localisation précise, photos — pas de tracking déclaré) — bon point, souvent oublié.
- **CocoaPods absent, Swift Package Manager utilisé** (`CapApp-SPM/Package.swift`, généré par Capacitor 7+) — approche moderne, évite les problèmes classiques de Podfile/CocoaPods sous Windows (pertinent puisque le dev se fait sous Windows, la compilation Xcode nécessitera un Mac de toute façon).

### 2.4 Android spécifique

Le dossier `ios/apptel/android/` **existe sur le disque mais est vide** (confirmé par inspection directe, hors index git puisque `.gitignore` exclut `android` en entier ligne 17). Cela signifie que `npx cap add android` **n'a pas été (ré)exécuté** depuis la restructuration monorepo (commit `72370fc8`, 09/07/2026) — alors que le rapport du 30/06 mentionne pourtant avoir modifié `ios/apptel/android/app/build.gradle` et un `MainActivity.java`, ce qui prouve que le projet a existé localement à un moment donné puis a disparu (nettoyage, changement de machine, ou simple absence de régénération post-restructuring).

**Conséquence directe : aucun build Android (APK/AAB) n'est possible en l'état actuel du repo.** `TODO-MANUAL.md` (C5, toujours ouvert) documente déjà ce manque — cet audit confirme qu'il est toujours d'actualité, pas résolu depuis le 15/07.

Ce qui existe malgré tout et reste valide :
- `assetlinks.json` avec une **vraie empreinte SHA-256** (pas le placeholder de `.example`) → un keystore release a déjà été généré au moins une fois (`android/generate-android-keystore.ps1`, process propre : mot de passe aléatoire, jamais committé, écrit uniquement dans `keystore.properties` gitignoré).
- `com.soundy.app` comme `package_name` — cohérent avec `capacitor.config.json` (`appId`).
- `build.gradle` / `AndroidManifest.xml` / `minSdkVersion`/`targetSdkVersion` : **impossibles à vérifier**, le projet n'existe pas. À valider dès régénération (`npx cap add android` régénère ces fichiers avec les defaults Capacitor 8.4 — généralement `targetSdkVersion` aligné sur le dernier stable au moment du build, mais **doit être vérifié et forcé à API 36** avant toute soumission, cf. §2.6).
- Le script `fetch-cert-pins.mjs` cible `ios/apptel/android/app/src/main/res/xml/network_security_config.xml` — **échouera** tel quel puisque ce chemin n'existe pas encore.

### 2.5 Sécurité mobile spécifique

- **Stockage token** : `Preferences` (non chiffré, utilisé seulement pour le flag `remember_me`, non sensible) + `@aparajita/capacitor-secure-storage` (Keychain iOS / Keystore Android) pour le JWT lui-même — **bon choix**, conforme aux standards (ni `localStorage`, ni `Preferences` en clair pour le token). Fallback en mémoire si Keychain/Keystore indisponible (device verrouillé) documenté et volontaire (`authStorage.ts` ligne ~105) — compromis raisonnable UX vs sécurité, acceptable.
- **Migration legacy** : `migrateLegacyStorage()` nettoie proprement tout résidu `localStorage`/`sessionStorage` au premier lancement natif — bonne pratique anti-résidu.
- **Certificate pinning** : infrastructure Android préparée (`fetch-cert-pins.mjs`, `mobile:cert-pins` script racine) mais **non fonctionnelle actuellement** (cible un fichier dans un projet Android non généré) et **risquée telle que conçue** : un seul pin SPKI SHA-256, sans pin de secours (« backup pin »). Si Cloudflare rotote son certificat (renouvellement TLS normal, ~90 jours Let's Encrypt ou équivalent) sans qu'un nouveau build avec le nouveau pin soit déployé sur les devices, **l'app cessera de pouvoir contacter l'API** (comportement recherché du pinning, mais destructeur si mal opéré). Pas d'équivalent iOS (pas de `NSPinnedDomains`/TrustKit) — pinning donc **asymétrique entre plateformes**, à clarifier : c'est acceptable si le choix produit est « pinning Android seul suffisant pour le niveau de risque actuel (pas encore d'IAP/paiement natif) », mais ce n'est pas documenté comme un choix explicite.
- **Paiements (Stripe)** : `CreatorSubscribeSheet.tsx` et `LiveDonationSheet.tsx` utilisent `isNativeApp()` (`web/app/src/lib/nativePlatform.ts`, basé sur `Capacitor.getPlatform()`) pour **masquer Stripe sur iOS et Android** et rediriger vers un message “passez par le web” — conforme App Store 3.1.1 / Play Billing. **Aucun IAP natif implémenté** (StoreKit 2 / Play Billing) — décision produit déjà tracée dans `TODO-MANUAL.md` (C1), pas un oubli de cet audit.
- **Audit sécurité existant** (`AUDIT-securite-v2.md`, `AUDIT-CONSOLIDE.md`) : le mobile n'y est traité que marginalement — seule mention structurante : `ARC-2` (TypeScript `strict` désactivé sur `web/app/tsconfig.app.json` **et** `ios/apptel/tsconfig.app.json`, toujours ouvert, effort L) et une note sur l'absence de revue XSS ligne-à-ligne exhaustive sur `ios/apptel/src` dans la dernière session de fixes. Ce présent audit **complète** ces deux points sans les dupliquer : le fait que `ios/apptel/tsconfig.app.json` ne soit pas strict aggrave légèrement le risque runtime des gros overrides mobiles (HomePage/DmPage/LivePage) qui manipulent des données réseau (WebSocket, API) sans garde `null`/`undefined` systématique.
- **Sightengine/NSFW, rate limiting, JWT tokenVersion** : ce sont des mécanismes backend partagés (pas mobile-spécifiques) déjà couverts par les audits sécurité existants — non dupliqués ici.

### 2.6 Écarts avec les règles projet

- **Règle `ios/apptel/src/` = overrides only** : respectée au niveau du **mécanisme** (fallback Vite), mais en pratique certains overrides sont des **réécritures complètes** de pages majeures plutôt que des diffs ciblés (cf. §2.1). Ce n'est pas une violation de la règle au sens strict (le fichier override *est* nécessaire car le rendu mobile diverge structurellement), mais cela crée une dette de synchronisation non trackée.
- **`mobile-responsive.mdc` dans le WebView Capacitor** : les composants observés (`MainTabNav.tsx` — touch targets `min-h-[44px]`, `RoomTheaterLayout.tsx`, `MapSalonListenSheet.tsx` en bottom-sheet) respectent visiblement les standards du projet (cible `≥44px`, bottom-sheet mobile, `safe-area-inset`). Le README `ios/apptel/README.md` documente explicitement les adaptations (max-width 430px, safe-area, `.desktop-only` masqué) — cohérent avec la règle. Aucun écran testé en profondeur pixel-par-pixel dans cet audit (hors scope lecture de code statique), mais rien d'alarmant relevé dans le code consulté.
- **TypeScript strict** : écart déjà documenté (`AUDIT-CONSOLIDE.md` ARC-2), confirmé toujours ouvert sur `ios/apptel/tsconfig.app.json`.

### 2.7 État de publication réel

**Aucune preuve de publication, même en beta.** Chronologie reconstituée depuis les fichiers repo :
- 30/06/2026 : rapport dev-agent — corrections bloquantes (package Android, guard Stripe, Sign in with Apple), mais rebuild AAB/IPA **non réalisé** (JDK 21 absent, Mac requis).
- 09/07/2026 : restructuration monorepo (`web/`, `ios/`, `android/`, `commun/`) — le dossier Android généré n'a apparemment pas survécu/été régénéré.
- 15/07/2026 : `TODO-MANUAL.md` toujours à jour, `C5 — Projet Android manquant` toujours listé comme ouvert.
- 22/07/2026 (ce jour) : confirmation — `android/` toujours vide, `APPLE_TEAM_ID` toujours placeholder dans l'AASA prod, aucun artefact `.apk`/`.aab` dans `android/OnScen-Mobile/`.
- CI iOS (`ios-capacitor.yml`) : capable de builder et sync le projet iOS sur runner macOS, mais **jamais signé** (étapes de signature commentées, en attente des secrets `APPLE_CERTIFICATE_BASE64` etc.). Aucune CI Android.

**Conclusion : l'app est en développement actif, jamais soumise à TestFlight ni Play Console.** Le canal de distribution actuel réel pour les utilisateurs mobiles est la **PWA** (`getsoundy.com/tel/`), pas une app store — ce qui est cohérent avec le README qui présente la PWA comme « recommandé » et Capacitor comme « configuré » (mais pas déployé).

---

## 3. Tableau récapitulatif iOS vs Android

| Axe | iOS | Android |
|---|---|---|
| **Projet natif** | ✅ Généré et committé (`ios/App.xcodeproj`), maintenu (AppDelegate custom, entitlements) | ❌ **Absent** (dossier vide, `npx cap add android` à refaire) |
| **Version/build** | ✅ 2.0.1 (201), cohérent partout | ⚠️ Inconnu (projet non généré, à revérifier après régénération) |
| **Permissions déclarées** | ✅ Toutes justifiées par une feature réelle (micro, caméra, localisation, photos, Face ID câblé via WebAuthn) | ⚠️ Non vérifiable (`AndroidManifest.xml` inexistant) |
| **Signing** | ✅ Automatic, aucun secret committé, ExportOptions en mode `development` (à passer `app-store` pour TestFlight) | ✅ Process keystore propre et scripté (mot de passe jamais committé) mais **rien à signer** (pas de projet) |
| **Universal/App Links** | ⚠️ Entitlements OK mais AASA prod avec `TEAM_ID` placeholder, paths incomplets (reels/feed absents) | ✅ `assetlinks.json` avec vraie empreinte SHA-256, `package_name` cohérent |
| **Push natif** | ✅ Code prêt (`AppDelegate` relaie le device token), backend FCM prêt, **Firebase non configuré en prod** (no-op tant que `FIREBASE_SERVICE_ACCOUNT_JSON` absent — attendu, décision fondateur) | ✅ Idem (FCM direct), même dépendance backend |
| **Stockage sécurisé token** | ✅ Keychain via `@aparajita/capacitor-secure-storage` | ✅ Keystore via même lib (cross-platform) |
| **Certificate pinning** | ❌ Non implémenté (pas d'équivalent TrustKit/NSPinnedDomains) | ⚠️ Scripté mais **non fonctionnel** (cible un fichier XML dans un projet Android absent), un seul pin sans secours |
| **Paiements (Stripe)** | ✅ Bloqué sur natif (conforme 3.1.1) | ✅ Bloqué sur natif (conforme Play Billing) |
| **IAP natif (StoreKit/Play Billing)** | ❌ Non implémenté (décision produit en attente, `TODO-MANUAL.md` C1) | ❌ Idem |
| **CI/CD mobile** | ⚠️ Squelette (`ios-capacitor.yml`), build+sync OK, **signature désactivée** | ❌ Aucune CI |
| **Build/déploiement réel** | ❌ Jamais soumis à TestFlight | ❌ Jamais buildé en release depuis la restructuration (AAB du 23/06 obsolète selon rapport 30/06) |
| **Conformité Play Store targetSdk 2026** | N/A | ❌ Impossible à vérifier — à forcer explicitement à API 36 dès régénération du projet (deadline Google : 31/08/2026) |
| **Capacitor version** | ⚠️ 8.4.1 vs 8.4.2 stable (retard mineur, fix pertinent caméra Android) | idem |

---

## 4. Risques

| # | Risque | Sévérité | Probabilité | Impact |
|---|---|---|---|---|
| R1 | Projet Android absent → aucune app Android livrable en l'état | Critique | Certain (constaté) | Bloque toute distribution Android |
| R2 | `APPLE_TEAM_ID` placeholder → Universal Links + WebAuthn cross-domain iOS cassés en prod native | Élevé | Certain (constaté) | Face ID/passkeys et deep links ne fonctionneront pas sur build iOS réel |
| R3 | Cert pinning Android mal opéré (pin unique, pas de secours) une fois activé | Moyen | Futur (si activé sans 2e pin) | App Android cassée au renouvellement TLS |
| R4 | `targetSdkVersion` non conforme Google Play (API 36 requis 31/08/2026) | Élevé si non traité avant soumission | À vérifier à la régénération | Rejet/dé-listing Play Store |
| R5 | Dérive fonctionnelle silencieuse des gros overrides (`HomePage`, `DmPage`, `ActualiteTabPage`, `LivePage`) vs web | Moyen | Continu, croissant avec le temps | Bugs/fonctionnalités manquantes non détectés côté mobile natif |
| R6 | Capacitor 8.4.1 vs 8.4.2 (bug capture image Android) | Faible | Faible (patch mineur) | Comportement caméra dégradé sur certains devices Android |
| R7 | Aucune CI de signature (iOS et Android) | Moyen | Certain | Chaque build store reste manuel, sujet à erreur humaine, pas reproductible |
| R8 | TypeScript non strict sur `ios/apptel/tsconfig.app.json` | Faible-Moyen | Continu | Bugs runtime `null`/`undefined` non détectés (déjà tracé `AUDIT-CONSOLIDE.md` ARC-2) |

---

## 5. Architecture recommandée

L'architecture actuelle (monorepo `web/app` source de vérité + `ios/apptel` overrides + fallback Vite) **est la bonne approche** pour ce contexte (équipe restreinte, un seul dev principal, besoin de partager la logique métier/API). Pas de recommandation de refonte — seulement des ajustements de processus :

1. **Introduire un mécanisme de suivi de parité** pour les overrides « pleine page » (HomePage, DmPage, ActualiteTabPage, LivePage, SalonPage, ChatPanel, NotificationBell, RoomTheaterLayout) : un simple commentaire d'en-tête type `// PARITÉ WEB : vérifié au commit <hash> — voir web/app/src/pages/X.tsx` mis à jour à chaque revue volontaire, ou une checklist dans `modification.txt` quand une MODIF touche un fichier qui a un override apptel. Coût quasi nul, gain de traçabilité important.
2. **Séparer explicitement « override UX volontaire » de « override technique »** dans un commentaire en tête de chaque fichier `ios/apptel/src/pages/*.tsx` : ex. « Carte simplifiée volontairement (pas de globe 3D, pas d'événements organisateur) — voir web/app pour la version complète ». Certains fichiers l'ont déjà partiellement (`vite.config.ts` l'explique pour le globe), à généraliser.
3. Ne pas envisager un passage à React Native/Flutter : le ROI de réécrire ~700 fichiers partagés serait très négatif face au gain marginal, et l'approche Capacitor + WebView est déjà correctement outillée ici.

---

## 6. Sécurité

Résumé (détails en §2.5) :
- Stockage token natif : ✅ conforme standards (Keychain/Keystore, pas de JWT en clair).
- Paiements : ✅ conforme guidelines stores (Stripe masqué sur natif).
- Biométrie : ✅ réellement câblée (WebAuthn + rp.id aligné), pas de permission déclarée sans usage.
- Cert pinning : ⚠️ à corriger avant activation réelle (pin de secours obligatoire, équivalent iOS à évaluer).
- TS strict : ⚠️ dette déjà tracée, aggravée par le volume de logique dupliquée dans les gros overrides.
- Aucun secret de signing (keystore, certificats, provisioning) committé — vérifié explicitement par recherche git, **aucune fuite constatée**.

---

## 7. Impacts légaux

- **RGPD / Privacy Manifest iOS** (`PrivacyInfo.xcprivacy`) : déclare email, localisation précise, photos — cohérent avec les fonctionnalités réelles (carte géo, profil, reels). Pas de tracking déclaré, cohérent avec l'absence de SDK publicitaire tiers dans `ios/apptel/src`.
- **Play Data Safety Form** : à remplir au moment de la création de la fiche Play Console (non fait tant que l'app n'est pas soumise) — action déjà listée dans le rapport du 30/06 (« Compléter App Privacy Labels + Play Data Safety »), non refaite ici.
- **App Store Review Guideline 3.1.1 / Play Billing** : conforme (Stripe bloqué sur natif) — pas de risque de rejet sur ce point précis. Le risque légal réel reste **l'absence d'IAP natif** si le fondateur souhaite terminer la monétisation via mobile (décision produit, hors périmètre CTO).
- Rien de nouveau vs `TODO-MANUAL.md` C1/C3/C6 déjà documentés — pas de duplication supplémentaire ici.

---

## 8. UX

- Respect visible de `mobile-responsive.mdc` dans le code consulté (touch targets 44px, bottom-sheet, safe-area, max-width 430px documenté dans le README apptel).
- Simplification volontaire de la carte/globe sur mobile (`canUseGlobeView()` exclut natif) — choix UX cohérent avec les contraintes de performance WebView/GPU mobile, pas une régression.
- Aucun test manuel effectué dans cet audit (lecture de code statique uniquement) — recommandation : QA manuelle dédiée sur device réel avant toute soumission store (au-delà de la checklist déjà présente dans `TODO-MANUAL.md`).

---

## 9. Infrastructure

- Backend push natif (`nativePush.ts`) prêt, no-op sans `FIREBASE_SERVICE_ACCOUNT_JSON` — décision/action fondateur déjà documentée dans le fichier lui-même (création compte Firebase, liaison APNs), pas une action technique restante côté code.
- CI iOS sur runner macOS GitHub Actions — coût à surveiller (minutes macOS plus chères que Linux) une fois activée en continu, mais actuellement `workflow_dispatch` + push sur `ios/apptel/**`/`web/app/**` (déclenchement raisonnable, pas systématique sur toute PR).
- Pas de CI Android — à créer (runner `ubuntu-latest` suffit pour un build Gradle, pas besoin de macOS, coût quasi nul).

---

## 10. Plan de développement priorisé

### 🔴 Critique (bloquant toute soumission store)

1. **Régénérer le projet Android** : `cd ios/apptel && npx cap add android`, puis forcer `targetSdkVersion`/`compileSdkVersion` à **36** (Android 16) dans `variables.gradle` avant tout build — deadline Google 31/08/2026. Revalider `AndroidManifest.xml` (permissions caméra/micro/localisation/notifications cohérentes avec `Info.plist` iOS).
2. **Renseigner `APPLE_TEAM_ID`** dans `android/config/mobile-store.env` (nécessite Apple Developer Program actif — 99 $/an, déjà mentionné dans `ios-capacitor.yml`) puis `npm run mobile:well-known` pour régénérer l'AASA prod avec le vrai Team ID. Étendre les `paths` AASA à `/reels/*`, `/feed/*` si le deep-linking doit couvrir ces écrans.
3. **Mettre à jour Capacitor 8.4.1 → 8.4.2** avant tout rebuild release (fix caméra Android).
4. **Rebuild + test AAB/IPA** : JDK 21 local ou passage par CI (compléter les secrets `APPLE_CERTIFICATE_BASE64`/`APPLE_PROVISIONING_PROFILE_BASE64`/`KEYCHAIN_PASSWORD` dans `ios-capacitor.yml` pour un vrai build signé macOS ; côté Android, un runner `ubuntu-latest` suffit avec JDK 21 + Android SDK via `setup-java`/`android-actions/setup-android`).

### 🟠 Important (avant publication publique, pas bloquant technique immédiat)

5. **Corriger le cert pinning Android** : ajouter un pin de secours (certificat CA intermédiaire ou clé de rotation planifiée) avant toute activation en production ; documenter le choix « iOS non pinné » ou implémenter un équivalent (TrustKit / vérification manuelle SPKI côté `URLSession`).
6. **Introduire un suivi de parité** sur les gros overrides (`HomePage`, `DmPage`, `ActualiteTabPage`, `LivePage`, etc.) — commentaire de traçabilité + mention dans `modification.txt` quand une feature web majeure est ajoutée sur une page qui a un override apptel.
7. **CI Android** (nouveau workflow, `ubuntu-latest`) pour builder l'AAB à chaque changement `ios/apptel/**`, en miroir de `ios-capacitor.yml`.
8. Compléter Play Data Safety Form + App Privacy Labels (déjà listé §7, action produit/légale, pas code).

### 🟢 Amélioration (dette technique, non bloquant)

9. Activer `strict: true` progressivement sur `ios/apptel/tsconfig.app.json` (en cohérence avec ARC-2 déjà tracé côté web).
10. Décision produit sur l'IAP natif (StoreKit 2 / Play Billing) — arbitrage fondateur, 4–8 semaines si retenu (déjà tracé `TODO-MANUAL.md` C1).
11. `ExportOptions.plist` : passer de `method: development` à `app-store` au moment du premier vrai export TestFlight (changement d'une ligne, à faire au bon moment plutôt que dès maintenant).

---

## 11. Bonnes pratiques déjà en place (à noter, pas à refaire)

- Aucun secret de signing committé (vérifié explicitement).
- Génération de mot de passe keystore aléatoire, jamais en dur dans un script.
- Migration propre des tokens legacy `localStorage` → Keychain/Keystore au premier lancement natif.
- Garde-fous App Store/Play Billing déjà en place pour Stripe.
- Privacy Manifest iOS à jour et cohérent avec les features réelles.
- Mécanisme d'override Vite bien pensé, évite la duplication silencieuse par défaut.

---

## 12. Évolutions futures

- Si le volume de trafic mobile natif croît significativement après publication : envisager un pin de secours + rotation documentée pour le cert pinning, et étendre le pinning à iOS si le profil de risque l'exige (paiements natifs notamment).
- Si l'IAP natif est retenu : prévoir un audit dédié `@onscen-cto` avant implémentation (arbitrage StoreKit 2 vs RevenueCat/autre SDK tiers de gestion d'abonnements cross-store).
- Une fois les deux apps publiées : ajouter un monitoring crash natif (Sentry a déjà un SDK mobile — `web/app/src/lib/sentry.ts` existe côté web, vérifier s'il couvre le contexte Capacitor ou s'il faut le SDK `@sentry/capacitor` dédié) — non vérifié dans cet audit, à couvrir dans un futur audit observabilité mobile.

---

## Notes de méthode

- **Aucun fichier applicatif n'a été modifié** pendant la production de ce document (lecture seule : `Read`, `Grep`, `Glob`, `git ls-files`, `git log`, inspection disque via PowerShell en lecture).
- Le dossier `ios/apptel/android/` a été inspecté directement sur disque (hors index git, gitignoré) pour confirmer son état vide — information non déductible du seul historique git.
- Recherche web effectuée pour la version Capacitor stable (8.4.2, 14/07/2026) et l'exigence Google Play targetSdk 2026 (API 36 au 31/08/2026) — sources citées dans le corps du texte.
