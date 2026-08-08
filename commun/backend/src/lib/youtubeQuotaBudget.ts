/**
 * Compteur de consommation du bucket dédié `search.list` de la YouTube Data API v3.
 *
 * Depuis l'évolution du modèle de quota Google, `search.list` a son propre bucket,
 * indépendant du pool général de 10 000 unités : **100 appels par jour et par projet**
 * (voir developers.google.com/youtube/v3/determine_quota_cost). Ce plafond s'applique à
 * l'ensemble de la plateforme OnScen, pas par utilisateur — un simple compteur en mémoire
 * suffit donc à protéger la fonctionnalité de recherche pour tous les utilisateurs.
 *
 * Le compteur est réinitialisé sur un changement de « jour » UTC. C'est une approximation
 * du vrai reset de Google (minuit heure du Pacifique) : le compteur peut donc se réinitialiser
 * jusqu'à ~8 h avant le vrai reset côté Google. C'est intentionnel — mieux vaut être
 * légèrement trop prudent (marge de réserve) que de laisser le compteur local dériver du
 * quota réel dans l'autre sens.
 */

/** Plafond quotidien Google pour le bucket dédié search.list. */
export const SEARCH_LIST_DAILY_LIMIT = 100;

/** Marge de sécurité conservée en réserve — on arrête de tenter search.list avant le mur réel. */
export const SEARCH_LIST_RESERVE = 5;

interface QuotaBucket {
  day: string;
  count: number;
}

function currentUtcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

let bucket: QuotaBucket = { day: currentUtcDay(), count: 0 };

function ensureFreshBucket(): QuotaBucket {
  const day = currentUtcDay();
  if (bucket.day !== day) {
    bucket = { day, count: 0 };
  }
  return bucket;
}

export interface YoutubeSearchQuotaStatus {
  used: number;
  limit: number;
  reserve: number;
  remaining: number;
  /** true si on ne doit plus tenter de nouvel appel search.list aujourd'hui. */
  exhausted: boolean;
}

export function getYoutubeSearchQuotaStatus(): YoutubeSearchQuotaStatus {
  const b = ensureFreshBucket();
  const remaining = Math.max(0, SEARCH_LIST_DAILY_LIMIT - b.count);
  return {
    used: b.count,
    limit: SEARCH_LIST_DAILY_LIMIT,
    reserve: SEARCH_LIST_RESERVE,
    remaining,
    exhausted: remaining <= SEARCH_LIST_RESERVE,
  };
}

/** À appeler avant de décider de tenter un appel search.list réel. */
export function canAttemptYoutubeSearchListCall(): boolean {
  return !getYoutubeSearchQuotaStatus().exhausted;
}

/** À appeler juste avant (ou après) chaque appel réseau réel à search.list. */
export function recordYoutubeSearchListCall(): YoutubeSearchQuotaStatus {
  const b = ensureFreshBucket();
  b.count += 1;
  const status = getYoutubeSearchQuotaStatus();
  const ratio = status.used / status.limit;
  if (ratio >= 0.95) {
    console.warn(
      `[youtube-quota] search.list à ${status.used}/${status.limit} appels aujourd'hui — ` +
        'bascule imminente vers le catalogue local pour préserver le budget restant.'
    );
  } else if (ratio >= 0.8) {
    console.warn(`[youtube-quota] search.list à ${status.used}/${status.limit} appels aujourd'hui.`);
  }
  return status;
}

/** Réservé aux tests — force l'état du compteur. */
export function __resetYoutubeSearchQuotaForTests(count = 0, day = currentUtcDay()): void {
  bucket = { day, count };
}
