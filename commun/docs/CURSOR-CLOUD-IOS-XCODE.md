# Cursor Cloud — iOS / Xcode (limites et workflow)

## Ce que Cursor Cloud ne peut pas faire

Les **Cloud Agents** tournent sur des **VM Ubuntu Linux** isolées. Cursor ne propose pas aujourd’hui un environnement **macOS** dans le cloud.

| Besoin | Cloud Agent (Ubuntu) | Mac local / CI macOS |
|--------|----------------------|----------------------|
| `npm run dev` web + API msdev | ✅ | ✅ |
| `npm run mobile:dev` (PWA `/tel/` :4082) | ✅ | ✅ |
| Typecheck / build Vite `ios/apptel` | ✅ | ✅ |
| `npx cap sync ios` (génère le projet Xcode) | ✅ (fichiers) | ✅ |
| **Ouvrir Xcode** (`cap open ios`) | ❌ | ✅ |
| **`xcodebuild` / archive IPA** | ❌ | ✅ |
| Simulateur iOS | ❌ | ✅ |
| Signature App Store | ❌ | ✅ |

**Conclusion :** on ne peut pas « implémenter un environnement Mac avec Xcode » dans Cursor Cloud. Le workflow recommandé est **hybride** :

1. **Cloud Agent (Linux)** — code React/Capacitor, tests PWA tel, typecheck, `cap sync ios`.
2. **GitHub Actions `macos-latest`** — build Xcode quand les secrets Apple sont configurés.
3. **Mac local** (optionnel) — simulateur, signature finale, soumission App Store Connect.

Doc Cursor : [Cloud agent setup](https://cursor.com/docs/cloud-agent/setup.md) · [Blog environnement cloud](https://cursor.com/blog/cloud-agent-environment)

---

## Environnement repo (Linux + mobile tel)

Fichiers :

| Fichier | Rôle |
|---------|------|
| `.cursor/environment.json` | Terminals API :4080, web :5173, **tel :4082** |
| `.cursor/cloud-install.sh` | `npm install` web + backend + **ios/apptel** + typecheck mobile |
| `.cursor/cloud-agent-prompts/02-ios-capacitor-cloud.md` | Prompt agent iOS / Capacitor |

### Terminals cloud (3 services)

| Terminal | URL |
|----------|-----|
| `soundy-api` | API msdev `http://localhost:4080` |
| `soundy-web` | Web `http://localhost:5173` |
| `onscen-tel` | App tel PWA `http://localhost:4082/tel/` |

Ports forwardés : 5173, 4080, **4082**.

### Install cloud (mobile)

`cloud-install.sh` installe aussi `ios/apptel` et lance un typecheck (`tsc --noEmit`) pour détecter les régressions TypeScript côté Capacitor sans Xcode.

---

## Build Xcode via GitHub Actions

Workflow : `.github/workflows/ios-capacitor.yml`

- Runner : **`macos-latest`** (Xcode installé par GitHub).
- Déclenchement : push `ios/apptel/**`, `web/app/**`, ou **workflow_dispatch** manuel.
- État actuel : sync Capacitor + workspace iOS en artefact ; **`xcodebuild` commenté** jusqu’à configuration des secrets Apple.

### Secrets GitHub requis (Settings → Secrets → Actions)

| Secret | Usage |
|--------|--------|
| `APPLE_TEAM_ID` | Équipe Developer |
| `APPLE_CERTIFICATE_BASE64` | Certificat .p12 (base64) |
| `APPLE_CERTIFICATE_PASSWORD` | Mot de passe .p12 |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Profil .mobileprovision |
| `KEYCHAIN_PASSWORD` | Keychain temporaire CI |

Après ajout des secrets : décommenter les étapes `xcodebuild` dans le workflow (voir commentaires dans le fichier).

### Lancer un build iOS depuis le dashboard GitHub

1. GitHub → **Actions** → **iOS Capacitor Build** → **Run workflow**.
2. Télécharger l’artefact `melosong-ios-workspace` (projet Xcode) ou l’IPA une fois signé.

Un Cloud Agent peut préparer le code et pousser une branche ; le workflow macOS build ensuite.

---

## Checklist agent Cloud — tâche iOS

1. Modifier `web/app/src/` (+ override `ios/apptel/src/` si besoin).
2. `npm run mobile:check` — overrides cohérents.
3. Terminals cloud : API + web + **tel** → tester UI mobile PWA.
4. `cd ios/apptel && npx tsc --noEmit -p tsconfig.app.json` — types OK.
5. `npm run build:capacitor --prefix ios/apptel` — assets web pour Capacitor.
6. Commit + push → CI macOS ou Mac local pour Xcode.

Prompt prêt : `.cursor/cloud-agent-prompts/02-ios-capacitor-cloud.md`

---

## Mac local (hors cloud)

Sur un Mac avec Xcode :

```bash
npm run capacitor:build
npm run cap:sync:ios --prefix ios/apptel
npm run cap:open:ios --prefix ios/apptel
```

Audit builds store : `commun/docs/audit/2026-08-15-cto-builds-ios-android.md`

---

## Demander macOS natif à Cursor (futur)

Si votre équipe a besoin de VMs macOS dans Cursor Cloud, contacter Cursor (Enterprise) : [hi@cursor.com](mailto:hi@cursor.com) ou votre account manager. Ce n’est pas configurable via `environment.json` ou Dockerfile aujourd’hui.
