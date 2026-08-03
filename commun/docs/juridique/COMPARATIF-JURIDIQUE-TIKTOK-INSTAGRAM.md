# Comparatif juridique — Notre dossier vs TikTok vs Instagram (Meta)

**Mode :** audit CTO · **Date :** 3 août 2026  
**Périmètre :** contenu du dossier `commun/docs/juridique/dossier-avocat-a-valider/` + sources in-app `web/app/src/content/legal/`  
**Références externes :** documents publics TikTok (Terms, Community Guidelines, Privacy, Branded Content Policy, Advertising Policies) · Meta/Instagram (Terms of Use, Community Standards, Privacy Policy, Branded Content, Ad Standards, EU DSA resources).

> **Limite de l’analyse :** TikTok et Instagram publient des centaines de pages juridiques et annexes régionales. Le comparatif porte sur **la couverture fonctionnelle** attendue d’une **plateforme UGC + pub native + monétisation créateurs** en UE/France, pas sur une parité ligne à ligne avec des géants (VLOP, 40+ langues, 50+ pays).

---

## 1. Synthèse — verdict global

| | TikTok / Instagram | Notre dossier |
|---|-------------------|----------------|
| **Socle utilisateur (CGU, privacy, cookies, LCEN)** | Très complet | **Bon** — équivalent « MVP sérieux » ; mentions + DSA contact présents |
| **Règles de communauté & modération** | Documents dédiés + centre d’aide | **Amélioré (août 2026)** — docs dédiés exportés ; recours à valider avocat |
| **Publicité & sponsors** | Politiques publiques annonceurs + créateurs (branded content) | **Bon côté B2B** (devis, contrat, reporting) + **politiques utilisateur** ajoutées |
| **Droits d’auteur / retrait** | Copyright policy, formulaires, contre-notification | **Amélioré** — politique dédiée + signalement in-app · procédure à valider |
| **Mineurs & sécurité enfant** | Politiques jeunesse, comptes teens, parental | **Basique** — 13+ / 16 live / 18 paiements · **pas** de doc dédié parental / teen |
| **Stores mobile (IAP, Apple Sign-In, labels privacy)** | N/A (eux = stores) | **Hors dossier juridique textuel** — identifié dans LEGAL_REPORT / TODO · **critique** avant soumission App Store |
| **DSA (UE)** | Portails transparence, modération, pub | **Entrée de gamme OK** (signalement, contact DSA en mentions) · **Manque** transparence algo (bonne pratique), CMP opérationnelle |

**Conclusion :** le dossier juridique est **solide pour une preprod / lancement B2B sponsor + RGPD**. Il reste **en retrait vs TikTok/Instagram** sur **mineurs détaillés**, **law enforcement**, **CMP cookies** et **alignement stores** (non couvert par les PDF seuls).

---

## 2. Inventaire du dossier juridique (ce que vous avez)

| Bloc dossier | Documents | Rôle |
|--------------|-----------|------|
| `01-commercial-sponsors/` | Devis, contrat type, reporting | B2B annonceurs · proche **Meta/TikTok Ads Terms** (côté annonceur) |
| `02-documents-utilisateurs/` | CGU, privacy, mentions, cookies, RGPD synthèse, API plateformes, licences OSS, communauté, branded content, pub, modération, copyright | Cœur **Terms + Privacy + LCEN** + couche « réseau social » |
| `03-monetisation/` | Mentions pourboires live | **Creator / virtual tips** (TikTok Gifts / IG Stars — partiellement couvert) |
| `04-rgpd-entreprise/` | DPA, AIPD/DPIA géoloc | **Au-dessus** de ce que la plupart des utilisateurs voient chez TikTok/IG (interne) |
| `05-audit-et-preparation/` | RDV avocat, LEGAL_REPORT, TODO, comparatif | Contexte · **LEGAL_REPORT juin 2026** : recouper avec l’état actuel |
| `06-donnees-editeur/` | Template LCEN | À compléter (adresse, etc.) |
| `07-annexes-produit/` | One-pager sponsor, justification tarifs | Commercial · pas juridique utilisateur |

