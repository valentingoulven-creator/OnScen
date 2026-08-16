# Phase 6 — APIs externes + YouTube (phases 10 et 12 du prompt)

**Date :** 2026-08-16 · **Statut :** Partiel  
**Niveau de preuve :** présence de **noms** de variables (VPS + copies locales) · dashboards **NON VÉRIFIÉ**

## Matrice

| API | Présente (noms) | Prod | Staging | Quota | Fail-open/closed | Coût scale | DPA | Risque |
| --- | --------------- | ---- | ------- | ----- | ---------------- | ---------- | --- | ------ |
| LiveKit | Oui | Health `ok` | `ok` | NV | NV | Élevé si CCU | NV | Critique live |
| Cloudflare Stream | Oui | Noms OK | Noms OK | NV | Sampling live CF only | Bandwidth | NV | Lives OBS |
| Cloudflare Turnstile | Oui | `TURNSTILE_REQUIRED=1` | 1 | NV | Requis | Faible | NV | Anti-bot |
| Cloudflare WAF/CDN | Non (DNS) | **Inactif** | — | — | — | — | — | P1-03 |
| Stripe Connect | Oui | **`sk_test`** + dons/abos **0** | `sk_test` ; dons **1** | NV | Guard `STRIPE_TEST_IN_PROD` | — | NV | Pas de live |
| Sightengine | Oui | Enabled, fail-open **0** | idem | NV | **Fail-closed** hors msdev | Par scan | NV | OK technique |
| PhotoDNA | **Non** | Absent | Absent | — | skip si pas de clé | Contrat | NV | **P0-03** |
| Google OAuth | Oui | Coupé (flag absent) | NV | NV | Feature off | — | NV | P1-02 |
| YouTube Data/IFrame | Clé nom présent | OAuth off | NV | NV | Embed only | Quota API | NV | Suspension si abus |
| Resend | Oui | Noms OK | Noms OK | NV | Startup exige FROM prod | Email | NV | Transactionnel |
| Scaleway S3 | Oui | Offsite sync OK | Sync présent | NV | — | Stockage | NV | Backups |
| Nominatim / géocode | Code | NV live | NV | ToS | — | — | NV | Rate Nominatim |
| ACRCloud | **Non** | Absent | Absent | — | Si configuré : fail-closed prod ; si absent : **pas de blocage** | Par scan | NV | **P1-08** |
| Sentry | Oui | DSN présent | DSN présent | NV | Boot fail sans DSN prod | Events | NV | Dashboard NV |
| Redis | Oui | Health `ok` | `ok` | — | Boot fail si PM2>1 sans Redis | — | — | C5 partiel |
| Facebook / IG | Non | Absent | Absent | — | — | — | — | P2 |
| Apple Sign In | Code | `APPLE_TEAM_ID` **absent** env prod | — | — | — | — | NV | Stores |

NV = NON VÉRIFIÉ (dashboard / quota / DPA).

## Stripe

Prod : préfixe `sk_test` ; `DONATIONS_ENABLED=0` ; `SUBSCRIPTIONS_ENABLED=0`.  
Webhook unsigned → 400.  
**CONSTAT TECHNIQUE :** aucun encaissement réel possible en l’état.  
Si le marketing annonce les dons : fonctionnalité critique **off** → P1-01.

## OAuth Google

`productionStartup.ts` : warning `deleted_client` tant que `GOOGLE_OAUTH_PROD_ENABLED !== 1`. Flag **absent** prod. Client Console : **NON VÉRIFIÉ** (pas d’accès Google Cloud).

## ACRCloud

`checkUploadedAudioCopyright` : si non configuré → `null` (upload accepté) + warn startup.  
Décision 08-15 : absence volontaire. **À reconfirmer** (question §8 synthèse).

## YouTube (détail phase 12)

Comparé à `AUDIT-legal-youtube-copyright-v2.md` et audits 08-11 :

- Pas de téléchargement serveur (constat historique, non re-grep exhaustif 2026-08-16 — **partiellement NON VÉRIFIÉ**).
- IFrame / embed autorisés par CSP (`youtube.com`, `youtube-nocookie.com`).
- OAuth YouTube **coupé** en prod → salons liés YouTube utilisateur : **indisponibles**.
- Quota / consent screen / révocation : **NON VÉRIFIÉ** (dashboard).
- Risque suspension : réduit tant que OAuth est off ; reste l’embed + Data API key.

**CONSTAT TECHNIQUE** ≠ avis ToS avocat.
