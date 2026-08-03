# Extrait TODO-MANUAL — Business / Légal

> Source : `TODO-MANUAL.md` (racine du dépôt) — section « Critique — Business / Légal ».  
> À lire avec le dossier avocat ; le fichier complet contient aussi mobile, UX, etc.

---

## C1 — IAP Apple/Google (remplacer Stripe)

**Statut :** ⚠️ **Garde-fous natifs en place** — `CreatorSubscribeSheet`, `LiveDonationSheet` bloquent Stripe sur app native (App Store 3.1.1).

**Reste :** Implémenter StoreKit 2 / Play Billing + sync backend (4–8 semaines).

**Décision produit requise :** modèle web vs mobile natif.

---

## C3 — Sign in with Apple

**Statut :** ✅ **Code prêt** — backend `GET /api/auth/apple` + UI AuthPage si `APPLE_CLIENT_ID` configuré.

**Reste :** Apple Developer Program + App Store Connect + variables prod `APPLE_*`.

---

## C6 — Mentions légales incomplètes

**Statut :** ⚠️ **Partiel** — SIREN, hébergeur, DPO email OK ; **adresse postale** via `LEGAL_PUBLISHER_ADDRESS` en prod (non versionnée).

**Action fondateur :** Renseigner `LEGAL_PUBLISHER_ADDRESS` (et optionnellement autres `LEGAL_PUBLISHER_*`) dans `/opt/soundly/.env` prod.

**Fichiers :** `msdev/legal-publisher.example.json`, `commun/deploy/legal-publisher.template.json`, `backend/src/lib/legalPublisher.ts`.

---

## C7 — URL privacy publique

**Statut :** ✅ **OK** — `GET /privacy` public sans auth (`backend/src/server.ts`).

---

*Extrait pour dossier avocat — juillet 2026*
