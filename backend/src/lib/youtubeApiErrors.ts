/** Erreurs typées renvoyées par YouTube Data API v3. */
export type YoutubeApiErrorCode =
  | 'quota_exceeded'
  | 'rate_limited'
  | 'auth_failed'
  | 'forbidden'
  | 'not_found'
  | 'network'
  | 'unknown';

export class YoutubeDataApiError extends Error {
  readonly status: number;
  readonly code: YoutubeApiErrorCode;
  readonly googleReason?: string;

  constructor(message: string, status: number, code: YoutubeApiErrorCode, googleReason?: string) {
    super(message);
    this.name = 'YoutubeDataApiError';
    this.status = status;
    this.code = code;
    this.googleReason = googleReason;
  }

  get isQuotaExceeded(): boolean {
    return this.code === 'quota_exceeded';
  }

  get isRetryable(): boolean {
    return this.code === 'rate_limited' || this.code === 'network';
  }
}

function mapGoogleReason(reason: string | undefined, status: number): YoutubeApiErrorCode {
  const r = (reason ?? '').toLowerCase();
  if (
    r.includes('quota') ||
    r.includes('dailylimit') ||
    r.includes('userratelimit') ||
    r.includes('quotaexceeded')
  ) {
    return 'quota_exceeded';
  }
  if (status === 429) return 'rate_limited';
  if (status === 401) return 'auth_failed';
  if (status === 403) return r ? 'quota_exceeded' : 'forbidden';
  if (status === 404) return 'not_found';
  return 'unknown';
}

export async function parseYoutubeApiResponse(res: Response): Promise<void> {
  if (res.ok) return;

  let googleReason: string | undefined;
  let message = `YouTube API HTTP ${res.status}`;
  try {
    const body = (await res.json()) as {
      error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> };
    };
    googleReason = body.error?.errors?.[0]?.reason ?? body.error?.message;
    if (body.error?.message) message = body.error.message;
  } catch {
    // ignore JSON parse errors
  }

  const code = mapGoogleReason(googleReason, res.status);
  throw new YoutubeDataApiError(message, res.status, code, googleReason);
}
