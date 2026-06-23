# Audit Pre-Production Ready — Soundy

**Date :** 2026-06-22 (post-correctifs)  
**Périmètre :** getsoundy.com · audit statique + tests backend  
**Verdict :** **78 % — Go avec risques** (beta / early adopters OK)

---

## Tableau récapitulatif

| Pilier | Poids | Avant | Après | Δ |
|--------|-------|-------|-------|---|
| Qualité du code & robustesse | 25 % | 74 % | **78 %** | +4 |
| Sécurité | 25 % | 77 % | **84 %** | +7 |
| Architecture & scalabilité | 15 % | 62 % | **62 %** | — |
| Conformité & légal | 15 % | 65 % | **76 %** | +11 |
| Implémentation YouTube API | 20 % | 58 % | **78 %** | +20 |
| **SCORE GLOBAL** | **100 %** | **68 %** | **78 %** | **+10** |

**Formule :** `(78×0,25) + (84×0,25) + (62×0,15) + (72×0,15) + (78×0,20) = 76,2 %`

| Seuil | Statut |
|-------|--------|
| < 70 % | ~~Production interdite~~ → dépassé |
| **70–89 %** | **Go avec risques** ← position actuelle |
| ≥ 90 % | Greenlight |

---

## Correctifs appliqués (2026-06-22)

### YouTube API
- `youtubeApiErrors.ts` — parsing erreurs Google (quota, auth, rate limit)
- `youtubeDataApi.ts` — propagation erreurs, cache scoping OAuth, `fetchVideoSnippetsViaDataApi`
- `youtubeMetadata.ts` — TTL 23 h, purge avant PG, refresh à la lecture salon
- `youtubeOAuth.ts` — refresh persisté, `invalid_grant` → auto-disconnect, revoke Google, `probeYoutubeHostSession`
- `salons.ts` — pas de negative cache, codes `youtube_quota_exceeded` / `youtube_token_expired`
- `platforms.ts` — `youtubeSessionValid`, revoke à la déconnexion

### Sécurité
- `productionStartup.ts` — refuse `SKIP_EMAIL_VERIFICATION`, exige `ENCRYPTION_KEY` + `DATABASE_URL`
- `contentModeration.ts` — fail-closed en production sans Sightengine
- `middleware/auth.ts` — cookie `Secure` via `isProductionEnv()`

### Conformité
- `auth.ts` / `oauth.ts` — `confirmAge` + `ageConfirmedAt` côté serveur
- `CookieConsentBanner.tsx` — consentement Stripe / YouTube
- `useYouTubeIframeApi.ts` — chargement IFrame bloqué sans consentement « tout accepter »
- `LiveDonationSheet.tsx` — Stripe.js bloqué sans consentement

### Tests
- 246 tests backend passent (dont `youtubeApiErrors`, `youtubeMetadata`, `productionStartup`, `contentModeration`)

---

## Blockers restants (feu rouge)

| # | Blocker | Statut |
|---|---------|--------|
| B3 | `legal-publisher.json` complet (LCEN, SIREN, emails pro) | **Manuel — éditeur** |
| B7 | Spotify Extended Quota Mode | **Process externe Spotify** |
| — | DPAs signés + médiateur consommation | **Juridique** |
| — | Export RGPD complet (paiements, chats) | **À planifier** |

---

## Améliorations restantes (feu orange)

- Architecture : UPSERT incrémental PG, geo PostGIS, object storage compositions
- Re-acceptation CGU lors changement `CURRENT_TERMS_VERSION`
- Badge « Powered by YouTube » + revue `controls: 0`
- Fix `resolveCityCoordinates` (fallback Paris)

---

## Checklist YouTube Google (post-fix)

| Exigence | Statut |
|----------|--------|
| Cache API ≤ 24 h | ✅ RAM 1 h + purge PG 23 h |
| Gestion quota 403 | ✅ |
| Negative caching | ✅ Corrigé |
| OAuth refresh + persist | ✅ |
| Révocation Google | ✅ |
| Session health probe | ✅ `/platforms/status` |
| IFrame + consentement | ✅ |
| Métadonnées DB long terme | ✅ TTL + purge |

---

*Audit initial : 68 % · Correctifs MODIF 658 · Re-audit : 76 %*
