# Audit légal OnScen — Phase 11 : Légalité globale de l'application

**Date :** 2026-08-07
**Méthode :** revue de `lib/ageGates.ts`, `donations.ts`, `locationPrivacy.ts`, `commun/docs/INFRA-ONSCEN.md`, `content/legal/{dpa,dpia,rgpd,privacy,mentions,moderationAppeals}.ts`, `commun/docs/juridique/COMPARATIF-JURIDIQUE-TIKTOK-INSTAGRAM.md`, `commun/docs/audit/AUDIT-mobile-ios-android.md`, `TODO-MANUAL.md`.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

---

## 11.1 Droits musicaux

**Constat :**
- Aucune licence directe avec une société de gestion collective (SACEM ou équivalent) identifiée dans le dépôt — le mécanisme de protection repose sur **ACRCloud** (empreinte audio) pour **bloquer** l'upload de musique commerciale non autorisée dans les compositions/reels, plutôt que sur l'obtention d'une licence permettant explicitement son usage.
- Ce choix (bloquer plutôt que licencier) est **cohérent et prudent** juridiquement pour une plateforme qui ne veut pas assumer le risque de gestion de droits musicaux à grande échelle — à condition qu'ACRCloud soit effectivement actif en production (voir Phase 8 §8.4, Phase 10 §10.3).

**Risque : 🟡 Moyen** — la stratégie « bloquer plutôt que licencier » est valide **seulement si le blocage est réellement opérationnel** ; sinon la plateforme se retrouve dans la pire situation (ni licence, ni blocage effectif).

**Recommandation :** confirmer l'activation d'ACRCloud en production en priorité (dépendance transverse critique pour ce point).

---

## 11.2 DSA (Digital Services Act)

**Constat :**

| Obligation DSA | Statut |
|---|---|
| Mécanisme de signalement (notice-and-action, art. 16) | ✅ Existe (`POST /api/legal/reports`, workflow admin) — voir aussi Phase 7 §7.4 |
| Point de contact autorités | 🟡 Documenté mais **non séparé** du contact éditeur générique (même e-mail que les mentions légales) |
| Transparence sur la modération / procédure de recours | 🟡 Recours motivé documenté (14 jours, `moderationAppeals.ts`), mais mise en œuvre produit effective du recours **non confirmée techniquement** (pas de statut de recours visible côté utilisateur identifié dans le code) |
| Transparence de la recommandation (art. 27 — logique du feed) | ❌ Absent — pas de page « comment fonctionne votre feed » |
| Rapport de transparence sur la modération | ❌ Absent — confirmé absent par le comparatif juridique interne lui-même |

**Risque : 🟡 Moyen** — OnScen n'est probablement pas une VLOP (Very Large Online Platform) au sens du DSA vu son échelle actuelle, donc les obligations renforcées (rapport de transparence, audit indépendant) ne sont pas encore applicables ; les obligations de base (notice-and-action, point de contact) existent mais restent incomplètes (contact autorités non séparé, transparence algorithmique absente).

**Recommandation :** séparer le contact autorités du contact éditeur générique ; ajouter une page de transparence sur le fonctionnement du feed (obligation qui s'applique dès qu'une recommandation algorithmique existe, indépendamment du statut VLOP) ; préparer un modèle de rapport de transparence même sommaire, à activer si le seuil d'utilisateurs actifs venait à être atteint.

---

## 11.3 Protection des mineurs

**Constat détaillé :**

| Seuil | Valeur codée | Fichier |
|---|---|---|
| Âge minimum compte | 13 ans | `lib/ageGates.ts` (`MIN_PROFILE_AGE = 13`) |
| Âge minimum pour démarrer un live | 16 ans | `MIN_LIVE_AGE = 16` |
| Âge minimum monétisation (dons, abonnements) | 18 ans | `CREATOR_MONETIZATION_MIN_AGE = 18` |

