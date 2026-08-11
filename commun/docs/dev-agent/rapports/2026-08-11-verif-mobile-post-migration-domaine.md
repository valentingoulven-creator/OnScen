# Rapport Dev Agent — 2026-08-11 — Vérification mobile iOS/Android post-migration domaine onscen.com

**Agent :** @onscen-dev
**Date :** 2026-08-11
**Durée estimée :** ~45 min
**Statut global :** ✅ App mobile fonctionnelle, 2 gaps réels corrigés (déep links Android + cert pinning)

---

## Mission

Suite à la demande « vérifie l'application ios/android », vérification terrain (build réel, pas lecture de code seule) de `ios/apptel/` après la migration de domaine canonique `onscen.com` (commit `cb6b5c3e`, 2026-08-10, cf. `commun/docs/ONSCEN-DOMAINE.md`).

---

## Contexte

Le dernier audit terrain remontait au 2026-07-22 (`commun/docs/dev-agent/rapports/2026-07-22-audit-mobile-corrections.md`). Depuis, le domaine canonique de l'app est passé de `getsoundy.com` à `onscen.com` (dual-host, `getsoundy.com` conservé en legacy). Cette migration touche directement la config Capacitor mobile (`hostname`, `VITE_API_URL`/`VITE_SOCKET_URL` en dur dans `capacitor-build-prod.mjs`) — objectif : vérifier que rien n'a cassé côté natif.

---

## Vérifications effectuées (build réel, pas seulement lecture de code)

| Vérification | Résultat |
|---|---|
| Build web apptel (`tsc -b && vite build`) | ✅ |
| `npm test` (apptel) | ✅ (aucun fichier de test, attendu) |
| `npm run lint` (apptel) | ⚠️ 36 erreurs / 26 warnings — **identiques à l'audit du 22/07** (`react-hooks/set-state-in-effect` sur `LivePage.tsx`), pas de régression |
| `npm run capacitor:build:prod` | ✅ (VITE_API_URL/SOCKET_URL = `https://onscen.com`) |
| Capacitor `cap sync android` | ✅ 6 plugins détectés |
| Build Gradle réel (`assembleDebug`) | ✅ `BUILD SUCCESSFUL` (avant **et** après correctifs) |
| Backend prod live (`onscen.com` + `getsoundy.com` `/health`) | ✅ les deux répondent `200 OK` |
| VPS prod `.env` réel (`WEBAUTHN_RP_ID`, `CORS_ORIGIN`, `WEB_APP_URL`) | ✅ déjà patchés en `onscen.com` (le patch `patch-env-onscen-domain.sh` a bien été exécuté sur le VPS) |
| AASA prod (`onscen.com/.well-known/apple-app-site-association`) | ⚠️ `TEAM_ID.com.soundy.app` toujours un placeholder — gap déjà connu, non résolu (bloque Universal Links/WebAuthn cross-domain iOS) |
| `assetlinks.json` Android | ✅ vraie empreinte SHA-256 cohérente avec `com.soundy.app` |
| `targetSdk`/`compileSdk` Android | ✅ 36 (conforme exigence Google Play 31/08/2026) |

---

## Gaps réels trouvés et corrigés

Le dossier `ios/apptel/android/` est gitignoré (projet Gradle persistant sur ce poste, jamais versionné) — la migration de domaine du 10/08 avait mis à jour les **scripts** (`patch-android-native.mjs`, commit `cb6b5c3e`) mais ces scripts n'avaient jamais été **ré-exécutés** contre le projet Android déjà généré sur disque. Deux dérives concrètes en résultaient :

1. **Deep links Android incomplets** — `AndroidManifest.xml` ne listait que `getsoundy.com`/`www.getsoundy.com` pour `/salon`, `/live`, `/profile` : un lien `https://onscen.com/salon/...` n'aurait pas ouvert l'app Android (App Links).
   - **Fix** : `node scripts/patch-android-native.mjs` ré-exécuté (idempotent, déjà à jour dans le script depuis le 10/08) → manifeste réécrit avec les 4 hôtes (`onscen.com`, `www.onscen.com`, `getsoundy.com`, `www.getsoundy.com`) par intent-filter.

