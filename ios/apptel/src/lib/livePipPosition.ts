/**
 * Persistance de la position du PiP live (mobile only) — l'utilisateur veut que le
 * PiP reste où il l'a laissé (drag) au lieu de revenir à la position par défaut
 * chaque fois qu'un nouveau live s'ouvre en prévisualisation.
 */

const STORAGE_KEY = 'ms-live-pip-pos';

type PipPos = { x: number; y: number };

function readStoredPosition(): PipPos | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PipPos>;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // localStorage indisponible / JSON invalide — retombe sur la position par défaut.
  }
  return null;
}

/** Position à utiliser à l'ouverture du PiP — dernière position connue, sinon `fallback()`. */
export function getLivePipPosition(fallback: () => PipPos): PipPos {
  return readStoredPosition() ?? fallback();
}

/** Enregistre la position courante (appelé à chaque déplacement du PiP). */
export function setLivePipPosition(pos: PipPos): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // Quota / mode privé — on ignore, le PiP reviendra à la position par défaut.
  }
}
