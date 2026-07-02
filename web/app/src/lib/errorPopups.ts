/**
 * Bus global de popups d'erreur — utilisable depuis n'importe quel module (React ou non :
 * lib/api, lib/socket, diagnosticLogs) sans prop-drilling ni dépendance à un contexte React.
 * Le composant GlobalErrorPopup (monté une seule fois à la racine) s'y abonne et affiche
 * un toast (auto-dismiss) ou une modale bloquante selon `blocking`.
 */

export type ErrorPopupKind = 'error' | 'warning';

export interface ErrorPopup {
  id: string;
  message: string;
  kind: ErrorPopupKind;
  /** true = modale bloquante (nécessite un clic) ; false = toast auto-dismiss. */
  blocking: boolean;
  ts: number;
}

type Listener = (popup: ErrorPopup) => void;

const listeners = new Set<Listener>();
const recentMessages = new Map<string, number>();
const DEDUP_WINDOW_MS = 4000;

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function pruneRecentMessages(now: number): void {
  if (recentMessages.size < 50) return;
  for (const [key, ts] of recentMessages) {
    if (now - ts > DEDUP_WINDOW_MS) recentMessages.delete(key);
  }
}

export function subscribeErrorPopups(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Affiche un popup d'erreur global. Anti-spam : même message ignoré pendant DEDUP_WINDOW_MS. */
export function showErrorPopup(
  message: string | null | undefined,
  opts: { kind?: ErrorPopupKind; blocking?: boolean } = {}
): void {
  if (!message || !message.trim()) return;
  const now = Date.now();
  const dedupeKey = `${opts.blocking ? 'b' : 't'}:${message}`;
  const lastSeen = recentMessages.get(dedupeKey);
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) return;
  recentMessages.set(dedupeKey, now);
  pruneRecentMessages(now);

  const popup: ErrorPopup = {
    id: makeId(),
    message,
    kind: opts.kind ?? 'error',
    blocking: opts.blocking ?? false,
    ts: now,
  };
  listeners.forEach((fn) => {
    try {
      fn(popup);
    } catch {
      /* un listener défaillant ne doit pas bloquer les autres */
    }
  });
}
