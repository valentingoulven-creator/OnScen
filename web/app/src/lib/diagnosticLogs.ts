import { diagnosticLogsApi } from './api/diagnosticLogs';
import { showErrorPopup } from './errorPopups';
import i18n from '../i18n';

export type DiagnosticLogLevel = 'error' | 'warn' | 'info';

export interface DiagnosticLogEntry {
  id: string;
  ts: number;
  level: DiagnosticLogLevel;
  source: string;
  message: string;
  stack?: string;
  url?: string;
  userId?: string;
  username?: string;
  clientId: string;
  context?: Record<string, unknown>;
  synced?: boolean;
}

const STORAGE_KEY = 'soundy_diagnostic_logs_v1';
const CLIENT_ID_KEY = 'soundy_diagnostic_client_id';
/** ~5 months */
const RETENTION_MS = 5 * 30 * 24 * 60 * 60 * 1000;
const MAX_LOCAL_ENTRIES = 800;
const FLUSH_INTERVAL_MS = 30_000;

let currentUserId: string | null = null;
let currentUsername: string | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;
let initialized = false;

function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

function readStore(): DiagnosticLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DiagnosticLogEntry[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - RETENTION_MS;
    return parsed.filter((e) => e && typeof e.ts === 'number' && e.ts >= cutoff);
  } catch {
    return [];
  }
}

function writeStore(entries: DiagnosticLogEntry[]): void {
  try {
    const cutoff = Date.now() - RETENTION_MS;
    const pruned = entries
      .filter((e) => e.ts >= cutoff)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_LOCAL_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    /* quota exceeded — drop oldest half */
    try {
      const half = entries.slice(0, Math.floor(entries.length / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(half));
    } catch {
      /* ignore */
    }
  }
}

function serializeArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function buildEntry(
  level: DiagnosticLogLevel,
  source: string,
  message: string,
  extra?: { stack?: string; context?: Record<string, unknown> }
): DiagnosticLogEntry {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `l_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    ts: Date.now(),
    level,
    source,
    message: message.slice(0, 4000),
    stack: extra?.stack?.slice(0, 8000),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userId: currentUserId ?? undefined,
    username: currentUsername ?? undefined,
    clientId: getClientId(),
    context: extra?.context,
    synced: false,
  };
}

export function appendDiagnosticLog(entry: Omit<DiagnosticLogEntry, 'id' | 'ts' | 'clientId' | 'synced'> & { id?: string; ts?: number }): void {
  const full = buildEntry(entry.level, entry.source, entry.message, {
    stack: entry.stack,
    context: entry.context,
  });
  if (entry.id) full.id = entry.id;
  if (entry.ts) full.ts = entry.ts;

  const store = readStore();
  store.unshift(full);
  writeStore(store);
  void flushDiagnosticLogsToServer();
}

export function logDiagnosticError(
  err: unknown,
  opts: { source?: string; context?: Record<string, unknown> } = {}
): void {
  const error = err instanceof Error ? err : new Error(String(err ?? 'Unknown error'));
  appendDiagnosticLog({
    level: 'error',
    source: opts.source ?? 'runtime',
    message: error.message,
    stack: error.stack,
    context: opts.context,
  });
}

export function setDiagnosticLogUser(userId: string | null, username?: string | null): void {
  currentUserId = userId;
  currentUsername = username ?? null;
}

export function getLocalDiagnosticLogs(): DiagnosticLogEntry[] {
  return readStore();
}

export function clearLocalDiagnosticLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function flushDiagnosticLogsToServer(token?: string | null): Promise<void> {
  if (flushing) return;
  const pending = readStore().filter((e) => !e.synced);
  if (pending.length === 0) return;

  flushing = true;
  try {
    const batch = pending.slice(0, 50);
    await diagnosticLogsApi.postLogs(
      batch.map((e) => ({
        id: e.id,
        createdAt: new Date(e.ts).toISOString(),
        level: e.level,
        source: e.source,
        message: e.message,
        stack: e.stack,
        context: e.context,
        userId: e.userId,
        username: e.username,
        url: e.url,
        clientId: e.clientId,
      })),
      token
    );

    const syncedIds = new Set(batch.map((e) => e.id));
    const store = readStore().map((e) => (syncedIds.has(e.id) ? { ...e, synced: true } : e));
    writeStore(store);
  } catch {
    /* retry later */
  } finally {
    flushing = false;
  }
}

/** Bruit connu sans impact utilisateur — jamais affiché en popup (mais toujours loggé). */
const SILENT_ERROR_PATTERN = /resizeobserver loop|script error\.?$/i;

function installGlobalHandlers(): void {
  window.addEventListener('error', (event) => {
    const message = event.message || 'Script error';
    appendDiagnosticLog({
      level: 'error',
      source: 'window.onerror',
      message,
      stack: event.error instanceof Error ? event.error.stack : undefined,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
    // Message générique dédupliqué (pas la stack brute) : reste user-friendly même en
    // cas de boucle d'erreurs, et évite de spammer l'utilisateur de détails techniques.
    if (!SILENT_ERROR_PATTERN.test(message)) {
      showErrorPopup(i18n.t('errors.unexpected'), { kind: 'error' });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    logDiagnosticError(event.reason, { source: 'unhandledrejection' });
    const reasonMessage =
      event.reason instanceof Error ? event.reason.message : String(event.reason ?? '');
    if (!SILENT_ERROR_PATTERN.test(reasonMessage)) {
      showErrorPopup(i18n.t('errors.unexpected'), { kind: 'error' });
    }
  });

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    origError(...args);
    const msg = args.map(serializeArg).join(' ').slice(0, 4000);
    if (/\b(error|exception|failed|uncaught)\b/i.test(msg)) {
      appendDiagnosticLog({ level: 'error', source: 'console.error', message: msg });
    }
  };

  const origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    const msg = args.map(serializeArg).join(' ').slice(0, 4000);
    appendDiagnosticLog({ level: 'warn', source: 'console.warn', message: msg });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushDiagnosticLogsToServer();
    }
  });

  window.addEventListener('pagehide', () => {
    void flushDiagnosticLogsToServer();
  });
}

export function initDiagnosticLogs(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  installGlobalHandlers();
  flushTimer = setInterval(() => {
    void flushDiagnosticLogsToServer();
  }, FLUSH_INTERVAL_MS);
}

export function disposeDiagnosticLogs(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
