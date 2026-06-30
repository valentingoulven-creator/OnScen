# Dossier de préparation brevet — Soundly / MeloSong

> **Date de création du dossier :** juin 2026  
> **Statut :** BROUILLONS TECHNIQUES — **PAS DE CONSEIL JURIDIQUE**

---

## ⚠️ Avertissement essentiel

Les documents de ce dossier (`01` à `07`) ont été **générés automatiquement à partir du code source** de l'application Soundly/MeloSong. Ils constituent une **aide à la divulgation technique** destinée à faciliter un échange avec un professionnel qualifié.

**Vous n'êtes PAS couvert par un avocat ou un mandataire en propriété industrielle (CPI) tant que vous n'en avez pas consulté un.**

- Aucune garantie de brevetabilité n'est donnée.
- Aucune revendication de ce dossier n'a valeur juridique sans relecture professionnelle.
- Les coûts, délais et stratégies indiqués sont des ordres de grandeur indicatifs (2026).

---

## Limites des brevets logiciels en Union européenne / France

En Europe, l'**article 52 de la Convention sur le brevet européen (CBE)** exclut notamment :

- les **programmes d'ordinateur en tant que tels** ;
- les **méthodes commerciales** et activités intellectuelles ;
- les présentations d'information.

Un brevet peut toutefois être accordé si l'invention produit un **effet technique** au-delà de l'implémentation logicielle « évidente » sur du matériel générique (ordinateur, réseau, serveur standard).

**Conséquences pour Soundly/MeloSong :**

| Fonctionnalité | Risque de non-brevetabilité (UE) |
|---|---|
| « Écouter de la musique ensemble » (concept social) | **Élevé** — idée d'usage, pas effet technique |
| Chat, likes, profils, fil d'actualité | **Élevé** — fonctionnalités sociales connues |
| Carte géolocalisée montrant des utilisateurs | **Moyen à élevé** — antériorité (Snap Map, Zenly, etc.) |
| Synchronisation audio via horloge partagée + WebSocket | **Moyen** — techniques connues (Watch2Gether, Discord activities, Spotify Jam) |
| Relay WebRTC mesh hôte→spectateurs | **Moyen** — WebRTC + signalisation Socket.io est standard |
| Résolution cross-plateforme titre/artiste → trackId | **Moyen à élevé** — matching métadonnées classique |
| **Combinaison** carte + salons synchronisés + double UI petit/grand salon + horloge + WebRTC live | **À évaluer par CPI** — pourrait constituer une invention technique **si** l'effet technique (réduction de dérive, continuité d'écoute lors du changement de mode UI, etc.) est démontré de façon nouvelle et non évidente |

**En résumé :** un brevet « global » sur « une app sociale musicale sur carte » est **peu probable** en France/UE. Des **revendications techniques ciblées** (ex. algorithme de fusion d'état de lecture, correction de dérive hôte) ont une chance **limitée** et dépendent fortement de l'antériorité.

---

## Étapes recommandées

### 1. Recherche d'antériorité (obligatoire avant dépôt)

- Consulter le guide : [`06-Recherche-antériorité-guide.md`](./06-Recherche-antériorité-guide.md)
- Bases : [Espacenet](https://worldwide.espacenet.com), [INPI](https://bases-brevets.inpi.fr), Google Patents
- Documenter les brevets et produits proches trouvés **avant** de rédiger les revendications finales

### 2. Choisir la stratégie de protection

| Option | Objet | Coût indicatif (2026) | Protection |
|---|---|---|---|
| **e-Soleau INPI** | Preuve de date d'existence d'un document (code, description) | **~15 €** (dépôt électronique) | **Aucune** exclusivité — seulement horodatage |
| **Brevet provisoire (US)** | Dépôt américain provisoire (si stratégie US) | ~1 500–3 000 $ + mandataire | 12 mois pour déposer un brevet complet US |
| **Brevet INPI (France)** | Demande de brevet national | **~36 €** (taxes INPI seules, dépôt électronique) + **600–2 000 €+** mandataire CPI pour rédaction | 20 ans si accordé (après examen) |
| **Brevet européen (EPO)** | Demande EPO puis validation nationale | **1 000–5 000 €+** (hors validation par pays) | Plus large géographiquement |

### 3. Dépôt

- Checklist : [`07-Checklist-depot-INPI.md`](./07-Checklist-depot-INPI.md)
- Délai **12 mois** (priorité) pour étendre un premier dépôt (France → international / PCT)

### 4. Consultation CPI / avocat PI

Apporter à la consultation :

1. [`01-Declaration-invention.md`](./01-Declaration-invention.md)
2. [`02-Description-detaillee.md`](./02-Description-detaillee.md)
3. [`03-Revendications-preliminaires.md`](./03-Revendications-preliminaires.md)
4. Résultats de recherche d'antériorité
5. Date de **première divulgation publique** (voir section ci-dessous)

---

## e-Soleau vs brevet — quand choisir quoi ?

### e-Soleau INPI

- **Utile pour :** prouver que vous aviez telle description / tel code à telle date (litige, négociation, preuve d'auteur).
- **Ne protège pas** contre la copie.
- **Recommandé si :** budget limité, incertitude sur la brevetabilité, besoin urgent d'horodater avant une démo publique.

### Brevet

- **Utile pour :** droit d'interdire l'exploitation commerciale d'une invention **brevetable et accordée**.
- **Coûteux** en temps et en argent (dépôt, examen, annuités, mandataire).
- **Recommandé si :** recherche d'antériorité favorable + effet technique démontré + stratégie commerciale / levée de fonds justifiant l'investissement.

**Suggestion pragmatique pour MeloSong :** déposer un **e-Soleau** immédiatement si l'app est déjà visible publiquement, **puis** consulter un CPI avec ce dossier pour évaluer 1–3 revendications techniques ciblées.

---

## Risque de nouveauté — divulgation publique

> **ATTENTION :** Si l'application, une démo vidéo, un dépôt GitHub public, un pitch ou une présentation ont été **accessibles au public avant le dépôt**, cela peut **détruire la nouveauté** requise pour un brevet (délai de grâce variable selon pays ; **pas de grâce en Europe** pour la plupart des cas).

Remplir impérativement la section « Date de première divulgation » dans [`01-Declaration-invention.md`](./01-Declaration-invention.md).

---

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `00-LISEZMOI-IMPORTANT.md` | Ce document |
| `01-Declaration-invention.md` | Formulaire de divulgation d'invention |
| `02-Description-detaillee.md` | Description technique type brevet |
| `03-Revendications-preliminaires.md` | Brouillon de revendications |
| `04-Abrege.md` | Abrégé (≤ 150 mots) |
| `05-Figures-description.md` | Descriptions de figures + diagrammes Mermaid |
| `06-Recherche-antériorité-guide.md` | Guide de recherche antériorité |
| `07-Checklist-depot-INPI.md` | Checklist dépôt INPI |

---

## Contacts utiles (France)

- **INPI** — dépôt brevet / e-Soleau : [https://www.inpi.fr](https://www.inpi.fr)
- **EPO (Office européen des brevets)** : [https://www.epo.org](https://www.epo.org)
- **Annuaire CPI** (conseils en propriété industrielle) : recherche « mandataire brevet » + ville

---

*Document généré à partir de l'audit du dépôt `MeloSong Dev`. À mettre à jour après chaque évolution majeure de l'architecture.*