2. **Cert pinning Android ne protégeait que `getsoundy.com`** — `commun/scripts/fetch-cert-pins.mjs` ciblait un seul host en dur. Or `onscen.com` et `getsoundy.com` sont servis par des **certificats TLS distincts** (Caddy/Let's Encrypt, vérifié : CN différents, empreintes différentes, dates d'expiration différentes — pas un certificat SAN partagé). Résultat : depuis le 10/08, l'app native (qui parle exclusivement à `onscen.com` via `VITE_API_URL`) n'avait **plus aucun pinning actif** sur le domaine réellement utilisé (retombée silencieuse sur `<base-config>`, validation TLS standard uniquement — pas une panne, mais une régression de sécurité silencieuse).
   - **Fix** : script réécrit pour itérer sur `['onscen.com', 'getsoundy.com']` et générer un `<domain-config>` + pin-set (leaf + intermédiaire de secours) par domaine. Régénéré (`npm run mobile:cert-pins`) : `network_security_config.xml` couvre maintenant les deux domaines.
   - Pins `onscen.com` : expiration `2026-11-08`. Pins `getsoundy.com` : expiration `2026-10-13` (inchangé).

Build Gradle (`assembleDebug`) revalidé **après** les deux correctifs → `BUILD SUCCESSFUL`, manifeste confirmé avec les 4 hôtes par intent-filter.

---

## Gaps déjà connus, non retraités (hors scope / décision humaine)

- `APPLE_TEAM_ID` toujours placeholder (`android/config/mobile-store.env` absent) → Universal Links + WebAuthn cross-domain iOS cassés en build réel signé. Nécessite compte Apple Developer Program actif (99 $/an), déjà tracé `TODO-MANUAL.md`.
- `staging.onscen.com` : aucun enregistrement DNS (A/AAAA) — le doc `ONSCEN-DOMAINE.md` le liste déjà comme action OVH restante.
- 36 erreurs ESLint `react-hooks/set-state-in-effect` pré-existantes sur `ios/apptel/src/pages/LivePage.tsx` — identiques à l'audit du 22/07, session dédiée déjà recommandée.
- TypeScript non strict sur `ios/apptel/tsconfig.app.json` — dette déjà tracée (`AUDIT-CONSOLIDE.md` ARC-2).
- AASA : paths `/reels/*`, `/feed/*` toujours absents (deep-linking limité à `/salon`, `/live`, `/profile`, `/`) — gap déjà documenté le 22/07, inchangé.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/scripts/fetch-cert-pins.mjs` | Multi-domaine (`onscen.com` + `getsoundy.com`), un `<domain-config>` + pin-set par host |
| `ios/apptel/android/app/src/main/res/xml/network_security_config.xml` | Régénéré — pins réels pour les 2 domaines (gitignoré, non committé) |
| `ios/apptel/android/app/src/main/AndroidManifest.xml` | Régénéré via `patch-android-native.mjs` — deep links `onscen.com` restaurés (gitignoré, non committé) |
| `modification.txt` | Entrée ajoutée (MODIF 1354) |
| `commun/docs/dev-agent/INDEX.md` | Ligne ajoutée |

---

## Commandes exécutées

```text
cd ios/apptel && npm run build                    → ✅ tsc -b && vite build
cd ios/apptel && npm test                          → ✅ (0 fichier de test)
cd ios/apptel && npm run lint                      → ⚠️ 36 erreurs pré-existantes, pas de régression
npm run capacitor:build:prod                        → ✅
npm run cap:sync:android --prefix ios/apptel        → ✅
cd ios/apptel/android && .\gradlew.bat assembleDebug → ✅ BUILD SUCCESSFUL (avant et après fix)
node ios/apptel/scripts/patch-android-native.mjs    → ✅ manifeste réécrit
npm run mobile:cert-pins                            → ✅ pins onscen.com + getsoundy.com générés
ssh onscen-prod "grep WEBAUTHN\|CORS_ORIGIN /opt/onscen/.env" → ✅ déjà patché en onscen.com
```

---

## Prochaines étapes

1. Si un build Android release/AAB est prévu prochainement : refaire tourner `patch-android-native.mjs` + `mobile:cert-pins` avant packaging (déjà à jour maintenant, mais penser à les ré-exécuter à chaque nouvelle régénération `npx cap add android`).
2. `APPLE_TEAM_ID` : décision fondateur (Apple Developer Program) toujours bloquante pour un build iOS signé complet.
3. DNS `staging.onscen.com` : à créer côté OVH avant de pouvoir tester la préprod mobile sur le nouveau domaine.

---

*Généré par OnScen Dev*
