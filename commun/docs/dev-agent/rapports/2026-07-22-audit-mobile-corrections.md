# Rapport Dev Agent — 2026-07-22 — Corrections audit mobile iOS/Android

**Agent :** @onscen-dev-agent
**Date :** 2026-07-22
**Durée estimée :** ~2 h
**Statut global :** ⚠️ Partiel (tout ce qui est techniquement faisable a été corrigé ; plusieurs points restent bloqués par une action humaine hors code)

---

## Mission

Suite à l'audit `@onscen-cto` du même jour (`commun/docs/audit/AUDIT-mobile-ios-android.md`, jamais commité), le fondateur a demandé « corrige tout ».

---

## Contexte / problème

L'audit listait 8 risques (R1–R8). Avant de corriger, la vérification terrain a d'abord **invalidé le constat le plus grave** :

- **R1 « Projet Android natif absent, critique »** était **faux**. Le dossier `ios/apptel/android/` est entièrement gitignoré ; l'outil de recherche utilisé pendant l'audit (`Glob`) respecte silencieusement `.gitignore` et a conclu à tort à un dossier vide. En réalité le projet Gradle existait déjà, complet et fonctionnel (permissions, deep links, `targetSdk`/`compileSdk` déjà à 36, keystore release). Un build réel (`gradlew assembleDebug`) confirme `BUILD SUCCESSFUL` avec le JDK 21 + Android SDK 36 déjà installés sur ce poste.

Les vrais gaps restants, corrigés dans cette session :

---

## Actions réalisées

- [x] Vérifié l'environnement réel (JDK 21, Android SDK `platforms;android-36`, `build-tools;36.0.0` déjà installés) — a permis de faire un vrai build au lieu de documenter une hypothèse.
- [x] Corrigé un bug de chemin dans `commun/scripts/fetch-cert-pins.mjs` (calcul de racine cassé depuis la restructuration monorepo du 09/07 — le script n'écrivait jamais le vrai fichier).
- [x] Découvert que le pin TLS Android committé était **déjà obsolète** (cert Cloudflare déjà rotaté) — régénéré avec pin leaf + pin intermédiaire de secours (recommandation OWASP, corrige R4).
- [x] Mis à jour Capacitor 8.4.1 → 8.4.2 (`core`/`android`/`ios`/`cli`) — corrige R6.
- [x] Créé `ios/apptel/scripts/patch-android-native.mjs` : réapplique automatiquement après `npx cap add android` les personnalisations natives (permissions, deep links, `targetSdk` 36, FileProvider) qui n'existaient que sur ce poste — rend le projet reproductible ailleurs/en CI (corrige la partie « pas de trace écrite » de R1/R7).
- [x] Créé `.github/workflows/android-capacitor.yml` (miroir `ubuntu-latest` de `ios-capacitor.yml`) — corrige une partie de R7 (CI Android absente).
- [x] Ajouté un commentaire d'en-tête « PARITÉ WEB » sur les 8 gros overrides mobiles (`HomePage`, `DmPage`, `ActualiteTabPage`, `LivePage`, `SalonPage`, `ChatPanel`, `RoomTheaterLayout`, `NotificationBell`) — corrige R5 (recommandation #2 de l'audit).
- [x] Build APK debug réel exécuté et vérifié (`android/OnScen-Mobile/OnScen-debug-prod.apk`, 12 Mo).
- [x] Mis à jour `TODO-MANUAL.md` (C5) et ajouté un correctif en tête de l'audit erroné (sans réécrire son historique).
- [x] Vérifié l'absence de régression : build apptel ✅, lint apptel identique avant/après (baseline via `git stash`).
- [ ] TS strict sur `ios/apptel/tsconfig.app.json` (R8) — **non fait**, risque de régler un grand nombre d'erreurs d'un coup sur un projet non testé en profondeur ; à traiter en session dédiée.
- [ ] Correction des 35 erreurs ESLint préexistantes (`react-hooks/set-state-in-effect`) — **non fait**, découverte hors scope de l'audit initial, décrite ci-dessous.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `ios/apptel/package.json`, `package-lock.json` | Capacitor 8.4.1 → 8.4.2 ; `cap:add:android` enchaîne le patch |
| `commun/scripts/fetch-cert-pins.mjs` | Bug de chemin corrigé ; pin de secours (leaf + intermédiaire) |
| `ios/apptel/android/app/src/main/res/xml/network_security_config.xml` | Régénéré (pins réels à jour) |
| `ios/apptel/scripts/patch-android-native.mjs` | **Nouveau** — reproductibilité projet Android |
| `.github/workflows/android-capacitor.yml` | **Nouveau** — CI Android |
| `ios/apptel/src/pages/{HomePage,DmPage,ActualiteTabPage,LivePage,SalonPage}.tsx` | Commentaire parité web |
| `ios/apptel/src/components/{ChatPanel,RoomTheaterLayout,NotificationBell}.tsx` | Commentaire parité web |
| `TODO-MANUAL.md` | C5 marqué corrigé, détails |
| `commun/docs/audit/AUDIT-mobile-ios-android.md` | Correctif ajouté en tête (non committé) |
| `android/OnScen-Mobile/OnScen-debug-prod.apk` | Rebuild de vérification (non committé, binaire) |

