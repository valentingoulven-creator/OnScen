import i18n from '../../i18n';

export const API_BASE = '/api';

/** JWT hors Authorization pour ne pas écraser le Basic Auth Caddy (reverse proxy). */
export const AUTH_TOKEN_HEADER = 'X-Auth-Token';

export function headers(token?: string | null): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) h[AUTH_TOKEN_HEADER] = token;
  return h;
}

export function normalizeFetchNetworkError(e: unknown): never {
  if (e instanceof TypeError) {
    const m = e.message.toLowerCase();
    if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
      throw new Error(i18n.t('errors.network'));
    }
  }
  throw e;
}

export class ApiRequestError extends Error {
  code?: string;
  status?: number;
  salonId?: string;
  playbackState?: import('../../types').PlaybackState;
  queue?: import('../../types').SalonQueueItem[];

  constructor(
    message: string,
    code?: string,
    status?: number,
    playbackState?: import('../../types').PlaybackState,
    queue?: import('../../types').SalonQueueItem[],
    salonId?: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.playbackState = playbackState;
    this.queue = queue;
    this.salonId = salonId;
  }
}

export async function parseApiError(res: Response): Promise<ApiRequestError> {
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      const json = JSON.parse(text) as {
        error?: string;
        code?: string;
        salonId?: string;
        playbackState?: import('../../types').PlaybackState;
        queue?: import('../../types').SalonQueueItem[];
      };
      const playbackState = json.playbackState;
      const queue = json.queue;
      if (json.error) {
        if (json.error === 'Token manquant' || json.error === 'Token invalide') {
          return new ApiRequestError(i18n.t('errors.sessionExpired'), json.code, res.status);
        }
        if (json.code === 'dm_disabled') {
          return new ApiRequestError(i18n.t('dm.privateMessagesDisabled'), json.code, res.status);
        }
        if (json.code === 'dm_mutual_follow_required') {
          return new ApiRequestError(i18n.t('dm.mutualFollowRequired'), json.code, res.status);
        }
        if (json.code === 'HOST_PLATFORM_NOT_LINKED') {
          return new ApiRequestError(json.error || i18n.t('errors.forbidden'), json.code, res.status);
        }
        return new ApiRequestError(
          json.error,
          json.code,
          res.status,
          playbackState,
          queue,
          typeof json.salonId === 'string' ? json.salonId : undefined
        );
      }
    } catch {
      if (text.length < 200) return new ApiRequestError(text, undefined, res.status);
    }
  }
  if (res.status === 413) return new ApiRequestError(i18n.t('errors.profileTooLarge'), undefined, res.status);
  if (res.status === 401) return new ApiRequestError(i18n.t('errors.sessionExpired'), undefined, res.status);
  if (res.status === 403) return new ApiRequestError(i18n.t('errors.forbidden'), undefined, res.status);
  if (res.status === 404) return new ApiRequestError(i18n.t('errors.notFound'), undefined, res.status);
  if (res.status === 429) return new ApiRequestError(i18n.t('errors.tooManyAttempts'), undefined, res.status);
  return new ApiRequestError(res.statusText || i18n.t('errors.network'), undefined, res.status);
}

/** Authenticated fetch — cookie session works when token is null (web httpOnly). */
export async function request<T>(
  path: string,
  opts: RequestInit = {},
  token?: string | null
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...opts,
      headers: { ...headers(token), ...opts.headers },
    });
  } catch (e) {
    normalizeFetchNetworkError(e);
  }
  if (!res.ok) {
    throw await parseApiError(res);
  }
  return res.json();
}
