# Refonte UX totale — OnScen (proposition CTO)

**Date :** 2026-07-15  
**Statut :** Analyse / recommandation — pas d’implémentation  
**Sources :** `web/app/src` · `commun/docs/audit-cto-20260619.md` (UX-01…07) · e-Soleau §3–4 · Pitch Deck  

**Prototype clickable :** [`commun/docs/ux-prototypes/core-journey.html`](./ux-prototypes/core-journey.html) — ouvrir dans le navigateur.

---

## Verdict

OnScen a le bon récit produit (`découverte → écoute → live → IRL`) mais une **IA d’accrétion**.  
**Recommandation : Core Journey** — 4 modes + hub Créer + SessionBar globale, sans tuer la carte ni les salons.

---

## Diagnostic

| Signal | Preuve |
|--------|--------|
| God pages (>2k lignes) | `DmPage` ~3350 · `HomePage` ~2780 · Actualités/Reels ~2180 |
| Dettes UX auditées | UX-01…07 |
| Dock divergent | Web : Actualités · Carte · DM · Music · Reels ≠ Apptel : Carte · Actualités · Live · DM · Reels |
| Carte saturée | Globe + nearby + stories + create + listen sheets + ads + sessions dans `HomePage` |
| Navigation | State machine `App.tsx` (pas URL-first) |

**En une phrase :** chaque surface empile découverte + création + session + social — le modèle mental est saturé.

---

## Alternatives

| Option | Contenu | Verdict |
|--------|---------|---------|
| **A — Refresh cosmétique** | Tokens, empty states, onboarding 3 steps | Insuffisant |
| **B — Core Journey** | 4 modes + Créer + SessionBar ; parity web/apptel | **Recommandé** |
| **C — Feed-first TikTok** | Reels/Actualités hub unique | Rejeté (tue le moat) |

---

## IA cible (Core Journey)

```
Dock unifié (web = apptel)
├── Accueil     → social local (stories + « ce soir près de toi » + feed léger)
├── Monde       → canvas géo + filtres + liste
├── [Créer]     → FAB central : Salon | Live | Reel | Story | Event
├── Social      → DM + notifs + matchs
└── Profil      → même shell visité/propre ; Settings hors onglet profil

Couche Session (globale)
└── SessionBar / mini-player : salon petit ↔ grand · live · PiP
```

**Music :** section Accueil + compositions profil (pas d’onglet dédié — décision fondateur possible).  
**Landing post-login :** Accueil partout (pas Carte-only sur apptel).

---

## Principes UX non négociables

1. One job per screen  
2. Progressive disclosure (onboarding 3 steps)  
3. Continuité de session (petit/grand salon = même session)  
4. Parity web / apptel  
5. Créer au centre (FAB)  
6. Empty → 1 CTA  
7. Mobile 390 first (44px touch)

---

## Mapping dettes UX-01…07

| ID | Problème | Phase |
|----|----------|-------|
| UX-01 | Onboarding 9 steps | P1 — 3 steps |
| UX-02 | Globe sans guidance | P1 — coach marks |
| UX-03 | Erreurs lecture salon YouTube floues | P3 — error surfacing |
| UX-04 | Compositions sans player | P3 — lecteur inline |
| UX-05 | 5 tabs &lt;375px | P1 — 4 tabs + FAB |
| UX-06 | Empty states faibles | P3 — EmptyState partagé |
| UX-07 | Match denial opaque | P2 — Social hub |

---

## Plan ~12 semaines

| Phase | Sem. | Livrable |
|-------|------|----------|
| **P0** Fondations | 1–2 | Spec IA + inventaire sheets + prototype SessionBar |
| **P1** Nav & onboarding | 3–5 | Dock unifié + onboarding 3 steps + first-run Monde |
| **P2** Découpe Monde & Social | 6–9 | Split `HomePage` / `DmPage` ; routes URL salon/live/profile |
| **P3** Créateur & polish | 10–12 | Hub Créer, empty states, player compositions, erreurs YouTube |

**Découpes code prioritaires :**
- `App.tsx` → `SessionController`
- `HomePage.tsx` → `MapCanvas` + `NearbyShelf`
- `DmPage.tsx` → `DmInbox` / `DmThread` / `DmGroup`
- `MainTabNav.tsx` → même config web + `ios/apptel`

---

## Décisions fondateur (bloquantes avant P1)

1. Valider **Core Journey** (vs A / C)  
2. **Music** : section Accueil vs onglet dédié  
3. **Landing** : Accueil partout ?  
4. Autoriser spec détaillée `commun/docs/UX-CORE-JOURNEY.md` puis sprint via `@onscen-dev-agent`

---

## Sécurité / légal (rappel)

- Gates auth / CGU / géoloc restent avant le shell  
- Onboarding court : consentement géoloc + âge/CGU explicites  
- Labels sponsorisés conservés dans Accueil/Monde  
- Deep links P2 : validation IDs, pas d’open redirect

---

*Handoff implémentation : `@onscen-dev-agent` — phase par phase, pas de big-bang.*