**Problèmes identifiés :**
1. **Vérification d'âge purement déclarative** — à l'inscription, seule une case à cocher `confirmAge === true` est requise (`routes/auth.ts:129,169-175`), **sans** date de naissance obligatoire à cette étape. La date de naissance n'est demandée que plus tard, lors de l'onboarding du profil (`ProfileSetupWizard.tsx`), avec une validation déclarative simple (pas de vérification d'identité, pas de prestataire de vérification d'âge tiers).
2. **Live streaming accessible dès 16 ans**, pas restreint aux « comptes majeurs vérifiés » comme le recommande la bonne pratique de l'industrie pour le live streaming public.
3. **Bypass identifié dans le flux de dons** : la condition d'éligibilité aux pourboires accepte soit un âge de profil ≥ 18 ans, soit un simple flag `ageConfirmed` envoyé par le client (`donations.ts:232-237,316-318`) — un client pourrait techniquement envoyer `ageConfirmed: true` sans que l'âge du profil soit cohérent avec la majorité.
4. **Géolocalisation précise non restreinte pour les comptes mineurs** — un utilisateur de 13 à 17 ans peut activer le mode de précision « precise » (position exacte visible, avant floutage applicatif) au même titre qu'un compte majeur ; aucune condition liée à l'âge n'a été trouvée dans `locationPrivacy.ts`/`geo.ts`.

**Risque : 🟠 Élevé** — les seuils d'âge existent et sont appliqués côté serveur (pas juste côté UI), ce qui est positif, mais l'absence de vérification d'âge réelle (au-delà d'une case à cocher) est un risque désormais scruté de près par les régulateurs (DSA, lois nationales sur la protection des mineurs en ligne) pour toute plateforme sociale avec live streaming et géolocalisation. Le bypass `ageConfirmed` sur les dons et l'absence de restriction géo pour les mineurs aggravent ce constat.

**Recommandation (priorité élevée) :**
1. Rendre la date de naissance obligatoire **dès l'inscription** (pas seulement à l'onboarding profil).
2. Supprimer le bypass `ageConfirmed` côté dons — n'accepter que l'âge dérivé du profil stocké en base.
3. Forcer `locationPrecision: 'city'` (pas d'option « precise ») pour tout compte de moins de 18 ans.
4. Faire trancher par un avocat si une vérification d'âge renforcée (au-delà du déclaratif) est requise pour le niveau de risque de la fonctionnalité live streaming (question déjà posée en interne, `RENDEZ-VOUS-AVOCAT.md`).

---

## 11.4 RGPD — localisation des serveurs

**Constat : ✅ conforme.**
- VPS de production et de staging hébergés chez **Scaleway, zone `fr-par-2`** (France) — confirmé (`commun/docs/INFRA-ONSCEN.md`).
- PostgreSQL managé et Object Storage également en région `fr-par` (France).
- Sous-traitants hors UE identifiés et documentés dans le registre (`dpa.ts`) : Cloudflare, LiveKit, Stripe (partiellement, entité IE), Sentry, potentiellement ACRCloud — tous mentionnés avec clauses contractuelles types (CCT) prévues, mais **DPA non encore signés** (voir Phase 9 §9.3, `LEG-5`).

**Risque : 🟢 Faible** sur l'hébergement primaire (conforme, en France/UE) ; 🟡 **Moyen** sur le statut contractuel des sous-traitants hors UE (transferts documentés mais DPA/CCT non finalisés).

---

## 11.5 Paiements — dons/pourboires live

**Constat :**
- **Pas de jeu d'argent déguisé** : les pourboires sont des montants directs en euros via Stripe (Payment Intents), sans conversion préalable vers une monnaie virtuelle interne. Un champ `meloCoins` existe dans le schéma utilisateur mais n'est **pas utilisé** dans le flux de don actuel (initialisé à 0, aucune dépense/achat identifié dans `lib/donations.ts`/`routes/donations.ts`) — pas de mécanique de type loot box ou pari.
- **PCI-DSS** : conforme par délégation — aucun numéro de carte/CVV ne transite ni n'est stocké côté OnScen, la saisie passe exclusivement par Stripe.js/Checkout (confirmé code + documentation légale).
- **TVA** : ❌ **aucune mention de TVA/facturation** dans les CGU/CGV de monétisation créateurs (`creatorMonetization.ts`) — sujet resté ouvert dans le dossier avocat (DAC7, TVA, KYC créateurs — `RENDEZ-VOUS-AVOCAT.md`, `CHECKLIST-VALIDATION-AVOCAT.md`).
- **Incohérence de taux de commission documentée** entre `creatorMonetization.ts` (30 %) et la configuration réelle/`MENTIONS-LEGALES-DONS.md` (50 %) — traitée en détail Phase 9 §9.4.
- **Point opérationnel critique distinct, toujours ouvert (`STR-11`, reconfirmé ce jour) :** `STRIPE_SECRET_KEY` en mode **test** (`sk_test_...`) dans la configuration de production locale (`commun/backend/.env.production`) alors que `APP_ENV=production` et `DONATIONS_ENABLED=1`. Un don réel effectué aujourd'hui avec cette configuration produirait une confirmation de succès fictive côté Stripe **sans aucun mouvement d'argent réel**. Ce point avait déjà été investigué en détail par l'audit consolidé du 22/07 (aucune clé live trouvée nulle part dans l'infrastructure accessible) et reste, à la vérification de ce jour, **inchangé**.

