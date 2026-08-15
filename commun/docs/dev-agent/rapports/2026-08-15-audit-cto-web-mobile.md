# Rapport Dev Agent — 2026-08-15 — Audit CTO web + mobile

**Agent :** @onscen-dev-agent  
**Date :** 2026-08-15  
**Durée estimée :** 4 h  
**Statut global :** ⚠️ Partiel (correctifs code livrés ; ops / stores / légal hors repo)

---

## Mission

Audit CTO profond web + iOS/Android, puis implémentation de toutes les recommandations **codables**.

---

## Contexte / problème

Inscriptions ouvertes, ~10 users prod, surface live/UGC/géo/paiements. Audits 08-11 encore vrais pour CSAM / WAF / Git / IAP stores. Le fondateur a demandé d’appliquer toutes les recos.

---

## Actions réalisées

- [x] Plafonds d’inscription + alerte `registration_spike`
- [x] Blocage Stripe natif (header `X-OnScen-Client`, 403 sans « navigateur »)
- [x] `ageConfirmed` dons / abonnements ; Connect 18+
- [x] Géo précise masquée pour mineurs (picker, events, salon create)
- [x] Fail-closed Sightengine / ACRCloud (si configuré) en prod
- [x] `RESEND_FROM` obligatoire en prod
- [x] Rate-limits track / support ; check-username délai + limiter
- [x] Bottom-sheets + touch 44 px + error boundary par vue
- [x] AASA paths, Privacy Manifest audio, entitlements www, Sentry slug
- [ ] StoreKit / Play Billing / Sign in with Apple natif (comptes stores)
- [ ] PhotoDNA, WAF DNS, purge Git, restore backup (ops)

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/lib/clientPlatform.ts` | Détection client + 403 IAP |
| `commun/backend/src/lib/registrationVolumeLimit.ts` | Plafonds inscriptions |
| `commun/backend/src/routes/auth.ts` | Volume + check-username |
| `commun/backend/src/routes/oauth.ts` | Volume + IP |
| `commun/backend/src/routes/donations.ts` | Natif + âge |
| `commun/backend/src/routes/subscriptions.ts` | Natif + âge |
| `web/app/src/App.tsx` | Error boundary `resetKey` |
| `web/app/src/components/ConfirmModal.tsx` + ~20 sheets | Bottom-sheet mobile |
| `ios/apptel/src/lib/api/core.ts` | Header natif |

Audit : `commun/docs/audit/2026-08-15-cto-web-mobile.md`

---

## Commandes exécutées

```text
cd commun/backend && npx vitest run … (6 files)  → ✅ 38/38
cd web/app && npx tsc -b                         → ✅
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend (6 fichiers, 38 tests) | ✅ |
| Typecheck frontend `tsc -b` | ✅ |
| Test manuel | non |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1433)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| ACRCloud | Rester absent (déjà décidé) ou fournir les clés |
| Google OAuth prod | Recréer le client (actuel `deleted_client`) |
| Apple Team ID | Remplacer `TEAM_ID` dans AASA |
| IAP stores | Compte Apple / Play + StoreKit — pas cette session |
| CSAM | Contrat PhotoDNA / NCMEC + avocat |
| Deploy | Uniquement sur demande explicite |

---

## Prochaines étapes

1. Recréer OAuth Google + `APPLE_TEAM_ID`
2. Projet IAP natif avant soumission stores
3. Deploy preprod/prod seulement si demandé

---

*Généré par OnScen Dev Agent — ne pas éditer le template `_TEMPLATE.md`*
