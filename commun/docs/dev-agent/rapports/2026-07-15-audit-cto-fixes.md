# Rapport Dev Agent — 2026-07-15 — Audit CTO fixes

**Agent :** @soundy-dev-agent  
**Date :** 2026-07-15  
**Durée estimée :** ~2 h  
**Statut global :** ✅ Terminé (hors signatures DPA / clés ACRCloud prod)

---

## Mission

Implémenter les recommandations de l'audit CTO (sécurité, légal, UX onboarding, dette admin).

---

## Contexte / problème

Audit CTO ~86/100 avec écarts P0 Sentry/CMP, docs sous-traitants incomplets, uploads non limités,
IDs user prévisibles, requireAdmin dupliqué, photos profil en base64 JSONB, onboarding 9 étapes.

---

## Actions réalisées

- [x] Sentry gated derrière consentement cookies (`hasAnalyticsCookieConsent`)
- [x] Privacy / cookies / DPA : LiveKit, Sightengine, ACRCloud, Sentry, Cloudflare Stream
- [x] Rate-limit uploads (reels, compositions, stories, profil, chat attachments)
- [x] `generateUserId()` crypto pour auth + OAuth
- [x] `middleware/requireAdmin.ts` — 11 fichiers admin refactorés
- [x] Photos profil persistées en fichiers (`profilePhotoAssets.ts`)
- [x] ACRCloud fail-closed production (`productionStartup`)
- [x] Filtre texte chat basique (`chatTextFilter` + `sanitizeChatText`)
- [x] Onboarding 9 → 3 étapes (goûts / profil / position)

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `web/app/src/lib/sentry.ts` | Init/shutdown selon CMP |
| `web/app/src/lib/cookieConsent.ts` | `hasAnalyticsCookieConsent()` |
| `web/app/src/content/legal/*.ts` | Sous-traitants + Sentry cookies |
| `commun/backend/src/middleware/requireAdmin.ts` | Admin centralisé |
| `commun/backend/src/lib/uploadRateLimits.ts` | Limiters uploads |
| `commun/backend/src/lib/profilePhotoAssets.ts` | Fichiers profil |
| `commun/backend/src/lib/userIds.ts` | IDs sécurisés |
| `commun/backend/src/lib/chatTextFilter.ts` | Masquage insultes |
| `commun/backend/src/routes/admin*.ts` (+ access, support, diagnosticLogs) | Import requireAdmin |
| `commun/backend/src/routes/auth.ts` | Photos fichiers + limiter |
| `web/app/src/pages/OnboardingPage.tsx` | 3 étapes |

---

## Commandes exécutées

```text
cd commun/backend && npm test        → ✅ (361/361)
cd web/app && npm run build          → ✅
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend | ✅ 361 tests |
| Build frontend | ✅ |
| Test manuel CMP/Sentry | Non fait (à valider navigateur) |

---

## modification.txt

- [x] MODIF 1043 — Implémentation recommandations audit CTO

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| DPA signatures (Scaleway, Cloudflare, Stripe, Resend, LiveKit, Sightengine, Sentry) | Signer depuis dashboards respectifs |
| Clés ACRCloud prod | Provisioning `.env.production` avant prochain deploy |
| Migration photos base64 existantes | Optionnel : script one-shot si volume important en PG |

---

## Prochaines étapes

1. Valider manuellement bannière cookies → Sentry actif/inactif
2. Provisionner `ACRCLOUD_*` prod avant deploy (boot fail-closed)
3. Signer DPA et mettre à jour `dpaStatus` dans `dpa.ts`

---

*Généré par Soundy Dev Agent*
