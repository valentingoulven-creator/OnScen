# Rapport Dev Agent — 2026-08-08 — Audit compatibilité web ↔ iOS Capacitor / APK Android

**Agent :** @onscen-dev-agent
**Date :** 2026-08-08
**Durée estimée :** ~1h30
**Statut global :** ⚠️ Partiel — **audit uniquement, aucun code modifié**. Finding majeur remontant au-delà du périmètre live (MODIF 1341).

---

## Mission

Vérifier que les changements récents (Config live P0→P3, MODIF 1341 : triggers, méta live, 18+, replay, mots bloqués, annonce épinglée, sondages, duo/co-hôte) restent cohérents et utilisables sur **Capacitor iOS** et **Android (APK/AAB)**, sans régression store ni écart silencieux entre `web/app` et `ios/apptel`.

---

## Contexte / problème

Suite à MODIF 1341 (implémentation P0-P3 de l'onglet Config `LiveHostPanel`), le fondateur a demandé une vérification de compatibilité mobile avant d'considérer cette fonctionnalité comme livrée. Contexte architecture : `ios/apptel/src/` ne contient que des **overrides** ; tout fichier absent y retombe automatiquement sur `web/app/src/` (plugin Vite `apptelSrcFallback`).

---

## A. Résumé exécutif

**Verdict : ⚠️ Compatible avec réserve majeure — mais pas pour la raison attendue.**

Le code du MODIF 1341 lui-même **ne casse rien** sur mobile : `tsc` et le build `ios/apptel` passent, aucune régression de type introduite. **Mais aucune des nouvelles fonctionnalités (P0 à P3) n'est accessible sur iOS Capacitor ni sur l'APK Android**, pour une raison structurelle **préexistante à cette session** :

> `ios/apptel/src/pages/LivePage.tsx` est un **override complet et divergent** de `LivePage.tsx` (1248 lignes vs 2021 lignes web) qui **n'importe pas `LiveHostPanel`** du tout. Il utilise à la place `LiveCloudflareHostPanel`, un composant `@deprecated` qui n'affiche que les identifiants d'ingestion OBS (RTMP/clé de stream) — **aucun onglet Dashboard/Don/Chat/Config, aucun objectif de don, aucune récompense, aucun trigger auto**, et donc aucune des 8 nouvelles features livrées dans MODIF 1341.

Ce n'est pas un bug introduit par le lot P0-P3 — c'est un gap d'architecture mobile qui existait déjà avant (les hôtes triggers/goals/rewards existants côté web n'étaient déjà pas portés sur mobile). Le MODIF 1341 l'a simplement rendu plus visible en ajoutant 8 features de plus au même écart.

Tout le reste vérifié (Stripe/IAP, permissions natives, LiveKit, targetSdk, deep links) est **conforme ou déjà documenté** dans l'audit mobile antérieur (`commun/docs/audit/AUDIT-mobile-ios-android.md`, 2026-07-22) — rien de nouveau cassé par cette session.

---

## B. Matrice de compatibilité

