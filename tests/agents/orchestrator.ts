/**
 * orchestrator.ts — Orchestrateur central des 30 agents de test
 *
 * Responsabilités :
 * - Instancier et démarrer les 30 agents en parallèle
 * - Collecter les résultats en temps réel
 * - Afficher la progression dans le terminal
 * - Sauvegarder des rapports partiels toutes les 15 min
 * - Arrêt gracieux sur CTRL+C (sauvegarde du rapport partiel)
 * - Déclencher la génération du rapport final
 */

import { BaseAgent, AgentResult } from './agent';
import { CONFIG } from './agents.config';
import { ALL_PERSONAS, createAgent, ROLE_DESCRIPTIONS } from './scenarios/index';
import { generateReport } from './report';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentStatus {
  id: number;
  role: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  actionCount: number;
  errorCount: number;
  startedAt?: number;
  completedAt?: number;
}

interface OrchestratorOptions {
  durationMs?: number;
  baseUrl?: string;
  agentIds?: number[]; // Sous-ensemble d'agents à lancer
}

// ── Classe Orchestrateur ──────────────────────────────────────────────────────

export class Orchestrator {
  private agents: Map<number, BaseAgent> = new Map();
  private statuses: Map<number, AgentStatus> = new Map();
  private results: AgentResult[] = [];
  private completedAgents = 0;
  private startTime = 0;
  private durationMs: number;
  private isRunning = false;
  private progressInterval?: ReturnType<typeof setInterval>;
  private partialReportInterval?: ReturnType<typeof setInterval>;
  private isStopping = false;

  constructor(private options: OrchestratorOptions = {}) {
    this.durationMs = options.durationMs ?? CONFIG.DURATION_MS;
  }

  // ── Démarrage ────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.startTime = Date.now();
    this.isRunning = true;

    // Reset de l'état partagé entre agents
    BaseAgent.sharedUserIds = [];
    BaseAgent.sharedSalonIds = [];
    BaseAgent.sharedLiveIds = [];
    BaseAgent.sharedReelIds = [];

    // Sélection des personas
    const personas = this.options.agentIds
      ? ALL_PERSONAS.filter((p) => this.options.agentIds!.includes(p.id))
      : ALL_PERSONAS;

    this.printBanner(personas.length);
    this.setupGracefulShutdown();
    this.ensureReportDir();

    // Initialisation des statuses
    for (const persona of personas) {
      this.statuses.set(persona.id, {
        id: persona.id,
        role: persona.role,
        name: persona.name,
        status: 'pending',
        actionCount: 0,
        errorCount: 0,
      });
    }

    // Démarrage de l'affichage de progression
    this.startProgressDisplay();

    // Démarrage des sauvegardes partielles
    this.startPartialReportSave();

    // Lancement de tous les agents en parallèle
    const agentPromises = personas.map(async (persona) => {
      try {
        const agent = createAgent(persona);
        this.agents.set(persona.id, agent);

        this.updateStatus(persona.id, { status: 'running', startedAt: Date.now() });

        const result = await agent.run(this.durationMs);

        this.results.push(result);
        this.completedAgents++;
        this.updateStatus(persona.id, {
          status: 'completed',
          actionCount: result.totalActions,
          errorCount: result.errors.length,
          completedAt: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\x1b[31m[ORCHESTRATEUR] Agent #${persona.id} (${persona.role}) erreur fatale: ${msg}\x1b[0m`);
        this.completedAgents++;
        this.updateStatus(persona.id, {
          status: 'error',
          completedAt: Date.now(),
        });
      }
    });

    // Attendre que tous les agents terminent (ou stop forcé)
    await Promise.allSettled(agentPromises);

    this.isRunning = false;
    this.clearIntervals();

    await this.generateFinalReport();
  }

  // ── Arrêt ────────────────────────────────────────────────────────────────────

  async stop(reason = 'Arrêt demandé'): Promise<void> {
    if (this.isStopping) return;
    this.isStopping = true;

    console.log(`\n\x1b[33m\n⏹  ${reason} — Arrêt gracieux en cours...\x1b[0m`);

    // Arrêter tous les agents
    for (const agent of this.agents.values()) {
      agent.stop();
    }

    this.isRunning = false;
    this.clearIntervals();

    // Attendre 2s que les agents finissent proprement
    await new Promise((r) => setTimeout(r, 2000));

    await this.generateFinalReport(true);
  }

  // ── Gestion de l'arrêt gracieux ──────────────────────────────────────────────

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      await this.stop(`Signal reçu: ${signal}`);
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (err) => {
      console.error('\x1b[31m[ORCHESTRATEUR] Exception non gérée:', err.message, '\x1b[0m');
      shutdown('uncaughtException');
    });
  }

  // ── Progression ──────────────────────────────────────────────────────────────

  private startProgressDisplay(): void {
    this.progressInterval = setInterval(() => {
      this.printProgress();
    }, 30_000); // Toutes les 30 secondes
  }