**Mise à jour août 2026 :** cinq documents in-app ajoutés et exportés (`communityGuidelines`, `brandedContent`, `advertisingPolicy`, `moderationAppeals`, `copyrightNotice`) — validation avocat recommandée.

---

## 3. Matrice comparative détaillée

Légende : ✅ Couvert · ⚠️ Partiel · ❌ Absent · N/A Non applicable à ce stade

| Domaine | TikTok | Instagram / Meta | Plateforme (dossier + in-app) | Écart vs géants |
|---------|--------|----------------|---------------------------|-------------------|
| **Conditions d’utilisation (ToS/CGU)** | ✅ Terms of Service | ✅ Terms of Use | ✅ `cgu.pdf` | ⚠️ Pas de clause **arbitrage US** (normal FR) · ⚠️ Pas de **Inactive Account Policy** |
| **Politique de confidentialité** | ✅ Privacy Policy | ✅ Privacy Policy | ✅ `politique-confidentialite.pdf` | ⚠️ Biométrie / analyse image (Sightengine) à **explicitter** |
| **Politique cookies + CMP** | ✅ + bannière | ✅ + bannière | ⚠️ `politique-cookies.pdf` | ❌ **CMP opérationnelle** (LEGAL_REPORT LEG-RGPD-001) — doc existe, **produit incomplet** |
| **Mentions légales LCEN** | ✅ (via entité locale) | ✅ | ⚠️ `mentions-legales.pdf` | ⚠️ **Placeholders** adresse / capital · à finaliser |
| **Community Guidelines / Standards** | ✅ Community Guidelines | ✅ Community Standards | ✅ `regles-communaute.pdf` | ⚠️ À valider avocat · ton & exhaustivité |
| **Signalement contenu illicite (DSA art. 16)** | ✅ In-app + help | ✅ | ✅ Signalement + mentions DSA | ⚠️ **Procédure autorités / PHAROS** non documentée dans dossier |
| **Point de contact DSA (art. 11)** | ✅ | ✅ | ✅ Mentions (contact DSA) | ⚠️ LEGAL_REPORT obsolète sur ce point — **mettre à jour l’audit** |
| **Décision motivée & recours modération (DSA)** | ✅ Help + appeal flows | ✅ | ✅ `moderation-et-recours.pdf` | ⚠️ Mise en œuvre produit + délais à confirmer |
| **Transparence recommandation (art. 27 DSA)** | ✅ (VLOP) / partiel | ✅ (VLOP) | ❌ | ❌ Pas de page **« Comment fonctionne le fil / reels »** |
| **Transparence publicité (art. 26 DSA)** | ✅ Label + policies | ✅ « Paid partnership » | ✅ Badge + `politique-publicitaire.pdf` | ⚠️ Cohérence UX badge / texte |
| **Politique publicité annonceurs** | ✅ TikTok Advertising Policies | ✅ Meta Advertising Standards | ✅ Contrat + devis sponsor | ✅ **Bon pour B2B managed** · ⚠️ Pas de **CGV annonceurs standalone** |
| **Branded content / influence** | ✅ Branded Content Policy | ✅ Branded Content tools + règles | ✅ `contenus-sponsorises-partenariats.pdf` | ⚠️ Discipline créateurs hors vente managed |
| **Copyright / IP utilisateurs** | ✅ Copyright policy + webform | ✅ IP help + forms | ✅ `politique-droits-auteur.pdf` | ⚠️ Formulaires / délais à valider |
| **Licence UGC (réutilisation par la plateforme)** | ✅ ToS détaillé | ✅ ToS détaillé | ⚠️ CGU §5 (licence courte) | ⚠️ Moins détaillé que Meta |
| **Musique / tiers (YouTube, etc.)** | ✅ Sound / licensing rules | ✅ Music guidelines | ✅ `conditions-api-plateformes.pdf` | ✅ **Point fort** vs réseaux généralistes |
| **Monétisation créateurs (tips, abos)** | ✅ Virtual Items / Creator terms | ✅ Stars / subscriptions | ✅ `monetisation-createurs.pdf` | ⚠️ **DAC7 / TVA / KYC** · ⚠️ **IAP stores** (LEGAL_REPORT) |
| **Pourboires ≠ dons** | N/A (gifts) | N/A | ✅ `MENTIONS-LEGALES-DONS.pdf` | ✅ Clarté **supérieure** à beaucoup de plateformes |
| **Mineurs 13–17** | ✅ Youth policies, restricted modes | ✅ Teen accounts (progression) | ⚠️ Privacy §9 + CGU §3 | ❌ Pas de **politique jeunesse** dédiée |
| **Vérification d’âge** | ⚠️ Déclaratif + parfois ID | ⚠️ Idem | ⚠️ Déclaratif 13+ | ⚠️ **Même faiblesse** que TikTok/IG au lancement |
| **Géolocalisation** | ✅ Privacy | ✅ | ✅ CGU §6 + DPIA | ✅ **Mieux documenté** (AIPD dans dossier) |
| **Messages privés / chiffrement** | ✅ Privacy | ✅ | ✅ CGU §7 | ⚠️ Pas de **politique end-to-end** (non E2E) |
| **DPA / sous-traitants B2B** | ✅ (entreprise) | ✅ | ✅ `dpa-sous-traitants.pdf` | ✅ Atout dossier avocat |
| **AIPD / DPIA** | Interne | Interne | ✅ `aipd-dpia-geolocalisation.pdf` | ✅ Atout |
| **Law enforcement / réquisitions** | ✅ Guidelines | ✅ Law enforcement | ❌ | ❌ **Absent** |
| **Rapport transparence modération (annuel)** | ✅ (VLOP) | ✅ (VLOP) | ❌ | N/A aujourd’hui |
| **EU ODR / médiation consommateur** | ✅ | ✅ | ⚠️ Mentions (ODR) | ⚠️ Médiateur conso **France** (LCEN) |
| **Stores : IAP, Sign in with Apple, privacy labels** | — | — | ❌ (TODO / LEGAL_REPORT) | ❌ **Critique** — parité produit stores |