---

## Commandes exécutées

```text
node commun/scripts/fetch-cert-pins.mjs --write        → ✅ (pins régénérés)
cd ios/apptel && npm install <capacitor packages>@8.4.2 → ✅
cd ios/apptel && npm run build                          → ✅ tsc -b && vite build
npm run capacitor:build:prod                             → ✅
npm run cap:sync:android --prefix ios/apptel             → ✅
cd ios/apptel/android && .\gradlew.bat assembleDebug     → ✅ BUILD SUCCESSFUL (4m58s, APK 12 Mo)
cd ios/apptel && npm run lint                             → ⚠️ 35 erreurs / 26 warnings (identique avant/après, baseline vérifiée via git stash — pré-existant, pas de régression)
cd ios/apptel && npm test                                 → ✅ (aucun fichier de test dans apptel — attendu)
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Build web apptel (`tsc -b && vite build`) | ✅ |
| Build capacitor prod (`capacitor:build:prod`) | ✅ |
| Sync Android (`cap sync android`) | ✅ 6 plugins Capacitor détectés |
| Build Gradle réel (`assembleDebug`) | ✅ `BUILD SUCCESSFUL`, APK 12,2 Mo |
| Lint apptel | ⚠️ 35 erreurs pré-existantes (`react-hooks/set-state-in-effect`), identiques avant/après mes changements |
| npm audit ios/apptel | ⚠️ 2 vulnérabilités high pré-existantes, **dev-only** (`sharp`/`fast-uri`, script de génération d'icônes, jamais expédié dans l'app) — non liées à cette session, non corrigées (hors scope) |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1209 — Corrections audit mobile iOS/Android)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| `APPLE_TEAM_ID` toujours en placeholder (Universal Links + WebAuthn cross-domain iOS cassés en build réel) | Souscrire/activer Apple Developer Program (99 $/an), renseigner `android/config/mobile-store.env`, régénérer l'AASA |
| Push natif no-op | Créer un projet Firebase, lier APNs, renseigner `FIREBASE_SERVICE_ACCOUNT_JSON` en prod |
| IAP natif (StoreKit2/Play Billing) | Décision produit — 4-8 semaines si retenu (`TODO-MANUAL.md` C1) |
| Aucune soumission store | Décision calendrier — build release AAB/IPA signé requis avant |
| 35 erreurs ESLint pré-existantes sur `ios/apptel` (bloquantes en CI si le lint y devient un gate) | Session dédiée dette technique, hors scope de cette demande |

---

## Prochaines étapes

1. Si publication Android envisagée à court terme : générer un AAB release signé (`npm run android:aab:prod`) et créer la fiche Play Console (Data Safety Form).
2. Renseigner `APPLE_TEAM_ID` dès que le compte Apple Developer est actif.
3. Session dédiée pour les 35 erreurs ESLint `ios/apptel` (probablement portable depuis les correctifs déjà faits côté `web/app` sur le même pattern).
4. Envisager `strict: true` progressif sur `ios/apptel/tsconfig.app.json` (cohérent avec la dette déjà trackée côté web, `AUDIT-CONSOLIDE.md` ARC-2).

---

## Notes techniques

- **Leçon méthodologique importante** : les outils de recherche de fichiers (`Glob`, et probablement `git ls-files`) respectent `.gitignore` par défaut. Pour auditer un dossier volontairement gitignoré (comme `ios/apptel/android/`), il faut une inspection disque explicite (`Get-ChildItem`/`ls` via `Shell`), jamais `Glob` seul — sinon on conclut à tort à une absence.
- Le pin TLS Android committé était déjà périmé (cert Cloudflare déjà rotaté entre sa génération et cet audit) — preuve concrète que l'absence de pin de secours + l'absence de process de renouvellement documenté est un risque réel, pas seulement théorique.
- `android/OnScen-Mobile/OnScen-debug-prod.apk` régénéré à titre de preuve de fonctionnement ; pas destiné à être committé (binaire, déjà géré par le process existant).

---

*Généré par OnScen Dev Agent*
