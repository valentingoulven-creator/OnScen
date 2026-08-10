# Rapport Dev Agent — 2026-08-07 — Live Config : implémentation audit CTO P0→P3

**Agent :** @onscen-dev-agent
**Date :** 2026-08-07
**Durée estimée :** ~1 session longue
**Statut global :** ✅ Terminé (avec 1 point hors périmètre non corrigé, voir Bloquers)

---

## Mission

Implémenter les 4 lots priorisés (P0, P1, P2, P3) issus de l'audit `@onscen-cto` de l'onglet **Config** du `LiveHostPanel`, comparé à TikTok / Instagram / Twitch / Kick.

---

## Contexte / problème

L'audit CTO (même session, message précédent) a relevé :
- **P0 (bug)** : les règles de déclenchement automatique (`TriggersTab`, onglet Don → Auto) n'étaient persistées qu'en `useState` local → perdues au reload, contrairement à `goals`/`rewards` déjà persistés via `useLiveHostSession`.
- **P1 (parité marché)** : pas de titre/description modifiable en live, pas de flag contenu sensible/18+, pas de contrôle host sur l'enregistrement replay — fonctionnalités standards chez les 4 concurrents.
- **P2 (différenciation modération/engagement)** : filtre de mots bloqués backend existant (`chatModerationPolicy.ts`) mais sans UI hôte ; pas de message épinglé distinct des animations de don.
- **P3 (paris produit, plus gros risque archi)** : pas de sondages/Q&A ; pas de co-hôte/duo (implication LiveKit multi-publisher, cf. escalade demandée dans l'audit).

---

## Actions réalisées

- [x] P0 — `triggers` déplacé de `useState` local vers `useLiveHostSession` (sessionStorage), même mécanisme que `goals`/`rewards`.
- [x] P1 — Titre + description live éditables en direct (schema `Live.description`, socket `live_update_meta`, UI `LiveHostMetaSettings`).
- [x] P1 — Toggle contenu sensible/18+ par live (schema `isSensitive`, badge + flou sur `LivesBrowseGrid`).
- [x] P1 — Toggle activer/désactiver le replay (schema `replayEnabled`, `liveArchive.ts` n'archive plus si désactivé).
- [x] P2 — UI mots bloqués (`blockedTerms`) ajoutée dans `LiveChatConfigFields` (backend déjà en place).
- [x] P2 — Message épinglé / annonce hôte (`pinnedAnnouncement`, socket `live_pin_announcement`, bannière chat viewers).
- [x] P3 — Sondages/Q&A live temps réel (création, vote, clôture, résultats) : `LivePoll` + 3 handlers socket + UI hôte/viewer.
- [x] P3 — Co-hôte/duo : MVP scopé (invite/accept/decline/end, token LiveKit `canPublish` pour le co-hôte, tuile vidéo secondaire) — cf. limites en Notes techniques.
- [x] Vérification complète : `tsc` backend + frontend, `vitest run` backend (489 tests), lint fichiers modifiés.
- [x] Fix collatéral : fuite `process.env` dans `donations.test.ts` cassant `donationsSummary.test.ts` de façon intermittente.
- [x] `modification.txt` — entrée MODIF 1341 ajoutée.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/models/schema.ts` | + `Live.description/isSensitive/replayEnabled/pinnedAnnouncement/activePoll/coHostId/coHostInvite`, interface `LivePoll` |
| `commun/backend/src/socket.ts` | + handlers `live_update_meta`, `live_pin_announcement`, `live_poll_create/vote/close`, `live_duo_invite/cancel/accept/decline/end` |
| `commun/backend/src/lib/livePublic.ts` | Sérialisation des nouveaux champs (poll avec `myVote` par viewer, coHost conditionnel) |
| `commun/backend/src/lib/liveArchive.ts` | `replayUrlForLive` retourne `undefined` si `replayEnabled=false` |
| `commun/backend/src/routes/lives.ts` | Token LiveKit : `canPublish` pour hôte **et** co-hôte ; archive VOD conditionnelle |
| `commun/backend/src/lib/donations.test.ts` | Fix fuite `process.env.DONATION_PLATFORM_FEE_PERCENT` (restauration en `finally`) |
| `web/app/src/lib/liveHostTypes.ts` | + `DEFAULT_LIVE_TRIGGERS`, `TriggerRule` |
| `web/app/src/lib/liveHostSession.ts` | + `triggers` dans `LiveHostSession`/`DEFAULT_SESSION`/persistance |
| `web/app/src/types.ts` | Types `Live` étendus (front) : meta, annonce, poll, duo |
| `web/app/src/components/LiveHostPanel.tsx` | `TriggersTab` persisté ; 3 nouvelles sections dans Config |
| `web/app/src/components/LiveHostMetaSettings.tsx` | **Nouveau** — UI titre/description + toggles sensible/replay |
| `web/app/src/components/LiveHostAnnouncementSettings.tsx` | **Nouveau** — UI publier/effacer annonce épinglée |
| `web/app/src/components/LiveHostPollSettings.tsx` | **Nouveau** — UI créer/suivre/clôturer un sondage |
| `web/app/src/components/LivePinnedAnnouncementBanner.tsx` | **Nouveau** — bannière annonce dans le chat (viewers) |
| `web/app/src/components/LivePollWidget.tsx` | **Nouveau** — widget vote + résultats (viewers) |
| `web/app/src/components/LiveChatConfigFields.tsx` | + UI mots bloqués |
| `web/app/src/components/LiveParticipantsPopover.tsx` | + invite duo par viewer, statut duo actif |
| `web/app/src/components/LiveKitVideoStage.tsx` | + rôle `isCoHost`, `LiveKitPeerTile` (tuile vidéo secondaire) |
| `web/app/src/components/LivesBrowseGrid.tsx` | + badge « 18+ » / flou si `isSensitive` |
| `web/app/src/pages/LivePage.tsx` | Wiring complet meta/annonce/sondage/duo + modale invite |
| `web/app/src/locales/fr.json`, `en.json` | ~40 clés i18n nouvelles |

---

## Commandes exécutées

```text
cd commun/backend && npx tsc --noEmit          → ✅ (0 erreur)
cd commun/backend && npx vitest run            → ✅ (103 fichiers, 489 tests)
cd web/app && npx tsc --noEmit -p tsconfig.json → ✅ (0 erreur)
cd web/app && npm run build (tsc -b)           → ❌ pré-existant, hors périmètre (voir Bloquers)
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend (vitest) | ✅ 489/489, 2 runs consécutifs stables (fix fuite process.env) |
| `tsc --noEmit` backend + frontend | ✅ 0 erreur |
| `npm run build` frontend (`tsc -b`) | ❌ échoue sur fichiers **non liés** aux lives (admin stats), confirmé pré-existant via `git stash` |
| Test manuel | Non fait (pas d'environnement dev lancé cette session) — à valider par le fondateur avant merge |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1341 — Live Config : P0-P3 audit CTO)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| `npm run build` (web/app, `tsc -b`) échoue sur `AdminStatsTab.tsx` / `adminStatsPdfExport.ts` / `adminReportAnalysis.ts` / `sponsorTrack.ts` — chantier stats admin non fini, non commité, sans rapport avec ce lot live. Confirmé cassé **avant** mes changements (`git stash` puis `tsc -b` échoue déjà). | Reprendre/terminer ce chantier admin séparément, ou me demander de le fixer si prioritaire. |
| Co-hôte/duo (P3) livré en **MVP scopé** : pas de contrôle caméra/résolution dédié pour le co-hôte, pas de gestion fine des déconnexions brutales (seulement `leave_live` propre). Un vrai multi-guest (>1 co-hôte) impliquerait un chantier LiveKit plus large (coûts d'egress, UI grille dynamique). | Valider si le MVP suffit pour un premier lancement ou si un cadrage produit/archi dédié est nécessaire avant d'exposer la fonctionnalité largement. |
| Test manuel du flux complet (config live → titre/desc/sensible/replay/annonce/sondage/duo en conditions réelles) non exécuté cette session. | Recommandé avant merge en prod : lancer `npm run dev` et tester un live de bout en bout. |

---

## Prochaines étapes

1. Test manuel bout-en-bout en dev (`npm run dev`) du flux Config complet, en particulier le duo (2 comptes simultanés) et les sondages (plusieurs viewers).
2. Décider du sort du chantier admin-stats cassé (build `tsc -b`) — indépendant de ce lot.
3. Si le duo est confirmé comme axe produit important : cadrer une itération 2 (multi-guest, contrôle device, UI grille).

---

## Notes techniques (optionnel)

- Tous les nouveaux champs `Live` (`description`, `isSensitive`, `replayEnabled`, `pinnedAnnouncement`, `activePoll`, `coHostId`, `coHostInvite`) sont stockés en JSONB existant côté Postgres (`models/schema.ts` + colonne JSON du document `Live`) — **aucune migration de schéma SQL nécessaire**.
- Le co-hôte réutilise le mécanisme `canPublish` déjà présent dans le token LiveKit pour l'hôte ; aucune refonte du pipeline vidéo n'a été nécessaire, seulement l'ajout d'un second rôle publisher + une tuile de rendu (`LiveKitPeerTile`).
- Fin de duo propre gérée via `leave_live` (cleanup `coHostId`) ; une déconnexion brutale du co-hôte (crash navigateur, perte réseau) n'est **pas** explicitement détectée côté serveur — limite connue du MVP, acceptable si le host garde un bouton « Quitter le duo » toujours visible côté UI (fait) mais à surveiller en usage réel.
- Le fix de fuite `process.env` dans `donations.test.ts` était latent depuis plus longtemps ; il n'est devenu visible que par la combinaison avec le run complet de la suite (`vitest run` sans isolation stricte entre fichiers dans le même worker).

---

*Généré par OnScen Dev Agent — ne pas éditer le template `_TEMPLATE.md`*
