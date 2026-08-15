# Info.md — Contacts fondateur + TODOs manuels (OnScen)

Document personnel fondateur. **Ne pas envoyer tel quel** à un tiers (contacts + backlog interne).
Ne remplace pas un avis juridique ou comptable.

**Dernière mise à jour :** 2026-08-15  
**Dernière revue CTO (todos) :** 2026-07-31 (MODIF 1277–1292 · live UX · dossier avocat PDF · docs)

**Index doc :** [`commun/docs/README.md`](commun/docs/README.md) · audit : [`commun/docs/audit/AUDIT-CONSOLIDE.md`](commun/docs/audit/AUDIT-CONSOLIDE.md)  
**Dossier avocat :** [`commun/docs/juridique/dossier-avocat-a-valider/`](commun/docs/juridique/dossier-avocat-a-valider/) · RDV : [`commun/docs/juridique/RENDEZ-VOUS-AVOCAT.md`](commun/docs/juridique/RENDEZ-VOUS-AVOCAT.md)

---

## Contacts professionnels

Coordonnées (tél / mail) à compléter au fil des échanges. Ne pas committer de secrets.

| Rôle | Personne / structure | Notes / prochaine action |
|------|----------------------|--------------------------|
| **Avocat** | Carbonnier | Validation CGU, DSA, pourboires, sponsors, forme juridique. Dossier PDF prêt. **Bloquant avant scale payant / sponsors signés.** Fiche RDV : `commun/docs/juridique/RENDEZ-VOUS-AVOCAT.md` |
| **Dev** | val.fcp | Contact technique externe / relais dev |
| **Expert-comptable** | Business Story — Mme Rossenblatt | Comptabilité, TVA, Stripe (test vs live), DAC7 / créateurs, immatriculation |
| **Conseiller & formateur — investissement & gestion de patrimoine** | Gael Mirabella | Financement, patrimoine, préparation emprunt / investisseurs. Voir aussi [`commun/docs/strategie/BUDGET-EMPRIUNT-BANCAIRE-ONSCEN.md`](commun/docs/strategie/BUDGET-EMPRIUNT-BANCAIRE-ONSCEN.md) |

### TODO — relances pro (fondateur)

- [ ] **RDV avocat Carbonnier** — apporter le pack PDF (22–32 docs) + fiche 15 questions. Objectif : GO / liste de corrections avant pourboires réels et contrats sponsors.
- [ ] **RDV Mme Rossenblatt (Business Story)** — statut société, TVA, traitement Stripe (aujourd’hui **clés TEST en prod**), obligations créateurs.
- [ ] **Point Gael Mirabella** — aligner budget emprunt / patrimoine avec le besoin réel OnScen (infra, stores, juridique).
- [ ] **Brief val.fcp** — périmètre (web + tel), accès repo, ce qui est bloqué fondateur vs ce qui est code.

---

## Contacts utilisateurs / artistes (early network)

Réseau musique à activer pour tests, retours produit, et premiers contenus (lives, reels, salons). Pas d’envoi de contrats sponsors sans validation avocat.

| Personne | Projet / rôle | Zone / notes | TODO |
|----------|---------------|--------------|------|
| **Valentin Cagigos** | DJ | Occitanie | [ ] Contacter — beta / live / salon |
| **Matthis Lacombe** | DJ | — | [ ] Contacter — beta / live / salon |
| **Romain Monnier** | Guitariste — **Born Sober** | Rock / hard | [ ] Contacter — profil artiste + contenus |
| **Gabriel Segala** | **VoidHeart** | Rock / hard | [ ] Contacter — profil artiste + contenus |
| **Baptiste Maigre** | Rappeur **+ son label** | Rap | [ ] Contacter lui **et** le label (contenus, éventuel partenariat — pas de contrat définitif sans avocat) |

---

## Prod & accès (2026-07-30)

| Item | Statut | Action / note |
|------|--------|----------------|
| **Inscriptions prod fermées** | ✅ Code + politique défaut prod | `accessControl.ts` · `registrationClosed` / mode `closed` · rouvrir : `ALLOW_REGISTRATION=1` ou admin (voir tests `accessControl.test.ts`) |
| **Google OAuth grisé en prod** | ✅ UI prod | `AuthPage.tsx` — bouton Google désactivé sur getsoundy.com ; msdev/preprod inchangés |
| **Impact C3 (Sign in with Apple)** | 🟡 Atténué temporairement | Tant que Google n’est pas proposé en prod iOS, règle Apple 4.8 moins pressante — **obligatoire avant soumission App Store si Google réactivé** |
| **Compte démo prod** | ℹ️ Opérationnel | Showcase documenté onboarding / présentations (ne pas commiter identifiants) |

---

## Juridique & dossiers (fondateur / avocat Carbonnier)

| Item | Statut | Action |
|------|--------|--------|
| **Pack avocat (PDF)** | ✅ Généré | `commun/docs/juridique/dossier-avocat-a-valider/` · régénérer : `npm run dossier-avocat --prefix commun/docs/juridique` |
| **Validation juriste** | ⏳ **Bloquant** — contact : **Carbonnier** | Checklist : `commun/docs/juridique/CHECKLIST-VALIDATION-AVOCAT.md` · RDV : `commun/docs/juridique/RENDEZ-VOUS-AVOCAT.md` |
| **C6 — Mentions légales LCEN** | ✅ **Complet (vérifié 2026-07-31)** | `GET https://getsoundy.com/api/legal/publisher` → `complete: true`. Source : `/opt/onscen/legal-publisher.json` |
| **Contrats / devis sponsors** | ⚠️ Modèles indicatifs | `commun/docs/strategie/commercial/` — **interdiction envoi définitif sans avocat** |
| **Lettres de soutien (BIC, partenaires)** | ✅ Modèles | `.docx` : `commun/docs/strategie/lettres-soutien/` |
| **C7 — URL privacy publique** | ✅ OK | `GET /privacy` sans auth |
| **Comptabilité / Stripe** | ⏳ Contact : **Mme Rossenblatt (Business Story)** | Décision clés TEST vs LIVE (voir ci-dessous) |

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

