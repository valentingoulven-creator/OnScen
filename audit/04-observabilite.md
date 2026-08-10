# Phase 4 — Sentry & observabilité

**Date :** 2026-08-10  
**Périmètre :** `lib/errorMonitoring.ts`, `web/app/src/lib/sentry.ts`, `sentryFilters.ts`, `adminDiagnostics.ts`, deploy logs

---

## 4.1 Couverture Sentry par environnement

| Surface | Constat | Risque | Recommandation |
|---------|---------|--------|----------------|
| Backend | `@sentry/node` si `SENTRY_DSN` ; désactivé msdev | faible | DSN obligatoire prod (check `verify-prod`) |
| Web | `@sentry/react` + vite plugin source maps ; init **après consentement cookies** (`cookieConsent.ts`) | faible | Préprod DSN distinct documenté |
| Mobile Capacitor | **`ios/apptel` : pas de `@sentry/react` dans dependencies** | **élevé** | Intégrer Sentry Capacitor ou bridge web + release mobile |
| Staging | Support `APP_ENV=preproduction` | faible | — |

---

## 4.2 Données sensibles dans les événements

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Backend | `sendDefaultPii: false` ; filtres ECONNRESET/AbortError | faible | Audit périodique `beforeSend` pour redacter Authorization/cookies si ajout context |
| Frontend | Replay `maskAllText: true` ; filtres bruit navigateur | faible | Désactiver replay session complète sauf on-error (déjà partiel) |
| Logs manuels | ~centaines de `console.*` backend — risque fuite token en debug | **moyen** | Logger structuré (pino) + redaction |

---

## 4.3 Alertes & gouvernance

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Sentry alerts | Config hors repo (console Sentry) — non vérifiable ici | **moyen** | Définir alertes : taux 5xx, régression release, spike `csam_risk` custom via `captureMessage` |
| Alertes métier | `alertNotifier.ts` email pour CSAM, signalements urgents, API tiers | faible | Configurer `ALERT_EXTRA_EMAILS` prod |
| On-call | Pas de PagerDuty/Opsgenie dans le code | **moyen** | Escalade SMS pour alertes `csam_risk_detected` |

---

## 4.4 Monitoring infra & APM

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| APM | `tracesSampleRate` défaut **0.05** backend ; tracing browser si Sentry actif | faible | Ajuster si coût Sentry explose |
| Infra | Pas de Datadog/Prometheus dans repo ; PM2 logs + scripts health | **élevé** | Uptime externe (Healthchecks.io), métriques VPS (Scaleway monitoring), latence API synthetic |
| Live | Cloudflare Stream analytics partielle (token Analytics Read doc) | **moyen** | Dashboard coût minutes + participants LiveKit |

---

## 4.5 Sampling & coûts

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Traces 5 % | Raisonnable au démarrage | faible | Revoir à 1 % si >1M events/mois |
| Replay | Intégration présente côté web | **moyen** | Limiter à échantillon 0.1 + erreurs uniquement |
| Sightengine / live frames | Coût lié modération (hors Sentry) | **moyen** | Métriques admin + plafond budget |

---

## 4.6 Synthèse phase 4

Combler **Sentry mobile**, **monitoring infra hors Sentry**, **logs structurés redactés**.