| Feature | Web (`web/app`) | PWA `/tel` (apptel, navigateur) | iOS Capacitor | Android APK | Notes / fichier |
|---|---|---|---|---|---|
| Live host — dashboard, objectifs, récompenses (préexistant) | ✅ | ❌ | ❌ | ❌ | `LiveHostPanel` jamais importé par `ios/apptel/src/pages/LivePage.tsx` |
| P0 — Triggers auto-dons persistés | ✅ | ❌ | ❌ | ❌ | idem — UI absente sur mobile |
| P1 — Titre/description live éditables | ✅ | ❌ | ❌ | ❌ | idem |
| P1 — Toggle contenu sensible/18+ (config hôte) | ✅ | ❌ | ❌ | ❌ | idem |
| P1 — Badge 18+/flou sur grille lives | ✅ (`LivesBrowseGrid`) | ✅* | ✅* | ✅* | *si `LivesBrowseGrid` est utilisé côté apptel (non vérifié — hors `LivePage`) ; à confirmer |
| P1 — Toggle replay VOD | ✅ | ❌ | ❌ | ❌ | config hôte absente |
| P2 — Mots bloqués (UI hôte) | ✅ | ❌ | ❌ | ❌ | backend actif (filtre appliqué même si posté depuis mobile), UI config absente |
| P2 — Annonce épinglée (publication hôte) | ✅ | ❌ | ❌ | ❌ | config hôte absente |
| P2 — Annonce épinglée (affichage viewer) | ✅ (`LivePinnedAnnouncementBanner` dans le chat) | ❌ | ❌ | ❌ | **non branché** dans `ios/apptel` `LivePage.tsx` (composant non importé) — un viewer mobile ne verra jamais l'annonce même si un hôte web la publie |
| P3 — Sondages (création hôte) | ✅ | ❌ | ❌ | ❌ | config hôte absente |
| P3 — Sondages (vote viewer) | ✅ (`LivePollWidget`) | ❌ | ❌ | ❌ | **non branché** côté apptel — un viewer mobile ne peut pas voter à un sondage lancé côté web |
| P3 — Duo/co-hôte (invite/accept) | ✅ (`LiveParticipantsPopover`, modale) | ❌ | ❌ | ❌ | non branché — bouton « + Duo » absent côté apptel |
| P3 — Duo/co-hôte (rendu vidéo 2 flux) | ✅ (`LiveKitVideoStage` partagé) | ⚠️ | ⚠️ | ⚠️ | Le composant `LiveKitVideoStage` **est** importé par apptel (fallback web) et supporte techniquement `isCoHost`/`coHostId` — mais comme apptel ne peut jamais déclencher/recevoir une invite duo (props non câblées dans `LivePage.tsx` apptel), cette voie est **inatteignable en pratique** sur mobile actuellement |
| Chat live (lecture/envoi) | ✅ | ✅ | ✅ | ✅ | `ChatPanel` overridé et fonctionnel côté apptel |
| Don Stripe en live | ✅ | Guard natif OK | 🚫 bloqué volontairement | 🚫 bloqué volontairement | `isNativeApp()` bloque Stripe et affiche un message de redirection — conforme App Store 3.1.1 |
| Réception LiveKit vidéo (viewer) | ✅ | ✅ | ✅ | ✅ | `LiveKitViewerSubscriber` partagé, fonctionnel |
| Diffusion caméra native (hôte mobile) | ✅ (via LiveKit) | ✅ (`useLiveCamera`) | ✅ (permissions `Info.plist` OK) | ⚠️ non vérifiable (AndroidManifest présent mais permissions caméra/micro non ré-auditées cette session) | |
| Diffusion OBS (hôte) | ✅ | ✅ (`LiveObsIngestSettings`) | ✅ (seul mode host-panel présent sur apptel) | ✅ | Seule voie de "config" hôte réellement disponible sur mobile actuellement |

---

## C. Écarts apptel vs web (par fichier override)

### `ios/apptel/src/pages/LivePage.tsx` — écart majeur, **bug/oubli de portage** (préexistant, aggravé par MODIF 1341)

- Le fichier porte lui-même un commentaire d'audit explicite (ajouté lors d'une session antérieure, commit `ca9bc509`, 2026-07-22) :
  > « PARITÉ WEB : override partiel (dock chat mobile, layout plein écran)… toute feature web majeure ajoutée sur cette page (sécurité, modération, paiement) doit être évaluée pour portage ici. »
- Cette évaluation **n'a pas été faite** pour MODIF 1341 (ce audit le fait a posteriori, à la demande du fondateur).
- **Cause racine** : `LivePage.tsx` n'est pas un simple override de détail — c'est un **fork structurel complet** (layout, hooks, JSX quasi entièrement réécrits pour le mobile plein écran). Le mécanisme `apptelSrcFallback` ne peut aider que pour les fichiers **absents** d'apptel ; ici le fichier existe et prime totalement sur la version web, donc **aucune des additions faites dans `web/app/src/pages/LivePage.tsx`** (les ~170 lignes ajoutées pour meta/annonce/sondage/duo) ne se propage automatiquement.
- **Action recommandée** : ne pas corriger dans l'urgence (fork volumineux, risque de régression sur le dock chat mobile) — **cadrer un chantier dédié de portage mobile du panneau hôte** (voir Plan d'action E).

