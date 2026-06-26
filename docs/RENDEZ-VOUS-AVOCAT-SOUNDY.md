# Soundy — Fiche rendez-vous avocat (1 page)

**Date du RDV :** _______________  
**Avocat :** _______________  
**Objet :** conformité juridique de l’application Soundy (getsoundy.com)

> Document de préparation interne — ne constitue pas un avis juridique.

---

## Contexte produit (30 secondes)

**Soundy** est une plateforme sociale autour de la musique : profils, feed, reels, DMs, **salons audio** (YouTube/Spotify), **lives vidéo** (LiveKit + Cloudflare), **géolocalisation** (« people nearby », carte), modération admin + NSFW automatisée (Sightengine).

**Monétisation :** pourboires live (commission plateforme ~30 %), abonnements créateurs, Soundy+ — via **Stripe Connect** (web). App mobile Capacitor (iOS/Android) en cours.

**Infra :** VPS Scaleway (fr-par), PostgreSQL, hébergement EU. Documents légaux in-app (CGU, privacy, DPIA, mentions, monétisation créateurs). Export / suppression de compte implémentés.

**Points sensibles identifiés en interne :** IAP obligatoires sur mobile (Stripe in-app = rejet stores), Sign in with Apple si Google OAuth, mentions légales LCEN incomplètes (SIREN, DPO), cookies tiers (Stripe/YouTube), durées de conservation données.

---

## Les 15 questions essentielles

### A. Statut & responsabilité (priorité 1)

| # | Question |
|---|----------|
| **1** | Quelle forme juridique recommandez-vous (micro, SASU, SAS) et **à quel moment** (avant prod, avant stores, avant premiers paiements) ? |
| **2** | Qui est l’**éditeur LCEN** et que doit contenir impérativement nos mentions légales (SIREN, siège, hébergeur, DPO) ? |
| **3** | Soundy est-elle **hébergeur** ou **éditeur** (LCEN / DSA) compte tenu de la modération admin, des algorithmes de feed et des sponsors ? |

### B. Monétisation & stores (priorité 1 — risque business)

| # | Question |
|---|----------|
| **4** | Nos **« pourboires » live** (soutien volontaire, 30 % plateforme, pas de reçu fiscal) — formulation et cadre juridique corrects (vs don, prestation, cadeau numérique) ? |
| **5** | Avec **Stripe Connect**, quelles obligations **KYC / AML / fiscalité / TVA** pour Soundy et pour les créateurs (DAC7, facturation, retenue) ? |
| **6** | Sur **iOS/Android**, Stripe in-app est-il interdit ? Comment articuler **web (Stripe)** vs **IAP Apple/Google** sans violation des règles stores ? |
| **7** | **Sign in with Apple** est-il obligatoire dès que Google OAuth est proposé ? Conséquences si non implémenté avant soumission App Store ? |

### C. RGPD & données (priorité 2)

| # | Question |
|---|----------|
| **8** | Faut-il **nommer un DPO** (géoloc temps réel, mineurs, lives vidéo) ? Responsable vs co-responsables (Stripe, Cloudflare, Sightengine) ? |
| **9** | Nos CGU / privacy / DPIA in-app suffisent-elles ou faut-il une **relecture et validation** avant mise en prod à grande échelle ? |
| **10** | **Durées de conservation** légales pour DMs, lives archivés, analytics, logs — faut-il des purges automatiques obligatoires ? |
| **11** | **Cookies** (auth + Stripe.js + YouTube) : CMP (bannière consentement) obligatoire ou base légale autre que consentement ? |

### D. Contenus, modération, mineurs (priorité 2)

| # | Question |
|---|----------|
| **12** | **DSA** : Soundy est-elle concernée ? Obligations de signalement, transparence modération, contact légal ? |
| **13** | **Seuils d’âge** actuels (compte 13+, live 16+, paiement 18+) — conformes ? Consentement parental requis ? Signalement PHAROS ? |
| **14** | **UGC + musique** (YouTube/Spotify, uploads reels/compositions) : CGU de licence utilisateur suffisante ? Procédure droits d’auteur (notice-and-takedown) ? |

### E. Clôture (priorité 1)

| # | Question |
|---|----------|
| **15** | **Si Soundy lance demain** avec pourboires réels + app iOS : quels sont les **3 risques** qui peuvent entraîner fermeture, rejet stores ou sanction — et **dans quel ordre** les traiter ? |

---

## Documents à apporter / partager

- [ ] `LEGAL_REPORT.md` (audit interne juin 2026)
- [ ] `docs/MENTIONS-LEGALES-DONS.md` (pourboires 30 %)
- [ ] CGU / Privacy / Monétisation créateurs (`app/src/content/legal/`)
- [ ] `TODO-MANUAL.md` (section Business / Légal)
- [ ] Liste sous-traitants : Scaleway, Stripe, Cloudflare, LiveKit, Sightengine, Google (OAuth/YouTube)
- [ ] Schéma flux : inscription → live → pourboire → Stripe Connect

---

## Déroulé suggéré (60 min)

| Durée | Sujet |
|-------|--------|
| 15 min | Statut société, éditeur LCEN/DSA (Q1–3) |
| 20 min | Monétisation Stripe + stores mobile (Q4–7) |
| 15 min | RGPD, cookies, conservation (Q8–11) |
| 8 min | Modération, mineurs, UGC (Q12–14) |
| 2 min | Synthèse risques + plan d’action (Q15) |

---

## Notes pendant le RDV

| Sujet | Réponse / action avocat | Échéance |
|-------|-------------------------|----------|
| Forme juridique | | |
| Mentions légales LCEN | | |
| Pourboires / Stripe | | |
| Stores iOS/Android | | |
| RGPD / DPO | | |
| DSA / modération | | |
| Mineurs | | |
| Prochain RDV | | |

---

*Soundy Dev — fiche générée le 2026-06-26 — `docs/RENDEZ-VOUS-AVOCAT-SOUNDY.md`*
