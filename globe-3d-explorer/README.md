# 🌍 Globe 3D Explorer

Globe terrestre 3D interactif et réaliste, construit avec **React Three Fiber**
(React + Three.js). Pays cliquables avec surbrillance, infobulle, capitales,
recherche avec recentrage caméra, mode sombre/clair.

![Stack](https://img.shields.io/badge/stack-React%20%2B%20Three.js%20%2B%20TypeScript-5fb1ff)

## ✨ Fonctionnalités

- **Globe réaliste** : texture Terre haute résolution (jour), relief (bump map),
  reflet spéculaire sur les océans, fine couche de nuages, halo atmosphérique
  (shader Fresnel), fond étoilé équirectangulaire.
- **Contrôles caméra** : rotation à la souris/tactile, zoom (molette / pincer),
  bornes min/max pour ne jamais "sortir" du globe ou le traverser.
- **Pays cliquables** : survol → surbrillance jaune + infobulle avec le nom du
  pays ; clic → surbrillance persistante (orange) + recentrage caméra en douceur.
- **Recherche** : champ avec autocomplétion (tous les pays), validation →
  la caméra se déplace automatiquement pour cadrer le pays choisi.
- **Capitales** : ~195 capitales mondiales affichées comme marqueurs lumineux
  (un seul draw call, `InstancedMesh`).
- **Mode sombre / clair** : bascule instantanée de toute l'interface + teintes
  du globe (frontières, capitales, atmosphère).
- **Responsive** : interface adaptée mobile/tablette/desktop, cibles tactiles
  ≥ 44px, aucun scroll horizontal, `100dvh`/`100dvw`.
- **Architecture extensible** : chaque pays préparé (`PreparedCountry`) porte
  déjà nom, code ISO, polygones et centroïde — prêt à accueillir des données
  supplémentaires (météo, population, vols…) sans rien casser.

## 🧱 Stack technique

| Domaine       | Choix                                            |
|---------------|---------------------------------------------------|
| Rendu 3D      | [Three.js](https://threejs.org/) via [`@react-three/fiber`](https://docs.pmnd.rs/react-three-fiber) |
| Aides R3F     | [`@react-three/drei`](https://github.com/pmndrs/drei) (`OrbitControls`, `useTexture`, `Instances`, `useProgress`) |
| UI            | React 18 + CSS (aucune librairie de composants)   |
| Build         | Vite + TypeScript strict                           |
| Données pays  | GeoJSON Natural Earth 110m (domaine public)        |

Volontairement **aucune** librairie de gestion d'état (Redux/Zustand…) : un
simple `React Context` suffit pour l'état global (mode sombre, pays
sélectionné). Idem pour la triangulation des pays : `THREE.ShapeGeometry`
(déjà inclus dans `three`) remplace une dépendance externe type `earcut`.

## 📂 Structure du projet

```
globe-3d-explorer/
├── public/
│   ├── textures/        # Terre jour, relief, spéculaire, nuages, étoiles
│   └── data/             # countries-110m.geojson (frontières)
├── src/
│   ├── components/
│   │   ├── canvas/       # Tout ce qui est rendu par Three.js (globe, nuages…)
│   │   ├── ui/           # Recherche, panneau de contrôle, infobulle, chargement
│   │   └── GlobeExperience.tsx  # Orchestration scène 3D + UI
│   ├── context/          # État global (mode sombre, pays sélectionné)
│   ├── data/              # Données statiques (capitales)
│   ├── hooks/             # useCountriesData, useCameraFlyTo
│   ├── utils/             # Maths géo (lon/lat ↔ 3D), point-dans-polygone, géométrie pays
│   ├── constants.ts       # Rayons, distances caméra, couleurs, chemins textures
│   ├── types.ts           # Types partagés (GeoJSON, pays préparé, capitale…)
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
```

## 🚀 Installation et lancement

Prérequis : Node.js 18+ et npm.

```bash
cd globe-3d-explorer
npm install
npm run dev
```

L'application démarre sur **http://localhost:5183** (port dédié pour ne pas
entrer en conflit avec d'autres projets locaux).

Autres commandes :

```bash
npm run build     # Build de production (tsc -b + vite build) → dist/
npm run preview   # Sert le build de production localement
npm run lint       # ESLint
```

## 🧭 Comment ça marche (points clés)

- **Projection lon/lat → 3D** (`src/utils/geoMath.ts`) : formule alignée sur
  le mapping UV par défaut de `THREE.SphereGeometry`, garantissant que
  frontières, capitales et texture coïncident exactement.
- **Détection du pays sous le curseur** (`Earth.tsx`) : R3F fournit déjà le
  point d'intersection 3D du raycast ; on le convertit en lon/lat puis on
  teste un point-dans-polygone (algorithme *ray casting*, avec gestion propre
  de l'antiméridien pour la Russie, les Fidji, l'Alaska…).
- **Remplissage d'un pays** (`utils/countryGeometry.ts`) : triangulation à
  plat via `THREE.ShapeGeometry` (gère nativement les trous, ex. le Lesotho
  dans l'Afrique du Sud), puis reprojection de chaque sommet sur la sphère.
- **Frontières** : toutes fusionnées en une seule géométrie de segments — un
  unique draw call pour ~180 pays, essentiel pour rester fluide.
- **Recentrage caméra** (`hooks/useCameraFlyTo.ts`) : anime `camera.position`
  par interpolation exponentielle (indépendante du framerate) vers un point
  situé sur la normale du pays visé ; `OrbitControls` (dont la cible reste au
  centre du globe) s'aligne automatiquement dessus à chaque frame.
- **Infobulle performante** : le texte est piloté par React (re-rendu
  uniquement quand le pays survolé change), mais sa **position** est mise à
  jour de façon impérative (mutation directe du style DOM) à chaque mouvement
  de souris — aucun re-rendu React par pixel déplacé.

## 🔌 Étendre le projet

Le type `PreparedCountry` (`src/types.ts`) est le point d'extension naturel :

```ts
export interface PreparedCountry {
  name: string;
  isoA2?: string;
  polygons: LonLatPolygon[];
  centroid: { lon: number; lat: number };
  // → ajoutez ici : population?: number; weather?: WeatherSnapshot; flights?: FlightRoute[];
}
```

Idées de suite :
- **Météo** : appeler une API météo avec le centroïde de chaque pays au survol,
  afficher dans l'infobulle ou un panneau latéral.
- **Population / données socio-éco** : colorer les pays par intensité
  (choroplèthe) en réutilisant `CountryHighlight` avec une couleur dynamique.
- **Vols / trajets** : dessiner des arcs 3D entre capitales avec `QuadraticBezierLine` (drei).

## 📄 Licence des données

- Frontières : [Natural Earth](https://www.naturalearthdata.com/) (domaine public).
- Textures Terre/nuages/étoiles : compositions usuelles de démonstration
  Three.js/three-globe (libres d'usage pour ce type de projet).
