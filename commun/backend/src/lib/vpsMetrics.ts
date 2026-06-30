/**
 * VPS / host metrics for admin analytics (RAM, disk, CPU, latency).
 * Uses Node `os` + `fs.statfs` on all platforms; load average is Linux/macOS only.
 */

import { statfs } from 'fs/promises';
import os from 'os';
import { performance } from 'perf_hooks';
import { checkPoolHealth, isPostgresEnabled } from '../db/pool';

export interface VpsMetricsReport {
  fetchedAt: string;
  platform: string;
  hostname: string;
  env: string;
  source: 'system' | 'partial' | 'mock';
  uptimeSeconds: number;
  latencyMs: number;
  latencySource: 'postgres' | 'internal';
  memory: {
    usedBytes: number;
    totalBytes: number;
    freeBytes: number;
    usedPercent: number;
    processRssBytes: number;
    processHeapUsedBytes: number;
  };
  cpu: {
    cores: number;
    model: string;
    loadAverage1m: number | null;
    loadAverage5m: number | null;
    loadAverage15m: number | null;
    loadPercent: number | null;
  };
  disk: {
    usedBytes: number | null;
    totalBytes: number | null;
    freeBytes: number | null;
    usedPercent: number | null;
    mountPoint: string | null;
    source: 'statfs' | 'unavailable';
  };
  node: {
    version: string;
    pid: number;
  };
  warnings: string[];
}

function roundPercent(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((used / total) * 1000) / 10;
}

function diskRootPath(): string {
  if (process.platform === 'win32') {
    const drive = process.env.SystemDrive?.trim() || 'C:';
    return drive.endsWith('\\') ? drive : `${drive}\\`;
  }
  return '/';
}

async function measureLatency(): Promise<{ ms: number; source: 'postgres' | 'internal' }> {
  const start = performance.now();
  if (isPostgresEnabled()) {
    const ok = await checkPoolHealth();
    return {
      ms: Math.round(performance.now() - start),
      source: ok ? 'postgres' : 'internal',
    };
  }
  return { ms: Math.round(performance.now() - start), source: 'internal' };
}

async function getDiskUsage(): Promise<VpsMetricsReport['disk']> {
  const mountPoint = diskRootPath();
  try {
    const s = await statfs(mountPoint);
    const totalBytes = s.bsize * s.blocks;
    const freeBytes = s.bsize * s.bavail;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    return {
      usedBytes,
      totalBytes,
      freeBytes,
      usedPercent: roundPercent(usedBytes, totalBytes),
      mountPoint,
      source: 'statfs',
    };
  } catch {
    return {
      usedBytes: null,
      totalBytes: null,
      freeBytes: null,
      usedPercent: null,
      mountPoint,
      source: 'unavailable',
    };
  }
}

function getMemoryMetrics(): VpsMetricsReport['memory'] {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const proc = process.memoryUsage();
  return {
    usedBytes,
    totalBytes,
    freeBytes,
    usedPercent: roundPercent(usedBytes, totalBytes),
    processRssBytes: proc.rss,
    processHeapUsedBytes: proc.heapUsed,
  };
}

function getCpuMetrics(): VpsMetricsReport['cpu'] {
  const cores = os.cpus().length;
  const model = os.cpus()[0]?.model?.trim() || 'unknown';
  const [l1, l5, l15] = os.loadavg();
  const hasLoad = process.platform !== 'win32';
  const loadAverage1m = hasLoad ? Math.round(l1 * 100) / 100 : null;
  const loadAverage5m = hasLoad ? Math.round(l5 * 100) / 100 : null;
  const loadAverage15m = hasLoad ? Math.round(l15 * 100) / 100 : null;
  const loadPercent =
    loadAverage1m != null && cores > 0
      ? Math.round((loadAverage1m / cores) * 1000) / 10
      : null;
  return {
    cores,
    model,
    loadAverage1m,
    loadAverage5m,
    loadAverage15m,
    loadPercent,
  };
}

function mockReport(warnings: string[]): VpsMetricsReport {
  const now = new Date().toISOString();
  return {
    fetchedAt: now,
    platform: process.platform,
    hostname: os.hostname(),
    env: process.env.APP_ENV || 'development',
    source: 'mock',
    uptimeSeconds: Math.floor(process.uptime()),
    latencyMs: 12,
    latencySource: 'internal',
    memory: {
      usedBytes: 2_147_483_648,
      totalBytes: 4_294_967_296,
      freeBytes: 2_147_483_648,
      usedPercent: 50,
      processRssBytes: 134_217_728,
      processHeapUsedBytes: 67_108_864,
    },
    cpu: {
      cores: 2,
      model: 'Mock CPU (dev)',
      loadAverage1m: 0.42,
      loadAverage5m: 0.38,
      loadAverage15m: 0.35,
      loadPercent: 21,
    },
    disk: {
      usedBytes: 25_000_000_000,
      totalBytes: 50_000_000_000,
      freeBytes: 25_000_000_000,
      usedPercent: 50,
      mountPoint: diskRootPath(),
      source: 'statfs',
    },
    node: {
      version: process.version,
      pid: process.pid,
    },
    warnings,
  };
}

export async function getVpsMetricsReport(): Promise<VpsMetricsReport> {
  if (process.env.VPS_MOCK_METRICS === '1') {
    return mockReport(['Données simulées (VPS_MOCK_METRICS=1).']);
  }

  const warnings: string[] = [];
  const latency = await measureLatency();
  const disk = await getDiskUsage();
  const memory = getMemoryMetrics();
  const cpu = getCpuMetrics();

  if (disk.source === 'unavailable') {
    warnings.push('Stockage disque indisponible sur cette plateforme.');
  }
  if (cpu.loadAverage1m == null) {
    warnings.push('Charge CPU (load average) non disponible sous Windows.');
  }
  if (latency.source === 'internal' && isPostgresEnabled()) {
    warnings.push('Latence mesurée sans PostgreSQL (pool indisponible).');
  } else if (latency.source === 'internal') {
    warnings.push('Latence interne Node (PostgreSQL non activé en dev).');
  }

  const source: VpsMetricsReport['source'] =
    disk.source === 'unavailable' || cpu.loadAverage1m == null ? 'partial' : 'system';

  return {
    fetchedAt: new Date().toISOString(),
    platform: process.platform,
    hostname: os.hostname(),
    env: process.env.APP_ENV || 'development',
    source,
    uptimeSeconds: Math.floor(os.uptime()),
    latencyMs: latency.ms,
    latencySource: latency.source,
    memory,
    cpu,
    disk,
    node: {
      version: process.version,
      pid: process.pid,
    },
    warnings,
  };
}
