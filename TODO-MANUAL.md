# TODO-MANUAL.md — Tâches non automatisables (post-audit OnScen)

Éléments nécessitant une **décision produit**, une **configuration externe**, une **validation humaine** (device, juriste, stores), ou un **sprint dédié**.

**Dernière revue CTO :** 2026-07-31 (MODIF 1277–1292 · live UX · dossier avocat PDF · docs) — **+ passe de vérification live prod le même jour** (voir § Vérifications CTO ci-dessous)

**Index doc :** [`commun/docs/README.md`](commun/docs/README.md) · audit de référence : [`commun/docs/audit/AUDIT-CONSOLIDE.md`](commun/docs/audit/AUDIT-CONSOLIDE.md)

---

## Prod & accès (2026-07-30)

| Item | Statut | Action / note |
|------|--------|----------------|
| **Inscriptions prod fermées** | ✅ Code + politique défaut prod | `accessControl.ts` · `registrationClosed` / mode `closed` · rouvrir : `ALLOW_REGISTRATION=1` ou admin (voir tests `accessControl.test.ts`) |
| **Google OAuth grisé en prod** | ✅ UI prod | `AuthPage.tsx` — bouton Google désactivé sur getsoundy.com ; msdev/preprod inchangés |
| **Impact C3 (Sign in with Apple)** | 🟡 Atténué temporairement | Tant que Google n’est pas proposé en prod iOS, règle Apple 4.8 moins pressante — **obligatoire avant soumission App Store si Google réactivé** |
| **Compte démo prod** | ℹ️ Opérationnel | Showcase documenté onboarding / présentations (ne pas commiter identifiants) |

---

## Juridique & dossiers (fondateur / avocat)

| Item | Statut | Action |
|------|--------|--------|
| **Pack avocat (PDF)** | ✅ Généré | `commun/docs/juridique/dossier-avocat-a-valider/` (22 PDF) · regénérer : `npm run dossier-avocat --prefix commun/docs/juridique` |
| **Validation juriste** | ⏳ **Bloquant avant scale payant / sponsors signés** | Checklist : `commun/docs/juridique/CHECKLIST-VALIDATION-AVOCAT.md` · RDV : `commun/docs/juridique/RENDEZ-VOUS-AVOCAT.md` |
| **C6 — Mentions légales LCEN** | ✅ **Complet (vérifié 2026-07-31)** | `GET https://getsoundy.com/api/legal/publisher` → `complete: true`. Source : `/opt/onscen/legal-publisher.json` (tous les champs LCEN art. 6 renseignés) |
| **Contrats / devis sponsors** | ⚠️ Modèles indicatifs | `commun/docs/strategie/commercial/` — **interdiction envoi définitif sans avocat** |
| **Lettres de soutien (BIC, partenaires)** | ✅ Modèles | `.docx` : `commun/docs/strategie/lettres-soutien/` · `npm run lettres-soutien --prefix commun/docs/strategie` |
| **C7 — URL privacy publique** | ✅ OK | `GET /privacy` sans auth |

---

## QA manuelle — session 2026-07-15 (MODIF 1009–1029)

Code livré ; valider sur **390 px**, **desktop**, **ios/apptel** si applicable.

### Globe & carte

- [ ] Zoom street : pins événement/live visibles (globe 3D + carte plate)
- [ ] Marqueur « Ma position » : pastille indigo + halo / dot centré ; FAB Recentrer
- [ ] Rotation auto idle : défilement constant ; s’arrête au drag

### Live (web) — **re-QA après MODIF 1280–1285 (2026-07-30)**

- [ ] Chat **épinglé** colonne gauche par défaut ; vidéo **non masquée** (layout `room-theater-side-row--live-left`)
- [ ] Plein écran : chat épinglé utilisable (régression MODIF 1281)
- [ ] Bouton **Dons** dans le chrome vidéo (plus bandeau récompenses séparé — MODIF 1280)
- [ ] Détacher / rouvrir chat → préférence conservée
- [ ] **apptel** : layout chat dock bas — smoke test séparé

### Profil

- [ ] Engrenage → Paramètres ; **Mon compte** uniquement dans Paramètres
- [ ] Profil visité : shell cohérent ; Suivre + DM + menu ⋯
- [ ] Lecture : une seule photo ; édition sans scroll principal (~390 px)

### Fil d’accueil

- [ ] Compose : pas de compteur `0/2000` ; actions sur une ligne
- [ ] Espace bannière SPONSORISÉE / post suivant

### Boucle console (LOOP-01)

- **Statut code :** ✅ **Fermé (vérifié 2026-07-31)** — MODIF 1030, `popularInterests.ts` contrôlé : une seule occurrence de `Sessions live`, aucun doublon réintroduit depuis. Reste optionnel : re-smoke visuel navigateur si régression suspectée après une future modif carte/live.

---

## Critique — Sécurité

### CRIT-01 — JWT → cookies httpOnly

**Statut :** ✅ Web — cookie `soundy_auth` httpOnly ; native Keychain/Keystore (apptel).

