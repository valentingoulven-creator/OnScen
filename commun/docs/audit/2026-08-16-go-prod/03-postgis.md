# Phase 3 — PostGIS / géolocalisation

**Date :** 2026-08-16 · **Statut :** OK prod (extension) / politique âge = code  
**Niveau de preuve :** VÉRIFIÉ LIVE (`psql` via SSH, URL non affichée) + REPO

## Extension

Prod (2026-08-16) :

```
EXTENSIONS postgis
USERS_GIST t
```

`CREATE EXTENSION` + index `users_geom_gist_idx` **actifs**.  
Staging PostGIS : **NON VÉRIFIÉ** (script non relancé sur staging).

Migration : `commun/backend/src/db/migrations/023_postgis_geo.sql`.  
Runtime : `commun/backend/src/lib/postgisConfig.ts` — fallback scan RAM si extension absente. Ici : actif.

## Précision / mineurs

`ageGates.ts` : `GEO_PRECISE_MIN_AGE = 18`.  
`userIsKnownMinorForPreciseGeo` : grandfathering comptes sans DOB (audit 08-11 ~95 %).  
`enforceMinorGeoPolicy` appelé à l’inscription / OAuth.

Exposition API de coordonnées précises, logs, cache : **NON REVÉRIFIÉ** exhaustivement cette passe. Flou ~50 m cité 08-11 : **NON REVÉRIFIÉ** aujourd’hui.

Injection spatiale : requêtes paramétrées historiquement ; pas de concat observée sur le chemin `postgisConfig` / nearby. Test négatif live : **NON FAIT**.

Fuite coords mineurs : dépend du grandfathering — **RISQUE** résiduel si comptes legacy sans DOB. **À VALIDER AVOCAT** (minimisation RGPD).

## Recommandation

Confirmer PostGIS staging. Exercice QA : compte mineur DOB < 18 → pas de GPS précis (NON TESTÉ aujourd’hui).
