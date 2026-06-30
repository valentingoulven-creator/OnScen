# Revendications préliminaires (brouillon)

> **ATTENTION :** Ces revendications sont un **point de départ conservateur** pour discussion avec un CPI.  
> Elles n'ont **pas** été validées par recherche d'antériorité complète.  
> Un mandataire réécrira probablement tout ou partie de ce texte.

---

## Revendication 1 (indépendante — système)

**Système** de synchronisation d'écoute multimédia comprenant :

- un serveur de coordination (100) configuré pour maintenir, pour au moins un salon d'écoute (200), un état de lecture (250) comprenant une position de référence en millisecondes (`progressMs`), un indicateur de lecture (`isPlaying`), un horodatage de mise à jour (`updatedAt`) et, lorsque ledit indicateur est actif, un horodatage d'ancrage de lecture (`startedAt`) ;

- une interface de communication temps réel configurée pour propager ledit état de lecture (250) vers une pluralité de clients (300) associés audit salon (200) ;

- au moins un premier client agissant en qualité d'hôte (220) et configuré pour transmettre au serveur (100) des modifications partielles dudit état de lecture (250) ;

- ledit serveur (100) étant configuré pour fusionner lesdites modifications partielles et diffuser l'état résultant ;

- chacun desdits clients (300) comprenant un module de calcul (260) configuré pour déterminer une position de lecture courante en additionnant ladite position de référence et un écart temporel dérivé de l'horodatage d'ancrage lorsque l'indicateur de lecture est actif ;

**caractérisé en ce que** au moins un client auditeur (230) comprend un module lecteur (300) exécutant un lecteur multimédia local et un module de correction de dérive (320) configuré pour, à intervalles périodiques, comparer une position fournie par ledit lecteur multimédia local à ladite position de lecture courante calculée et commander un repositionnement du lecteur local lorsque l'écart dépasse un seuil prédéterminé.

---

## Revendication 2 (indépendante — méthode)

**Méthode** de synchronisation d'écoute multimédia entre un hôte (220) et au moins un auditeur (230), comprenant les étapes de :

- a) maintenir sur un serveur (100) un état de lecture (250) comprenant une position de référence, un indicateur de lecture et au moins un horodatage d'ancrage ;

- b) recevoir, de la part de l'hôte (220), une modification partielle de l'état de lecture ;

- c) fusionner ladite modification avec l'état maintenu et diffuser l'état fusionné aux auditeurs via un canal temps réel ;

- d) calculer, sur chaque auditeur (230), une position courante à partir de l'état reçu et d'une horloge locale ;

- e) comparer périodiquement la position courante calculée à une position d'un lecteur multimédia local ;

- f) repositionner le lecteur local lorsque l'écart excède un seuil ;

**caractérisée en ce que** l'hôte (220) exécute en outre une étape de rapport de progression comprenant la transmission d'une correction d'horodatage au serveur (100) **uniquement** lorsque la position du lecteur local de l'hôte dépasse la position courante calculée d'une marge prédéterminée, de sorte à éviter une régression cyclique de l'état de lecture diffusé.

---

## Revendication 3 (indépendante — produit programme)

**Support d'enregistrement** lisible par un processeur, sur lequel est enregistré un programme d'ordinateur qui, lorsqu'il est exécuté par ledit processeur, met en œuvre la méthode selon la revendication 2.

---

## Revendications dépendantes

### Revendication 4

Système selon la revendication 1, **caractérisé en ce que** chaque client (300) comprend un module de fusion d'état (280) configuré pour :

- remplacer intégralement l'état local par un état distant reçu lorsqu'une modification de piste, de statut lecture/pause ou de position de référence est détectée ;

- conserver l'horodatage d'ancrage local et mettre à jour uniquement des métadonnées non temporelles lorsqu'aucune modification temporelle n'est détectée.

### Revendication 5

Système selon la revendication 1 ou 4, **caractérisé en ce que** ledit salon d'écoute (200) est associé à des coordonnées géographiques précises et à des coordonnées publiques floues, et en ce que le serveur (100) fournit, à un client requérant (300), les coordonnées précises lorsque le requérant est l'hôte du salon et les coordonnées floues sinon.

### Revendication 6

Système selon la revendication 5, **caractérisé en ce qu'un** module cartographique (500) affiche une icône du salon (200) aux coordonnées publiques et permet à un auditeur (230) de rejoindre le salon et d'initialiser le module lecteur (300) avec l'état de lecture (250) diffusé sans ouvrir une vue dédiée plein écran.

### Revendication 7

Système selon la revendication 6, **caractérisé en ce que** l'auditeur (230) peut basculer d'une première interface compacte (410) affichée en surcouche d'une carte à une seconde interface immersive (420) associée au même identifiant de salon et à la même session de communication temps réel, sans réinitialiser l'état de lecture (250).

### Revendication 8

Système selon la revendication 1, **caractérisé en ce qu'un** live vidéo (700) associé au salon (200) comprend :

- un module de signalisation WebRTC relayant des messages offer, answer et ice entre un hôte et des spectateurs via le serveur (100) avec validation du sens de transmission ;

- une diffusion parallèle de l'état de lecture (250) vers une room de spectateurs live distincte de la room du salon.

### Revendication 9

Méthode selon la revendication 2, **caractérisée en ce que** l'étape c) comprend la diffusion simultanée vers une première room associée au salon et, lorsqu'un live est actif pour le même identifiant, vers une seconde room associée audit live.

### Revendication 10

Système selon la revendication 1, **caractérisé en ce que**, pour un auditeur (230) utilisant une plateforme de streaming différente de celle de l'hôte (220), un module de résolution (600) détermine un identifiant de piste cible à partir d'un titre et d'un artiste de l'état de lecture (250) et le lecteur local de l'auditeur est initialisé avec ledit identifiant tout en utilisant la position courante calculée par le module (260).

### Revendication 11

Système selon la revendication 1, **caractérisé en ce que** seul le client hôte (220) est autorisé à émettre des modifications d'état de lecture et le serveur (100) rejette les tentatives émanant d'autres clients.

### Revendication 12

Méthode selon la revendication 2, **caractérisée en ce que** le seuil de l'étape f) et l'intervalle des étapes e) et de rapport de progression de l'hôte sont adaptés selon qu'un onglet navigateur du client est au premier plan ou en arrière-plan.

---

## Notes pour le mandataire

1. **Revendications 1–3** : cœur technique (horloge + dérive + heartbeat hôte) — prioriser la recherche d'antériorité sur ces éléments.

2. **Revendications 5–7** (carte + petit/grand salon) : risque élevé d'objection « programme en tant tel » / activité commerciale en UE — pourraient être retirées ou reformulées avec effet technique mesurable (ex. réduction de reconnexions socket).

3. **Revendication 8** (WebRTC) : antériorité nombreuse — utile surtout en combinaison avec revendication 1.

4. Envisager une **revendication indépendante** limitée au module de fusion (280) si la recherche montre de la nouveauté sur ce point précis.

5. **Double dépôt** : revendications système + méthode + produit programme est standard ; le CPI validera la stratégie.

---

*Ne pas utiliser pour un dépôt INPI sans relecture professionnelle.*
