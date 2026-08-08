/**
 * report.ts — Génération de rapports HTML et JSON
 *
 * Produit :
 * - Un rapport HTML interactif avec métriques, graphiques, erreurs
 * - Un rapport JSON pour l'intégration CI/CD
 * - Un résumé console avec bugs trouvés et points de friction UX
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentResult, ActionRecord } from './agent';
import { ROLE_DESCRIPTIONS } from './scenarios/index';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportOptions {
  baseUrl: string;
  durationMs: number;
  startTime: number;
  isPartial: boolean;
  outputDir: string;
  baseName: string;
}

export interface ReportSummary {
  totalActions: number;
  successActions: number;
  failedActions: number;
  successRate: number;
  totalErrors: number;
  criticalBugs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  avgLatencyMs: number;
  agentCount: number;
  completedAgents: number;
}

interface EndpointStat {
  endpoint: string;
  method: string;
  callCount: number;
  successCount: number;
  failCount: number;
  avgLatency: number;
  p95Latency: number;
  statusCodes: Record<number, number>;
  errors: string[];
}

interface BugReport {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  endpoint: string;
  description: string;
  count: number;
}

// ── Génération du rapport ──────────────────────────────────────────────────────

export async function generateReport(
  results: AgentResult[],
  options: ReportOptions
): Promise<{ htmlPath: string; jsonPath: string; summary: ReportSummary }> {
  const analysis = analyzeResults(results, options);
  const summary = computeSummary(analysis.allActions, results);

  // Assurer que le dossier de sortie existe
  fs.mkdirSync(path.resolve(options.outputDir), { recursive: true });

  const htmlPath = path.join(path.resolve(options.outputDir), `${options.baseName}.html`);
  const jsonPath = path.join(path.resolve(options.outputDir), `${options.baseName}.json`);

  // Rapport HTML
  const html = generateHTML(results, analysis, summary, options);
  fs.writeFileSync(htmlPath, html, 'utf-8');

  // Rapport JSON
  const jsonReport = {
    meta: {
      generatedAt: new Date().toISOString(),
      baseUrl: options.baseUrl,
      durationMs: options.durationMs,
      startTime: new Date(options.startTime).toISOString(),
      isPartial: options.isPartial,
    },
    summary,
    endpointStats: analysis.endpointStats,
    bugs: analysis.bugs,
    agentResults: results.map((r) => ({
      agentId: r.persona.id,
      name: r.persona.name,
      role: r.persona.role,
      totalActions: r.totalActions,
      successActions: r.successActions,
      failedActions: r.failedActions,
      errors: r.errors,
      durationMs: r.endTime - r.startTime,
      socketEvents: r.socketEvents.length,
    })),
  };

  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf-8');

  return { htmlPath, jsonPath, summary };
}

// ── Analyse des résultats ──────────────────────────────────────────────────────

function analyzeResults(results: AgentResult[], options: ReportOptions) {
  const allActions: ActionRecord[] = results.flatMap((r) => r.actions);

  // Stats par endpoint
  const endpointMap = new Map<string, EndpointStat>();

  for (const action of allActions) {
    const key = `${action.method} ${normalizeEndpoint(action.endpoint)}`;
    if (!endpointMap.has(key)) {
      endpointMap.set(key, {
        endpoint: normalizeEndpoint(action.endpoint),
        method: action.method,
        callCount: 0,
        successCount: 0,
        failCount: 0,
        avgLatency: 0,
        p95Latency: 0,
        statusCodes: {},
        errors: [],
      });
    }
    const stat = endpointMap.get(key)!;
    stat.callCount++;
    if (action.success) stat.successCount++;
    else {
      stat.failCount++;
      if (action.error) stat.errors.push(action.error.slice(0, 200));
    }
    stat.statusCodes[action.statusCode] = (stat.statusCodes[action.statusCode] ?? 0) + 1;
  }

  // Calcul des latences par endpoint
  for (const [key, stat] of endpointMap) {
    const latencies = allActions
      .filter((a) => `${a.method} ${normalizeEndpoint(a.endpoint)}` === key)
      .map((a) => a.latencyMs)
      .sort((a, b) => a - b);

    stat.avgLatency = Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length);
    stat.p95Latency = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  }

  const endpointStats = [...endpointMap.values()].sort((a, b) => b.callCount - a.callCount);

  // Détection de bugs
  const bugs = detectBugs(allActions, results, endpointStats);

  return { allActions, endpointStats, bugs };
}

function computeSummary(allActions: ActionRecord[], results: AgentResult[]): ReportSummary {
  const successActions = allActions.filter((a) => a.success).length;
  const latencies = allActions.map((a) => a.latencyMs).sort((a, b) => a - b);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

  return {
    totalActions: allActions.length,
    successActions,
    failedActions: allActions.length - successActions,
    successRate: allActions.length > 0 ? (successActions / allActions.length) * 100 : 0,
    totalErrors,
    criticalBugs: 0, // sera calculé après detectBugs
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    p99LatencyMs: percentile(latencies, 99),
    avgLatencyMs: latencies.length > 0
      ? Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length)
      : 0,
    agentCount: results.length,
    completedAgents: results.length,
  };
}

// ── Détection de bugs ──────────────────────────────────────────────────────────

function detectBugs(
  actions: ActionRecord[],
  results: AgentResult[],
  endpointStats: EndpointStat[]
): BugReport[] {
  const bugs: BugReport[] = [];

  // 1. Erreurs 500
  const serverErrors = actions.filter((a) => a.statusCode === 500);
  const errorsByEndpoint = groupBy(serverErrors, (a) => `${a.method} ${normalizeEndpoint(a.endpoint)}`);
  for (const [endpoint, errs] of Object.entries(errorsByEndpoint)) {
    bugs.push({
      severity: 'critical',
      type: 'server_error_500',
      endpoint,
      description: `${errs.length} erreur(s) 500 détectée(s) — erreur serveur inattendue`,
      count: errs.length,
    });
  }

  // 2. Inputs invalides → 500 (au lieu de 400)
  const invalidInputActions = actions.filter(
    (a) => a.action.includes('invalide') && a.statusCode === 500
  );
  for (const action of invalidInputActions) {
    bugs.push({
      severity: 'high',
      type: 'invalid_input_crashes_server',
      endpoint: action.endpoint,
      description: `Input invalide cause un 500 (devrait être 400/422): ${action.action}`,
      count: 1,
    });
  }

  // 3. Latence élevée (>5s)
  const slowEndpoints = endpointStats.filter((s) => s.p95Latency > 5000);
  for (const stat of slowEndpoints) {
    bugs.push({
      severity: 'medium',
      type: 'high_latency',
      endpoint: `${stat.method} ${stat.endpoint}`,
      description: `Latence P95 élevée: ${stat.p95Latency}ms — risque UX`,
      count: stat.callCount,
    });
  }

  // 4. Taux d'erreur élevé (>20% sur un endpoint avec >5 appels)
  const highErrorEndpoints = endpointStats.filter(
    (s) => s.callCount >= 5 && s.failCount / s.callCount > 0.2
  );
  for (const stat of highErrorEndpoints) {
    const rate = ((stat.failCount / stat.callCount) * 100).toFixed(1);
    bugs.push({
      severity: 'medium',
      type: 'high_error_rate',
      endpoint: `${stat.method} ${stat.endpoint}`,
      description: `Taux d'erreur élevé: ${rate}% (${stat.failCount}/${stat.callCount} appels)`,
      count: stat.failCount,
    });
  }

  // 5. Timeouts réseau
  const timeouts = actions.filter((a) => a.statusCode === 0 && !a.success);
  if (timeouts.length > 0) {
    const byEndpoint = groupBy(timeouts, (a) => normalizeEndpoint(a.endpoint));
    for (const [endpoint, errs] of Object.entries(byEndpoint)) {
      bugs.push({
        severity: 'high',
        type: 'network_timeout',
        endpoint,
        description: `${errs.length} timeout(s) réseau — serveur potentiellement saturé`,
        count: errs.length,
      });
    }
  }

  // 6. Socket.io — agents sans connexion socket
  const agentsWithoutSocket = results.filter(
    (r) => r.socketEvents.filter((e) => e.event === 'connect').length === 0
  );
  if (agentsWithoutSocket.length > 0) {
    bugs.push({
      severity: 'high',
      type: 'socket_connection_failed',
      endpoint: '/socket.io',
      description: `${agentsWithoutSocket.length} agent(s) n'ont pas pu se connecter en Socket.io`,
      count: agentsWithoutSocket.length,
    });
  }

  return bugs.sort((a, b) => {
    const sev = { critical: 0, high: 1, medium: 2, low: 3 };
    return sev[a.severity] - sev[b.severity];
  });
}

// ── Génération HTML ────────────────────────────────────────────────────────────

function generateHTML(
  results: AgentResult[],
  analysis: ReturnType<typeof analyzeResults>,
  summary: ReportSummary,
  options: ReportOptions
): string {
  const criticalBugs = analysis.bugs.filter((b) => b.severity === 'critical').length;
  const highBugs = analysis.bugs.filter((b) => b.severity === 'high').length;

  const agentRows = results
    .sort((a, b) => a.persona.id - b.persona.id)
    .map((r) => {
      const rate = r.totalActions > 0 ? ((r.successActions / r.totalActions) * 100).toFixed(1) : '0';
      const duration = formatMs(r.endTime - r.startTime);
      const statusClass = r.errors.length > 5 ? 'status-warn' : 'status-ok';
      return `
      <tr>
        <td><span class="badge">#${r.persona.id}</span></td>
        <td>${escapeHtml(r.persona.name)}</td>
        <td><code>${r.persona.role}</code></td>
        <td>${r.totalActions}</td>
        <td><span class="${statusClass}">${rate}%</span></td>
        <td>${r.errors.length}</td>
        <td>${r.socketEvents.length}</td>
        <td>${duration}</td>
      </tr>`;
    })
    .join('');

  const endpointRows = analysis.endpointStats
    .slice(0, 50)
    .map((s) => {
      const rate = s.callCount > 0 ? ((s.successCount / s.callCount) * 100).toFixed(0) : '0';
      const statusClass = parseInt(rate) < 80 ? 'status-warn' : 'status-ok';
      const statusCodesStr = Object.entries(s.statusCodes)
        .map(([code, count]) => `<span class="status-code status-${code[0]}xx">${code}: ${count}</span>`)
        .join(' ');
      return `
      <tr>
        <td><code>${s.method}</code></td>
        <td><code>${s.endpoint}</code></td>
        <td>${s.callCount}</td>
        <td><span class="${statusClass}">${rate}%</span></td>
        <td>${s.avgLatency}ms</td>
        <td>${s.p95Latency}ms</td>
        <td class="small">${statusCodesStr}</td>
      </tr>`;
    })
    .join('');

  const bugRows = analysis.bugs
    .map((b) => `
      <tr class="bug-${b.severity}">
        <td><span class="severity-badge severity-${b.severity}">${b.severity.toUpperCase()}</span></td>
        <td><code>${b.type}</code></td>
        <td><code>${b.endpoint}</code></td>
        <td>${escapeHtml(b.description)}</td>
        <td>${b.count}</td>
      </tr>`)
    .join('');

  const roleStats = Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => {
    const roleResults = results.filter((r) => r.persona.role === role);
    if (!roleResults.length) return '';
    const totalAct = roleResults.reduce((s, r) => s + r.totalActions, 0);
    const successAct = roleResults.reduce((s, r) => s + r.successActions, 0);
    const rate = totalAct > 0 ? ((successAct / totalAct) * 100).toFixed(1) : '0';
    return `<div class="role-card">
      <h4>${role}</h4>
      <p class="role-desc">${escapeHtml(desc)}</p>
      <div class="role-stats">
        <span>Agents: ${roleResults.length}</span>
        <span>Actions: ${totalAct}</span>
        <span class="${parseFloat(rate) >= 80 ? 'status-ok' : 'status-warn'}">Succès: ${rate}%</span>
      </div>
    </div>`;
  }).join('');

  const generatedAt = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const duration = formatMs(options.durationMs);
  const partialBadge = options.isPartial
    ? '<span class="badge badge-partial">PARTIEL</span>'
    : '<span class="badge badge-final">FINAL</span>';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OnScen — Rapport Tests Agents ${options.isPartial ? '(Partiel)' : ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f0f1a; color: #e2e8f0; line-height: 1.6; }
    .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; }
    h2 { font-size: 1.4rem; color: #a5b4fc; margin: 2rem 0 1rem; border-bottom: 1px solid #2d2d4e; padding-bottom: 0.5rem; }
    h3 { font-size: 1.1rem; color: #cbd5e1; margin: 1rem 0 0.5rem; }
    h4 { font-size: 0.95rem; color: #94a3b8; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
    .meta { color: #64748b; font-size: 0.85rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: #1a1a2e; border: 1px solid #2d2d4e; border-radius: 12px; padding: 1.25rem; text-align: center; }
    .stat-value { font-size: 2rem; font-weight: 700; color: #6366f1; }
    .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }
    .stat-sub { font-size: 0.7rem; color: #475569; margin-top: 0.1rem; }
    .status-ok { color: #34d399; }
    .status-warn { color: #fbbf24; }
    .status-error { color: #f87171; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; background: #2d2d4e; color: #a5b4fc; font-family: monospace; }
    .badge-partial { background: #7c3aed33; color: #a78bfa; border: 1px solid #7c3aed; }
    .badge-final { background: #05966933; color: #34d399; border: 1px solid #059669; }
    table { width: 100%; border-collapse: collapse; background: #1a1a2e; border-radius: 12px; overflow: hidden; margin-bottom: 1.5rem; }
    th { background: #2d2d4e; color: #94a3b8; padding: 0.75rem 1rem; text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 0.6rem 1rem; border-bottom: 1px solid #2d2d4e; font-size: 0.85rem; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #2d2d4e22; }
    code { font-family: 'Fira Code', monospace; font-size: 0.8rem; color: #a5b4fc; background: #2d2d4e; padding: 0.1rem 0.3rem; border-radius: 3px; }
    .status-code { display: inline-block; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.75rem; font-family: monospace; margin: 0.1rem; }
    .status-2xx { background: #05966933; color: #34d399; }
    .status-3xx { background: #0891b233; color: #67e8f9; }
    .status-4xx { background: #92400e33; color: #fbbf24; }
    .status-5xx { background: #7f1d1d33; color: #f87171; }
    .status-0xx { background: #4b0082; color: #e879f9; }
    .bug-critical td { border-left: 3px solid #f87171; }
    .bug-high td { border-left: 3px solid #fbbf24; }
    .bug-medium td { border-left: 3px solid #6366f1; }
    .bug-low td { border-left: 3px solid #34d399; }
    .severity-badge { padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em; }
    .severity-critical { background: #7f1d1d; color: #fca5a5; }
    .severity-high { background: #78350f; color: #fcd34d; }
    .severity-medium { background: #312e81; color: #a5b4fc; }
    .severity-low { background: #052e16; color: #6ee7b7; }
    .roles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .role-card { background: #1a1a2e; border: 1px solid #2d2d4e; border-radius: 12px; padding: 1rem; }
    .role-desc { font-size: 0.8rem; color: #64748b; margin: 0.4rem 0; }
    .role-stats { display: flex; gap: 1rem; font-size: 0.8rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .latency-chart { display: flex; align-items: flex-end; gap: 2px; height: 60px; margin-top: 0.5rem; }
    .latency-bar { background: linear-gradient(to top, #6366f1, #8b5cf6); border-radius: 2px 2px 0 0; min-width: 4px; flex: 1; }
    .small { font-size: 0.75rem; }
    .no-bugs { text-align: center; padding: 2rem; color: #34d399; font-size: 1.1rem; }
    .footer { text-align: center; color: #475569; font-size: 0.8rem; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #2d2d4e; }
    .info-box { background: #1a1a2e; border: 1px solid #2d2d4e; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; font-size: 0.85rem; color: #94a3b8; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <h1>🎵 OnScen — Rapport Tests Agents</h1>
      <div class="meta">
        ${partialBadge}
        &nbsp;Généré le ${generatedAt}
        &nbsp;|&nbsp;Cible: <code>${options.baseUrl}</code>
        &nbsp;|&nbsp;Durée: ${duration}
      </div>
    </div>
  </div>

  <!-- Stats globales -->
  <h2>📊 Statistiques globales</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${summary.totalActions.toLocaleString()}</div>
      <div class="stat-label">Actions totales</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${summary.successRate >= 80 ? 'status-ok' : 'status-warn'}">${summary.successRate.toFixed(1)}%</div>
      <div class="stat-label">Taux de succès</div>
      <div class="stat-sub">${summary.successActions.toLocaleString()} succès / ${summary.failedActions.toLocaleString()} échecs</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${summary.avgLatencyMs}ms</div>
      <div class="stat-label">Latence moyenne</div>
      <div class="stat-sub">P50: ${summary.p50LatencyMs}ms</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${summary.p99LatencyMs > 3000 ? 'status-warn' : ''}">${summary.p99LatencyMs}ms</div>
      <div class="stat-label">Latence P99</div>
      <div class="stat-sub">P95: ${summary.p95LatencyMs}ms</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${summary.totalErrors > 0 ? 'status-warn' : 'status-ok'}">${summary.totalErrors}</div>
      <div class="stat-label">Erreurs agents</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${criticalBugs > 0 ? 'status-error' : 'status-ok'}">${criticalBugs}</div>
      <div class="stat-label">Bugs critiques</div>
      <div class="stat-sub">${highBugs} high severity</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${summary.agentCount}</div>
      <div class="stat-label">Agents simulés</div>
      <div class="stat-sub">${summary.completedAgents} terminés</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${analysis.endpointStats.length}</div>
      <div class="stat-label">Endpoints testés</div>
    </div>
  </div>

  <!-- Bugs détectés -->
  <h2>🐛 Bugs détectés (${analysis.bugs.length})</h2>
  ${analysis.bugs.length === 0
    ? '<div class="no-bugs">✅ Aucun bug détecté automatiquement</div>'
    : `<table>
        <thead><tr><th>Sévérité</th><th>Type</th><th>Endpoint</th><th>Description</th><th>Occurrences</th></tr></thead>
        <tbody>${bugRows}</tbody>
      </table>`}

  <!-- Par groupe d'agents -->
  <h2>👥 Par groupe d'agents</h2>
  <div class="roles-grid">${roleStats}</div>

  <!-- Performance par endpoint -->
  <h2>🔌 Performance par endpoint (Top 50)</h2>
  <table>
    <thead>
      <tr><th>Méthode</th><th>Endpoint</th><th>Appels</th><th>Succès</th><th>Latence moy.</th><th>Latence P95</th><th>Codes HTTP</th></tr>
    </thead>
    <tbody>${endpointRows}</tbody>
  </table>

  <!-- Résultats par agent -->
  <h2>🤖 Résultats par agent</h2>
  <table>
    <thead>
      <tr><th>ID</th><th>Nom</th><th>Rôle</th><th>Actions</th><th>Succès</th><th>Erreurs</th><th>Socket Events</th><th>Durée</th></tr>
    </thead>
    <tbody>${agentRows}</tbody>
  </table>

  <!-- Infos CI -->
  <h2>📁 Intégration CI/CD</h2>
  <div class="info-box">
    <strong>Rapport JSON disponible</strong> pour intégration CI. Variables clés :<br>
    • <code>summary.successRate</code> — taux de succès global (seuil recommandé: ≥ 80%)<br>
    • <code>summary.criticalBugs</code> — bugs critiques (seuil CI: 0)<br>
    • <code>summary.p99LatencyMs</code> — latence P99 (seuil recommandé: ≤ 5000ms)<br>
    • <code>bugs[]</code> — liste complète des bugs avec sévérité
  </div>

  <div class="footer">
    OnScen Agent Testing Infrastructure — Généré automatiquement
  </div>
</div>
</body>
</html>`;
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.floor((sorted.length - 1) * (p / 100));
  return sorted[idx] ?? 0;
}

function normalizeEndpoint(endpoint: string): string {
  // Normalise les IDs dynamiques dans les URLs pour regrouper les stats
  return endpoint
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
    .replace(/\/user_[a-z0-9_]+/g, '/:userId')
    .replace(/\/salon_[a-z0-9_]+/g, '/:salonId')
    .replace(/\/live_[a-z0-9_]+/g, '/:liveId')
    .replace(/\/reel_[a-z0-9_]+/g, '/:reelId')
    .replace(/\/\d{10,}/g, '/:id')
    .replace(/\?.*$/, '');
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    acc[k] = acc[k] ?? [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
