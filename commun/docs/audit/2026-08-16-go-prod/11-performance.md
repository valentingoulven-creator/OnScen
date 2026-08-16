# Phase 11 — Performance et charge

**Date :** 2026-08-16 · **Statut :** **NON VÉRIFIÉ / CAPACITÉ NON DÉMONTRÉE**  
**Niveau de preuve :** live (charge machine faible) + doc `SCALABILITY.md` · pas de load test

## Capacité observée (pas un test de charge)

Prod au moment de l’audit : load average 0.03, CPU PM2 0 %, RAM process 186 Mo, disque 2 %.  
Cohérent avec un trafic **très bas** (~10 users historiquement). **≠** capacité démontrée.

## Capacité théorique (doc)

`commun/docs/STACK-CIBLE.md` + `commun/msdev/SCALABILITY.md` : Redis + PostGIS + S3 + N workers.  
Réel 2026-08-16 : Redis **ok**, PostGIS **ok**, S3 uploads configurés (noms), PM2 **1** process malgré `PM2_INSTANCES=2`.

## Test de charge

| Champ | Valeur |
| ----- | ------ |
| Existe ? | **Non** trouvé (pas de k6/artillery/scenario daté) |
| Date / env / CCU / résultat | — |

**NON VÉRIFIÉ / CAPACITÉ NON DÉMONTRÉE** pour : connexions simultanées, API, DB, WebSocket, live, uploads, inscriptions, webhooks.

N+1 / index / cache : index GiST vérifié ; revue N+1 **NON FAITE** cette passe.  
Frontend bundles : assets hashés servis par Caddy ; perf rendering **NON MESURÉE**.

## Risque

Un pic d’inscriptions `open` + lives WebRTC saturera un seul process + 2 Go RAM VPS avant toute alerte utile. C5 **partiellement** mitigé (Redis) mais pas cluster réel.

## Recommandation

Load test staging **après** DNS + disque. Ne pas vendre de scale sponsors (déjà NO-GO 08-15).
