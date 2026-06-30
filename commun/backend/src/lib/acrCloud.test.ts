import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  formatCopyrightBlockMessage,
  identifyCommercialMusicMatch,
  checkUploadedAudioCopyright,
} from './acrCloud';

describe('formatCopyrightBlockMessage', () => {
  it('inclut titre et artiste', () => {
    const msg = formatCopyrightBlockMessage({
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      score: 95,
    });
    expect(msg).toMatch(/Bohemian Rhapsody/);
    expect(msg).toMatch(/Queen/);
    expect(msg).toMatch(/protégé/i);
  });

  it('fonctionne sans artiste', () => {
    const msg = formatCopyrightBlockMessage({ title: 'Untitled', score: 90 });
    expect(msg).toMatch(/Untitled/);
  });
});

describe('identifyCommercialMusicMatch', () => {
  const envBackup: Record<string, string | undefined> = {};
  const fetchMock = vi.fn();

  beforeEach(() => {
    for (const key of [
      'ACRCLOUD_ENABLED',
      'ACRCLOUD_ACCESS_KEY',
      'ACRCLOUD_ACCESS_SECRET',
      'ACRCLOUD_HOST',
      'ACRCLOUD_MATCH_SCORE_THRESHOLD',
      'ACRCLOUD_FAIL_OPEN',
      'APP_ENV',
    ]) {
      envBackup[key] = process.env[key];
    }
    process.env.ACRCLOUD_ENABLED = '1';
    process.env.ACRCLOUD_ACCESS_KEY = 'test-key';
    process.env.ACRCLOUD_ACCESS_SECRET = 'test-secret';
    process.env.ACRCLOUD_MATCH_SCORE_THRESHOLD = '80';
    process.env.APP_ENV = 'msdev';
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.unstubAllGlobals();
  });

  it('retourne null si non configuré', async () => {
    delete process.env.ACRCLOUD_ACCESS_KEY;
    const result = await identifyCommercialMusicMatch(Buffer.alloc(2000, 1));
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retourne null si buffer trop petit', async () => {
    const result = await identifyCommercialMusicMatch(Buffer.alloc(50));
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retourne le match si score ≥ seuil', async () => {
    fetchMock.mockResolvedValue({
      text: async () =>
        JSON.stringify({
          status: { code: 0, msg: 'Success' },
          metadata: {
            music: [
              {
                title: 'Song Title',
                score: 92,
                artists: [{ name: 'Artist Name' }],
                label: 'Major Label',
              },
            ],
          },
        }),
    });

    const match = await identifyCommercialMusicMatch(Buffer.alloc(2000, 1));
    expect(match).toEqual({
      title: 'Song Title',
      artist: 'Artist Name',
      score: 92,
      label: 'Major Label',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retourne null si score sous le seuil', async () => {
    fetchMock.mockResolvedValue({
      text: async () =>
        JSON.stringify({
          status: { code: 0 },
          metadata: { music: [{ title: 'Low Score', score: 50 }] },
        }),
    });

    const match = await identifyCommercialMusicMatch(Buffer.alloc(2000, 1));
    expect(match).toBeNull();
  });

  it('fail-open en msdev sur erreur API', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const match = await identifyCommercialMusicMatch(Buffer.alloc(2000, 1));
    expect(match).toBeNull();
  });

  it('fail-closed en prod sur erreur API', async () => {
    process.env.APP_ENV = 'production';
    process.env.ACRCLOUD_FAIL_OPEN = '0';
    fetchMock.mockRejectedValue(new Error('network'));
    await expect(identifyCommercialMusicMatch(Buffer.alloc(2000, 1))).rejects.toThrow('network');
  });
});

describe('checkUploadedAudioCopyright', () => {
  const envBackup: Record<string, string | undefined> = {};
  const fetchMock = vi.fn();

  beforeEach(() => {
    for (const key of [
      'ACRCLOUD_ENABLED',
      'ACRCLOUD_ACCESS_KEY',
      'ACRCLOUD_ACCESS_SECRET',
      'APP_ENV',
    ]) {
      envBackup[key] = process.env[key];
    }
    process.env.ACRCLOUD_ENABLED = '1';
    process.env.ACRCLOUD_ACCESS_KEY = 'test-key';
    process.env.ACRCLOUD_ACCESS_SECRET = 'test-secret';
    process.env.APP_ENV = 'msdev';
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.unstubAllGlobals();
  });

  it('retourne null si non configuré', async () => {
    delete process.env.ACRCLOUD_ACCESS_KEY;
    const msg = await checkUploadedAudioCopyright(Buffer.alloc(2000, 1));
    expect(msg).toBeNull();
  });

  it('retourne message utilisateur si match catalogue', async () => {
    fetchMock.mockResolvedValue({
      text: async () =>
        JSON.stringify({
          status: { code: 0 },
          metadata: {
            music: [{ title: 'Hit Song', score: 99, artists: [{ name: 'Star' }] }],
          },
        }),
    });

    const msg = await checkUploadedAudioCopyright(Buffer.alloc(2000, 1));
    expect(msg).toMatch(/Hit Song/);
    expect(msg).toMatch(/Star/);
  });
});