### `web/app/src/components/LiveHostPanel.tsx`, `LiveHostMetaSettings.tsx`, `LiveHostAnnouncementSettings.tsx`, `LiveHostPollSettings.tsx`, `LivePinnedAnnouncementBanner.tsx`, `LivePollWidget.tsx`, `LiveParticipantsPopover.tsx`, `LiveChatConfigFields.tsx`, `LiveKitVideoStage.tsx`, `LivesBrowseGrid.tsx` — **volontaire par défaut (fallback), mais jamais atteint**

- Aucun de ces fichiers n'a d'override dans `ios/apptel/src/components/` → le fallback fonctionnerait **si** `ios/apptel/src/pages/LivePage.tsx` les important. Ce n'est le cas que pour `LiveKitVideoStage` (déjà utilisé côté apptel pour le flux vidéo de base) et `ChatPanel`.
- **Conclusion** : ces fichiers sont **prêts techniquement** pour le mobile (aucun changement de code requis dedans) — seul le branchement dans `ios/apptel/src/pages/LivePage.tsx` manque.

### Dépendance npm `livekit-client` / `@livekit/components-react` — point technique neutre, pas un bug

- Ces packages ne sont déclarés que dans `web/app/package.json`, absents de `ios/apptel/package.json` et de `ios/apptel/node_modules`.
- Le build apptel réussit quand même car Vite/Rollup résout les imports "bare" (`livekit-client`) depuis l'emplacement réel sur disque du fichier importeur — et `LiveKitVideoStage.tsx` étant physiquement dans `web/app/src/components/`, la résolution Node remonte jusqu'à `web/app/node_modules/livekit-client` (trouvé). **Fonctionne mais fragile** : si `web/app/node_modules` est absent (ex. CI qui n'installe que `ios/apptel`), le build casserait silencieusement sur ce point précis. À sécuriser en documentant la dépendance croisée ou en ajoutant `livekit-client`/`@livekit/components-react` explicitement dans `ios/apptel/package.json` (peerDependency de fait).

### `LiveKitPeerTile` (nouveau, MODIF 1341) — mineur, à corriger

- Positionné en `absolute bottom-3 right-3` (12px du bord), **sans `env(safe-area-inset-bottom)`**. Sur iPhone avec home indicator (mode plein écran vidéo, ce qui est le cas exact du live), la tuile duo peut chevaucher la zone de geste. Non testé physiquement (pas de device iOS disponible dans cette session). Fix trivial (`bottom-[calc(0.75rem+env(safe-area-inset-bottom))]`) mais impacte aussi le web/PWA — recommandé avant activation large du duo.

---

## D. Checklist technique

- [x] Build apptel (`npm run build` dans `ios/apptel`) OK — 0 erreur, artefacts générés puis restaurés (non commités, audit uniquement)
- [x] Types OK — `tsc --noEmit` backend (0 erreur), `web/app` (0 erreur), `ios/apptel` (`tsconfig.app.json`, 0 erreur)
- [x] Permissions OK — `Info.plist` iOS : micro/caméra/localisation/photos toutes justifiées et inchangées par ce lot ; `AndroidManifest.xml` généré présent (projet Android existe sur ce poste, contrairement au constat périmé de l'audit du 22/07)
- [ ] **Live host + viewer sur tel — ❌ NON OK** : aucune des 8 features MODIF 1341 accessible (cf. matrice B)
- [x] Dons/légal natif OK — guard `isNativeApp()` bloque Stripe sur Capacitor, conforme App Store 3.1.1 ; non affecté par ce lot
- [ ] Deep links — inchangé par ce lot, mais toujours incomplet (AASA sans `/reels/*`, `/dm/*`, `TEAM_ID` toujours en placeholder) — **déjà connu, non ré-introduit**
- [ ] Safe-area/touch targets modales live — nouveau modal duo (web) conforme (`items-end sm:items-center`, `min-h-11`) ; `LiveKitPeerTile` à corriger (safe-area, voir C)

---

## E. Plan d'action priorisé

| # | Sujet | Priorité | Effort | Détail |
|---|---|---|---|---|
| 1 | Décider si le Config live (P0-P3 + héritage goals/rewards/triggers) doit être porté sur mobile, et sous quelle forme (panneau complet identique, ou version simplifiée mobile-first) | **P0 (décision produit)** | — | Bloque toute estimation d'effort de portage tant que non tranché |
| 2 | Si porté : créer `ios/apptel/src/components/LiveHostPanel.tsx` (override) ou refactorer pour que `LivePage.tsx` apptel importe le vrai `LiveHostPanel` (probablement en bottom-sheet plutôt qu'en overlay desktop) | P1 | L | Gros morceau : le panel desktop (onglets, tableaux) doit être repensé en bottom-sheet mobile-first (`mobile-responsive.mdc`) |
| 3 | Brancher `LivePinnedAnnouncementBanner` + `LivePollWidget` côté viewer apptel (lecture seule, sans besoin du panel hôte complet) | P1 | S | Un viewer mobile devrait au minimum **voir** l'annonce/sondage d'un hôte web, même sans pouvoir en créer depuis mobile |
| 4 | Fix `LiveKitPeerTile` : ajouter `env(safe-area-inset-bottom)` | P1 | S | Fix ciblé, low-risk, bénéficie aussi au web/PWA plein écran |
| 5 | Sécuriser la dépendance croisée `livekit-client`/`@livekit/components-react` (déclarer explicitement dans `ios/apptel/package.json` ou documenter) | P2 | S | Évite une casse silencieuse en CI si `web/app/node_modules` n'est pas installé |
| 6 | Étendre l'AASA (`/reels/*`, `/dm/*`) + renseigner `APPLE_TEAM_ID` | P2 | S | Déjà connu (audit 22/07), non aggravé, rappelé ici pour visibilité |
| 7 | Vérifier permissions caméra/micro Android réelles (`AndroidManifest.xml` régénéré) car le dernier audit datait d'avant régénération du projet Android | P2 | S | Peut être fait au prochain `cap sync` |

---

## F. Tests manuels recommandés (2 comptes, un hôte + un viewer)

**Sur web (référence, déjà fonctionnel) :**
1. Hôte lance un live → onglet Config → change titre/description → viewer voit la mise à jour en direct.
2. Hôte active 18+ → vérifier badge/flou sur `LivesBrowseGrid`.
3. Hôte désactive le replay → terminer le live → vérifier absence de VOD.
4. Hôte publie une annonce épinglée → viewer la voit en haut du chat.
5. Hôte crée un sondage → viewer vote → hôte voit les résultats en temps réel → hôte clôture.
6. Hôte invite un viewer en duo → viewer accepte → les 2 flux vidéo s'affichent (hôte + tuile duo) → l'un des deux quitte le duo proprement.

**Sur mobile (Capacitor iOS build local ou APK debug) — pour confirmer les gaps de cet audit :**
7. Reproduire les scénarios 1 à 6 côté **hôte mobile** → attendu : aucun onglet Config visible, seul « 📡 Configurer OBS » disponible.
8. Reproduire côté **viewer mobile** pendant qu'un hôte web publie une annonce/sondage → attendu : rien ne s'affiche (bug confirmé, cf. matrice B) — à valider physiquement, non testé cette session faute de device/simulateur disponible.
9. Vérifier au conditionnel sur device iPhone réel (home indicator) : chevauchement visuel de `LiveKitPeerTile` en plein écran si un duo est actif (nécessite qu'un hôte web ait initié le duo, puisque mobile ne peut pas encore le faire).

---

## Commandes exécutées

```text
cd commun/backend && npx vitest run              → ✅ (105 fichiers, 504 tests)
cd web/app && npx tsc --noEmit -p tsconfig.json  → ✅ (0 erreur)
cd ios/apptel && npx tsc --noEmit -p tsconfig.app.json → ✅ (0 erreur)
cd ios/apptel && npm run build                   → ✅ (build complet, artefacts restaurés après coup)
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend | ✅ 504/504 |
| Types backend + web/app + ios/apptel | ✅ 0 erreur partout |
| Build production apptel (`vite build`) | ✅ (artefacts générés dans `commun/backend/public/tel/**`, revert git après vérification pour ne pas polluer le diff) |
| Test manuel device réel (iOS/Android) | ❌ Non fait — pas de Mac/simulateur ni device Android disponible dans cette session (cf. contraintes ci-dessous) |

---

## modification.txt

- [x] **Non requis** — session d'audit en lecture seule, aucun code applicatif modifié. Les seuls artefacts générés (build `ios/apptel`, cache `tsconfig.tsbuildinfo`) ont été restaurés/supprimés pour ne pas polluer le working tree.

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| Le Config live (P0-P3, MODIF 1341) et les features hôte préexistantes (goals/rewards/triggers) sont **entièrement invisibles sur mobile** (iOS Capacitor + APK) car `ios/apptel/src/pages/LivePage.tsx` n'importe jamais `LiveHostPanel`. Ce n'est pas un bug de cette session — c'est un choix (ou un oubli) architectural antérieur, révélé par le comment de portage déjà présent dans le fichier. | **Décision requise** : (a) porter le panel complet sur mobile (chantier L, cf. plan E #2), (b) porter uniquement une version simplifiée (annonce/sondage en lecture pour viewers — chantier S, plan E #3), ou (c) accepter l'écart tel quel (hôtes mobiles restent en mode OBS-only). |
| Test manuel réel iOS/Android non exécuté (pas de device/simulateur disponible dans cet environnement) | Recommandé de tester sur device physique ou simulateur Xcode/Android Studio avant toute annonce produit de ces features comme "disponibles partout". |

---

## Prochaines étapes

1. Trancher la décision produit ci-dessus (item Bloquers #1).
2. Si portage décidé : nouvelle session dédiée (`@onscen-dev-agent`) pour créer un `LiveHostPanel` mobile ou brancher `LivePinnedAnnouncementBanner`/`LivePollWidget` côté viewer apptel.
3. Fix rapide et à faible risque, indépendant de la décision produit : `LiveKitPeerTile` safe-area (plan E #4).
4. Test manuel sur device réel dès qu'un Mac (iOS) ou un poste avec Android Studio/JDK 21 est disponible.

---

## Notes techniques (optionnel)

- Le dossier `ios/apptel/android/` **existe et est peuplé** sur ce poste de développement (contrairement au constat de l'audit du 22/07 qui le décrivait vide — probablement régénéré depuis via `npx cap add android` lors d'une session ultérieure). `targetSdkVersion`/`compileSdkVersion` = 36 dans `variables.gradle`, conforme à l'exigence Google Play du 31/08/2026.
- `livekit-client` n'est physiquement présent que dans `web/app/node_modules` ; la résolution fonctionne pour apptel par effet de bord de la résolution Node.js à partir du chemin réel du fichier importeur (`web/app/src/components/LiveKitVideoStage.tsx`), pas par une configuration explicite. Fragile en environnement CI qui n'installerait que `ios/apptel/`.
- Aucun secret de signing, aucune régression de permission, aucune dépendance Capacitor obsolète détectée au-delà de ce qui était déjà documenté dans `commun/docs/audit/AUDIT-mobile-ios-android.md`.

---

*Généré par OnScen Dev Agent — ne pas éditer le template `_TEMPLATE.md`*
