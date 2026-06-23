import { describe, expect, it } from 'vitest';
import { YoutubeDataApiError, parseYoutubeApiResponse } from './youtubeApiErrors';

describe('parseYoutubeApiResponse', () => {
  it('throws quota_exceeded on 403 quotaExceeded', async () => {
    const res = new Response(
      JSON.stringify({
        error: { errors: [{ reason: 'quotaExceeded', message: 'Quota exceeded' }] },
      }),
      { status: 403 }
    );
    await expect(parseYoutubeApiResponse(res)).rejects.toMatchObject({
      code: 'quota_exceeded',
    } satisfies Partial<YoutubeDataApiError>);
  });

  it('throws forbidden on 403 without quota reason', async () => {
    const res = new Response(
      JSON.stringify({
        error: { errors: [{ reason: 'accessNotConfigured', message: 'Forbidden' }] },
      }),
      { status: 403 }
    );
    await expect(parseYoutubeApiResponse(res)).rejects.toMatchObject({
      code: 'forbidden',
    } satisfies Partial<YoutubeDataApiError>);
  });

  it('no-op on ok response', async () => {
    const res = new Response('{}', { status: 200 });
    await expect(parseYoutubeApiResponse(res)).resolves.toBeUndefined();
  });
});
