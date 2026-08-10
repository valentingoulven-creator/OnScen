# Dev Agent — Index des rapports

Rapports produits par `@onscen-dev-agent` à chaque session de développement significative.

| Date | Rapport | Mission | Statut |
|------|---------|---------|--------|
| 2026-08-10 | [audit-technique-complet](./rapports/2026-08-10-audit-technique-complet.md) | Audit 12 phases + synthèse dans `audit/` (lecture seule, npm audit + tests) | ✅ |
| 2026-08-08 | [fix-compat-ios-android](./rapports/2026-08-08-fix-compat-ios-android.md) | Correctifs audit compat iOS/Android : safe-area duo, dépendance LiveKit apptel, viewer mobile (annonce épinglée + sondage) | ✅ |
| 2026-08-08 | [audit-compat-ios-android](./rapports/2026-08-08-audit-compat-ios-android.md) | Audit compatibilité web ↔ iOS Capacitor / APK Android du Config live (MODIF 1341) — révèle que le panel hôte live entier n'est pas porté sur mobile | ⚠️ |
| 2026-08-07 | [audit-technique-implementation-p1](./rapports/2026-08-07-audit-technique-implementation-p1.md) | Implémentation audit technique complet — vague 1 : CSAM (détection + runbook), modération live temps réel, modèles gore/weapon, scan sponsors, filtre commentaires reels, notification admin signalements, rate limiting lives/search/follow/like | ⚠️ |
| 2026-08-07 | [live-config-audit-p0-p3](./rapports/2026-08-07-live-config-audit-p0-p3.md) | Live Config : implémentation audit CTO P0→P3 (triggers persistés, titre/desc/18+/replay, mots bloqués, annonce épinglée, sondages, duo/co-hôte MVP) | ✅ |
| 2026-07-22 | [seed-test-account-full-prod](./rapports/2026-07-22-seed-test-account-full-prod.md) | Compte de test complet en production (`demo_test_founder`, 221 comptes, salons/lives/events/albums/reels/stories/sponsors/follows) — exécuté et vérifié par comptage SQL | ✅ |
| 2026-07-22 | [demo-showcase-seed-prod](./rapports/2026-07-22-demo-showcase-seed-prod.md) | Compte démo « showcase » complet en production (126 comptes, salons/lives/events/albums/reels/stories/sponsors) + scripts seed/cleanup | ✅ |
| 2026-07-22 | [audit-mobile-corrections](./rapports/2026-07-22-audit-mobile-corrections.md) | Corrections audit mobile iOS/Android (Capacitor 8.4.2, cert pinning, reproductibilité Android, CI) | ⚠️ |
| 2026-07-22 | [admin-integrations-configure-button](./rapports/2026-07-22-admin-integrations-configure-button.md) | Bouton "Configurer" mal placé dans la carte provider (onglet Admin Intégrations) | ✅ |
| 2026-07-22 | [admin-integrations-secrets](./rapports/2026-07-22-admin-integrations-secrets.md) | Onglet Admin « Intégrations » : registre générique clés API tierces + détection d'alertes (clé test-en-prod, manquante, placeholder, format invalide) | ✅ |
| 2026-07-22 | [admin-stripe-live-config](./rapports/2026-07-22-admin-stripe-live-config.md) | Saisie/mise à jour des clés Stripe live depuis l'admin (sans SSH) | ✅ |
| 2026-07-21 | [settings-accordion-ux](./rapports/2026-07-21-settings-accordion-ux.md) | Paramètres : accordéon 6 sections + sous-accordéons légal | ✅ |
| 2026-07-21 | [dm-group-system-cto-recos](./rapports/2026-07-21-dm-group-system-cto-recos.md) | Messages groupe : recommandations CTO P0–P3 (sécurité, i18n, tests, création) | ✅ |
| 2026-07-21 | [reels-feed-cache-pagination](./rapports/2026-07-21-reels-feed-cache-pagination.md) | Reels : cache court du classement feed + pagination additive (suite audit CTO) | ✅ |
| 2026-07-21 | [map-event-preview-ux](./rapports/2026-07-21-map-event-preview-ux.md) | Refonte UX aperçu événement carte (MapEventPreviewCard, Phase 1 CTO) | ✅ |
| 2026-07-16 | [restore-compte-admin](./rapports/2026-07-16-restore-compte-admin.md) | Restauration de compte unique depuis l'admin (snapshot, dev only) | ✅ |
| 2026-07-16 | [ux-core-journey-nav-shell](./rapports/2026-07-16-ux-core-journey-nav-shell.md) | UX Core Journey : dock 4 onglets + FAB Créer (coquille nav, dev) | ✅ |
| 2026-07-15 | [audit-cto-fixes](./rapports/2026-07-15-audit-cto-fixes.md) | Implémentation recommandations audit CTO (Sentry/CMP, uploads, légal, onboarding 3 étapes) | ✅ |
| 2026-07-15 | [infra-ops-priorities](./rapports/2026-07-15-infra-ops-priorities.md) | Doc ops P1–P5 (Cloudflare, ACRCloud, backup, uptime) | ⚠️ |
| 2026-06-30 | [stores-mobile-conformite](./rapports/2026-06-30-stores-mobile-conformite.md) | Correctifs App Store / Play Store (Apple OAuth, package Android, IAP guards) | ⚠️ |
| 2026-06-30 | [ci-dette-warnings](./rapports/2026-06-30-ci-dette-warnings.md) | CI ESLint + warnings + TODO-MANUAL | ✅ |
| 2026-06-30 | [audit-debug-global](./rapports/2026-06-30-audit-debug-global.md) | Audit santé app (build, tests, lint, infra) | ⚠️ |
| 2026-06-26 | [setup-agent-dev](./rapports/2026-06-26-setup-agent-dev.md) | Création agent Dev + système de rapports | ✅ |
| 2026-06-26 | [admin-agents-chat](./rapports/2026-06-26-admin-agents-chat.md) | Onglet admin chat CEO IA + Dev Agent | ✅ |

---

## Utilisation

- Template : [`rapports/_TEMPLATE.md`](./rapports/_TEMPLATE.md)
- Guide : [`docs/ONSCEN-DEV-AGENT.md`](../ONSCEN-DEV-AGENT.md)
- Règle Cursor : [`.cursor/rules/onscen-dev-agent.mdc`](../../.cursor/rules/onscen-dev-agent.mdc)