### ELEV-01 — Révocation JWT

**Statut :** ✅ `tokenVersion` + logout bump.

### ELEV-07 — Stores OAuth en mémoire

**Statut :** ✅ **Résolu (vérifié 2026-07-31)** — `oauthStates` (`routes/oauth.ts`) et `oauthExchangeCodes` (`lib/oauthExchange.ts`) sont **Redis-backed avec fallback mémoire** (`lib/optionalRedis.ts`). `REDIS_URL` est bien configuré en prod (confirmé via `ssh onscen-prod` — clé présente, non affichée). Doc précédente obsolète (le code avait déjà été fait ; il manquait juste la confirmation infra).

### 🔴 NOUVEAU — Stripe en mode **TEST** malgré prod live + dons activés

**Statut :** 🔴 **Confirmé 2026-07-31 (vérification read-only, aucune modif effectuée)** — sur `/opt/onscen/.env` prod : `APP_ENV=production`, `DONATIONS_ENABLED=1`, mais `STRIPE_SECRET_KEY=sk_test_...` (préfixe test, pas live).

**Impact :** tout paiement/don/abonnement passé en prod est traité par le **compte test Stripe** — aucun encaissement réel, mais aussi aucune trace dans le dashboard Stripe **live** (comptabilité, réconciliation, Stripe Connect payouts sponsors faussés si activés).

