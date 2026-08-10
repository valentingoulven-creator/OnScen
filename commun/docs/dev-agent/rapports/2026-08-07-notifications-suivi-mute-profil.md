# Rapport Dev Agent — 2026-08-07 — Notifications suivi + mute profil

**Agent :** @onscen-dev-agent  
**Date :** 2026-08-07  
**Statut global :** ✅ Terminé

---

## Mission

P0/P1 CTO : fan-out activité pour les profils suivis (salon, live, événement, album, morceau, reel), mute par profil, pas de doublon favoris+suivi ; DM/tags inchangés.

---

## Actions réalisées

- Fan-out unifié `notifyFollowersCreatorActivity` + prefs `userFollowNotificationPrefs` (PG migration 034).
- API `GET following-status` / `PATCH follow-notifications` ; profil public expose `followNotificationsEnabled`.
- Hooks album / composition / reel ; événements via même pipeline ; favoris live/salon skip si déjà suivi.
- UI `FollowProfileNotificationsButton` sur profil autrui ; cloche + push types.

---

## Fichiers modifiés (principal)

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/lib/followActivityNotifications.ts` | Fan-out activité suivi |
| `commun/backend/src/lib/follows.ts` | Prefs + wrappers salon/live |
| `commun/backend/src/db/migrations/034_user_follow_notifications.sql` | Colonne PG |
| `web/app/src/components/FollowProfileNotificationsButton.tsx` | Toggle profil |

---

## Commandes exécutées

```text
cd commun/backend && npx vitest run followActivityNotifications notifications → ✅ 8/8
cd commun/backend && npx tsc --noEmit → ✅
```

---

## modification.txt

- Entrée MODIF 1414

---

## Prochaines étapes

1. Appliquer migration 034 en preprod/prod.
2. (P2) Regroupement anti-spam uploads musique si volume élevé.
