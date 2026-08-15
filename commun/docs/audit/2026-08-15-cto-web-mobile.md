# Audit CTO — Web + iOS + Android — 15 août 2026

**Agent :** @onscen-cto (analyse) + @onscen-dev-agent (correctifs code)  
**Périmètre :** `web/app/src/`, `ios/apptel/src/`, Capacitor iOS/Android, `commun/backend/src/`  
**Contexte :** ~10 comptes prod, inscriptions **ouvertes**, EI SIREN `106548464`, domaine unique `onscen.com`  
**ACRCloud :** clés **volontairement absentes** (décision fondateur antérieure) — ne pas fail-closed les uploads si non configuré

---

## 1. Analyse

OnScen est un monolithe Express + React 19 / Vite, avec une PWA `/tel/` et un shell Capacitor (`ios/apptel` + Android). La source UI est `web/app/src/` ; le tel n’a d’overrides que là où le chemin existe dans `ios/apptel/src/`.

Le produit mélange **live, UGC, géoloc, musique, paiements**. À ~10 users le risque n’est pas le scale : c’est **légal (CSAM, mineurs, IAP stores)**, **surface d’inscription ouverte sans plafond**, et **non-conformité App Store 3.1.1** si Stripe reste joignable depuis le WebView natif.

Les audits du 7–11 août restent valides pour tout ce qui n’est pas du code (PhotoDNA, WAF DNS, purge Git, DPA, restore backup, PM2 cluster). Cet audit les actualise et **implémente tout ce qui est corrigeable dans le repo**.

---

## 2. Risques

| Sévérité | Risque | Surface |
|----------|--------|---------|
| P0 ops | Hash-matching CSAM local + hook PhotoDNA | **Mitigé** — blocklist SHA-256 + PhotoDNA si `PHOTODNA_SUBSCRIPTION_KEY` |
| P0 store | Stripe dans le WebView natif | **Corrigé** |
| P0 légal | GPS précis exposé aux mineurs | **Corrigé** |
| P0 abuse | Inscriptions sans plafond | **Corrigé** (+ Redis si `REDIS_URL`) |
| P0 store | Google OAuth `deleted_client` | **Mitigé** — login/YouTube coupés en prod jusqu’à `GOOGLE_OAUTH_PROD_ENABLED=1` |
| P0 argent | Stripe `sk_test_` en prod | **Corrigé** — 503 `STRIPE_TEST_IN_PROD` (sauf opt-in) |
| P1 | Énumération / rate-limits | **Corrigé** |
| P1 | Modales / touch / crash onglet | **Corrigé** |
| P2 | AASA Team ID | **Mitigé** — servi depuis `APPLE_TEAM_ID` runtime |
| P2 | Pinning Android | **Corrigé** — pins leaf + intermédiaire régénérés 2026-08-15 |
| P2 | WAF Cloudflare DNS | **Mitigé origin** — headers Caddy + body 25 Mo (bascule NS = fondateur) |
| P2 | StoreKit / Play Billing | **Garde-fous** — pas d’IAP natif sans comptes stores |

---

## 3. Architecture recommandée

**Court terme (fait dans le repo) :** garder le monolithe ; durcir les gates (âge, natif, volume) côté API — jamais seulement côté UI.

**Stores :**
- Web : Stripe Checkout / Connect OK (18+).
- Natif : **aucun achat numérique Stripe**. Header `X-OnScen-Client` + 403 `NATIVE_IAP_REQUIRED` sans « ouvrez le navigateur » (guideline Apple).
- IAP réel (StoreKit 2 + Play Billing) = projet dédié + compte Apple / Play Console — **pas improvisable en une session**.

**Géo mineurs :** `canUsePreciseGeo` déjà en place ; l’UI ne doit plus proposer GPS si faux ; le backend `enforceMinorGeoPolicy` reste la source de vérité.

**Auth mobile :** cookie httpOnly (web) + Keychain/Keystore (natif). Ne plus documenter un JWT dans `localStorage`.

---

## 4. Sécurité

**Implémenté aujourd’hui**
- Plafond inscriptions : 200/jour + 8/h/IP (`REGISTRATION_DAILY_CAP`, `REGISTRATION_HOURLY_IP_CAP`), alerte `registration_spike`.
- Login 403 : plus d’email en clair dans la réponse (déjà le cas après revue).
- `/check-username` : délai constant 280 ms + limiter 12/5 min.
- Rate-limit `/api/sponsors/track` (60/min) et `/api/support/contact` (5/15 min).
- Sightengine : fail-closed en prod (ignore `SIGHTENGINE_FAIL_OPEN`).
- ACRCloud : si **configuré**, erreur API = refus en prod (ignore `ACRCLOUD_FAIL_OPEN`). Si **non configuré**, pas de blocage global (décision fondateur).
- `RESEND_FROM` / `SMTP_FROM` obligatoire en prod.
- Paiements natifs rejetés côté API.

**Toujours hors code (fondateur / ops)**
- Purge historique Git + rotation des secrets du commit historique.
- WAF Cloudflare (DNS `onscen.com` → proxy).
- Client Google OAuth prod à recréer (actuel `deleted_client`).
- Exercice restore backup PostgreSQL / S3.
- DPA Sightengine / Stripe / LiveKit / Resend.

---

## 5. Impacts légaux

