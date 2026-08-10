# Guide de recherche d'antériorité

> À réaliser **avant** tout dépôt de brevet — ou en parallèle d'une consultation CPI  
> Durée indicative : 4–12 heures pour une première passe

---

## 1. Objectif

Identifier les documents publics (brevets, demandes, articles, produits) qui pourraient :

- **anticiper** les éléments techniques de OnScen ;
- **détruire la nouveauté** (divulgation antérieure) ;
- **rendre l'invention évidente** pour l'examinateur.

Sans recherche sérieuse, un dépôt brevet a une forte probabilité de **rejet** ou de **revocation** ultérieure.

---

## 2. Bases de données

| Base | URL | Usage |
|---|---|---|
| **Espacenet** (EPO) | https://worldwide.espacenet.com | Brevets mondiaux, recherche avancée CPC/IPC |
| **INPI** | https://bases-brevets.inpi.fr | Brevets français |
| **Google Patents** | https://patents.google.com | Recherche rapide, familles de brevets |
| **WIPO PATENTSCOPE** | https://patentscope.wipo.int | Dépôts PCT internationaux |
| **USPTO** | https://ppubs.uspto.gov/pubwebapp/ | Brevets américains (si stratégie US) |

### Recherche produits / non-brevets (antériorité « non brevet »)

- Documentation : Discord Activities, Spotify Jam, Twitch, Watch2Gether, Teleparty, Zenly, Snap Map
- Articles techniques : « synchronized playback websocket », « YouTube sync party »
- GitHub : `socket.io sync playback`, `webrtc mesh signaling`

---

## 3. Mots-clés suggérés

### Anglais (prioritaires pour Espacenet)

**Horloge / sync :**

```
synchronized media playback
shared playback state timestamp
distributed audio synchronization client
websocket playback position sync
drift correction media player
host listener playback clock
merge playback state metadata
```

**Géo + social :**

```
geolocation music listening session map
location privacy blurred coordinates social map
nearby live audio session map
```

**WebRTC + musique :**

```
webrtc live signaling socket.io
parallel audio sync video live stream
mesh webrtc host viewer limit
```

**Cross-platform :**

```
cross platform track resolution title artist
spotify youtube track matching
```

### Français (INPI)

```
synchronisation lecture audio temps réel
horloge partagée lecture multimédia
salon écoute géolocalisé
carte sessions musique proximité
```

### Codes CPC / IPC à explorer

| Code | Domaine |
|---|---|
| **H04L 65/** | Réseaux multimédias, WebRTC |
| **H04L 67/1095** | Protocoles temps réel (WebSocket) |
| **H04L 67/306** | Services sociaux réseau |
| **G06F 3/16** | Transfert de données audio |
| **G06Q 50/10** | Réseaux sociaux (attention : exclusions UE) |

---

## 4. Méthodologie pas à pas

### Étape 1 — Recherche large (2 h)

1. Espacenet → Recherche avancée :
   ```
   ta:"synchronized playback" AND ta:websocket
   ```
2. Noter les 20 premiers résultats pertinents (numéro, titre, date, assignee).

### Étape 2 — Recherche ciblée horloge (2 h)

```
(synchroni* NEAR playback) AND (drift OR clock OR timestamp OR seek)
```

Filtrer dates : prioriser **2015–2026**.

Lire les **revendications indépendantes** des 5 brevets les plus proches.

### Étape 3 — Concurrents produits (1 h)

| Produit | Question à répondre | Source |
|---|---|---|
| Watch2Gether | Comment sync le timestamp ? | Site + FAQ |
| Teleparty | Algorithme de sync ? | Blog technique |
| Spotify Jam | Architecture ? | Support Spotify |
| Discord | Activities / Listen Along | Documentation |
| Apple SharePlay | Sync mechanism | WWDC / brevets Apple |

### Étape 4 — Recherche WebRTC (1 h)

```
webrtc AND signaling AND (offer OR ice) AND viewer AND host
```

Comparer avec `validateLiveWebrtcSignal` — la validation directionnelle est-elle nouvelle ?

### Étape 5 — Carte + musique (1 h)

```
(map OR geolocation) AND (music OR audio) AND (listen* OR session)
```

### Étape 6 — Synthèse (1 h)

Remplir le tableau ci-dessous et le transmettre au CPI.

---

## 5. Grille de synthèse (à compléter)

| # | Référence (brevet / produit) | Date | Éléments communs | Différences vs OnScen | Impact nouveauté |
|---|---|---|---|---|---|
| 1 | `[À COMPLÉTER]` | | | | Faible / Moyen / Fort |
| 2 | | | | | |
| 3 | | | | | |
| … | | | | | |

**Légende impact :**

- **Fort** : antériorité directe sur revendication ciblée
- **Moyen** : même domaine, différences notables
- **Faible** : éloigné techniquement

---

## 6. Antériorités probables (hypothèses à vérifier)

> Ces éléments sont **suspects** d'antériorité — la recherche doit confirmer ou infirmer.

| Fonctionnalité OnScen | Antériorité suspectée |
|---|---|
| Horloge `progressMs + startedAt` | Sync par timestamp serveur (nombreux brevets streaming) |
| Correction dérive client | Lecteurs vidéo synchronisés (Teleparty, etc.) |
| Socket.IO rooms | Pattern standard |
| WebRTC mesh + Socket signalisation | Très répandu (open source) |
| Carte sociale géo | Snap, Zenly, Google Maps live location |
| Cross-platform title→trackId | Services de métadonnées music (Gracenote, etc.) |
| Petit/grand salon UI | Pattern UX mobile (bottom sheet) — **faible valeur technique** |

---

## 7. Recherche sur divulgations OnScen (nouveauté)

Documenter **toutes** les divulgations par l'inventeur :

| Date | Type | URL / lieu | Contenu divulgué |
|---|---|---|---|
| `[À COMPLÉTER]` | Git public / privé | | |
| | Démo | | |
| | Store / PWA | | |
| | Réseaux sociaux | | |
| | Pitch investisseur | | |

En Europe, une divulgation publique **avant dépôt** détruit généralement la nouveauté **sans délai de grâce**.

---

## 8. Outils complémentaires

- **Lens.org** — https://www.lens.org (analytics brevets)
- **Semantic Scholar** — articles académiques sync multimédia
- **Wayback Machine** — https://web.archive.org (dates de mise en ligne produits)

---

## 9. Livrables attendus pour le CPI

1. Tableau synthèse (§5) avec ≥ 15 entrées analysées
2. PDF des 3–5 brevets les plus proches (revendications + description pertinente)
3. Liste des divulgations propres (§7)
4. Avis préliminaire : « poursuivre brevet » / « e-Soleau seulement » / « revendications à réduire à … »

---

*La recherche d'antériorité n'est pas un acte juridique ; un mandataire peut commander une recherche professionnelle payante (≈ 500–1 500 €).*
