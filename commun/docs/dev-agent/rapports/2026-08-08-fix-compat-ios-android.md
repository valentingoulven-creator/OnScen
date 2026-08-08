# Rapport Dev Agent — 2026-08-08 — Correctifs audit compat iOS/Android

**Agent :** @soundy-dev-agent
**Date :** 2026-08-08
**Durée estimée :** ~1h
**Statut global :** ✅ Terminé (scope validé avec le fondateur — portage complet du panel hôte exclu)

---

## Mission

Appliquer les correctifs de priorité rapide identifiés par l'audit [`2026-08-08-audit-compat-ios-android.md`](./2026-08-08-audit-compat-ios-android.md), sans entreprendre le portage complet du panel hôte live sur mobile (décision produit non tranchée).

---

## Contexte / problème

L'audit précédent a révélé que le Config live (MODIF 1341) et les features hôte préexistantes ne sont pas accessibles sur mobile (`ios/apptel/src/pages/LivePage.tsx` n'importe jamais `LiveHostPanel`), plus 2 points techniques mineurs (safe-area duo, dépendance LiveKit fragile) et 1 point d'infra (AASA). Le fondateur a validé le scope : fixes techniques rapides + branchement de la lecture viewer (annonce épinglée + sondage), sans le panel hôte complet.

---

## Actions réalisées

- [x] Safe-area sur `LiveKitPeerTile` (tuile vidéo duo) — évite le chevauchement avec le home indicator iPhone en plein écran.
- [x] Déclaration explicite de `livekit-client`/`@livekit/components-react` dans `ios/apptel/package.json` + `npm install` réel (n'était résolu qu'implicitement via `web/app/node_modules`).
- [x] Ajout des types `LivePinnedAnnouncement`/`LivePoll` + champs `Live.pinnedAnnouncement`/`Live.activePoll` dans `ios/apptel/src/types.ts` (absents jusqu'ici, fork divergent du fichier web).
- [x] Branchement de `LivePinnedAnnouncementBanner` + `LivePollWidget` dans `ios/apptel/src/pages/LivePage.tsx` (zone chat) — un viewer mobile voit désormais et peut voter à un sondage / voir une annonce publiée par un hôte web.
- [x] Mise à jour du commentaire d'audit en tête de `ios/apptel/src/pages/LivePage.tsx` pour tracer explicitement le statut du portage `LiveHostPanel`.
- [ ] **Volontairement non fait** : portage complet du panel hôte (décision produit en attente), extension AASA `/reels/*`/`/dm/*` (aucune route de deep-link fonctionnelle trouvée pour ces chemins — chantier distinct, pas un simple ajout de string).
- [x] Vérification : tsc backend/web/apptel, build apptel complet, vitest backend, eslint fichiers modifiés.
- [x] `modification.txt` — entrée MODIF 1344 ajoutée (renumérotée après collision avec des MODIF 1341/1342/1343 pris par une session parallèle).

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `web/app/src/components/LiveKitVideoStage.tsx` | `LiveKitPeerTile` : `bottom-3` → `calc(0.75rem + env(safe-area-inset-bottom))` |
| `ios/apptel/package.json` | + `livekit-client`, `@livekit/components-react` en dépendances directes |
| `ios/apptel/package-lock.json` | Mis à jour par `npm install` (21 paquets ajoutés) |
| `ios/apptel/src/types.ts` | + `LivePinnedAnnouncement`, `LivePoll`, `Live.pinnedAnnouncement`/`Live.activePoll` |
| `ios/apptel/src/pages/LivePage.tsx` | + import/rendu `LivePinnedAnnouncementBanner`/`LivePollWidget` dans le chat ; commentaire d'audit mis à jour |

---

## Commandes exécutées

```text
cd ios/apptel && npm install                              → ✅ (21 paquets ajoutés)
cd commun/backend && npx vitest run                        → ✅ (105 fichiers, 504 tests)
cd web/app && npx tsc --noEmit -p tsconfig.json             → ✅ (0 erreur)
cd ios/apptel && npx tsc --noEmit -p tsconfig.app.json      → ✅ (0 erreur)
cd ios/apptel && npm run build                              → ✅ (build complet, artefacts restaurés après coup)
cd web/app && npx eslint src/components/LiveKitVideoStage.tsx → ✅ (0 erreur)
cd ios/apptel && npx eslint src/pages/LivePage.tsx src/types.ts → ⚠️ 10 erreurs/5 warnings PRÉ-EXISTANTES
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend | ✅ 504/504 |
| Types backend + web/app + ios/apptel | ✅ 0 erreur partout |
| Build production apptel (`vite build`) | ✅ (bundle `LivePage` 120.4→123.15 kB gzip, cohérent avec les 2 composants ajoutés) |
| Lint fichiers modifiés | ✅ `LiveKitVideoStage.tsx`, `types.ts` — 0 erreur. `LivePage.tsx` apptel : 10 erreurs/5 warnings **pré-existantes** (React Compiler, lignes 147-815, aucune sur les lignes ajoutées par ce fix — vérifié via `git diff --stat`) |
| Test manuel device réel | ❌ Non fait — pas de Mac/simulateur iOS ni device Android disponible dans cette session |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1344 — Correctifs audit compat iOS/Android)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| Portage complet du panel hôte live (`LiveHostPanel`) sur mobile — toujours en attente de décision (cf. audit du 2026-08-08). Hôtes mobiles restent en mode OBS-only pour l'instant. | Trancher : panel identique en bottom-sheet (chantier L) vs version simplifiée mobile (chantier M) vs statu quo assumé. |
| AASA `/reels/*`/`/dm/*` non étendue — aucune route de deep-link dédiée trouvée côté frontend pour ces chemins (pas de `<Route>` react-router-dom, pas de parsing de pathname identifié dans `App.tsx`). | Si le deep-linking reels/DM est prioritaire, prévoir une session d'investigation dédiée sur le mécanisme de routing actuel avant d'étendre l'AASA (ajouter le chemin sans route fonctionnelle ouvrirait l'app sur un état non pertinent). |
| Test manuel réel iOS/Android non exécuté (pas de device/simulateur disponible) | Recommandé avant d'annoncer la fonctionnalité viewer (annonce/sondage) comme disponible sur mobile. |

---

## Prochaines étapes

1. Trancher la décision produit sur le portage du panel hôte (cf. Bloquers).
2. Si prioritaire : session dédiée d'investigation du routing/deep-link actuel avant d'étendre l'AASA.
3. Test manuel sur device réel (hôte web + viewer mobile) dès qu'un environnement de test est disponible : publier une annonce/sondage côté web, vérifier l'affichage et le vote côté apptel.

---

## Notes techniques (optionnel)

- La collision de numérotation `modification.txt` (MODIF 1341 et 1342 chacun utilisés deux fois par des sessions parallèles) a été détectée et résolue en prenant le vrai dernier numéro du fichier (1343) avant d'ajouter cette entrée en 1344. À surveiller si plusieurs agents travaillent en parallèle sur le même fichier changelog.
- `ios/apptel/src/types.ts` reste un fork très partiel de `web/app/src/types.ts` (577 vs ~1900 lignes) — seuls les 2 types et 2 champs strictement nécessaires à cette fonctionnalité ont été ajoutés, volontairement, pour ne pas élargir le scope (pas de `coHostId`, `description`, `isSensitive`, etc., qui nécessiteraient le panel hôte complet pour avoir un sens sur mobile).

---

*Généré par Soundy Dev Agent — ne pas éditer le template `_TEMPLATE.md`*
