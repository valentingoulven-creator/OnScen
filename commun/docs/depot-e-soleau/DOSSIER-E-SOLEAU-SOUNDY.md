# DOSSIER DE DESCRIPTION — APPLICATION SOUNDY

**Document destiné au dépôt e-Soleau INPI**  
**Horodatage de l’existence d’une création logicielle et de sa documentation**

---

| Champ | Valeur |
|-------|--------|
| **Titre du document** | Description intégrale de l’application Soundy — réseau social musical |
| **Nom commercial principal** | **Soundy** |
| **Domaine de production** | https://getsoundy.com |
| **Version du document** | 1.2 |
| **Date de rédaction** | 29 juin 2026 |
| **Langue** | Français |
| **Statut du produit** | Application en production (PWA web) + builds natifs Capacitor |
| **Distribution mobile** | **App Store (iOS)** et **Google Play (Android)** — publication prévue, builds prêts (`com.soundy.app`) |
| **Ambition géographique** | **Internationale** — lancement dense par villes, puis extension multi-pays |

---

## AVERTISSEMENT

Ce document décrit fidèlement l’état du produit Soundy tel que documenté dans le dépôt source au 29 juin 2026. Il constitue une **preuve descriptive** de l’existence, du contenu et de l’architecture de l’application à la date indiquée.

**Il ne constitue pas un conseil juridique.** Le dépôt e-Soleau INPI horodate un document mais **n’accorde aucune exclusivité** sur la marque, le code ou les fonctionnalités. Pour une protection de marque, un dépôt de marque distinct est nécessaire. Pour un brevet, une évaluation par un conseil en propriété industrielle (CPI) est requise.

---

## TABLE DES MATIÈRES

