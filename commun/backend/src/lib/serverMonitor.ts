/**
 * Periodic server monitoring (production only).
 * Runs every MONITOR_INTERVAL_MS (default 5 min).
 * Checks disk, RAM, CPU via vpsMetrics.ts and p95 API latency via a rolling window.
 * Sends alerts through alertNotifier.ts when thresholds are exceeded.
 *
 * Thresholds (all configurable via .env):
 *   ALERT_DISK_PERCENT   (default 80)
 *   ALERT_RAM_PERCENT    (default 80)
 *   ALERT_CPU_PERCENT    (default 80)
 *   ALERT_LATENCY_MS     (default 100 — 10ms is too tight for DB-backed APIs;
 *                         adjust to 1000 for slow-query alerting)
 *   MONITOR_INTERVAL_MS  (default 300000 = 5 min)
 */

import { getVpsMetricsReport } from './vpsMetrics';
import { sendMonitoringAlert } from './alertNotifier';

const DISK_THRESHOLD = parseInt(process.env.ALERT_DISK_PERCENT ?? '80', 10);
const RAM_THRESHOLD = parseInt(process.env.ALERT_RAM_PERCENT ?? '80', 10);
const CPU_THRESHOLD = parseInt(process.env.ALERT_CPU_PERCENT ?? '80', 10);
const LATENCY_THRESHOLD = parseInt(process.env.ALERT_LATENCY_MS ?? '1000', 10);
const CHECK_INTERVAL_MS = parseInt(process.env.MONITOR_INTERVAL_MS ?? '300000', 10);

let monitorInterval: ReturnType<typeof setInterval> | null = null;

// Rolling p95 latency window — populated by latencyMonitor middleware
const latencyWindow: number[] = [];
const LATENCY_WINDOW_SIZE = 500;

export function recordApiLatency(ms: number): void {
  latencyWindow.push(ms);
  if (latencyWindow.length > LATENCY_WINDOW_SIZE) latencyWindow.shift();
}

function calcP95(samples: number[]): number | null {
  if (samples.length < 20) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)];
}

async function runChecks(): Promise<void> {
  try {
    const m = await getVpsMetricsReport();

    if (m.disk.usedPercent != null && m.disk.usedPercent >= DISK_THRESHOLD) {
      const used = Math.round((m.disk.usedBytes ?? 0) / 1_073_741_824);
      const total = Math.round((m.disk.totalBytes ?? 0) / 1_073_741_824);
      await sendMonitoringAlert({
        type: 'disk',
        severity: m.disk.usedPercent >= 95 ? 'critical' : 'warning',
        message:
          `Stockage disque à ${m.disk.usedPercent}% (seuil : ${DISK_THRESHOLD}%).\n` +
          `Utilisé : ${used} Go / ${total} Go. Point de montage : ${m.disk.mountPoint ?? '/'}`,
        value: m.disk.usedPercent,
        threshold: DISK_THRESHOLD,
      });
    }

    if (m.memory.usedPercent >= RAM_THRESHOLD) {
      const used = Math.round(m.memory.usedBytes / 1_048_576);
      const total = Math.round(m.memory.totalBytes / 1_048_576);
      await sendMonitoringAlert({
        type: 'ram',
        severity: m.memory.usedPercent >= 95 ? 'critical' : 'warning',
        message:
          `RAM à ${m.memory.usedPercent}% (seuil : ${RAM_THRESHOLD}%).\n` +
          `Utilisée : ${used} Mo / ${total} Mo. Process RSS : ${Math.round(m.memory.processRssBytes / 1_048_576)} Mo`,
        value: m.memory.usedPercent,
        threshold: RAM_THRESHOLD,
      });
    }

    if (m.cpu.loadPercent != null && m.cpu.loadPercent >= CPU_THRESHOLD) {
      await sendMonitoringAlert({
        type: 'cpu',
        severity: m.cpu.loadPercent >= 95 ? 'critical' : 'warning',
        message:
          `CPU à ${m.cpu.loadPercent}% (seuil : ${CPU_THRESHOLD}%).\n` +
          `Load avg 1m : ${m.cpu.loadAverage1m} / 5m : ${m.cpu.loadAverage5m}. ${m.cpu.cores} cœur(s), modèle : ${m.cpu.model}`,
        value: m.cpu.loadPercent,
        threshold: CPU_THRESHOLD,
      });
    }

    const p95 = calcP95(latencyWindow);
    if (p95 !== null && p95 > LATENCY_THRESHOLD) {
      await sendMonitoringAlert({
        type: 'latency',
        severity: p95 > LATENCY_THRESHOLD * 5 ? 'critical' : 'warning',
        message:
          `Latence API p95 = ${p95}ms (seuil : ${LATENCY_THRESHOLD}ms).\n` +
          `Basé sur ${latencyWindow.length} requêtes récentes. Latence DB mesurée : ${m.latencyMs}ms (source : ${m.latencySource})`,
        value: p95,
        threshold: LATENCY_THRESHOLD,
      });
    }
  } catch (err) {
    console.error('[serverMonitor] Erreur lors des vérifications périodiques:', err);
  }
}

export function startServerMonitor(): void {
  if (monitorInterval) return;
  if (process.env.APP_ENV !== 'production') return;

  // Warmup delay: first check runs 60 s after startup to let the server stabilise
  setTimeout(() => {
    void runChecks();
    monitorInterval = setInterval(() => void runChecks(), CHECK_INTERVAL_MS);
  }, 60_000);

  const thresholds = `CPU ${CPU_THRESHOLD}%, RAM ${RAM_THRESHOLD}%, disk ${DISK_THRESHOLD}%, latence p95 ${LATENCY_THRESHOLD}ms`;
  console.log(`[monitor] Monitoring actif — intervalle ${CHECK_INTERVAL_MS / 1000}s, seuils : ${thresholds}`);
}

export function stopServerMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
