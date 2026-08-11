# Phase 3 — PostGIS & géolocalisation

**Date :** 2026-08-10 (rafraîchi 2026-08-11)  
**Périmètre :** `db/migrations/023_postgis_geo.sql`, `lib/postgisConfig.ts`, `routes/geo.ts`, `lib/nearbyPeople.ts`, `lib/geo.ts`, `lib/locationPrivacy.ts`, `lib/ageGates.ts`

> **Rafraîchissement 2026-08-11** : la restriction géo mineurs recommandée en §3.2 a été implémentée depuis (working tree, non déployée) — voir mise à jour ci-dessous. Une régression de test liée à ce changement a aussi été identifiée (cf. [01-stack §1.5](./01-stack.md)).
>
> **Correctif appliqué 2026-08-11 (MODIF 1352)** : requête PostgreSQL prod en lecture seule → 418/439 comptes actifs (95 %) sans `birthDate` ni `age`. La politique a été corrigée pour ne restreindre que les mineurs **confirmés** (âge connu < 18) — voir mise à jour §3.2.

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
| Mineurs | ✅ **Implémenté depuis le 08-10** (`ageGates.GEO_PRECISE_MIN_AGE = 18`, `locationPrivacy.enforceMinorGeoPolicy` / `userRequiresCityOnlyGeo`) : les comptes < 18 ans **confirmés** sont forcés en précision « ville » (`locationPrecision = 'city'`), sans GPS live, appliqué à l'inscription (`auth.ts`/`oauth.ts`) et au changement de préférences (`applyPrivacySettings`) | résolu (code) | Confirmer le **déploiement prod** (actuellement working tree uniquement) ; ajouter un test E2E « mineur ne peut pas activer géo précise » |
| ✅ Âge inconnu | **Résolu 08-11.** La requête prod en lecture seule confirme **418/439 comptes actifs (95 %) sans `birthDate` ni `age`**. La logique initiale (âge inconnu = traité comme mineur) aurait dégradé silencieusement la précision géo de la quasi-totalité des comptes existants. **Corrigé** (`userIsKnownMinorForPreciseGeo`, MODIF 1352) : seuls les mineurs **confirmés** (âge connu < 18) sont restreints ; les comptes à âge inconnu conservent leur précision géo actuelle (grandfathering). Recommandation produit conservée : campagne de collecte DOB progressive (bandeau profil) pour réduire ce volume dans le temps — non implémentée (choix produit/UX, hors scope technique) | résolu (technique) — campagne de collecte DOB = décision produit ouverte | Envisager un bandeau non bloquant incitant les comptes legacy à renseigner leur date de naissance |

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

PostGIS **bien conçu dans le code** ; risques résiduels = **fallback RAM en prod**, **gouvernance précision stockée**.

**Mise à jour 2026-08-11 :** la restriction géo mineurs (E2 de la synthèse) est **implémentée** dans le code (non déployée). Le risque de régression sur les comptes « âge inconnu » (quantifié à 95 % des comptes actifs) a été **corrigé** avant tout déploiement — voir §3.2.
