# Rapport Dev Agent — 2026-08-16 — Handoff builds mobiles

**Agent :** @onscen-dev-agent  
**Date :** 2026-08-16  
**Durée estimée :** 0,5 h  
**Statut global :** ✅ Terminé (hors secrets fondateur)

---

## Mission

Handoff de l’audit CTO builds mobiles 2026-08-16 : CI iOS qui compile, artefact OnScen, ExportOptions store, version unique 2.0.2/202. Ne pas inventer `APPLE_TEAM_ID`. Ne pas commit.

---

## Contexte / problème

L’audit (`commun/docs/audit/2026-08-16-builds-mobiles.md`) constatait : CI iOS sans `xcodebuild`, artefact `melosong-ios-workspace`, ExportOptions `development` seulement, version dupliquée pbxproj / patch Android, AASA `TEAM_ID` placeholder.

---

## Actions réalisées

- [x] `xcodebuild` unsigned (workspace ou projet) dans `ios-capacitor.yml`
- [x] Artefact `onscen-ios-project` ; build web CI = `capacitor:build:prod`
- [x] `ExportOptions.app-store.plist`
- [x] `ios/apptel/app-version.json` + sync iOS + lecture Android
- [x] Handoff + `modification.txt` MODIF 1458
- [x] `APPLE_TEAM_ID` non inventé (AASA runtime déjà branché sur l’env)

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `.github/workflows/ios-capacitor.yml` | xcodebuild unsigned, artefact onscen, prod web |
| `ios/apptel/app-version.json` | source unique 2.0.2 / 202 |
| `ios/apptel/scripts/read-app-version.mjs` | lecture + sync pbxproj |
| `ios/apptel/scripts/sync-app-version.mjs` | CLI sync |
| `ios/apptel/scripts/patch-android-native.mjs` | version depuis JSON |
| `ios/apptel/scripts/capacitor-build-prod.mjs` | sync version avant build |
| `ios/apptel/ios/ExportOptions.app-store.plist` | method app-store |
| `ios/apptel/package.json` | script `sync:app-version` |
| `commun/docs/dev-agent/handoffs/2026-08-16-builds-mobiles.md` | handoff |
| `commun/docs/audit/2026-08-16-builds-mobiles.md` | note handoff |

---

## Commandes exécutées

```text
node ios/apptel/scripts/sync-app-version.mjs   → à vérifier
```

`xcodebuild` non lancé ici (pas de macOS local). CI GitHub le fera au prochain push sur `main` / `master` (non fait dans cette session).

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend | non requis |
| Build frontend | non requis (CI / scripts seulement) |
| Sync version locale | voir commandes |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1458 — Handoff builds mobiles)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| `APPLE_TEAM_ID` | Poser le Team ID réel (env prod + secret GH). Ne pas l’inventer. |
| ACRCloud | Clés prod ou absence volontaire |
| Signing iOS | p12 + profil pour IPA / TestFlight |

---

## Prochaines étapes

1. Fondateur : Team ID + `npm run mobile:well-known` (ou env runtime seul).
2. Push / CI iOS pour valider `xcodebuild` sur `macos-latest`.
3. Secrets Apple puis décommenter les étapes de signature.

---

*Généré par OnScen Dev Agent — ne pas éditer le template `_TEMPLATE.md`*
