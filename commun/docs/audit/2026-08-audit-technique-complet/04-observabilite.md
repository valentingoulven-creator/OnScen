# Audit technique Soundy — Phase 4 : Sentry & Observabilité

**Date :** 2026-08-07
**Méthode :** revue de `commun/backend/src/lib/errorMonitoring.ts`, `bootstrap.ts`, `server.ts`, `web/app/src/lib/sentry.ts`, `main.tsx`, `ios/apptel/`, scripts de monitoring (`serverMonitor.ts`, `systemMonitor.ts`, `externalUptimeMonitor.ts`), `commun/docs/STACK-CIBLE.md`.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

---

## 4.1 Sentry configuré sur tous les environnements pertinents ?

| Environnement | Statut | Détail |
|---|---|---|
| Backend (`commun/backend`) | ✅ Configuré | `@sentry/node ^10.62.0`, `initErrorMonitoring()` (`lib/errorMonitoring.ts:57-103`), appelé au boot (`bootstrap.ts:223`), handler Express (`server.ts:891`), **obligatoire en production** (`productionStartup.ts:126-130` → `throw` si `SENTRY_DSN` absent) |
| Frontend web (`web/app`) | ✅ Configuré | `@sentry/react ^10.62.0`, init dans `lib/sentry.ts:33-55`, appelé depuis `main.tsx`, source maps via `@sentry/vite-plugin`, **conditionné au consentement cookies analytics** (`hasAnalyticsCookieConsent()`) |
| Mobile (`ios/apptel`, Capacitor) | ❌ **Absent** | Aucune dépendance `@sentry/*` dans `ios/apptel/package.json`, aucune occurrence `Sentry`/`sentry` dans `ios/apptel/src` |

**Risque : 🟠 Élevé** sur le périmètre mobile — les crashs/erreurs de l'app Capacitor (build iOS/Android) ne remontent dans **aucun** outil de monitoring d'erreurs, alors que ce sont les cibles de publication stores (`AUDIT-mobile-ios-android.md`).

**Recommandation :** intégrer `@sentry/capacitor` (ou a minima `@sentry/react` déjà utilisé côté web, dont `ios/apptel/src` est un override) avant la première soumission store.

---

## 4.2 Fuite de données sensibles dans les événements Sentry

**Constat :**

| Contrôle | Backend | Frontend |
|---|---|---|
| `sendDefaultPii: false` | ✅ `errorMonitoring.ts:81` | ✅ `sentry.ts:47` |
| `beforeSend` (filtrage) | ✅ filtre bruit réseau (ECONNRESET/EPIPE) | ✅ filtre bruit navigateur (`sentryFilters.ts`) |
| `beforeBreadcrumb` (scrubbing breadcrumbs) | ❌ Absent | ❌ Absent |
| Scrubbing explicite des headers `Authorization`/cookies/body de requête | ❌ Absent | N/A (pas de requêtes serveur interceptées côté client) |
| Session Replay masqué | N/A | ✅ `maskAllText: true`, `blockAllMedia: true` (`sentry.ts:39-42`) |
| Appels `captureError`/`reportServerError` avec contexte riche utilisés en production | Définis mais **sans appelant** ailleurs dans le code (grep négatif) | Utilisé uniquement avec `componentStack` (`AppErrorBoundary.tsx:120`), pas de données utilisateur |

**Risque : 🟡 Moyen** — aucune preuve d'envoi effectif de mots de passe/tokens/JWT en clair vers Sentry (le code ne le fait pas explicitement), mais le manque de `beforeBreadcrumb` et de scrubbing explicite des en-têtes/corps de requête sur l'intégration `expressIntegration()` laisse une **surface structurelle** non neutralisée si un développeur ajoute plus tard un appel `captureError(err, { extra: req.body })` par exemple.

**Recommandation :** ajouter un `beforeBreadcrumb` qui filtre les breadcrumbs de type `http`/`fetch` contenant des en-têtes `Authorization`/`Cookie`, et un scrubbing systématique de `req.body`/`req.headers` avant tout `captureError` avec contexte.

---

## 4.3 Configuration des alertes (seuils, destinataires)

**Constat :**
- **Aucune configuration d'alerte Sentry as-code** dans le dépôt (pas de fichier de règles d'alerte Sentry, pas de webhook Slack Sentry) — la configuration d'alertes Sentry dépend entièrement du dashboard externe (`bewware.sentry.io`, hors périmètre du code).
- En **complément**, un système d'alertes email applicatif existe et est bien plus documenté :

| Mécanisme | Fichier | Seuils/destinataires |
|---|---|---|
| `alertNotifier` | `lib/alertNotifier.ts` | `SMTP_ADMIN_EMAIL` + `ALERT_EXTRA_EMAILS`, cooldown 30 min |
| `serverMonitor` | `lib/serverMonitor.ts` | disk/RAM/CPU/latence p95, prod uniquement |
| `systemMonitor` | `lib/systemMonitor.ts` | RAM 85 %, CPU 90 % (configurable) |
| `externalUptimeMonitor` | `lib/externalUptimeMonitor.ts` | Email si `/health` public échoue |
| Crash process | `bootstrap.ts:182-203` | Email sur `uncaughtException`/`unhandledRejection` — **pas envoyé à Sentry**, seulement email |