- Mentions : session = cookie httpOnly / Keychain, plus « JWT localStorage ».
- Mineurs : pas de géoloc précise (RGPD minimisation + politique âge 18 pour GPS).
- Dons / abonnements : `ageConfirmed === true` obligatoire sur les intents Stripe réels ; Connect 18+.
- CSAM : Sightengine `face-age` ≠ obligation légale de hash-matching. Runbook PHAROS à valider avocat.
- IAP : copy « payez dans le navigateur » retirée (risque guideline 3.1.1).
- Privacy Manifest iOS : `NSPrivacyCollectedDataTypeAudioData` (micro live).
- **Conseil juridique définitif : escalade humain** (pas le CTO).

---

## 6. UX (web + tel)

**Implémenté**
- ~25 feuilles / modales utilisateur : bottom-sheet mobile (`items-end sm:items-center`), `ConfirmModal` inclus.
- Cibles 44 px : cloche, player (prev/next), chat salon, theater, LiveKit stage, OAuth (`min-h-11`).
- Google OAuth masqué en **natif production**.
- Stripe Connect masqué / bloqué en natif.
- Timeout boot 20 s : n’efface plus token/user (évite déconnexion fantôme).
- Error boundary par vue (`resetKey` onglet) : un crash carte/live ne tue plus toute l’app.
- AASA paths : `/reels/*`, `/tel/*`, `/auth/*`.

**Non fait (volontaire)**
- Modales admin / dev-sponso : desktop-only, centrées OK.
- Menu profil visiteur : dropdown desktop, pas une sheet.

---

## 7. Infrastructure

| Sujet | Verdict |
|-------|---------|
| VPS unique + PM2 `instances: 1` | OK à 10 users ; bloquant à l’échelle |
| Store RAM | Inchangé — cluster PM2 sans Redis session = casse |
| Health | `/health` prod + staging |
| Sentry web | slug `onscen-web` ; build Capacitor injecte `VITE_SENTRY_*` |
| Cert pinning Android | régénérer via `npm run mobile:cert-pins` à chaque renouvellement TLS |

Pas de deploy prod dans cette session.

---

## 8. Base de données

Pas de migration. Les plafonds d’inscription sont **in-memory** (process unique actuel). Si PM2 passe en cluster, les déplacer vers Redis (même store que les rate-limits).

Index / intégrité : rien de nouveau à corriger pour cet audit (voir audit 08-11 DB).

---

## 9. Sauvegarde

Inchangé : backups S3 existent. **Manque un restore testé** (tabletop + restore staging). Hors code.

---

## 10. Plan de développement

| Vague | Quoi | Qui |
|-------|------|-----|
| **Fait** | Gates API + UX mobile + volume + fail-closed + IAP copy | repo |
| **Ops P0** | Recréer client Google OAuth ; `APPLE_TEAM_ID` dans AASA ; WAF DNS | fondateur |
| **Stores** | StoreKit 2 + Play Billing ; Sign in with Apple natif | 2–4 semaines + comptes stores |
| **Légal** | PhotoDNA / NCMEC ; DPA ; validation runbook CSAM | avocat + contrat |
| **Scale** | Redis partagé + PM2 cluster **après** restore drill | quand > 1k DAU |

---

## 11. Code (correctifs livrés)

- `commun/backend/src/lib/clientPlatform.ts` — header + 403 IAP
- `commun/backend/src/lib/registrationVolumeLimit.ts` — plafonds
- `commun/backend/src/routes/{auth,oauth,donations,subscriptions}.ts`
- `web/app/src/lib/api/core.ts` + `ios/apptel/src/lib/api/core.ts` — `X-OnScen-Client`
- Géo : `SessionLocationPicker`, `EventLocationInput`, `useEventsCountry`, `salonCreateFlow`
- UI : `ConfirmModal` + sheets carte / DM / settings / share / live
- `AppErrorBoundary` `resetKey` autour du `<main>`

---

## 12. Optimisations possibles

- Plafonds d’inscription dans Redis dès le premier scale-out.
- Turnstile sur `/check-username` si abus réel (aujourd’hui limiter + délai suffisent à 10 users).
- Error boundaries plus fins (carte / live / reels) en plus du `resetKey` d’onglet.
- `100vh` dans `index.css` déjà doublé par `100dvh` — ne pas retirer le fallback Safari.

---

## 13. Bonnes pratiques

- Toute feature UI = web **et** tel (`onscen-web-et-tel.mdc`). Les overrides apptel de cet audit : `lib/api/core.ts` uniquement.
- Jamais de « payez dans Safari » dans l’app native.
- Jamais de GPS pour un profil `!canUsePreciseGeo`.
- Secrets hors Git ; `RESEND_FROM` domaine `onscen.com` en prod.
- Ne pas déployer sans demande explicite.

---

## 14. Évolutions futures

1. IAP natif (StoreKit / Play) avant soumission stores.
2. Hash-matching CSAM avant tout volume UGC public.
3. Cadre SACEM / licences avant push musique UGC.
4. WAF + cluster quand la prospection sponsors sort de Montpellier.
5. JEI / CIR : seulement après SASU + salaire R&D (hors scope tech).

---

## Verdict GO / NO-GO

| Cible | Verdict |
|-------|---------|
| Dev / usage interne 10 users | **GO** après deploy (quand demandé) |
| Soumission App Store / Play | **NO-GO** sans IAP natif + Apple Team ID + Sign in with Apple |
| Sponsors nationaux | **NO-GO** (pas de reporting impressions, trop peu d’users) |
| GO prod « scale » | **NO-GO** sans WAF, restore drill, PhotoDNA |

**ACRCloud :** rester **absent** tant que le fondateur ne décide pas autrement. Si les clés sont ajoutées plus tard, le fail-closed prod est déjà en place.
