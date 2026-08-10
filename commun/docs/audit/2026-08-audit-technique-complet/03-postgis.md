# Audit technique OnScen — Phase 3 : PostGIS & géolocalisation

**Date :** 2026-08-07
**Méthode :** revue exhaustive de `commun/backend/src/db/migrations/023_postgis_geo.sql`, `lib/{geo,postgisConfig,pgGeoNearby,pgGeoBackfill,locationPrivacy,nearbyPeople,pgUsers,pgSalonsLives}.ts`, `routes/{geo,salons,lives,feed}.ts`, `web/app/src/content/legal/{privacy,rgpd,dpia,terms}.ts`.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

---

## 3.1 PostGIS activé et utilisé ?

**Constat :** ✅ Oui, réellement câblé, pas un vestige de code mort.

- `CREATE EXTENSION IF NOT EXISTS postgis;` — `023_postgis_geo.sql:4`
- Colonnes `geography(POINT, 4326)` sur `users.geom`, `salons.geom`, `lives.geom` (`023:9,29,41`), dérivées de `latitude`/`longitude` via `ST_SetSRID(ST_MakePoint(...))::geography`.
- Activation runtime conditionnelle : `initPostGis()` au boot (`bootstrap.ts:313`), détection `pg_extension` + `PostGIS_Version()` (`postgisConfig.ts:7-33`).
- Si l'extension est absente sur l'instance PostgreSQL, repli automatique sur un scan en mémoire (`postgisConfig.ts:18-19`).

**Risque : 🟢 Conforme.** Point de vigilance 🟡 moyen : dépendance à la disponibilité réelle de l'extension côté Scaleway Managed Database — un fallback existe mais dégrade les performances à l'échelle (voir §3.4).

---

## 3.2 Index spatiaux GIST

**Constat :**

| Table | Colonne | Index GIST | Fichier |
|---|---|---|---|
| `users` | `geom` | ✅ `users_geom_gist_idx` (partiel `WHERE geom IS NOT NULL`) | `023:25-26` |
| `salons` | `geom` | ✅ `salons_geom_gist_idx` | `023:37-38` |
| `lives` | `geom` | ✅ `lives_geom_gist_idx` | `023:49-50` |
| `salons`/`lives` | `latitude`,`longitude` | B-tree (non GIST, précurseur historique) | `002_complete_schema.sql:22-23,43-44` |
| `major_cities` | `latitude`,`longitude` | B-tree uniquement, pas de colonne `geography` | `021_major_cities.sql:14` |

**Risque : 🟢 Conforme** pour le chemin nearby PostGIS (les 3 tables réellement utilisées pour les requêtes de proximité ont toutes leur index GIST).

---

## 3.3 Précision de géolocalisation stockée vs nécessaire (RGPD)

**Constat :**
- **La position GPS exacte est stockée en base** (`users.latitude`/`longitude` + `geom` dérivé de la position précise) — nécessaire techniquement pour permettre les calculs de proximité, mais représente une donnée sensible conservée en clair.
- Une **version floutée** est calculée en parallèle (`blurredLatitude`/`blurredLongitude`) via un offset aléatoire :

```15:18:commun/backend/src/lib/geo.ts
/** Random offset ~50m for privacy */
export function blurCoordinate(coord: number): number {
  const offset = (Math.random() - 0.5) * 2 * 0.00045;
  return coord + offset;
}
```

- Amplitude ≈ ±50 m, recalculée **aléatoirement à chaque mise à jour de position** (`POST /geo/update` → `refreshUserPublicCoords`).
- Mode « ville » disponible (centre-ville au lieu de position précise) mais **désactivé dès qu'un GPS live a été reçu** (`locationPrivacy.ts:279-282`) — écart avec la documentation légale qui suggère un mode ville plus systématique.

**Risque : 🟠 Élevé** — deux problèmes distincts :
1. **Stockage de la position exacte** en base (nécessaire au service mais non minimisé — un accès DB compromis exposerait la position réelle de tous les utilisateurs, pas seulement la version floutée).
2. **Re-floutage aléatoire à chaque update** : un observateur qui interroge répétitivement la position floutée d'un même utilisateur peut statistiquement moyenner plusieurs échantillons et se rapprocher de la position réelle (**triangulation par répétition**) — le flou n'est pas stable/persistant par session.

