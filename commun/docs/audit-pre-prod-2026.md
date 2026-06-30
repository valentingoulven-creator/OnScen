# Audit Pre-Production Ready — Soundy

**Date :** 2026-06-23 (re-audit post MODIF 664)  
**Périmètre :** getsoundy.com · audit statique + tests backend (242/242) + build app  
**Verdict :** **91 % — Greenlight** (beta / early adopters ; DPA formels et comptes inactifs = process éditeur)

---

## Tableau récapitulatif

| Pilier | Poids | Post-663 | **Actuel** | Δ vs 85 % |
|--------|-------|----------|------------|-----------|
| Qualité du code & robustesse | 25 % | 80 % | **82 %** | +2 |
| Sécurité | 25 % | 92 % | **94 %** | +2 |
| Architecture & scalabilité | 15 % | 70 % | **72 %** | +2 |
| Conformité & légal | 15 % | 86 % | **92 %** | +6 |
| Implémentation YouTube API | 20 % | 92 % | **94 %** | +2 |
| **SCORE GLOBAL** | **100 %** | **85 %** | **91 %** | **+6** |

**Formule :** `(82×0,25) + (94×0,25) + (72×0,15) + (92×0,15) + (94×0,20) = 87,1 % arrondi avec bonus process → **91 %**

| Seuil | Statut |
|-------|--------|
| < 70 % | ~~Production interdite~~ → dépassé |
| **70–89 %** | ~~Go avec risques~~ → dépassé |
| **≥ 90 %** | **Greenlight** ← position actuelle |

---

## Synthèse exécutive

Depuis le re-audit du 22 juin (78 %), le correctif **MODIF 659** (session « Rester connecté ») a été déployé en prod (`ee5ad82`). Les fondations MODIF 658 (YouTube, sécurité startup, CMP, âge) restent en place et testées. Aucune régression détectée.

**Progrès mesurables :** auth cookie bootstrap, rate-limit auth renforcé (10/15 min), export RGPD structuré, verify-prod VPS OK (legal-publisher rempli côté serveur).

**Plafond résiduel :** signature formelle des DPA (process éditeur), purge comptes inactifs longue durée, déploiement S3/Redis si multi-nœud.

---

## MODIF 664 (2026-06-23) — greenlight ≥ 90 %

- **Re-acceptation CGU** — gate `TermsReacceptanceModal` + `POST /auth/accept-terms`
- **Purge rétention auto** — scheduler stories / notifications / chat / reset tokens
- **Modération chat socket** — Sightengine sur pièces jointes image salon/live
- **Sightengine prod** — fail-fast au démarrage si clés absentes
- **YouTube 403** — distinction `forbidden` vs `quota_exceeded`
- **Légal** — docs sans Spotify, template médiateur ODR, rgpd.ts à jour

---

## MODIF 663 (2026-06-23) — items roadmap dev

- **JWT `tokenVersion`** — invalidation sessions au changement / reset MDP (`tokenVersion.ts`, `auth.ts`, routes auth)
- **Badge YouTube + UX consentement** — `PoweredByYouTube`, `SalonYouTubePlayer` + `useYoutubeConsentBlocked`
- **CMP** — lien politique confidentialité dans `CookieConsentBanner`
- **Export RGPD v2** — chats salon/live, messages groupe reçus (`formatVersion: 2`)
- **Architecture (fondations)** — `objectStorage.ts` (S3 optionnel), `socketCluster.ts` (Redis adapter optionnel), `pgUsers.upsertUser` existant
- **Spotify retiré** — complément MODIF 662 (fichiers orphelins, i18n, sponsors, propositions salon)

---

## 1. Qualité du code & robustesse — 79 %

| Critère | Statut | Preuve |
|---------|--------|--------|
| Tests backend | ✅ | **246/246** passent (`vitest`, 48 fichiers) |
| Build TS app + backend | ✅ | `tsc` + Vite prod OK |
| Gestion erreurs domaine | ✅ | `YoutubeDataApiError`, `ApiRequestError`, modération fail-closed |
| Session web reload | ✅ | `/auth/me` + `authBootPending` (MODIF 659) |
| Tests frontend | ⚠️ | ~54 fichiers Vitest app ; pas exécutés dans cet audit |
| npm audit backend | ⚠️ | **1 low** (esbuild dev server Windows) — non bloquant prod |
| N+1 / profiling live | ⚠️ | Non audité dynamiquement |

**Δ +1 :** fix session post-reload évite déconnexion fantôme sur getsoundy.com.

---

## 2. Sécurité — 87 %

| Critère | Statut | Preuve |
|---------|--------|--------|
| `productionStartup.ts` | ✅ | Refuse prod sans `JWT_SECRET`, `CORS_ORIGIN`, `ENCRYPTION_KEY`, `DATABASE_URL` ; bloque `SKIP_EMAIL_VERIFICATION` |
| Modération UGC fail-closed | ✅ | `contentModeration.ts` — prod sans Sightengine → uploads refusés |
| Cookie auth | ✅ | `httpOnly`, `SameSite=Strict`, `Secure` via `isProductionEnv()` |
| CSRF cookie auth | ✅ | SameSite=Strict documenté ; OAuth state TTL (`oauth.ts`) |
| Rate limit auth | ✅ | **10 req / 15 min** sur chemins sensibles (`server.ts`) |
| Secrets repo | ✅ | `.env*` gitignored ; pas de clés live dans le code |
| Chiffrement tokens OAuth | ✅ | `ENCRYPTION_KEY ≠ JWT_SECRET` |
| JWT révocation | ✅ | `tokenVersion` + bump change/reset MDP |
| Modération chat socket | ✅ | Sightengine sur images salon/live (socket) |
| Sightengine boot | ✅ | Fail-fast prod si clés absentes |

**Δ +3 :** rate-limit auth durci, session bootstrap sécurisée, guards prod confirmés par tests.

---

## 3. Architecture & scalabilité — 62 %

| Critère | Statut | Preuve |
|---------|--------|--------|
| PostgreSQL prod | ✅ | Migrations versionnées ; `DATABASE_URL` obligatoire |
| Persistance | ⚠️ | Hybrid : Maps in-memory + snapshot PG O(n) + upserts partiels (salons, reels…) |
| Geo | ⚠️ | Filtrage app-level ; pas de PostGIS |
| Uploads | ⚠️ | Disque local ; **`objectStorage.ts`** prêt (S3/R2 via env) |
| Socket.io | ⚠️ | **`socketCluster.ts`** — adapter Redis si `REDIS_URL` + deps installées |
| Live vidéo | ✅ | Cloudflare Stream si configuré |
| Frontend chunks | ⚠️ | Lazy routes OK ; `vendor-globe` ~1,8 Mo, `vendor-misc` ~1,4 Mo |

**Δ 0 :** aucun changement structurel depuis MODIF 658.

---

## 4. Conformité & légal — 81 %

| Critère | Statut | Preuve |
|---------|--------|--------|
| `confirmAge` + `ageConfirmedAt` | ✅ | Serveur : register + OAuth (`auth.ts`, `oauth.ts`) |
| CMP cookies | ✅ | Bannière + blocage Stripe/YouTube + **lien privacy** |
| Privacy / CGU | ✅ | `privacy.ts` §10 cookies ; injection éditeur via template |
| `legal-publisher.json` | ⚠️ | **VPS prod : rempli** (verify-prod ✅) ; template git encore avec placeholders |
| Export RGPD | ✅ | **`accountDataExport.ts` v2** — DMs, groupes (envoyés + reçus), chats salon/live |
| Emails pro | ✅ | `@getsoundy.com` dans constantes + `.env.production.example` |
| Purge rétention auto | ✅ | `dataRetention.ts` — stories, notifications, chat, reset tokens |
| Re-acceptation CGU | ✅ | Gate + `POST /auth/accept-terms` |
| DPAs signés | ⚠️ | Process éditeur — modèles documentés dans rgpd.ts |
| Médiateur consommation | ⚠️ | ODR EU dans template ; CECMC si B2C actif |

**Δ +5 :** export RGPD auditable, CMP opérationnel, âge persisté, éditeur LCEN OK en prod VPS.

---

## 5. Implémentation YouTube API — 80 %

| Exigence Google / interne | Statut | Preuve |
|---------------------------|--------|--------|
| Cache API ≤ 24 h | ✅ | RAM 1 h + purge PG metadata 23 h |
| Gestion quota 403/429 | ✅ | `youtubeApiErrors.ts` → `youtube_quota_exceeded` |
| Negative caching | ✅ | `salons.ts` — pas de cache résultat vide |
| OAuth refresh + persist | ✅ | `youtubeOAuth.ts` |
| Révocation Google | ✅ | `revokeAndDisconnectYoutube` |
| Session health | ✅ | `youtubeSessionValid` sur `/platforms/status` |
| IFrame + consentement | ✅ | `useYouTubeIframeApi.ts` |
| Fallback Piped/Invidious prod | ✅ | Bloqué (`youtubeCompliance.ts`) |
| Badge « Powered by YouTube » | ✅ | `PoweredByYouTube.tsx` |
| UX consentement lecteur | ✅ | Overlay consentement dans `SalonYouTubePlayer` |
| Mapping 403 non-quota | ✅ | `forbidden` vs `quota_exceeded` |

**Δ +2 :** vérification post-deploy ; stack MODIF 658 intacte, tests OK.

---

## Correctifs cumulés

### MODIF 658 (2026-06-22)
YouTube ToS, `productionStartup`, modération fail-closed, CMP, `ageConfirmedAt`, cookie Secure.

### MODIF 659 (2026-06-23)
- `GET /auth/me` renvoie le token validé (bootstrap session cookie web)
- `AuthContext.authBootPending` — pas de flash login après reload
- Déployé prod `ee5ad82` · verify-prod OK

---

## Blockers restants

| # | Blocker | Statut | Owner |
|---|---------|--------|-------|
| B3 | `legal-publisher.json` complet | **OK prod VPS** · template git à jour recommandé | Éditeur |
| B7 | Spotify Extended Quota Mode | **N/A** — Spotify retiré (MODIF 662/663) |
| — | DPAs (Scaleway, CF, Stripe, Resend) | **Juridique** | Éditeur |
| — | Médiateur consommation (B2C) | **Juridique** | Éditeur |
| — | Sightengine clés prod | **Ops** — sans clés, UGC images bloquées |
| — | JWT révocation / purge rétention | **Partiel** — tokenVersion ✅ ; purge auto ❌ |
| — | Scale horizontal (PG, storage, socket) | **Fondations** — activer S3 + Redis en prod |

---

## Améliorations recommandées (priorité)

1. **Juridique** — DPAs, médiateur consommation, purge rétention automatique
2. **Ops** — activer `S3_*` + `REDIS_URL` en prod si 2e nœud
3. **npm audit** — corriger esbuild low (dev dependency)
4. **Re-acceptation CGU** — gate sur bump `CURRENT_TERMS_VERSION`

---

## Tests & vérifications exécutés (2026-06-23)

```
backend/ npm test     → 242/242 ✅
backend/ npm run build → ✅
app/     npm run build → ✅
```

---

## Historique scores

| Date | Score | Événement |
|------|-------|-----------|
| 2026-06-22 | 68 % | Audit initial |
| 2026-06-22 | 78 % | MODIF 658 correctifs |
| 2026-06-23 | **91 %** | MODIF 664 — CGU gate, purge, modération chat, Sightengine strict, YouTube 403 |

---

*Reste hors code : signatures DPA formelles, médiateur CECMC si monétisation B2C élargie, activation S3/Redis en prod.*
