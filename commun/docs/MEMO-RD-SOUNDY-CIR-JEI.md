# Mémo R&D — Soundy (CIR / JEI)

**Document interne** · à transmettre à l'expert-comptable / conseil fiscal  
**Date :** 9 juillet 2026  
**Éditeur visé :** SASU Soundy (à constituer) — activité : plateforme sociale musicale getsoundy.com  
**Rédaction :** documentation technique issue du monorepo `C:\Dev\Soundy`  
**Statut :** *non constitutif d'un avis fiscal — base de travail pour qualification R&D*

---

## 1. Objet du document

Ce mémo recense les **travaux de recherche et développement (R&D)** menés sur Soundy, distingue les activités **éligibles / non éligibles** au sens du **Crédit d'Impôt Recherche (CIR)** et du statut **Jeune Entreprise Innovante (JEI)**, et propose une **estimation du ratio dépenses R&D / charges déductibles**.

**Références réglementaires utiles :**
- [Service Public — JEI / JEC / JEU / JEII](https://entreprendre.service-public.gouv.fr/vosdroits/F31188)
- [BOFiP — conditions JEI (seuil 20 % R&D depuis mars 2025)](https://bofip.impots.gouv.fr/bofip/5356-PGP.html)
- Guide ministériel CIR (frascati — incertitudes scientifiques ou techniques)

---

## 2. Contexte produit et technique

### 2.1 Description

**Soundy** est une plateforme sociale **musicale et artistique** (PWA + apps Capacitor) permettant :
- salons d'écoute **synchronisés** (YouTube IFrame API) ;
- **lives vidéo** (LiveKit, Cloudflare Stream HLS, fallback WebRTC mesh) ;
- **carte géolocalisée** (salons, lives, événements, personnes à proximité) ;
- feed social (actualités, stories, **reels**) ;
- monétisation créateurs (Stripe Connect — pourboires, abonnements) ;
- modération admin + **NSFW automatisée** (Sightengine).

**Production :** https://getsoundy.com · hébergement France (Scaleway VPS + PostgreSQL managé).

### 2.2 Stack (juin 2026)

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, Vite, Tailwind, PWA, Capacitor 8 |
| Backend | Node.js, Express, TypeScript, Socket.io |
| Données | PostgreSQL 16 (+ migration PostGIS en cours) |
| Temps réel | Socket.io, LiveKit, Cloudflare Stream |
| Paiements | Stripe Connect |
| Conformité musique | ACRCloud (empreinte audio uploads) |

**Document d'architecture cible :** `commun/docs/STACK-CIBLE.md`  
**Coûts infra de référence :** `commun/docs/COUT-APPLICATION.md` (~40–85 €/mois au stade actuel).

### 2.3 État juridique actuel (à corriger)

- Exploitation en **entrepreneur individuel** (SIREN présent dans `legal-publisher.example.json`).
- **Recommandation préalable au JEI :** création d'une **SASU** reprenant l'activité, avec cession IP (code, marque, domaine).
- Point de vigilance : condition d'**« activité nouvelle »** — à valider avec le comptable (reprise d'activité EI → SASU).

---

## 3. Synthèse éligibilité JEI / CIR

| Critère JEI | Soundy (aujourd'hui) | Commentaire |
|-------------|----------------------|-------------|
| PME (< 250 ETP, CA < 50 M€) | ✅ | Très en dessous des seuils |
| Âge < 8 ans | ✅ | Si SASU créée en 2026 |
| Capital ≥ 50 % personnes physiques | ✅ | Fondateur solo en SASU |
| Activité nouvelle (pas simple restructuration) | ⚠️ | À documenter lors du passage EI → SASU |
| **≥ 20 % charges en R&D** | ⚠️ | **Atteignable seulement avec masse salariale R&D formalisée** |
| Travaux de R&D au sens fiscal | ⚠️ | Oui sur plusieurs lots (voir §4), pas sur tout le dev |

| Avantage | Éligible si SASU 2026 ? |
|----------|-------------------------|
| Exonération IS (100 % / 50 %) | ❌ Supprimée pour créations ≥ 01/01/2024 |
| Exonération charges patronales R&D | ✅ Si création avant 31/12/2028 et statut JEI maintenu |
| CIR (30 % dépenses éligibles) | ✅ Indépendamment ou cumulé avec JEI |
| Remboursement CIR immédiat (JEI) | ✅ Si statut JEI obtenu |
| IR-PME investisseurs | ✅ Intérêt levée de fonds |

**Verdict préliminaire :** le **CIR** est le levier le plus réaliste à court terme ; le **JEI** devient intéressant dès qu'une **rémunération R&D du président** et/ou un **premier recrutement tech** sont formalisés.

---

## 4. Lots de travaux R&D — éligibles CIR

Chaque lot répond à une **incertitude technique** non résoluble par un développeur expérimenté sans investigation (tests, prototypes, itérations).

### Lot 1 — Synchronisation multi-utilisateurs des salons musicaux YouTube

| Champ | Détail |
|-------|--------|
| **Incertitude** | Maintenir une lecture YouTube **synchronisée** entre N participants mobiles/web avec latences réseau variables, onglets en arrière-plan, et API IFrame non conçue pour le sync multi-clients. |
| **État de l'art** | Spotify Group Session, Discord watch-together : solutions fermées ; pas de SDK public équivalent pour YouTube sync tierce partie conforme aux ToS. |
| **Travaux Soundy** | Événements Socket.io `sync_playback`, `salon_force_sync` ; gestion drift ; file d'attente salon ; rate limiting ; état playback partagé. |
| **Fichiers** | `commun/backend/src/socket.ts`, `commun/backend/src/lib/salonPlaybackOps.ts`, `commun/backend/src/lib/pgSalonQueues.ts`, frontend salons |
| **Livrables R&D** | Protocole de resync, réduction écart inter-clients, gestion host failover |

### Lot 2 — Couche géo-sociale temps réel (privacy + performance)

| Champ | Détail |
|-------|--------|
| **Incertitude** | Agréger en temps réel lives, salons, événements et utilisateurs **à proximité** tout en **floutant** la position (~50 m), avec montée en charge (passage scan O(n) → PostGIS `ST_DWithin`). |
| **État de l'art** | Apps sociales généralistes (Snap Map, etc.) ; pas de solution clé en main « musique + salons sync + lives + privacy floue ». |
| **Travaux Soundy** | Haversine + blur (`geo.ts`), fallback RAM / PostGIS (`nearbyPeople.ts`, `routes/geo.ts`), clusters grandes villes (`mapMajorCityLiveClusters.ts`), bascule carte 2D / globe 3D (`MapView.tsx`, `GlobeView.tsx`). |
| **Fichiers** | `commun/backend/src/lib/geo.ts`, `nearbyPeople.ts`, `postgisConfig.ts`, `web/app/src/lib/mapMajorCityLiveClusters.ts` |
| **Livrables R&D** | Index géo, règles de confidentialité, clustering ville sans GPS exact |

### Lot 3 — Pipeline live vidéo hybride (WebRTC → HLS)

| Champ | Détail |
|-------|--------|
| **Incertitude** | Orchestrer **LiveKit** (WebRTC SFU), **egress vers Cloudflare Stream** (HLS), fallback **mesh WebRTC + Coturn**, latence et coûts variables selon le nombre de spectateurs. |
| **État de l'art** | Twitch/YouTube Live : infrastructures propriétaires ; intégration multi-fournisseur à coût maîtrisé non documentée pour PME. |
| **Travaux Soundy** | `livekit.ts`, `cloudflareStream.ts`, `livekitEgressStore.ts`, modes stream, preview PiP, playback HLS client. |
| **Fichiers** | `commun/backend/src/lib/livekit.ts`, `cloudflareStream.ts`, `web/app/src/hooks/useCloudflareHlsPlayback.ts` |
| **Livrables R&D** | Choix mode stream, bascule egress, résilience réseau mobile |

### Lot 4 — Détection automatique de contenu musical protégé (uploads)

| Champ | Détail |
|-------|--------|
| **Incertitude** | Identifier si un upload audio utilisateur (composition, reel) correspond à un **morceau commercial** avant publication — sans faux négatifs massifs ni blocage abusif. |
| **État de l'art** | Shazam/ACRCloud : API tierce ; intégration fail-closed vs fail-open en prod à définir selon risque juridique. |
| **Travaux Soundy** | Intégration ACRCloud HMAC, échantillonnage, seuils score, politique fail-closed prod (`acrCloud.ts`, `acrCloudConfig.ts`). |
| **Fichiers** | `commun/backend/src/lib/acrCloud.ts` |
| **Livrables R&D** | Pipeline modération pré-publication droits d'auteur |

### Lot 5 — Algorithmes de ranking contenus musicaux (reels / feed)

| Champ | Détail |
|-------|--------|
| **Incertitude** | Classer reels et contenus sociaux pour une **communauté musicale géolocalisée** (engagement, récence, affinités) — sans réseau social généraliste. |
| **État de l'art** | TikTok/Instagram : modèles propriétaires ; pas applicable directement au graphe social limité Soundy. |
| **Travaux Soundy** | Pondération configurable, algo intégré MeloSong (`reelFeedRanking.ts`), affinités musicales, feed actualités. |
| **Fichiers** | `commun/backend/src/lib/reelFeedRanking.ts`, `musicAffinities` (frontend/backend) |
| **Livrables R&D** | Moteur de score v1, métriques engagement, A/B interne |

### Lot 6 — Modération automatisée contenus visuels (NSFW)

| Champ | Détail |
|-------|--------|
| **Incertitude** | Détecter contenus inappropriés (stories, reels, photos) en **temps quasi réel** avec taux acceptable faux positifs/négatifs sur mobile. |
| **Travaux Soundy** | Intégration Sightengine, workflows modération admin, blocage publication. |
| **Fichiers** | `commun/backend/src/lib/sightengineConfig.ts`, `contentModeration.ts`, `liveModeration.ts` |
| **Livrables R&D** | Pipeline modération hybride humain + API |

### Lot 7 — Migration architecture données (scale horizontal)

| Champ | Détail |
|-------|--------|
| **Incertitude** | Passer d'un store **RAM monolithique** (incompatible multi-workers PM2) à **PostgreSQL source de vérité + Redis + S3** sans perte de cohérence temps réel. |
| **État de l'art** | Patterns classiques, mais **incertitude spécifique** sur la cohérence salon/live/socket pendant migration incrémentale. |
| **Travaux Soundy** | `pgStore.ts`, `pgSalonsLives.ts`, `pgReels.ts`, mutex persistance, plan `STACK-CIBLE.md`. |
| **Fichiers** | `commun/backend/src/lib/pgStore.ts`, `commun/docs/STACK-CIBLE.md` |
| **Livrables R&D** | Stratégie migration phase 0–2, tests charge |

---

## 5. Activités NON éligibles (à exclure du CIR/JEI)

| Activité | Raison d'exclusion |
|----------|-------------------|
| Intégration Stripe Connect standard (PaymentElement, webhooks) | Paramétrage API connue — `commun/backend/src/routes/donations.ts` |
| UI/UX, design, traductions i18n | Production routinière |
| Rédaction CGU, privacy, pages légales | Juridique / conformité, pas R&D |
| Admin sponsors (CRUD campagnes) | Fonctionnalité métier classique |
| Déploiement VPS, scripts PM2, Caddy | Exploitation infra |
| Marketing, pitch deck, prospection B2B | Hors R&D |
| Correction bugs triviaux, ESLint, mojibake | Maintenance courante |
| Connexion OAuth Google/YouTube (flux standard) | Intégration documentée |

**Règle pratique :** si la solution est trouvable dans la documentation officielle d'un SDK sans expérimentation → **non R&D**.

---

## 6. Estimation des charges et ratio R&D (scénarios)

### 6.1 Charges opérationnelles non R&D (ordre de grandeur annuel)

| Poste | €/an | Source |
|-------|------|--------|
| VPS Scaleway | ~120 | `COUT-APPLICATION.md` |
| PostgreSQL managé | ~180 | idem |
| Domaine + Workspace | ~220 | idem |
| APIs variables (faible trafic) | ~200–500 | Stripe, Sightengine, ACRCloud, Cloudflare |
| Comptabilité / juridique | ~1 200–2 400 | Estimation marché |
| **Total hors R&D (fourchette)** | **~2 000 – 3 500 €** | Stade pré-scale |

### 6.2 Scénarios masse salariale R&D

Hypothèse : président ou salarié avec **fiche de poste R&D** (ingénieur-chercheur / chef de projet R&D / technicien R&D) et **temps traçable** (cahier de labo, Git, tickets).

| Scénario | Description | Charges R&D annuelles (charges sociales comprises, estim.) | Charges non R&D | **% R&D** | JEI (≥ 20 %) ? |
|----------|-------------|-----------------------------------------------------------|-----------------|-----------|----------------|
| **A** | Solo, pas de rémunération, infra seule | **0 €** | ~2 500 € | **0 %** | ❌ |
| **B** | Président 30 % temps R&D, rémunération 1 500 € brut/mois | ~9 000 € | ~6 000 € (70 % gestion) + 2 500 € | **~52 %** | ✅ |
| **C** | Président 60 % temps R&D, 2 000 € brut/mois | ~18 000 € | ~12 000 € + 2 500 € | **~55 %** | ✅ |
| **D** | Président 80 % R&D + alternant/stagiaire R&D 50 % | ~35 000 € | ~10 000 € | **~78 %** | ✅ |
| **E** | 1 ingénieur CDI mi-temps R&D (50 %) | ~30 000 € | ~15 000 € | **~67 %** | ✅ |

> Les montants salariaux sont **indicatifs** (taux charges ~45 % selon statut). L'expert-comptable recalculera sur bulletins réels.

### 6.3 Scénario recommandé pour Soundy (2026–2027)

**Scénario C** : SASU créée T4 2026, président rémunéré modérément avec **60 % du temps sur lots 1–5**, documentation R&D trimestrielle.

- Objectif : dépasser **20 %** confortablement tout en restant solo.
- Dès **premier salaire R&D** : demander qualification JEI à la clôture du 1er exercice.
- **CIR estimé** (si 18 000 € dépenses R&D éligibles) : 30 % × 18 000 = **~5 400 €** de crédit d'impôt (ou remboursement si JEI).

---

## 7. Documentation à tenir pour le comptable (obligatoire)

### 7.1 Par lot R&D

- [ ] Fiche projet (objectif, incertitude, état de l'art, planning)
- [ ] Cahier de laboratoire / journal technique (dates, hypothèses, résultats tests)
- [ ] Liens commits Git ou tickets (traçabilité)
- [ ] Captures / métriques (latence sync, taux modération, perf geo…)

### 7.2 Par personne R&D

- [ ] Fiche de poste (intitulé éligible JEI : ingénieur R&D, technicien R&D, chef de projet R&D)
- [ ] Feuilles de temps mensuelles (% par lot)
- [ ] Bulletins de salaire / charges sociales
- [ ] CV / diplômes (ingénieur ou équivalent pour certains montants CIR)

### 7.3 Dossier fiscal

- [ ] Liasse fiscale avec détail dépenses R&D (compte 62x/64x selon imputation)
- [ ] Formulaire CIR (2069-A-SD et annexes)
- [ ] Demande d'avis préalable JEI (modèle BOFiP) si montants significatifs
- [ ] Attestation JEI (MESRI) si requise

---

## 8. Plan d'action 90 jours

| Semaine | Action |
|---------|--------|
| S1–S2 | Création **SASU** · transfert IP · compte bancaire pro |
| S3 | Rendez-vous expert-comptable spécialisé **CIR/JEI** avec ce mémo |
| S4–S6 | Ouverture **cahier de labo R&D** · fiches projets lots 1–5 |
| S7–S12 | Mise en place **rémunération président** (même modeste) + timesheets |
| Clôture exercice | Calcul ratio R&D · dépôt CIR · demande statut JEI si ≥ 20 % |

---

## 9. Annexes — mapping code / lots R&D

```
Lot 1 Salon sync     → socket.ts, salonPlaybackOps.ts, pgSalonQueues.ts
Lot 2 Géo-social     → geo.ts, nearbyPeople.ts, postgisConfig.ts, MapView.tsx
Lot 3 Live pipeline  → livekit.ts, cloudflareStream.ts, useCloudflareHlsPlayback.ts
Lot 4 ACRCloud       → acrCloud.ts, acrCloudConfig.ts
Lot 5 Ranking        → reelFeedRanking.ts, musicAffinities
Lot 6 Modération     → contentModeration.ts, sightengineConfig.ts
Lot 7 Scale données  → pgStore.ts, STACK-CIBLE.md
```

---

## 10. Contacts et pièces à joindre au RDV comptable

**À apporter :**
- Ce mémo
- `commun/docs/STACK-CIBLE.md`
- `commun/docs/COUT-APPLICATION.md`
- `commun/docs/juridique/RENDEZ-VOUS-AVOCAT.md`
- Prévisionnel 12 mois (trésorerie, salaire cible, charges infra)
- Statuts SASU projetés (objet social incluant « édition logicielle » et « R&D »)

**Questions à trancher avec le comptable :**
1. Reprise d'activité EI → SASU : impact condition « activité nouvelle » JEI ?
2. Rémunération optimale du président pour atteindre 20 % sans sur-coût social ?
3. CIR seul vs JEI + CIR : quel gain net année 1 ?
4. Possibilité de faire appel à un **consultant R&D** (doc Frascati) pour dossier MESRI ?

---

*Document généré pour Soundy / getsoundy.com — juillet 2026. À mettre à jour à chaque clôture comptable ou pivot technique majeur.*