**Statut :** ✅ **Résolu (vérifié 2026-07-31)** — `oauthStates` (`routes/oauth.ts`) et `oauthExchangeCodes` (`lib/oauthExchange.ts`) sont **Redis-backed avec fallback mémoire** (`lib/optionalRedis.ts`). `REDIS_URL` est bien configuré en prod.

### 🔴 Stripe en mode **TEST** malgré prod live + dons activés

**Statut :** 🔴 **Confirmé 2026-07-31** — sur `/opt/onscen/.env` prod : `APP_ENV=production`, `DONATIONS_ENABLED=1`, mais `STRIPE_SECRET_KEY=sk_test_...` (préfixe test, pas live).

**Impact :** tout paiement/don/abonnement passé en prod est traité par le **compte test Stripe** — aucun encaissement réel, comptabilité live faussée.

**Action requise (fondateur + Mme Rossenblatt / Carbonnier) :**
1. Confirmer si c'est **volontaire** (soft-launch sans encaissement réel) ou un **oubli**.
2. Si passage en live : clés `sk_live_` / `pk_live_` + webhook secret live, `/opt/onscen/.env`, endpoints webhook Stripe live, puis `pm2 restart`.
3. Ne pas basculer sans confirmation explicite — bascule = argent réel.

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

**Statut :** ⏳ Ouvert — **scope précisé le 2026-07-31**, volontairement **non traité en autonomie** (trop gros/risqué sans QA visuelle 390 px).

**Ampleur réelle (grep 2026-07-31) :** ~80 appels dans 20 fichiers, dont ~35 dans `DmPage.tsx` seul.

**Plan recommandé (→ `@onscen-dev-agent`, par petits lots testables) :**
1. Créer un `ToastProvider`/`useToast` léger (bottom-sheet safe-area mobile).
2. Convertir `window.confirm()` → `ConfirmModal` fichier par fichier.
3. Convertir `alert()` → `useToast` en priorisant DM, chat, live, reels.
4. QA visuelle 390 px après chaque lot.

---

## React Compiler / ESLint (MODIF 882)

**Statut :** ✅ **0 warning React Compiler (vérifié 2026-07-31 via `npm run lint`)**. Restent 8 warnings `react-hooks/exhaustive-deps` (non bloquants).

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

## Résumé priorisation (CTO — 2026-07-31 + contacts 2026-08-15)

| Priorité | Item | Statut | Qui |
|----------|------|--------|-----|
| 🔴 | Validation **juriste** (CGU, sponsors, pourboires) | ⏳ Dossier PDF prêt | **Carbonnier** |
| 🔴 | **Stripe TEST en prod** malgré `DONATIONS_ENABLED=1` | 🔴 Confirmé | Fondateur + **Mme Rossenblatt** |
| 🔴 | QA **Live** post-1280–1285 | ⏳ Checklist | Fondateur / QA |
| 🔴 | **C1** IAP si publication stores | ⚠️ Garde-fous seulement | Fondateur + val.fcp / `@onscen-dev-agent` |
| 🟠 | Activer early users artistes | ⏳ Contacts listés ci-dessus | Fondateur |
| 🟠 | **C3** Apple Sign-In avant Google iOS | ⚠️ Config Apple | Fondateur |
| 🟠 | Inscriptions prod (mode closed) | ✅ Volontaire | — |
| 🟡 | P1 Cloudflare WAF | ⏳ | Fondateur / infra |
| 🟢 | F1 alert()/confirm() | ⏳ Sprint dédié | `@onscen-dev-agent` |
| 🟢 | C10 onboarding | ⏳ | Produit |
| ✅ | **C6** mentions légales LCEN | Complet | — |
| ✅ | ELEV-07 Redis OAuth | Résolu | — |
| ✅ | LOOP-01 boucle console | Fermé | — |
| ✅ | React Compiler warnings | 0 warning | — |

---

## Vérifications CTO du 2026-07-31 (lecture seule)

- ✅ Corrigé : C6 LCEN, ELEV-07 Redis OAuth, LOOP-01, React Compiler (0 warning).
- 🔴 Détecté : Stripe `sk_test_` en prod avec dons activés — **décision fondateur**.
- ⏳ Non traité volontairement : F1 (alert/confirm) — ~80 appels / 20 fichiers.
- Inchangé (compte externe) : C1 IAP, C3 Apple Developer, P1 Cloudflare zone, P2 ACRCloud, C5 `APPLE_TEAM_ID`/Firebase/AAB, C10.

---

## Handoff agents

| Besoin | Agent |
|--------|--------|
| Implémenter IAP, fixes QA code | `@onscen-dev-agent` (+ relais **val.fcp**) |
| Arbitrage architecture / audit | `@onscen-cto` |
| Priorisation business, BIC, financement | `@onscen-ceo-ia` (+ **Gael Mirabella**) |

*OnScen · Info fondateur · Ne remplace pas un avis juridique ou comptable.*