---

## 4. Manquements priorisés (par rapport à TikTok / Instagram)

### Priorité 1 — Avant scale créateurs influenceurs

1. **Validation avocat** des 5 documents ajoutés (communauté, branded content, copyright, recours, pub).  
2. **Discipline créateurs** — posts sponsorisés hors contrat managed (ARPP / DSA).

### Priorité 2 — Conformité produit = conformité juridique

3. **CMP cookies** — TikTok/IG bloquent non-essentiels sans consentement ; la doc existe, **implémentation** incomplète (Stripe.js, YouTube).  
4. **Mentions légales complètes** — entité légale complète vs **template** à remplir.  
5. **Stores mobile** — IAP + Apple Sign-In + Privacy Nutrition Labels.

### Priorité 3 — Maturité plateforme (12–24 mois)

6. **Transparence algorithme** (fil, reels, carte).  
7. **Law enforcement guidelines**.  
8. **Politique comptes mineurs / parents**.  
9. **Rapport transparence annuel (modèle)**.

---

## 5. Points où la plateforme est **mieux** ou **plus claire** que la doc publique moyenne TikTok/IG

| Sujet | Commentaire |
|-------|-------------|
| **Dossier B2B sponsor** | Devis, contrat, reporting, justification tarifs — **plus explicite** que self-serve TikTok Ads. |
| **Pourboires vs dons** | Document dédié commission 30 % — **rarement aussi clair**. |
| **YouTube / API tierces** | `conditions-api-plateformes.pdf` — **aligné** bonnes pratiques Google API. |
| **DPIA + DPA dans le pack avocat** | Niveau **entreprise / RGPD** souvent **interne only** chez les géants. |
| **Verticalisation musicale dans CGU** | Règle de contenu **plus précise** que des Community Standards généralistes. |

