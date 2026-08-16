# Prompt Cloud Agent #2 — iOS / Capacitor (sans Xcode sur la VM)

Copier-coller le bloc **PROMPT** dans un Cloud Agent (branche à jour, secrets P0 configurés).

**Important :** la VM cloud est **Linux**. Pas de Xcode ni simulateur. Voir `commun/docs/CURSOR-CLOUD-IOS-XCODE.md`.

---

## PROMPT (copier à partir d'ici)

```
Mission : travail iOS/Capacitor OnScen sur VM cloud Linux — code, PWA tel, typecheck, préparation projet Xcode pour CI macOS.

Contexte :
- Cloud = Ubuntu. Xcode uniquement via GitHub Actions (macos-latest) ou Mac local.
- Source partagée : web/app/src/ · overrides mobile : ios/apptel/src/
- Config : .cursor/environment.json (terminals soundy-api, soundy-web, onscen-tel :4082)
- Doc : commun/docs/CURSOR-CLOUD-IOS-XCODE.md

Règles :
- Ne pas deploy prod/preprod · pas SSH VPS.
- Ne pas committer de secrets.
- Toute UI visible utilisateur : vérifier web :5173 ET tel :4082/tel/
- Overrides ios/apptel : npm run mobile:check avant commit.

Étapes :

1) INSTALL
   - bash .cursor/cloud-install.sh (web + backend + ios/apptel + typecheck mobile)

2) SERVICES (3 terminals)
   - soundy-api → :4080
   - soundy-web → :5173
   - onscen-tel → :4082/tel/

3) VÉRIFICATIONS
   - cd ios/apptel && npx tsc --noEmit -p tsconfig.app.json
   - npm run mobile:check
   - Tester la feature sur http://localhost:4082/tel/ (computer use si UI)
   - Si changement web/app : vérifier aussi http://localhost:5173

4) CAPACITOR (sans xcodebuild)
   - npm run build:capacitor --prefix ios/apptel
   - npx cap sync ios (dans ios/apptel) — génère/met à jour ios/App/

5) CI XCODE (si build natif requis)
   - Push branche → GitHub Actions « iOS Capacitor Build » (macos-latest)
   - Ou indiquer au fondateur : Run workflow manuel + secrets Apple

6) RAPPORT
   - Fichiers modifiés (web + overrides apptel)
   - Screenshots tel :4082 si UI
   - Résultat tsc + mobile:check
   - Statut cap sync (OK / erreurs)
   - Lien ou statut CI macOS si poussé

Compte démo msdev : listener@msdev.local / msdev123
```

---

## Fin du prompt
