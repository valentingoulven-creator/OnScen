# Audit légal OnScen — Phase 9 : CGU / CGV / Politique de confidentialité

**Date :** 2026-08-07
**Méthode :** revue de `web/app/src/content/legal/*.ts` (terms, privacy, rgpd, dpa, dpia, mentions, creatorMonetization, communityGuidelines, moderationAppeals), `commun/backend/src/lib/legalDocumentsApp.json`, `commun/docs/juridique/*.md`, croisement avec `LEG-1` à `LEG-10` de `AUDIT-CONSOLIDE.md`.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

---

## 9.1 Existence et accessibilité des documents légaux

**Constat : ✅ conforme, corpus complet et structuré.**

| Document | Fichier |
|---|---|
| CGU (terms) | `web/app/src/content/legal/terms.ts` |
| Pourboires/abonnements créateurs (CGV) | `web/app/src/content/legal/creatorMonetization.ts` |
| Politique de confidentialité | `web/app/src/content/legal/privacy.ts` |
| Registre RGPD | `web/app/src/content/legal/rgpd.ts` |
| Registre des sous-traitants (DPA) | `web/app/src/content/legal/dpa.ts` |
| AIPD/DPIA géolocalisation | `web/app/src/content/legal/dpia.ts` (modèle non finalisé, voir Phase 3) |
| Mentions légales (LCEN) | `web/app/src/content/legal/mentions.ts` |
| Règles communautaires | `web/app/src/content/legal/communityGuidelines.ts` |
| Procédure de recours modération | `web/app/src/content/legal/moderationAppeals.ts` |
| Mentions légales spécifiques dons | `commun/docs/juridique/MENTIONS-LEGALES-DONS.md` |
| Mise à jour miroir statique (revue avocat) | `commun/backend/src/lib/legalDocumentsApp.json` |

Accessibilité in-app confirmée (Paramètres → section légale, `SettingsPage.tsx`).

---

## 9.2 Couverture des CGU

| Exigence | Couverte ? | Détail |
|---|---|---|
| Âge minimum | ✅ | 13 ans compte, 16 ans live, 18 ans monétisation (`ageGates.ts`, `terms.ts:19`) |
| Règles de contenu autorisé/interdit | ✅ | `communityGuidelines.ts` |
| Procédure de modération et sanction | ✅ | Avertissement/suspension/bannissement décrits ; procédure de recours 14 jours (`moderationAppeals.ts`) |
| Propriété intellectuelle du contenu UGC | ✅ | Section dédiée dans `terms.ts` |

**Risque : 🟢 Faible** sur la complétude documentaire. Nuance : voir §9.4 pour un écart chiffré identifié entre deux documents légaux sur la commission des pourboires.

---

## 9.3 Conformité RGPD de la politique de confidentialité

**Constat :**

| Exigence RGPD | Statut |
|---|---|
| Finalités de collecte | ✅ Documentées par catégorie de donnée (`privacy.ts`) |
| Base légale | ✅ Mentionnée (intérêt légitime, consentement, exécution contractuelle selon les cas) |
| Durée de conservation | ✅ Documentée par catégorie ; 🟡 écart identifié Phase 12 entre la durée déclarée (12 mois logs techniques) et la durée réellement implémentée (~5 mois diagnostics, ~4 mois jours de connexion) |
| Droits utilisateurs (accès/rectification/suppression/portabilité) | ✅ Implémentés — export RGPD limité à 3 requêtes/heure (`auth.ts:84-94`), suppression de compte fonctionnelle (`accountDeletion.ts`, purge des médias S3/local + anonymisation des messages) |
| DPO désigné | 🔍 Non vérifiable depuis le code (statut organisationnel, hors périmètre technique) |
| Registre des sous-traitants avec localisation | ✅ `dpa.ts` — Scaleway (France/UE), Cloudflare/LiveKit/Stripe/Sentry (USA, clauses contractuelles types), Sightengine (France/UE), ACRCloud/Resend (localisation « à vérifier ») |
| DPA effectivement signés | ❌ **Tous en statut `pending`** sauf Google (`not-required`) — `LEG-5`, toujours ouvert |

**Risque : 🟡 Moyen** — le corpus documentaire RGPD est mature et détaillé (au-delà de la moyenne pour une startup à ce stade), mais deux écarts concrets subsistent : DPA non signés contractuellement (`LEG-5`), et durée de rétention des logs techniques non alignée entre la promesse (12 mois) et l'implémentation réelle (voir Phase 12 §12.5).

**Recommandation :** finaliser la signature des DPA standards avec Scaleway/Cloudflare/Stripe/Resend (action contractuelle) ; clarifier la localisation ACRCloud (Chine/USA mentionné comme « à vérifier » dans le registre) et Resend (CCT « à vérifier ») ; aligner le code de rétention des logs sur la durée annoncée de 12 mois ou ajuster la documentation à la baisse en la justifiant.