1. [Identification et marques](#1-identification-et-marques)
2. [Objet et mission de l’application](#2-objet-et-mission-de-lapplication)
3. [Proposition de valeur et positionnement](#3-proposition-de-valeur-et-positionnement)
4. [Fonctionnalités détaillées](#4-fonctionnalités-détaillées)
5. [Architecture technique et stack](#5-architecture-technique-et-stack)
6. [Système de sponsoring et publicité native](#6-système-de-sponsoring-et-publicité-native)
7. [Modèle économique et monétisation](#7-modèle-économique-et-monétisation)
8. [Différenciation et éléments distinctifs](#8-différenciation-et-éléments-distinctifs)
9. [Public cible et marché](#9-public-cible-et-marché)
10. [Propriété intellectuelle et éléments protégeables](#10-propriété-intellectuelle-et-éléments-protégeables)
11. [Conformité légale et données personnelles](#11-conformité-légale-et-données-personnelles)
12. [Infrastructure et déploiement](#12-infrastructure-et-déploiement)
13. [Historique et jalons produit](#13-historique-et-jalons-produit)
14. [Annexes techniques](#14-annexes-techniques)

---

## 1. IDENTIFICATION ET MARQUES

### 1.1 Dénominations utilisées

| Nom | Usage | Contexte |
|-----|-------|----------|
| **Soundy** | Marque publique principale | Interface utilisateur, CGU, domaine getsoundy.com, stores mobiles (`appName: "Soundy"`) |
| **Soundy+** | Abonnement premium plateforme | Réduction publicités, filtres carte, quotas live étendus |
| **SoundyUltra** | Abonnement premium avancé | Diffusion OBS / Cloudflare Stream, quotas live élevés |
| **Supporter / Super fan** | Abonnements créateur | Monétisation directe des créateurs musicaux |

### 1.2 Signature visuelle et identité

- **Baseline officielle :** « Le réseau social de la musique live et de l’écoute partagée »
- **Identité graphique :** dégradé « Wave Soundy » appliqué aux pseudonymes et éléments de navigation
- **Langues supportées :** français et anglais (i18next), extensible à d’autres langues

### 1.3 Domaines et présence en ligne

| Domaine | Rôle |
|---------|------|
| **getsoundy.com** | Production — PWA, API, pages légales |
| **www.getsoundy.com** | Alias production, deep links |
| **staging.getsoundy.com** | Pré-production / QA |

**URLs de production :**
- Application web / PWA : `https://getsoundy.com`
- PWA mobile : `https://getsoundy.com/tel/`
- API REST : `https://getsoundy.com/api`
- Pages légales : `/privacy`, `/terms`, `/legal/mentions`

### 1.4 Éditeur et contacts

| Élément | Valeur |
|---------|--------|
| Éditeur | Valentin Goulven (Soundy) |
| Directeur de publication | Valentin Goulven |
| Hébergeur (LCEN) | Scaleway SAS, 8 rue de la Ville l’Évêque, 75008 Paris |
| Contact général | admin@getsoundy.com |
| Données personnelles (DPO) | admin@getsoundy.com |
| Droits d’auteur | admin@getsoundy.com |
| Administration | admin@getsoundy.com |

---

## 2. OBJET ET MISSION DE L’APPLICATION

### 2.1 Définition légale (CGU)

Soundy est une **plateforme sociale musicale** permettant notamment :

- de visualiser sur une carte des salons d’écoute musicale et des lives à proximité ;
- de créer ou rejoindre des salons YouTube et d’écouter de façon synchronisée ;
- d’échanger via chat public (salon, live) et messages privés ;
- de publier ou consulter des reels, de suivre des utilisateurs, d’envoyer des réactions, des pourboires en live ou des abonnements créateurs / Soundy+.

**Le Service n’est pas un service de rencontre.**

### 2.2 Mission produit

Soundy vise à **unifier** ce que les fans de musique dispersent aujourd’hui entre plusieurs applications :

| Besoin utilisateur | Applications actuelles | Réponse Soundy |
|--------------------|------------------------|----------------|
| Découverte musicale | TikTok, Instagram Reels | Reels, feed actualités, algo Soundy |
| Écoute | YouTube Music, apps streaming | Salons synchronisés YouTube |
| Social | Instagram, Discord | Feed, DMs, stories, profils créateurs |
| Sorties / événements | Shotgun, Facebook Events | Carte géolocalisée, événements, salons |

### 2.3 Vision

Retrouver sa **communauté musicale** partout dans le monde : en écoutant ensemble, en direct, et en sortant — avec une expérience mobile-first, **internationale** dès la conception (UI multilingue, carte globale, sponsors et créateurs dans toutes les zones où la musique live rassemble du public).

**Stratégie de déploiement :** densité par ville (effet réseau local) puis extension progressive vers de nouveaux pays et marchés, sans limite géographique au produit.

---

## 3. PROPOSITION DE VALEUR ET POSITIONNEMENT

### 3.1 Proposition centrale

**Une PWA sociale musicale** couvrant le parcours complet : découverte → écoute ensemble → live vidéo → sortie en présentiel (IRL).

### 3.2 Navigation principale (5 onglets)

| Onglet | Nom technique | Fonction |
|--------|---------------|----------|
| Actualités | `actualite` | Feed social, stories, algorithmes de découverte |
| Carte | `map` | Géolocalisation, salons, lives, événements, personnes proches |
| Messages | `dm` | Messagerie privée, groupes, matching cœur (18+) |
| Musique | `music` | Découverte musicale, compositions utilisateur |
| Reels | `reels` | Vidéos courtes verticales, format 9:16 |

### 3.3 Statut de production et distribution

- Application **déjà déployée en production** sur getsoundy.com (depuis au minimum juin 2025) — PWA accessible navigateur et `getsoundy.com/tel/`
- Infrastructure opérationnelle : base PostgreSQL, WebSocket temps réel, paiements Stripe, modération NSFW
- **Applications natives iOS et Android** : développées via **Capacitor 8** (module `ios/apptel/`), même code source que la PWA
- **Publication stores :** dépôt prévu sur l’**App Store Apple (iOS)** et **Google Play (Android)** sous le nom **Soundy**, identifiant `com.soundy.app`

---

## 4. FONCTIONNALITÉS DÉTAILLÉES

### 4.1 Salons d’écoute synchronisée

**Description :** Salles d’écoute musicale collaborative où un hôte et N auditeurs partagent la même position de lecture audio/vidéo.

**Caractéristiques :**
- Lecture **exclusivement via YouTube IFrame API** (lecteur officiel Google, vidéo visible en production)
- Écoute synchronisée entre hôte et auditeurs dans le même salon YouTube
- Coordination de session en temps réel via WebSocket (Socket.IO) : présence, file d’attente, chat
- File d’attente collaborative, chat intégré, modération hôte
- Salons **publics ou privés**, durée maximale ~2 heures
- **Ancrage carte** : un salon actif apparaît sur la carte géolocalisée
- Double interface :
  - **« Petit salon »** : écoute depuis la carte (`MapSalonListenSheet`) sans quitter la vue carte
  - **« Grand salon »** : interface théâtre plein écran (`SalonPage`, `RoomTheaterLayout`) — continuité de session

### 4.2 Lives (Direct)

**Description :** Diffusion vidéo en direct avec chat, pourboires et abonnements créateur.

**Modes de streaming (priorité) :**
1. **LiveKit Cloud** — WebRTC SFU, caméra navigateur (quota Build : 100 concurrents)
2. **Cloudflare Stream** — RTMP → HLS, spectateurs illimités
3. **Mesh WebRTC + Coturn TURN** — fallback, ~30 spectateurs max

**Fonctionnalités associées :**
- Chat live, réactions, pourboires Stripe Connect (commission plateforme 50 %)
- Abonnements créateur (Supporter 4,99 €/mois, Super fan 9,99 €/mois)
- Notation hôte, archivage rediffusions (Soundy+ / SoundyUltra)
- Setup assisté par chat (`StartLiveSetupChatModal`)

### 4.3 Actualités, Stories et Reels

**Actualités :** Feed social avec posts, algorithmes de découverte, bannières sponsor inline.

**Stories :**
- Contenu éphémère (24 h)
- Effets créatifs (boomerang, vinyl spin, beat pulse, canvas effects)
- Stickers de lien vers catalogue (salons, lives, profils)
- Bannières sponsor au-dessus de la barre stories
- Stories sponsorisées plein écran

**Reels :**
- Format vertical 9:16
- Enregistrement in-app (`ProfileReelRecorder`)
- Composition audio (`reelCompositionAudio`)
- Reels sponsorisés (1 tous les 5 reels par défaut, configurable)
- Modération NSFW (Sightengine)

### 4.4 Carte géolocalisée

**Description :** Carte interactive centrale de l’expérience Soundy.

**Éléments affichés :**
- Salons d’écoute actifs
- Lives en cours
- Événements musicaux (~30 km)
- Personnes proches (comptes Soundy avec géolocalisation activée)
- Clusters d’événements (`mapEventClusters`)
- Bannières sponsor carrousel (`map_banner`)
- Globe 3D (web, Three.js / react-globe.gl)

**Recherche et navigation :**
- Recherche globale (utilisateurs, salons, événements, lieux)
- Recherche de villes (`citySearch`)
- Intent de recherche carte (`mapSearchIntent`) avec flyTo automatique
- Filtres salons (`MapSalonFilterSheet`)

**Confidentialité géolocalisation :**
- Position floutée ~50 m par défaut pour les autres utilisateurs
- Mode « ville uniquement »
- Mode fantôme (masquage complet)
- Debounce des mises à jour de position

### 4.5 Messagerie (DMs)

- Messages privés et conversations de groupe
- Matching « cœur » (réservé 18+, compte célibataire actif)
- Partage de contenus (reels, profils, salons)
- Notifications temps réel

### 4.6 Profils utilisateur

- Photo, bio, genres musicaux, affinités
- Section compositions audio (upload ≤ 30 Mo, détection ACRCloud)
- Lives archivés, reels publiés
- Abonnements créateur, badge Supporter/Super fan
- Écoute en cours (`ProfileCurrentListening`)
- Deep links profil (`profileDeepLink`)

### 4.7 Authentification et sécurité

| Mécanisme | Détail |
|-----------|--------|
| JWT | Sessions API |
| 2FA TOTP | Authentification à deux facteurs |
| WebAuthn | Passkeys (RP ID : getsoundy.com) |
| OAuth | Google, YouTube, Instagram |
| Modération | Sightengine (NSFW images/vidéos) |
| Rate limiting | Endpoints sensibles (geo, auth) |

### 4.8 Panel administrateur

- Gestion comptes et accès
- Modération contenus et signalements
- Analytics et coûts infrastructure
- Support tickets temps réel
- **Gestion sponsors** (CRUD campagnes, emplacements, planification)
- Configuration plans plateforme (Soundy+, SoundyUltra)

### 4.9 Conformité RGPD

- Export de données utilisateur
- Suppression en cascade du compte
- Documents légaux in-app (CGU, confidentialité, mentions, DPIA)
- Configuration éditeur centralisée (`legalConfig.ts`, `legal-publisher.json`)

---

## 5. ARCHITECTURE TECHNIQUE ET STACK

### 5.1 Structure du dépôt source

```
Soundy/
├── app/          → Frontend web React (source de vérité)
├── ios/apptel/       → Overrides Capacitor mobile (23 fichiers spécifiques)
├── backend/      → API Node.js Express + Socket.io
├── commun/msdev/        → Environnement de développement local
├── commun/deploy/       → Scripts déploiement, Caddy, PM2
└── docs/         → Documentation produit, infra, brevet, légal
```

**Principe architectural :** une seule base de code frontend (`app/src/`) partagée entre web PWA et mobile Capacitor, avec overrides ciblés dans `ios/apptel/src/`.

### 5.2 Stack frontend

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework UI | React | 19 |
| Build | Vite | 8 |
| Styles | Tailwind CSS | v4 (mobile-first) |
| Langage | TypeScript | — |
| PWA | vite-plugin-pwa | Service Worker |
| i18n | i18next | FR / EN |
| Cartes | Leaflet, MarkerCluster | — |
| Globe 3D | react-globe.gl (Three.js) | Lazy-loaded |
| Mobile | Capacitor | 8 |

### 5.3 Stack backend

| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js |
| Framework HTTP | Express 4 |
| Langage | TypeScript |
| Temps réel | Socket.io 4 |
| Base de données | PostgreSQL 16 (Scaleway managed) |
| ORM / schéma | Schéma custom (`backend/src/models/schema.ts`) |
| Paiements | Stripe Connect, Stripe Billing |
| Modération | Sightengine API |
| Stockage fichiers | VPS `/uploads` + Scaleway Object Storage (S3 API) |
| Email | SMTP configurable |

### 5.4 Services externes

| Service | Usage |
|---------|-------|
| LiveKit Cloud | Streaming live WebRTC SFU |
| Cloudflare Stream | RTMP → HLS, CDN vidéo |
| Cloudflare | CDN/proxy optionnel getsoundy.com |
| YouTube API | Lecteur IFrame, métadonnées, salons synchronisés |
| Stripe | Paiements, Connect, abonnements |
| Sightengine | Modération contenus NSFW |
| ACRCloud | Détection empreinte audio compositions |
| Coturn | Serveur TURN WebRTC (VPS) |
| Scaleway | VPS, PostgreSQL, Object Storage |

### 5.5 Stack cible (montée en charge)

Évolution planifiée sans réécriture :

| Couche | Actuel | Cible |
|--------|--------|-------|
| Données | RAM + flush PG périodique | PostgreSQL source de vérité |
| Géo nearby | Scan Haversine O(n) | PostGIS `ST_DWithin` |
| Cache | In-process TTL | Redis 7 |
| Socket.io | 1 processus | Redis adapter multi-workers |
| Recherche | Scan RAM | Meilisearch ou PG tsvector |
| Jobs async | setTimeout | BullMQ sur Redis |
| Déploiement | PM2 fork ×1 | PM2 cluster → Docker |

Capacité estimée post-Phase 0 : 2 000–5 000 connexions simultanées.

### 5.6 Environnements

| Environnement | URL / Port | Usage |
|---------------|------------|-------|
| DEV | localhost:5173 + API :4080 | Développement local (msdev) |
| PREPROD | staging.getsoundy.com | QA, tests pré-déploiement |
| PROD | getsoundy.com | Production utilisateurs |

---

## 6. SYSTÈME DE SPONSORING ET PUBLICITÉ NATIVE

### 6.1 Vue d’ensemble

Soundy intègre un **réseau publicitaire natif** directement dans l’expérience musicale. Le sponsoring est la **priorité court terme** du modèle économique (45–55 % du revenu cible à M24).

**Proposition de valeur annonceur :**
- Audience qualifiée musique & sorties (fans, DJs, bars, labels)
- Contexte géolocalisé (salons, lives, événements autour de l’utilisateur)
- Formats non intrusifs (bandeaux natifs, carrousel, reels sponsorisés)
- Transparence : badge « Sponsorisé » vs « Promo » (interne Soundy)

### 6.2 Emplacements opérationnels (production)

| Code emplacement | Surface UI | Format | Spécifications |
|------------------|------------|--------|----------------|
| `map_banner` | Onglet Carte — carrousel | Logo + titre + sous-titre + CTA | Logo 80×80 px, bandeau 360×90 px |
| `feed_inline` | Onglet Actualités — entre posts | Carte inline native | Logo 48×48 px, bannière 343×120 px |
| `stories_banner` | Au-dessus barre Stories | Bandeau fin | Logo 32×32 px, 390×56 px |
| `reels_sponsored` | Onglet Reels — plein écran | Vidéo 9:16 ou vignette + CTA | 1080×1920 px, logo 64×64 px |
| `stories_sponsored` | Viewer Stories | Plein écran | Configurable admin |

### 6.3 Paramètres de campagne (codés)

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `displayDurationSec` | 3–60 s (défaut 8 s) | Durée affichage carrousel |
| `reelsSponsorEveryN` | 1–50 (défaut 5) | Fréquence reels sponsorisés |
| `reelsSponsorEnabled` | on/off | Activation globale |
| `priority` | entier | Ordre de rotation |
| `startsAt` / `endsAt` | timestamps | Planification campagne |
| `kind` | `promo` \| `sponsored` | Badge UI |
| Géo-ciblage | configurable | Ciblage par zone |

### 6.4 API sponsors

- **Public :** `GET /api/sponsors/map|feed|stories|reels`
- **Admin :** CRUD complet via `AdminSponsorsTab.tsx`

### 6.5 Grille tarifaire (référence marché européen, musique/nightlife)

Grille initiale calibrée pour l’Europe ; **adaptation par pays et devise** prévue pour le déploiement international (forfaits locaux, sponsors régionaux, takeover par ville).

| Package | Emplacements | Prix/mois HT |
|---------|--------------|--------------|
| Starter Local | Carte OU feed | 800 € |
| Pro Ville | Carte + feed + stories | 2 400 € |
| Premium Musique | Tous + 2 reels/mois | 4 800 € |
| Reels Boost | Reels uniquement | 2 000 € |
| Takeover Ville | Tous emplacements, 7 jours | 8 000 €/semaine |

**Tarifs à la carte :**
- Carte seule : 800 – 2 000 €/mois
- Pack feed + stories : 1 500 – 4 000 €/mois
- Reels sponsorisé : 2 000 – 8 000 €/mois

### 6.6 Segments annonceurs cibles

- Lieux & nightlife (bars, clubs, salles 50–500 places)
- Festivals & billetterie (Shotgun, Dice, billetteries locales)
- Labels & distributeurs indie
- Marques lifestyle (16–35 ans)
- Streaming & retail musique
- Équipement audio & créateurs

### 6.7 Emplacements roadmap

| Emplacement | Phase prévue |
|-------------|--------------|
| Salon sponsorisé (ancrage carte) | M4–M6 |
| Live overlay sponsor | M6–M9 |
| Événement carte premium | M4–M6 |
| Takeover ville | M9+ |

---

## 7. MODÈLE ÉCONOMIQUE ET MONÉTISATION

### 7.1 Sources de revenus

| Source | Détail | Part cible M24 |
|--------|--------|----------------|
| **Sponsors natifs** | Emplacements carte, feed, stories, reels | 45–55 % |
| **Commissions créateurs** | Pourboires live (50 % plateforme), abonnements créateur | 25–35 % |
| **Soundy+ / SoundyUltra** | Abonnement plateforme 2,99–4,99 €/mois | 10–15 % |
| **B2B lieux** | Soundy Pro Lieu 49–149 €/mois (roadmap) | 5–15 % |

### 7.2 Abonnements plateforme

| Plan | ID | Prix | Avantages principaux |
|------|-----|------|---------------------|
| Gratuit | `free` | 0 € | 30 spectateurs live, 120 min live/jour, LiveKit |
| Soundy+ | `soundy_plus` | ~2,99–4,99 €/mois | Moins de sponsors, filtres carte, quotas étendus |
| SoundyUltra | `soundy_ultra` | Premium | OBS/Cloudflare Stream, quotas live élevés, rediffusions |

### 7.3 Abonnements créateur

| Palier | Prix | Bénéficiaire |
|--------|------|--------------|
| Supporter | 4,99 €/mois | Créateur concerné |
| Super fan | 9,99 €/mois | Créateur concerné |

Commission plateforme configurable sur abonnements créateurs.

### 7.4 Pourboires live

- Gratifications volontaires pendant un live
- Paiement via Stripe Connect
- Commission plateforme : **50 %**
- Réservé aux 18 ans et plus
- Cadre légal : gratification volontaire, pas un don ouvrant droit à réduction fiscale

### 7.5 Objectifs commerciaux M12 (hypothèses)

- 40 k€ ARR sponsors
- 30 créateurs monétisés (Stripe Connect actif)
- 5–8 contrats sponsors récurrents
- 15 000 MAU

---

## 8. DIFFÉRENCIATION ET ÉLÉMENTS DISTINCTIFS

### 8.1 Comparaison concurrentielle

| Acteur | Limite | Avantage Soundy |
|--------|--------|-----------------|
| Instagram / TikTok | Pas d’écoute synchronisée, pas de carte events musique | Verticalisation musique + salons + carte |
| Apps de streaming | Social faible, pas de live vidéo intégré | Couche sociale & live au-dessus de YouTube |
| Discord | Friction, pas mobile-first grand public | UX grand public, carte, reels |
| Shotgun / Resident Advisor | Peu social, pas d’écoute partagée | Pont social → sortie IRL |

### 8.2 Moat technique (documenté)

1. **Salons YouTube synchronisés** — écoute partagée via le lecteur officiel YouTube, sans re-streaming audio centralisé par Soundy
2. **Carte géolocalisée + salons actifs** — découverte spatiale des sessions en cours
3. **Double UI petit/grand salon** — continuité de session lors du changement de présentation
4. **Combinaison** écoute YouTube + chat + live vidéo WebRTC + file d’attente collaborative
5. **Confidentialité géolocalisation graduée** — flou ~50 m, ville seule, mode fantôme

### 8.3 Moat produit

- Données combinées social + géo + écoute
- Monétisation créateur intégrée (tips, abonnements, sponsors)
- Ancrage **international** : carte mondiale, événements et salons par zone, sponsors locaux ou globaux
- Infrastructure sponsors native dès le MVP

---

## 9. PUBLIC CIBLE ET MARCHÉ

### 9.1 Géographie et ambition internationale

Soundy est conçu pour un **public mondial** : fans de musique, créateurs, lieux et marques, où que se trouvent leurs communautés.

| Phase | Périmètre | Objectif |
|-------|-----------|----------|
| **Lancement** | Premières métropoles denses (ex. Paris, Lyon, Londres, Berlin, Montréal…) | Effet réseau local, créateurs pilotes, sponsors fondateurs |
| **Expansion** | Multi-pays Europe, Amérique du Nord, diasporas et scènes musicales actives | Répéter le playbook « ville dense » |
| **Scale** | Couverture internationale large | Marques globales, festivals, labels multi-territoires |

Le produit (PWA, i18n, carte, YouTube, Stripe) **n’est pas limité à un pays** : seule la stratégie commerciale et community privilégie des lancements concentrés avant l’élargissement.

### 9.2 Marché adressable (hypothèses)

- **TAM mondial (musique + social + sorties, 16–35 ans) :** plusieurs centaines de millions de personnes
- **SAM cible (pays à forte culture live / nightlife / créateurs) :** 50–100 M personnes
- **Early adopters 24 mois :** 500 k – 1 M (multi-pays)

### 9.3 Personas

| Persona | Profil | Usage Soundy |
|---------|--------|--------------|
| **Léa** | Fan, 24 ans | Carte + salons + reels pour sorties week-end |
| **Karim** | DJ, 29 ans | Live + pourboires + profil + notation hôte |
| **Sophie** | Gérante de bar | Événements carte/feed + visibilité locale |

### 9.4 Restrictions d’âge

| Action | Âge minimum |
|--------|-------------|
| Création de compte | 13 ans (autorisation parentale 13–18) |
| Lancer un live | 16 ans |
| Paiements / monétisation | 18 ans |

---

## 10. PROPRIÉTÉ INTELLECTUELLE ET ÉLÉMENTS PROTÉGEABLES

### 10.1 Marques candidates au dépôt

| Marque | Classes suggérées | Usage |
|--------|-------------------|-------|
| **Soundy** | 9 (logiciel), 38 ( télécoms), 41 (divertissement), 42 (SaaS) | Marque principale |
| **Soundy+** | 9, 41 | Abonnement premium |
| **SoundyUltra** | 9, 41 | Abonnement premium avancé |

### 10.2 Éléments protégés par le droit d’auteur

- Code source intégral (frontend React, backend Node.js, scripts déploiement)
- Interface utilisateur et design system (Tailwind, composants React)
- Textes légaux, CGU, politique de confidentialité
- Documentation produit et technique
- Logique salons YouTube synchronisés (`salonPlayback.ts`, routes salons)
- Effets créatifs stories (`storyCreativeEffects.ts`, `storyBoomerang.ts`, etc.)
- Logique sponsoring (`sponsorAds.ts`, routes API sponsors)

### 10.3 Éléments brevetables potentiels (à évaluer par CPI)

- Architecture petit salon / grand salon avec continuité de session
- Combinaison carte géolocalisée + salons YouTube synchronisés + live WebRTC

**Note :** L’application étant déjà publique sur getsoundy.com, la nouveauté brevet (Europe) peut être compromise pour les éléments divulgués avant dépôt. L’e-Soleau horodate l’état actuel ; un CPI doit évaluer la stratégie brevet.

### 10.4 Licences tierces

- YouTube IFrame API (conditions Google)
- Stripe (conditions Stripe)
- LiveKit, Cloudflare Stream (conditions respective)
- Open source : React, Vite, Leaflet, Socket.io, etc. (licences MIT/Apache)

---

## 11. CONFORMITÉ LÉGALE ET DONNÉES PERSONNELLES

### 11.1 Cadre juridique

- **Droit applicable :** droit français
- **LCEN :** mentions légales obligatoires (éditeur, hébergeur, directeur de publication)
- **RGPD :** politique de confidentialité, DPIA, droits utilisateurs (accès, rectification, suppression, portabilité)
- **DSA :** modération, signalement, transparence

### 11.2 Documents légaux in-app

| Document | Fichier source |
|----------|----------------|
| CGU | `app/src/content/legal/terms.ts` |
| Politique de confidentialité | `app/src/content/legal/privacy.ts` |
| Mentions légales | `app/src/content/legal/mentions.ts` |
| Monétisation créateurs | `app/src/content/legal/creatorMonetization.ts` |
| DPIA | `app/src/content/legal/dpia.ts` |

### 11.3 Données traitées

- Identité (email, pseudo, photo)
- Géolocalisation (avec consentement, floutage)
- Contenus publiés (messages, reels, compositions)
- Données de paiement (via Stripe, non stockées localement)
- Logs techniques et analytics

### 11.4 Modération

- Sightengine : analyse automatique images/vidéos NSFW
- Signalement utilisateur (contenu, droits d'auteur, harcèlement)
- Intervention admin sur signalements manifestes
- ACRCloud : détection empreinte audio sur uploads

---

## 12. INFRASTRUCTURE ET DÉPLOIEMENT

### 12.1 Production (juin 2026)

| Élément | Valeur |
|---------|--------|
| VPS | 51.159.164.100 (Scaleway fr-par-2, DEV1-S) |
| Chemin application | `/opt/soundy` |
| Serveur HTTP | Caddy (HTTPS :443) |
| Process manager | PM2 (`soundy-backend`) |
| PostgreSQL | Instance managée Scaleway (soundy-prod) |
| TURN | Coturn :3478 (VPS) |
| Backups | pg_dump cron 03:15 + S3 Scaleway |

### 12.2 Pré-production

| Élément | Valeur |
|---------|--------|
| VPS | 51.159.170.181 (Scaleway fr-par-2) |
| Domaine | staging.getsoundy.com |
| PM2 | `soundy-backend-staging` |
| Base | soundy_staging (même instance PG) |

### 12.3 Coûts infrastructure mensuels (ordre de grandeur)

| Poste | €/mois |
|-------|--------|
| VPS Scaleway DEV1-S | ~10 |
| PostgreSQL DB-DEV-S | ~15 |
| Domaine getsoundy.com | ~1 |
| LiveKit Build | 0 (gratuit jusqu’au quota) |
| Cloudflare Stream | variable (~1 $/1000 min) |
| Sightengine | variable |
| **Total base** | **~30–50 €/mois** |

### 12.4 Déploiement

- Script : `commun/scripts/deploy-prod.ps1` → `commun/deploy/deploy_zero_downtime.ps1`
- Build : frontend Vite → `backend/public/`, backend TypeScript compilé
- Migrations PostgreSQL automatiques au déploiement
- Health check : `https://getsoundy.com/health`
- CI/CD : GitHub Actions (deploy preprod automatique après CI verte)

---

## 13. HISTORIQUE ET JALONS PROduit

| Date | Jalon |
|------|-------|
| 2025 (juin) | Pitch deck investisseur — PWA en production getsoundy.com |
| 2025–2026 | Développement salons synchronisés, lives LiveKit/Cloudflare, reels, stories |
| 2026 (juin) | Infrastructure sponsors 4 emplacements opérationnels |
| 2026 (juin) | Stories créatives (effets, liens catalogue, boomerang) |
| 2026 (juin) | Recherche globale, map flyTo, filtres carte |
| 2026 (juin) | Conformité légale CGU/RGPD mises à jour |
| 2026 (juin) | Environnement staging opérationnel |
| 2026 (juin) | Dossier brevet préparatoire (`docs/brevet/`) |
| 2026 (juin) | ~800+ entrées journal de modifications (`modification.txt`) |

---

## 14. ANNEXES TECHNIQUES

### 14.1 Modules backend principaux

```
backend/src/
├── routes/          → API REST (users, salons, lives, reels, stories, sponsors, geo…)
├── lib/
│   ├── platformPlans.ts      → Plans Soundy+/Ultra
│   ├── reels.ts              → Logique reels
│   ├── stories.ts            → Logique stories
│   ├── livePublic.ts         → Lives publics
│   ├── contentModeration.ts  → Modération
│   └── objectStorage.ts      → S3 Scaleway
└── models/schema.ts → Schéma PostgreSQL
```

### 14.2 Modules frontend principaux

```
app/src/
├── components/
│   ├── MapView.tsx              → Carte centrale
│   ├── StoryViewer.tsx          → Viewer stories
│   ├── ProfileReelRecorder.tsx  → Enregistrement reels
│   ├── AdminSponsorsTab.tsx     → Admin sponsors
│   └── MainTabNav.tsx           → Navigation 5 onglets
├── lib/
│   ├── salonPlayback.ts         → Sync client salons
│   ├── storyCreativeEffects.ts  → Effets stories
│   ├── mapSearchIntent.ts       → Intent recherche carte
│   └── globalSearch.ts          → Recherche globale
├── content/legal/               → Documents légaux
└── pages/                       → Pages application
```

### 14.3 Application mobile iOS et Android

- **Plateformes :** **iOS** (App Store) et **Android** (Google Play)
- **Bundle ID :** `com.soundy.app`
- **Nom affiché store :** Soundy
- **Technologie :** Capacitor 8, WebView partageant `app/src/` (code identique à la PWA)
- **Statut :** builds natifs opérationnels ; **publication sur les stores prévue** (soumission App Store + Google Play)

### 14.4 Références documentaires internes

| Document | Chemin |
|----------|--------|
| Pitch deck | `docs/Soundy-Pitch-Deck.md` |
| Plan sponsoring | `docs/PLAN-SPONSORING-PAYANT.md` |
| Stack cible | `docs/STACK-CIBLE.md` |
| Infrastructure | `docs/INFRA-SOUNDY.md` |
| Environnements | `docs/ENVIRONNEMENTS.md` |
| Dossier brevet | `docs/brevet/` |
| Journal modifications | `modification.txt` |
| Rapport légal | `LEGAL_REPORT.md` |

---

## DÉCLARATION DE L’AUTEUR

Je soussigné(e), **Valentin Goulven**, déclare être l’auteur de l’application **Soundy** et de la documentation qui en décrit l’architecture, les fonctionnalités et le modèle économique, tels que présentés dans ce document à la date du **29 juin 2026**.

Ce document a été établi à partir du dépôt source Soundy situé au chemin local `C:\Dev\Soundy` et reflète l’état du produit accessible publiquement sur **https://getsoundy.com**.

---

**FIN DU DOCUMENT**

*Document généré pour dépôt e-Soleau INPI — Soundy — 29 juin 2026*
