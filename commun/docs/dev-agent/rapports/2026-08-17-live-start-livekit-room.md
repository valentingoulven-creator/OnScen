# Rapport Dev Agent — 2026-08-17 — Live prod : room LiveKit avant egress

**Agent :** @onscen-dev-agent  
**Date :** 2026-08-17  
**Durée estimée :** 0,5 h  
**Statut global :** ✅ Terminé (code) — ⚠️ pas encore déployé en prod

---

## Mission

Corriger l’impossibilité de démarrer un live en production.

---

## Contexte / problème

Log prod `onscen-backend` 2026-08-17 14:46:58 UTC :

`[lives] Échec démarrage du live: Not Found: requested room does not exist`

Cause : en prod, un live LiveKit doit relayer vers Cloudflare Stream (échantillonnage Sightengine). L’egress Room Composite était lancé au `POST /lives/start`, avant que l’hôte n’ait rejoint — LiveKit ne crée la room qu’au premier join.

---

## Actions réalisées

- [x] `ensureLiveKitRoom()` (`createRoom`) avant `startRoomCompositeEgress`
- [x] Idempotent si la room existe déjà
- [x] Tests unitaires
- [x] `modification.txt` MODIF 1465

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/lib/livekit.ts` | `ensureLiveKitRoom` + appel dans `startLiveKitEgress` |
| `commun/backend/src/lib/livekitEgressStart.test.ts` | 2 tests |
| `commun/backend/src/lib/livekitEgressStop.test.ts` | mock `RoomServiceClient` |

---

## Commandes exécutées

```text
ssh onscen-prod "pm2 logs …" → requested room does not exist
cd commun/backend && npm test -- livekitEgressStart livekitEgressStop liveSamplingPolicy lives.start
→ ✅ 10/10
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend | ✅ 10/10 |
| Build frontend | n/a (backend only) |
| Test manuel prod | ⚠️ nécessite deploy prod |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1465)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| Mise en prod | Dire **deploy prod** pour que le correctif soit actif |

---

## Prochaines étapes

1. Commit + deploy prod (sur demande).
2. Retester création de live sur onscen.com.

---

*Généré par OnScen Dev Agent*
