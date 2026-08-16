# Handoff — Builds mobiles (audit 2026-08-16)

**De :** @onscen-cto (audit) → @onscen-dev-agent (cette session)  
**Source :** `commun/docs/audit/2026-08-16-builds-mobiles.md`  
**Date :** 2026-08-16

---

## Fait dans cette session (sans secrets fondateur)

| Item | Statut |
|------|--------|
| CI iOS `xcodebuild` unsigned | ✅ `.github/workflows/ios-capacitor.yml` |
| Artefact `melosong-*` → `onscen-ios-project` | ✅ |
| Build web CI iOS = prod (`capacitor:build:prod`) | ✅ aligné Android |
| `ExportOptions.app-store.plist` | ✅ `ios/apptel/ios/` (local `ExportOptions.plist` reste `development`) |
| Version unique 2.0.2 / 202 | ✅ `ios/apptel/app-version.json` + sync pbxproj / patch Android |
| `APPLE_TEAM_ID` | ❌ non inventé (volontaire) |

## Reste fondateur (hors code)

1. Mettre le **Team ID Apple réel** dans `APPLE_TEAM_ID` (VPS prod + secret GitHub + `android/config/mobile-store.env` local).
2. Régénérer AASA statique : `npm run mobile:well-known` — le backend sert déjà AASA dynamique si `APPLE_TEAM_ID` ≠ `TEAM_ID` (`commun/backend/src/server.ts`).
3. Décider **ACRCloud** prod : clés ou absence volontaire (question GO de l’audit).
4. Secrets signing iOS (p12, profil) puis décommenter les étapes CI pour IPA / TestFlight.
5. IAP / Firebase : hors scope tant que non demandés.

## Prompt pour une session suivante

```markdown
@onscen-dev-agent

Mission : suite handoff builds mobiles.
Ne pas inventer APPLE_TEAM_ID.
Si le fondateur a fourni le Team ID : documenter où le poser (env + secret GH),
ne pas le committer en clair.
Ne pas commit / deploy prod sans demande.
```

## Ne pas faire sans ordre explicite

- Commit / push
- Deploy prod
- Inventer un Team ID / bundle ID store
- IAP StoreKit / Play Billing
- IPA signé