---

## 6. Écarts « normaux » — ne pas copier TikTok/Instagram

| Sujet | Pourquoi ne pas viser la parité |
|-------|----------------------------------|
| **Arbitration / class action waiver (US)** | Cible droit **français** — clauses US inutiles voire interdites pour consommateurs UE. |
| **VLOP / rapport transparence 45 M MAU** | Non applicable tant que sous les seuils DSA. |
| **50+ politiques régionales** | Un jeu **FR + UE** suffit au lancement. |
| **Politique TikTok Shop / Meta Pay** | Hors périmètre produit actuel. |

---

## 7. Plan d’action recommandé (ordre dossier avocat)

| # | Action | Livrable | Où |
|---|--------|----------|-----|
| 1 | **Valider avocat** les 5 docs sociaux | PDF `02-documents-utilisateurs/` | RDV avocat |
| 2 | Mettre à jour **LEGAL_REPORT** | `LEGAL_REPORT.md` | `05-audit-et-preparation/` |
| 3 | Finaliser **legal-publisher** (adresse, médiateur FR) | JSON prod | `06-donnees-editeur/` |
| 4 | Traiter **IAP + Sign in with Apple + CMP** | Spec produit | TODO |

---

## 8. Tableau récapitulatif « couverture vs géants »

| Catégorie documentaire | TikTok | Instagram | Plateforme | Gap |
|------------------------|--------|-----------|------------|-----|
| ToS + Privacy + Cookies | ✅ | ✅ | ✅ | Faible |
| Community rules (standalone) | ✅ | ✅ | ✅ | Faible (validation) |
| Copyright policy (formelle) | ✅ | ✅ | ✅ | Faible (validation) |
| Branded / paid partnership | ✅ | ✅ | ✅ | Moyen (usage créateurs) |
| Ad policy (public) | ✅ | ✅ | ✅ | Faible |
| Advertiser contract (B2B) | ✅ | ✅ | ✅ | Faible |
| Creator monetization | ✅ | ✅ | ✅ | Faible (stores) |
| DSA contact + reporting | ✅ | ✅ | ✅ | Faible |
| Moderation appeals (public) | ✅ | ✅ | ✅ | Moyen |
| Youth / teen policy | ✅ | ✅ | ⚠️ | **Moyen** |
| Law enforcement | ✅ | ✅ | ❌ | Moyen |
| Algo transparency | ✅ | ✅ | ❌ | Moyen (croissance) |
| RGPD enterprise (DPA/DPIA) | ⚠️ interne | ⚠️ interne | ✅ dossier | **Atout** |

---

## 9. Conclusion pour l’avocat / le BIC

Le dossier juridique **ne présente pas de trou béant sur le triptyque LCEN + RGPD + contrat sponsor B2B** pour une **jeune plateforme UE**. Face à TikTok et Instagram, l’écart principal est désormais **produit & stores** (CMP, IAP) et **mineurs / law enforcement**, plus que l’absence de documents sociaux de base.

- **DSA** — bonne voie ; transparence pub et recours à confirmer en prod.  
- **App Store / Play** — exigences **plus dures** que le dossier PDF sur les **paiements in-app**.  
- **Créateurs** — comparer à Instagram : **branded content policy** existe ; faire respecter l’étiquetage hors campagnes managed.

**Recommandation CTO :** validation avocat des textes août 2026 ; compléter LCEN + CMP + stores en parallèle.

---

*Comparatif interne · Ne constitue pas un avis juridique · Sources : documentation publique TikTok & Meta (2025–2026).*