**Action requise (fondateur/CTO — décision produit, pas de code) :**
1. Confirmer si c'est **volontaire** (soft-launch sans encaissement réel) ou un **oubli**.
2. Si passage en live : récupérer `sk_live_...` + `pk_live_...` + webhook secret **live** depuis le dashboard Stripe, mettre à jour `/opt/onscen/.env` (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`), reconfigurer les endpoints webhook Stripe en mode live, puis `pm2 restart`.
3. Ne pas basculer sans confirmation explicite — bascule = argent réel qui commence à circuler.

---

## Critique — Business / stores

### C1 — IAP Apple / Google (Stripe in-app)

**Statut :** ⚠️ Garde-fous natifs — `CreatorSubscribeSheet`, `LiveDonationSheet` bloquent Stripe sur Capacitor (App Store 3.1.1).

**Reste :** StoreKit 2 / Play Billing + sync backend (4–8 semaines).

**Décision produit :** Périmètre web (Stripe) vs monétisation native obligatoire.

### C3 — Sign in with Apple

**Statut :** ✅ Code prêt (`GET /api/auth/apple`, AuthPage si `APPLE_CLIENT_ID`).

**Reste humain :** Apple Developer Program, App Store Connect, `APPLE_*` prod, `APPLE_TEAM_ID` (Android/iOS).

---

## Architecture — Capacitor mobile

### C5 — Projet Android

**Statut :** ✅ Reproductible — `patch-android-native.mjs`, CI `.github/workflows/android-capacitor.yml`, `assembleDebug` validé.

**Reste ouvert :**

- [ ] `APPLE_TEAM_ID` réel (placeholder `TEAM_ID.com.soundy.app`)
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` prod → push natif no-op sans Firebase
- [ ] AAB release signé + Play Console / TestFlight — **calendrier fondateur**

```powershell
cd ios/apptel
npm run cap:add:android
npm run mobile:cert-pins --prefix ..\..
npm run cap:sync:android
cd android; .\gradlew.bat assembleDebug
```

---

## UX — Sprints futurs

### C10 — Onboarding raccourci (9 → ≤3 étapes)

**Statut :** ⏳ Produit — flux « multi-photos » vs profil mono-photo (MODIF 1021–1022) à realigner.

### F1 — Remplacer `alert()` / `window.confirm()` restants

**Statut :** ⏳ Ouvert — **scope précisé le 2026-07-31**, volontairement **non traité en autonomie** (trop gros/risqué sans QA visuelle 390 px, cf. règle mobile-responsive).

**Ampleur réelle (grep 2026-07-31) :** ~80 appels dans 20 fichiers, dont ~35 dans `DmPage.tsx` seul. Fichiers concernés : `DmPage.tsx`, `ChatPanel.tsx`, `UserReelsSection.tsx`, `UserCompositionsSection.tsx`, `LivePrivateSheet.tsx`, `SalonUserBanModal.tsx`, `LiveUserBanModal.tsx`, `SalonParticipantsPanel/Popover.tsx`, `LiveVipModeratorsPopover.tsx`, `LiveCloudflareHostPanel.tsx`, `LiveKitCdnEgressSettings.tsx`, `EventDevSponsoModal.tsx`, `ReelDevSponsoModal.tsx`, `ReportContentModal.tsx`, + panneaux `Admin*Tab.tsx` (desktop-only, priorité basse — acceptable tel quel).

**Ce qui existe déjà et peut être réutilisé :** `components/ConfirmModal.tsx` (dialog bottom-sheet mobile déjà conforme aux standards du projet) pour les `window.confirm()`. **Aucun système de toast** n'existe encore pour remplacer les `alert()` d'erreur — c'est le vrai chaînon manquant.

**Plan recommandé (→ `@onscen-dev-agent`, par petits lots testables) :**
1. Créer un `ToastProvider`/`useToast` léger (bottom-sheet safe-area mobile, cf. règle mobile-responsive).
2. Convertir `window.confirm()` → `ConfirmModal` fichier par fichier (mécanique, risque faible).
3. Convertir `alert()` → `useToast` en priorisant les flux **utilisateur** (DM, chat, live, reels) avant l'admin.
4. QA visuelle 390 px après chaque lot — ne pas tout livrer en un seul commit.

---

## React Compiler / ESLint (MODIF 882)

**Statut :** ✅ **0 warning React Compiler (vérifié 2026-07-31 via `npm run lint`)**. Restent 8 warnings `react-hooks/exhaustive-deps` (catégorie différente, non bloquante, pré-existante) — migration `useSyncRef.ts` peut être close pour la partie React Compiler.

---

## Infra ops — priorités audit (manuel)

Checklist : [`commun/deploy/OPS-PRIORITIES.md`](commun/deploy/OPS-PRIORITIES.md)

| P | Action | Statut |
|---|--------|--------|
| 1 | Cloudflare proxy + WAF + cache `/assets/*` | ⏳ Zone CF + NS OVH |
| 2 | ACRCloud + `ACRCLOUD_*` prod | ⏳ Inscription compte |
| 3 | Crons backup staging + vérif PG + S3 | ✅ 2026-07-15 |
| 4 | Uptime externe `/health` | ✅ GitHub Actions |
| 5 | Audit clés `.env` orphelines | ✅ `audit-external-env.cjs` |

---

## Résumé priorisation (CTO — 2026-07-31, mise à jour post-vérification)

| Priorité | Item | Statut | Risque si non fait |
|----------|------|--------|-------------------|
| 🔴 | Validation **juriste** (CGU, sponsors, pourboires) | ⏳ Dossier PDF prêt | Contrats / prod payante non sécurisés |
| 🔴 | **Stripe TEST en prod** malgré `DONATIONS_ENABLED=1` | 🔴 **Confirmé** — décision fondateur requise | Paiements invalides / comptabilité faussée si volontaire non documenté |
| 🔴 | QA **Live** post-1280–1285 | ⏳ Checklist | Régressions spectateur |
| 🔴 | **C1** IAP si publication stores | ⚠️ Garde-fous seulement | Rejet App Store / Play |
| 🟠 | **C3** Apple Sign-In avant Google iOS | ⚠️ Config Apple | Rejet si Google réactivé sans Apple |
| 🟠 | Inscriptions prod (mode closed) | ✅ Volontaire | Communication si réouverture |
| 🟡 | P1 Cloudflare WAF | ⏳ | Surface DDoS / cache |
| 🟢 | F1 alert()/confirm() | ⏳ Scope précisé, sprint dédié | Dette UX (pas de risque prod) |
| 🟢 | C10 onboarding | ⏳ | Friction inscription |
| ✅ | **C6** mentions légales LCEN | **Complet — vérifié** | — |
| ✅ | ELEV-07 Redis OAuth | **Résolu — vérifié** | — |
| ✅ | LOOP-01 boucle console | **Fermé — vérifié** | — |
| ✅ | React Compiler warnings | **0 warning — vérifié** | — |

---

## Vérifications CTO du 2026-07-31 (lecture seule, aucun code ni secret modifié)

En réponse à « fait tout les todo que tu peux faire sans moi » : revue de `TODO-MANUAL.md` pour distinguer ce qui est **déjà résolu mais mal documenté** (corrigé ci-dessus, aucune décision fondateur nécessaire) de ce qui **reste bloqué sur une décision/compte externe** (laissé tel quel, pas d'action risquée en autonomie) :

- ✅ Corrigé : C6 LCEN, ELEV-07 Redis OAuth, LOOP-01, React Compiler (0 warning) — statuts obsolètes, code déjà correct.
- 🔴 Détecté : Stripe `sk_test_` en prod avec dons activés — **nécessite ta décision**, aucune bascule effectuée.
- ⏳ Non traité volontairement : F1 (alert/confirm) — scope réel = 80 appels / 20 fichiers, dont flux DM/live/chat critiques ; blast radius trop large pour une modif non supervisée sans QA visuelle mobile. Plan détaillé ajouté ci-dessus pour `@onscen-dev-agent`.
- Inchangé (bloqué sur compte/accès externe, pas actionnable sans toi) : C1 IAP, C3 Apple Developer, P1 Cloudflare zone, P2 ACRCloud, C5 `APPLE_TEAM_ID`/Firebase/AAB, C10 (décision produit).

---

## Handoff agents

| Besoin | Agent |
|--------|--------|
| Implémenter IAP, OAuth Redis, fixes QA code | `@onscen-dev-agent` |
| Arbitrage architecture / audit approfondi | `@onscen-cto` |
| Priorisation business, BIC, financement | `@onscen-ceo-ia` |

*OnScen · TODO manuel · Ne remplace pas un avis juridique ou comptable.*