**Risque : 🟡 Moyen** — les alertes Sentry ne sont pas versionnées (dépendance à une configuration externe non auditable depuis le repo), et les crashs process fatals (`uncaughtException`) ne remontent pas dans Sentry, uniquement par email — un pic d'erreurs applicatives pourrait donc être visible dans Sentry sans alerte push, tandis qu'un crash process complet est visible par email mais pas dans le dashboard d'erreurs.

**Recommandation :** envoyer aussi `uncaughtException`/`unhandledRejection` à `Sentry.captureException` avant l'email ; documenter la configuration des règles d'alerte Sentry (capture d'écran/export) dans `commun/docs/` pour traçabilité.

---

## 4.4 Dashboards de monitoring infra (au-delà de Sentry)

**Constat :**

| Capacité | Présent ? |
|---|---|
| `GET /health` (statut DB + services tiers) | ✅ `server.ts:609-639` |
| `GET /health/db` (authentifié) | ✅ `server.ts:642-653` |
| Cron watchdog VPS (`healthcheck.sh` → restart PM2 si `/health` KO) | ✅ `commun/deploy/healthcheck.sh` |
| Monitoring CPU/RAM/disk/latence applicatif | ✅ `serverMonitor.ts`/`systemMonitor.ts` |
| Monitoring d'uptime externe | ✅ `externalUptimeMonitor.ts` + workflow GitHub `uptime-health.yml` |
| APM dédié (Prometheus/Grafana/Datadog/New Relic/Scaleway Cockpit) | ❌ **Absent** du dépôt et des dépendances |

La cible produit documente explicitement cet écart : `commun/docs/STACK-CIBLE.md:34` prévoit *« Sentry + Prometheus/Grafana (ou Scaleway Cockpit) »* comme chantier de **Phase 1** (non encore réalisé).

**Risque : 🟡 Moyen** — le monitoring actuel (health checks + moniteurs maison + Sentry) couvre les besoins de base pour le volume de trafic actuel, mais ne fournit pas de vue temps réel fine (dashboards de latence par endpoint, tracing distribué) nécessaire à l'analyse d'incidents complexes à plus grande échelle.

**Recommandation :** déployer Scaleway Cockpit (offre managée déjà dans l'écosystème d'hébergement, faible effort d'intégration) ou Grafana/Prometheus self-hosted lors de la prochaine phase de scale, conformément au plan déjà documenté dans `STACK-CIBLE.md`.

---

## 4.5 Taux d'échantillonnage (sampling)

**Constat :**

| Paramètre | Backend | Frontend |
|---|---|---|
| `tracesSampleRate` | 0.05 (défaut, `SENTRY_TRACES_SAMPLE_RATE`) | 0.05 (défaut, `VITE_SENTRY_TRACES_SAMPLE_RATE`) |
| `replaysSessionSampleRate` | N/A | 0 (défaut) |
| `replaysOnErrorSampleRate` | N/A | 1 (défaut — replay capturé uniquement en cas d'erreur) |
| `profilesSampleRate` | Non configuré | Non configuré |

**Risque : 🟢 Conforme.** Profil coût-maîtrisé : 5 % de traces, pas de replay de session en continu (seulement à la survenue d'une erreur), cohérent avec un objectif de maîtrise des coûts à fort volume de trafic. Ces valeurs sont surchageables par variable d'environnement — les valeurs **effectivement actives en production** dépendent du `.env` réel du VPS (non auditées ici comme vérité runtime, seulement les défauts du code).

---

## 4.6 Logs structurés vs `console.*`

**Constat :**
- **Aucun logger structuré** (`winston`, `pino`, `bunyan`) dans les dépendances backend ou le code source.
- Volume mesuré (grep `rg`) : **~396 occurrences `console.(log|error|warn|info|debug)`** dans `commun/backend/src`, **~32** dans `web/app/src`.
- Un seul utilitaire de préfixe existe (`lib/logPrefix.ts`), pas un vrai pipeline de log structuré (pas de niveaux configurables via `LOG_LEVEL`, pas de sortie JSON exploitable par un agrégateur de logs).

**Risque : 🟠 Élevé** — en l'absence de logs structurés, la corrélation d'incidents en production (recherche par requestId, filtrage par sévérité, agrégation de volumétrie d'erreurs) repose entièrement sur Sentry (échantillonné à 5 %) et les logs bruts PM2 (`pm2 logs`), ce qui devient rapidement insuffisant à mesure que le trafic et la complexité augmentent.

**Recommandation :** introduire `pino` (performant, JSON structuré, faible overhead) au moins sur les chemins critiques (auth, paiement, modération, erreurs serveur), avec un niveau configurable via variable d'environnement.

---

## Synthèse des risques — Phase 4

| # | Sujet | Risque | Effort |
|---|---|---|---|
| OBS-1 | Sentry absent sur mobile Capacitor | 🟠 Élevé | S/M |
| OBS-2 | Pas de scrubbing `beforeBreadcrumb`/headers-body sur Sentry | 🟡 Moyen | S |
| OBS-3 | Alertes Sentry non versionnées (dépendance dashboard externe) | 🟡 Moyen | S (doc) |
| OBS-4 | `uncaughtException`/`unhandledRejection` non envoyés à Sentry (email seulement) | 🟡 Moyen | S |
| OBS-5 | Pas d'APM/dashboard infra (Prometheus/Grafana/Cockpit) | 🟡 Moyen | M |
| OBS-6 | Sampling rates | 🟢 Conforme | — |
| OBS-7 | Logs non structurés (~396 `console.*` backend) | 🟠 Élevé | M
