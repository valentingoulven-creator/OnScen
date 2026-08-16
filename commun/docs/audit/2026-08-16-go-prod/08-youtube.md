# Phase 8 — YouTube

**Date :** 2026-08-16 · **Statut :** Mitigé par coupure OAuth · risque embed restant  
**Détail API :** voir `06-apis.md`.

## Constat

| Point | Statut | Preuve |
| ----- | ------ | ------ |
| YouTube Data API key | Nom présent prod | Env names |
| IFrame / embed | Autorisé CSP | Headers prod |
| OAuth YouTube | **Coupé** (`GOOGLE_OAUTH_PROD_ENABLED` absent) | `googleOAuthPublic.ts` |
| Téléchargement serveur | Constat historique « absent » | **NON REVÉRIFIÉ** grep 2026-08-16 |
| Fond d’écran / salon | Code salons existe ; liaison compte off | Repo |
| Quota / consent / révocation | **NON VÉRIFIÉ** | Pas de console Google |
| Branding YouTube | **NON VÉRIFIÉ** UI | Pas de navigateur |

Écart vs `AUDIT-legal-youtube-copyright-v2.md` : OAuth désormais **volontairement off** (mitigation 08-15). YT-1/YT-3 historiques (quota, process) **TOUJOURS OUVERTS** dès réactivation.

**RISQUE :** réactiver OAuth sans client Console valide = régression `deleted_client`.  
**À VALIDER AVOCAT :** usage embed en salon vs ToS YouTube.

## Recommandation

Ne pas remettre `GOOGLE_OAUTH_PROD_ENABLED=1` avant test staging du nouveau client. Relire ToS avant tout push salon YouTube public.