**Recommandation :**
- Envisager un flou **déterministe et stable** (dérivé d'un seed par utilisateur, recalculé uniquement à intervalle long) plutôt qu'aléatoire à chaque update, pour empêcher la triangulation statistique.
- Réduire la durée de rétention de la position précise en base (purge/rotation) si elle n'est pas strictement nécessaire au-delà de la session active.
- Revoir la condition qui désactive le mode ville dès réception d'un GPS live, pour l'aligner avec la promesse faite dans la politique de confidentialité.

---

## 3.4 Requêtes de proximité — performance à l'échelle

**Constat :** approche **hybride** — préfiltre PostGIS (`ST_DWithin`/`ST_Distance`) puis filtrage/tri final par Haversine en mémoire (JS) sur les coordonnées publiques déjà réduites par le préfiltre.

- Route principale : `GET /geo/nearby` (`routes/geo.ts:173-310`) → `loadNearbyGeoCandidates` (`pgGeoNearby.ts:14-143`) utilise `ST_DWithin`/`ST_Distance`/`ST_MakePoint`.
- **Pas d'opérateur KNN `<->`** (tri par plus-proche-voisin natif PostGIS) — le tri final se fait en JS après le préfiltre géographique.
- **Fallback complet en scan mémoire** si PostGIS est indisponible ou si `distanceFilter=false` (pas de rayon défini) — `geo.ts:212,218-219`, `nearbyPeople.ts:126-127`.

**Risque : 🟡 Moyen** — l'architecture est correcte pour le volume actuel (préfiltre géographique avant tout calcul coûteux), mais deux angles morts à l'échelle : (1) absence d'opérateur KNN natif pour les tris de type "N personnes les plus proches" sur de très gros volumes, (2) le mode sans filtre de distance (`distanceFilter=false`) déclenche un scan complet côté application.

**Recommandation :** utiliser l'opérateur `<->` PostGIS pour les cas de tri par proximité pure (déjà indexable par le GIST existant) ; plafonner ou interdire `distanceFilter=false` sur les datasets à fort volume.

---

## 3.5 Exposition publique — précision affichée aux tiers

**Constat :** ✅ globalement conforme — aucune API publique ne renvoie directement les coordonnées exactes à un tiers (hors propriétaire du compte lui-même).

| Surface | Donnée renvoyée |
|---|---|
| `POST /geo/update` (réponse à l'appelant) | Uniquement coordonnées **floutées**, même au propriétaire (`geo.ts:85-88,115-118`) |
| `GET /geo/nearby` (salons/lives/personnes) | Coordonnées publiques via `getPublicMapCoords`/`getUserPublicCoords` : précises **seulement** si le viewer est le propriétaire, sinon centre-ville ou floutées | `locationPrivacy.ts:266-304` |
| Feed socket | Coordonnées floutées uniquement (commentaire explicite dans le code) | `feed.ts:119-130` |
| Distance affichée | Arrondie à 0,1 km si `shareDistance` activé | `nearbyPeople.ts:170,232,254` |

**Risque : 🟡 Moyen résiduel** — pas de fuite directe de coordonnées brutes, mais le préfiltre PostGIS interroge la position **exacte** côté serveur ; des requêtes répétées avec des rayons variables pourraient théoriquement permettre une inférence de position (trilatération par variation de rayon), un vecteur d'attaque plus sophistiqué que la lecture directe mais non nul.

---

## 3.6 Mentions RGPD / minimisation dans la documentation légale

**Constat :** ✅ le sujet est **documenté** (pas un angle mort juridique), avec un écart factuel entre la doc et le comportement runtime.

| Document | Contenu |
|---|---|
| `privacy.ts` | Géolocalisation GPS + position floutée + précision ville/~50m + mode fantôme |
| `rgpd.ts` | Section dédiée « Minimisation et privacy by design » |
| `dpia.ts` | Modèle d'analyse d'impact (AIPD) géolocalisation — statut **« MODÈLE À COMPLÉTER »**, pas finalisé |
| `terms.ts` | §6 Géolocalisation et visibilité |

**Écart identifié :** la documentation affirme que la position brute n'est « jamais divulguée » et que le mode ville s'applique par défaut ; le code **contourne le mode ville dès qu'un GPS live existe** (`locationPrivacy.ts:279-282`), ce qui contredit partiellement la promesse utilisateur.

**Risque : 🟡 Moyen** (transparence documentaire, pas absence de documentation).

**Recommandation :** finaliser l'AIPD géolocalisation (actuellement un modèle non complété — à faire remplir/valider par le DPO/fondateur) ; aligner le texte legal sur le comportement réel du mode ville.

---

## Synthèse des risques — Phase 3

| # | Sujet | Risque | Effort |
|---|---|---|---|
| GEO-1 | PostGIS activé, index GIST en place | 🟢 Conforme | — |
| GEO-2 | Position GPS exacte stockée en base (nécessaire mais non minimisée) | 🟠 Élevé | M |
| GEO-3 | Flou aléatoire recalculé à chaque update → triangulation possible par répétition | 🟠 Élevé | M |
| GEO-4 | Mode ville contourné dès réception GPS live (écart vs doc légale) | 🟡 Moyen | S |
| GEO-5 | Pas d'opérateur KNN natif, fallback scan complet si pas de filtre de distance | 🟡 Moyen | M |
| GEO-6 | AIPD géolocalisation non finalisée (modèle vide) | 🟡 Moyen | M (juridique) |
