# Phase 9 — Mobile iOS / Android / PWA

**Date :** 2026-08-16 · **Statut :** PWA OK HTTP · **NO-GO stores**  
**Niveau de preuve :** HTTP prod + audits `2026-08-15-cto-builds-ios-android.md` + `2026-08-16-builds-mobiles.md` · binaire store **NON VÉRIFIÉ**

## Surfaces

| Surface | Verdict | Preuve |
| ------- | ------- | ------ |
| Web desktop | En ligne | `https://onscen.com/` 200 |
| PWA `/tel/` | En ligne | `https://onscen.com/tel/` 200 |
| iOS store | **NO-GO** | Pas d’IPA, Team ID placeholder, `aps-environment` development (audit 08-15/16) |
| Android store | **NO-GO** | AAB local 15/08 seulement ; `com.soundy.app` ; pas de Play Billing |

## Overrides

Source UI : `web/app/src/`. Overrides `ios/apptel/src/` (moins de forks pages qu’en juillet — audit 16). Working tree local du 16/08 contient des overrides carte/share **non déployés** (prod HTML `Last-Modified: 2026-08-15 15:56`).

## Points vérifiés aujourd’hui

- AASA prod : `TEAM_ID.com.soundy.app` + paths `/salon/*` `/live/*` `/profile/*` `/reels/*` `/tel/*` `/auth/*`. Universal Links **non fonctionnels** tant que le placeholder reste.
- Stripe natif : 403 `NATIVE_IAP_REQUIRED` (code 08-15) — **NON RETESTÉ** HTTP (besoin header client).
- Sentry « natif » : `@sentry/react` dans WebView. Crash TestFlight remonté Sentry : **NON VÉRIFIÉ**.
- Permissions / privacy nutrition / push FCM : constats 08-15/16 **non re-ouverts** Xcode aujourd’hui (poste Windows).
- Touch 44px / dvh / safe-area : correctifs 08-15 **NON TESTÉS** device.

## Comparaison audits

Écarts bloquants stores **inchangés** : IAP, Team ID, signing iOS, package Soundy, CI iOS non signée.  
Deep links Android : alignés AASA selon audit 16 (amélioration vs 08-15 matin).

## Recommandation

Ne pas soumettre les stores. PWA + web peuvent rester en ligne **sans** GO prod « stores ». Ticket IAP = fondateur, pas P0 code de cet audit.
