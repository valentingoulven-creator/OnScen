# Phase 3 — PostGIS & géolocalisation

**Date :** 2026-08-10  
**Périmètre :** `db/migrations/023_postgis_geo.sql`, `lib/postgisConfig.ts`, `routes/geo.ts`, `lib/nearbyPeople.ts`, `lib/geo.ts`

---

## 3.1 Extension & index spatiaux

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Extension | Migration `023` : `CREATE EXTENSION postgis`, colonnes `geom geography(POINT,4326)` sur `users`, `salons`, `lives` | faible | Vérifier extension active sur instance Scaleway prod |
| Index GiST | `users_geom_gist_idx`, `salons_geom_gist_idx`, `lives_geom_gist_idx` (partial `WHERE geom IS NOT NULL`) | faible | Maintenir ; `ANALYZE` après gros backfill |
| Fallback | Si PostGIS absent : warning boot + scan RAM (`nearbyPeople.ts`, `geo.ts`) | **élevé** à >100k entités | Alerte admin si `postgis.enabled === false` en prod |

---

## 3.2 Précision stockée vs besoin métier

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Stockage | Lat/lng précis + `geom` pour requêtes ; commentaire migration 002 : index simple sans PostGIS suffisant ~100k salons | **moyen** | Politique de rétention / arrondi au stockage (ex. 3 décimales) pour comptes non hôtes live |
| Affichage | `blurCoordinate()` — jitter ~50 m pour positions « publiques » ; distance affichée en km | faible | Documenter dans DPIA ; ne pas exposer lat/lng brutes dans API publique (revue routes) |
| Mineurs | Pas de restriction code évidente désactivant geo fine pour <18 (cf. phase 11) | **élevé** | Forcer rayon flou / opt-in parental pour mineurs |

---

## 3.3 Requêtes de proximité & performance

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Requête | Préfiltre SQL `ST_DWithin(geom, …)` puis filtrage métier | faible si PostGIS ON | Benchmark avec EXPLAIN ANALYZE sur rayon 5–50 km |
| Rate limits | `geoUpdateLimiter`, `nearbyAnonLimiter`, `nearbyAuthLimiter` sur routes geo | faible | Ajuster plafonds si abus carto |
| msdev | Comportement identique — facile de tester sans PostGIS | faible | CI optionnel job avec PostGIS docker |

---

## 3.4 Anonymisation / RGPD

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| UX | Carte « à X km » plutôt que adresse exacte (i18n + logique distance) | faible | — |
| Export / suppression | Droits RGPD implémentés côté compte ; coordonnées dans payload user | **moyen** | Vérifier purge `geom` à la suppression compte |
| Historique | Positions passées peu archivées séparément (store) | **moyen** | Politique conservation geo explicite dans privacy |

---

## 3.5 Synthèse phase 3

PostGIS **bien conçu dans le code** ; risques = **fallback RAM en prod**, **geo fine mineurs**, **gouvernance précision stockée**.