**Risque global : 🟢 Faible** sur le modèle juridique du don (pas un jeu d'argent, PCI délégué) ; 🟠 **Élevé** sur la TVA/DAC7 non traités et l'incohérence de commission ; 🔴 **Critique opérationnel** (confirmé persistant) sur la clé Stripe de test en configuration de production.

**Recommandation :**
1. Trancher en priorité absolue le sort de `STRIPE_SECRET_KEY` (voir détail complet et 3 options documentées dans `AUDIT-CONSOLIDE.md` §5.1) — décision produit/business, pas une action technique bloquée.
2. Faire rédiger une clause TVA/facturation créateurs par l'avocat déjà mandaté.
3. Corriger l'incohérence de commission (voir Phase 9 §9.4).

---

## 11.6 Conformité stores (Apple App Store / Google Play) — live streaming & UGC

**Constat :**
- L'application **n'a jamais été soumise** aux stores (`AUDIT-mobile-ios-android.md`), donc aucune décision de conformité (acceptation/rejet) n'existe encore.
- Les audits mobiles existants se concentrent sur les exigences **In-App Purchase (Guideline 3.1.1)** et **Sign in with Apple** — pas sur les exigences spécifiques **Apple 1.2 (User-Generated Content)** ni les exigences équivalentes Google Play pour le live streaming (bouton de signalement/blocage visible pendant un live, capacité de bannissement rapide, contact support, classification d'âge cohérente).
- **Mesures produit déjà en place** qui répondent partiellement à ces exigences (même si non formalisées comme checklist store) : bouton de signalement pendant un live (`LivePage.tsx`), bannissement rapide par l'hôte/modérateur (`LiveUserBanModal.tsx`), système de support/tickets.
- **Non documenté** : classification d'âge du store (17+/18+ typiquement requis par Apple pour les apps avec live streaming UGC non modéré en continu).

**Risque : 🟠 Élevé** à l'échéance de la soumission aux stores — les fonctionnalités techniques sous-jacentes existent partiellement, mais aucune checklist formelle de conformité **Guideline 1.2 (Apple)** / exigences UGC équivalentes **Google Play** n'a été produite, ce qui expose à un risque de rejet ou de retrait a posteriori lors de la première soumission.

**Recommandation :** avant toute soumission aux stores, produire une checklist dédiée « live streaming + UGC » (au-delà de la checklist IAP/Sign in with Apple déjà connue) couvrant : bouton report/block visible en toute circonstance de live, EULA affiché, délai de modération démontrable, contact support accessible, classification d'âge cohérente avec le contenu (17+ probable vu le live UGC non pré-modéré).

---

## Synthèse des risques — Phase 11

| # | Sujet | Risque | Effort |
|---|---|---|---|
| GLOB-1 | Droits musicaux — stratégie de blocage dépend d'ACRCloud actif (non confirmé) | 🟡 Moyen | S (une fois décidé) |
| GLOB-2 | DSA — contact autorités non séparé, transparence recommandation absente | 🟡 Moyen | S/M |
| GLOB-3 | **Vérification d'âge purement déclarative, bypass dons, geo précise non restreinte pour mineurs** | 🟠 Élevé | M |
| GLOB-4 | RGPD hébergement | 🟢 Conforme | — |
| GLOB-5 | TVA/DAC7 non traités dans les CGV monétisation | 🟠 Élevé | M (juridique) |
| GLOB-6 | **`STRIPE_SECRET_KEY` de test en configuration de production, dons activés** | 🔴 Critique (opérationnel, reconfirmé persistant) | S (config) + décision business |
| GLOB-7 | Conformité stores UGC/live streaming non formalisée avant soumission | 🟠 Élevé | M |

*Recoupe et actualise `LEG-*`/`STR-11` de `commun/docs/audit/AUDIT-CONSOLIDE.md` (2026-07-22).*