---

## 9.4 Incohérence factuelle identifiée — commission sur les pourboires

**Constat (nouveau, cette phase) :** deux documents légaux affichent des taux de commission **différents** pour la même fonctionnalité (pourboires live) :

- `web/app/src/content/legal/creatorMonetization.ts:30-31` : *« OnScen prélève une commission plateforme de **30 %** par défaut […] Exemple pour un pourboire de 10 € : commission OnScen 3 €, part créateur estimée 7 € »* — inchangé depuis le dernier commit du fichier (`git log` : aucune modification depuis `72370fc8`, aucune modification en attente).
- `commun/docs/juridique/MENTIONS-LEGALES-DONS.md` et la configuration backend actuelle (`DEFAULT_DONATION_PLATFORM_FEE_PERCENT = 50` dans `commun/backend/src/config/donationLegal.ts`, `DONATION_PLATFORM_FEE_PERCENT=50` dans `commun/backend/.env.production`) : **50 %**.

**Ce document est resté à 30 % alors que le taux réellement appliqué en configuration (backend + variable d'environnement de production) est désormais 50 %.** C'est exactement le type d'écart « documentation légale affichée à l'utilisateur vs comportement réel du système » qui expose à un risque de pratique commerciale trompeuse si un utilisateur consulte ce document précis avant de faire un don.

**Risque : 🟠 Élevé** — un utilisateur consultant `creatorMonetization.ts` (accessible depuis les Paramètres) verrait une répartition (3€/7€ sur 10€) différente de celle réellement appliquée par le système (5€/5€ sur 10€ au taux de 50 %), ce qui constitue une information légale erronée délivrée à l'utilisateur final.

**Recommandation :** mettre à jour `creatorMonetization.ts` (section « 5 bis. Commission sur les pourboires live ») pour refléter le taux de 50 % actuellement configuré, et vérifier qu'aucun autre document légal in-app n'affiche encore l'ancien taux de 30 %.

---

## 9.5 Mécanisme de consentement cookies/tracking

**Constat : ✅ conforme.**
- Bandeau de consentement dédié (`web/app/src/components/CookieConsentBanner.tsx`, `lib/cookieConsent.ts`).
- Sentry (tracking d'erreurs avec Session Replay) **conditionné** au consentement analytics (`hasAnalyticsCookieConsent()`, `lib/sentry.ts:25-28`) — pas de tracking avant consentement pour ce point précis.

**Risque : 🟢 Faible.**

---

## 9.6 Procédure de suppression de compte et de données

**Constat :**
- Suppression fonctionnelle et assez complète : anonymisation des messages, purge des médias possédés (photos, reels, stories, albums, compositions) du stockage local **et** S3 (`accountDeletion.ts`), révocation OAuth YouTube avant la cascade (`LEG-3 ✅`), purge des signalements liés à l'utilisateur (`purgeReportsForUser`).
- **Point non documenté explicitement dans le code ou la politique de confidentialité :** le sort des données de l'utilisateur supprimé dans les **backups** déjà réalisés (rétention 14 jours, Phase 2 §2.3) — pratique standard de l'industrie (impossible techniquement de purger un backup déjà écrit sans le regénérer), mais devrait être explicitement mentionné dans `privacy.ts` pour la transparence RGPD (délai de complétude de la suppression, y compris backups).

**Risque : 🟡 Moyen** — la suppression est fonctionnellement solide sur les données actives, mais la politique de confidentialité ne précise pas le délai de purge complète incluant les copies de sauvegarde (obligation de transparence RGPD sur ce point).

**Recommandation :** ajouter une mention explicite dans `privacy.ts` : « vos données sont supprimées immédiatement des systèmes actifs ; les sauvegardes de secours, qui ne sont pas modifiables individuellement, sont automatiquement purgées sous 14 jours maximum ».

---

## Synthèse des risques — Phase 9

| # | Sujet | Risque | Effort |
|---|---|---|---|
| CGU-1 | DPA non signés (Scaleway/Cloudflare/Stripe/Resend) | 🟡 Moyen | M (contractuel) |
| CGU-2 | Localisation ACRCloud/Resend « à vérifier » dans le registre sous-traitants | 🟡 Moyen | S |
| CGU-3 | **Incohérence commission pourboires 30 % (doc) vs 50 % (config réelle)** | 🟠 Élevé | S (mise à jour texte) |
| CGU-4 | Durée de rétention logs techniques : 12 mois annoncés vs ~4-5 mois implémentés | 🟠 Élevé | S (voir Phase 12 §12.5) |
| CGU-5 | Purge des backups après suppression de compte non mentionnée dans la privacy policy | 🟡 Moyen | S (doc) |
