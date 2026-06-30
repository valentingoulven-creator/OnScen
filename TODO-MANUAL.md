# TODO-MANUAL.md — Tâches non automatisables (post-audit Soundy)

Ces éléments nécessitent une décision produit, une configuration externe, ou une refactorisation majeure planifiée en sprint dédié.

**Dernière revue :** 2026-06-30 (MODIF 882)

---

## Critique — Sécurité

### CRIT-01 — JWT → cookies httpOnly (ELEV-01 partiel)
**Statut :** ✅ **Web implémenté** (2026-06-21+) — cookie `soundy_auth` httpOnly Secure SameSite=Strict ; `authStorage.ts` no-op web.
**Reste :** Native Capacitor utilise Keychain/Keystore via override apptel (acceptable stores).
**Risque résiduel :** XSS sur web ne vole plus le JWT (cookie httpOnly).

### ELEV-01 — Révocation JWT (blacklist)
**Statut :** ✅ **Implémenté via `tokenVersion`** — `revokeSessionForToken()` + `POST /api/auth/logout` bump la version ; JWT invalidés sans table jti.
**Alternative future :** blacklist Redis si besoin révocation granulaire avant expiry.

### ELEV-07 — Stores OAuth en mémoire (vs Redis)
**Statut :** ⏳ Ouvert
**Risque :** En cas de redémarrage serveur, états OAuth CSRF en cours perdus.
**Action :** Migrer `oauthStates` / `oauthExchangeCodes` vers Redis ou PostgreSQL TTL.
**Effort estimé :** 0.5 jour si Redis disponible.

---

## Critique — Business / Légal

### C1 — IAP Apple/Google (remplacer Stripe)
**Statut :** ⚠️ **Garde-fous natifs en place** — `CreatorSubscribeSheet`, `LiveDonationSheet` bloquent Stripe sur app native (App Store 3.1.1).
**Reste :** Implémenter StoreKit 2 / Play Billing + sync backend (4–8 semaines).
**Décision produit requise :** modèle web vs mobile natif.

### C3 — Sign in with Apple
**Statut :** ✅ **Code prêt** — backend `GET /api/auth/apple` + UI AuthPage si `APPLE_CLIENT_ID` configuré.
**Reste :** Apple Developer Program + App Store Connect + variables prod `APPLE_*`.

### C6 — Mentions légales incomplètes
**Statut :** ⚠️ **Partiel** — SIREN, hébergeur, DPO email OK ; **adresse postale** via `LEGAL_PUBLISHER_ADDRESS` en prod (non versionnée).
**Action fondateur :** Renseigner `LEGAL_PUBLISHER_ADDRESS` (et optionnellement autres `LEGAL_PUBLISHER_*`) dans `/opt/soundly/.env` prod.
**Fichiers :** `msdev/legal-publisher.example.json`, `commun/deploy/legal-publisher.template.json`, `backend/src/lib/legalPublisher.ts`.

### C7 — URL privacy publique
**Statut :** ✅ **OK** — `GET /privacy` public sans auth (`backend/src/server.ts`).

---

## Architecture — Capacitor Mobile

### C5 — Projet Android manquant
**Statut :** ⏳ Ouvert — voir commandes ci-dessous.
```bash
cd apptel
npx cap add android
```

---

## UX — Sprints futurs

### C10 — Onboarding 9 étapes → 3 étapes maximum
**Statut :** ⏳ Sprint futur

### F1 — Remplacer les alert() / window.confirm() restants
**Statut :** ⏳ Partiel — voir liste fichiers dans historique audit.

---

## React Compiler / ESLint (MODIF 882)

**Statut :** ⚠️ Règles React Compiler (`set-state-in-effect`, `refs`) en **warn** — migration incrémentale ; CI passe sur errors only.
**Hook utilitaire :** `app/src/hooks/useSyncRef.ts` pour remplacer `ref.current = state` au render.

---

## Résumé priorisation (mise à jour 2026-06-30)

| Priorité | Item | Statut | Risque si non fait |
|----------|------|--------|-------------------|
| 🔴 | CRIT-01 JWT httpOnly web | ✅ Fait | — |
| 🔴 | C1 IAP Apple/Google | ⚠️ Garde natif | Rejet App Store sans IAP |
| 🔴 | C3 Sign in with Apple | ⚠️ Config Apple | Rejet si Google sans Apple |
| 🟠 | ELEV-01 Révocation JWT | ✅ tokenVersion | — |
| 🟠 | C6 Mentions légales | ⚠️ Adresse .env | Risque LCEN |
| 🟡 | ELEV-07 Redis OAuth | ⏳ | OAuth restart |
| 🟡 | C5 Android project | ⏳ | Pas de déploiement Android |
| 🟡 | React Compiler ESLint | ⚠️ Warn | Dette technique |
| 🟢 | C10 Onboarding | ⏳ | Abandon inscription |
| 🟢 | F1 alert() restants | ⏳ | UX |