  private printProgress(): void {
    const elapsed = Date.now() - this.startTime;
    const remaining = Math.max(0, this.durationMs - elapsed);
    const progress = Math.min(100, (elapsed / this.durationMs) * 100).toFixed(1);

    const completed = [...this.statuses.values()].filter((s) => s.status === 'completed').length;
    const running = [...this.statuses.values()].filter((s) => s.status === 'running').length;
    const errors = [...this.statuses.values()].filter((s) => s.status === 'error').length;

    const totalActions = [...this.statuses.values()].reduce((sum, s) => sum + s.actionCount, 0);
    const totalErrors = [...this.statuses.values()].reduce((sum, s) => sum + s.errorCount, 0);

    const elapsedStr = formatDuration(elapsed);
    const remainingStr = formatDuration(remaining);

    console.log(
      `\n\x1b[36m${'─'.repeat(70)}\x1b[0m\n` +
      `\x1b[1m⏱  Durée: ${elapsedStr} / ${formatDuration(this.durationMs)} | Restant: ${remainingStr} | Progression: ${progress}%\x1b[0m\n` +
      `\x1b[32m✅ Terminés: ${completed}\x1b[0m | \x1b[33m🔄 En cours: ${running}\x1b[0m | \x1b[31m❌ Erreurs: ${errors}\x1b[0m\n` +
      `\x1b[36m📊 Actions totales: ${totalActions} | Erreurs actions: ${totalErrors}\x1b[0m\n` +
      `\x1b[36m${'─'.repeat(70)}\x1b[0m`
    );
  }

  private printBanner(agentCount: number): void {
    const durationStr = formatDuration(this.durationMs);
    console.log(`
\x1b[36m╔══════════════════════════════════════════════════════════════════════╗
║              🎵  SOUNDY — INFRASTRUCTURE DE TESTS AGENTS             ║
╚══════════════════════════════════════════════════════════════════════╝\x1b[0m

\x1b[1m  Cible  :\x1b[0m ${CONFIG.BASE_URL}
\x1b[1m  Agents :\x1b[0m ${agentCount} agents simulés
\x1b[1m  Durée  :\x1b[0m ${durationStr}
\x1b[1m  Rapport:\x1b[0m ${path.resolve(CONFIG.REPORT_DIR)}

\x1b[33m  ⚠️  Appuyer sur CTRL+C pour arrêter et sauvegarder le rapport\x1b[0m

${Object.entries(ROLE_DESCRIPTIONS)
  .map(([, desc]) => `  \x1b[90m▸\x1b[0m ${desc}`)
  .join('\n')}

\x1b[36m${'─'.repeat(72)}\x1b[0m
\x1b[32m  Démarrage des agents...\x1b[0m
`);
  }

  // ── Rapport ──────────────────────────────────────────────────────────────────

  private startPartialReportSave(): void {
    this.partialReportInterval = setInterval(async () => {
      if (this.results.length > 0) {
        await this.saveReport(this.results, true);
      }
    }, CONFIG.PARTIAL_REPORT_INTERVAL_MS);
  }

  private async generateFinalReport(isPartial = false): Promise<void> {
    if (this.results.length === 0) {
      console.log('\x1b[33m⚠️  Aucun résultat à reporter.\x1b[0m');
      return;
    }

    console.log(`\n\x1b[36m📋 Génération du rapport ${isPartial ? 'partiel' : 'final'}...\x1b[0m`);
    await this.saveReport(this.results, isPartial);
  }

  private async saveReport(results: AgentResult[], isPartial: boolean): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const suffix = isPartial ? '-partial' : '-final';
      const baseName = `soundy-agents-report-${timestamp}${suffix}`;

      const { htmlPath, jsonPath, summary } = await generateReport(results, {
        baseUrl: CONFIG.BASE_URL,
        durationMs: this.durationMs,
        startTime: this.startTime,
        isPartial,
        outputDir: CONFIG.REPORT_DIR,
        baseName,
      });

      console.log(`\n\x1b[32m✅ Rapport ${isPartial ? 'partiel' : 'final'} généré:\x1b[0m`);
      console.log(`   📊 HTML : ${htmlPath}`);
      console.log(`   📁 JSON : ${jsonPath}`);
      console.log(`\n\x1b[1m  Résumé :\x1b[0m`);
      console.log(`   • Total actions  : ${summary.totalActions}`);
      console.log(`   • Taux de succès : ${summary.successRate.toFixed(1)}%`);
      console.log(`   • Latence P50    : ${summary.p50LatencyMs}ms`);
      console.log(`   • Latence P99    : ${summary.p99LatencyMs}ms`);
      console.log(`   • Erreurs totales: ${summary.totalErrors}`);
      console.log(`   • Bugs critiques : ${summary.criticalBugs}`);
    } catch (err) {
      console.error('\x1b[31m[ORCHESTRATEUR] Erreur génération rapport:', err, '\x1b[0m');
    }
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────────

  private updateStatus(id: number, updates: Partial<AgentStatus>): void {
    const current = this.statuses.get(id);
    if (current) {
      this.statuses.set(id, { ...current, ...updates });
    }
  }

  private clearIntervals(): void {
    if (this.progressInterval) clearInterval(this.progressInterval);
    if (this.partialReportInterval) clearInterval(this.partialReportInterval);
  }

  private ensureReportDir(): void {
    const dir = path.resolve(CONFIG.REPORT_DIR);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // ── Getters ───────────────────────────────────────────────────────────────────

  get isActive(): boolean {
    return this.isRunning;
  }

  get completedCount(): number {
    return this.completedAgents;
  }

  get currentResults(): AgentResult[] {
    return [...this.results];
  }
}

// ── Utilitaire de formatage ────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
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
