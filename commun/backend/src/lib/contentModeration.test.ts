import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateVideoSightenginePayload,
  evaluateSightenginePayload,
} from './sightengineModeration';
import {
  getModerationCoverage,
  moderateFeedPostMedia,
  moderateImageSource,
  moderateReelUpload,
  buildCsamHashMatchEscalation,
} from './contentModeration';
import * as alertNotifier from './alertNotifier';
import * as contentReports from './contentReports';
import { resetCsamHashMatchForTests, sha256Buffer } from './csamHashMatch';

describe('evaluateVideoSightenginePayload', () => {
  it('refuse si summary.action est reject', () => {
    const result = evaluateVideoSightenginePayload({
      status: 'success',
      summary: { action: 'reject', reject_prob: 0.9 },
    });
    expect(result.allowed).toBe(false);
  });

  it('analyse chaque frame vidéo', () => {
    const result = evaluateVideoSightenginePayload({
      status: 'success',
      data: {
        frames: [
          { nudity: { sexual_activity: 0.01, sexual_display: 0.01, erotica: 0.01 } },
          { nudity: { sexual_activity: 0.99, sexual_display: 0.01, erotica: 0.01 } },
        ],
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('explicit');
  });
});

describe('getModerationCoverage', () => {
  it('liste les surfaces UGC principales', () => {
    const coverage = getModerationCoverage();
    const surfaces = coverage.map((c) => c.surface);
    expect(surfaces).toContain('Stories');
    expect(surfaces).toContain('Reels');
    expect(surfaces).toContain('Publications fil');
  });
});

describe('contentModeration with mocked Sightengine', () => {
  const envBackup: Record<string, string | undefined> = {};
  const fetchMock = vi.fn();

  beforeEach(() => {
    for (const key of [
      'SIGHTENGINE_API_USER',
      'SIGHTENGINE_API_SECRET',
      'SIGHTENGINE_ENABLED',
      'SIGHTENGINE_FAIL_OPEN',
      'APP_ENV',
      'PHOTODNA_REQUIRED',
      'PHOTODNA_SUBSCRIPTION_KEY',
    ]) {
      envBackup[key] = process.env[key];
    }
    process.env.SIGHTENGINE_API_USER = 'test-user';
    process.env.SIGHTENGINE_API_SECRET = 'test-secret';
    process.env.SIGHTENGINE_ENABLED = '1';
    process.env.SIGHTENGINE_FAIL_OPEN = '0';
    process.env.APP_ENV = 'production';
    process.env.PHOTODNA_REQUIRED = '0';
    delete process.env.PHOTODNA_SUBSCRIPTION_KEY;
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const safeImagePayload = {
    status: 'success',
    nudity: { sexual_activity: 0.01, sexual_display: 0.01, erotica: 0.01 },
    offensive: { prob: 0.01 },
  };

  const unsafeImagePayload = {
    status: 'success',
    nudity: { sexual_activity: 0.99, sexual_display: 0.01, erotica: 0.01 },
    offensive: { prob: 0.01 },
  };

  it('autorise une image sûre (story)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => safeImagePayload,
    });
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const result = await moderateImageSource(tinyPng, 'story');
    expect(result.allowed).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('refuse une image explicite (publication fil)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => unsafeImagePayload,
    });
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const result = await moderateFeedPostMedia({ imageUrl: tinyPng });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('explicit');
  });

  it('modère poster + vidéo pour un reel vidéo', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => safeImagePayload,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            frames: [{ nudity: { sexual_activity: 0.01, sexual_display: 0.01, erotica: 0.01 } }],
          },
        }),
      });

    const poster =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const video = 'data:video/mp4;base64,AAAA';
    const result = await moderateReelUpload({
      mediaType: 'video',
      mediaUrl: video,
      posterUrl: poster,
      durationSec: 15,
    });
    expect(result.allowed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skip si Sightengine non configuré (hors production)', async () => {
    delete process.env.SIGHTENGINE_API_USER;
    process.env.APP_ENV = 'msdev';
    const result = await moderateImageSource(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'story',
    );
    expect(result.allowed).toBe(true);
    expect(result.skipped).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse les uploads en production si Sightengine absent', async () => {
    delete process.env.SIGHTENGINE_API_USER;
    delete process.env.SIGHTENGINE_API_SECRET;
    process.env.APP_ENV = 'production';
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const result = await moderateImageSource(tinyPng, 'story');
    expect(result.allowed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse en production si PhotoDNA requis et sans clé (avant Sightengine)', async () => {
    delete process.env.PHOTODNA_REQUIRED;
    delete process.env.PHOTODNA_SUBSCRIPTION_KEY;
    const alertSpy = vi.spyOn(alertNotifier, 'sendMonitoringAlert').mockResolvedValue();
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const result = await moderateImageSource(tinyPng, 'story');
    expect(result.allowed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('alerte PhotoDNA match avec SHA-256 et user id, sans le fichier', async () => {
    resetCsamHashMatchForTests();
    process.env.PHOTODNA_REQUIRED = '1';
    process.env.PHOTODNA_SUBSCRIPTION_KEY = 'test-key';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Status: 3000 }),
    });
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const sha = sha256Buffer(Buffer.from(tinyPng.replace(/^data:image\/png;base64,/, ''), 'base64'));
    const alertSpy = vi.spyOn(alertNotifier, 'sendMonitoringAlert').mockResolvedValue();
    const reportSpy = vi.spyOn(contentReports, 'appendContentReport').mockImplementation((report) => ({
      ...report,
      id: 'test_report',
      createdAt: Date.now(),
      priority: 'urgent',
    }));
    const result = await moderateImageSource(tinyPng, 'story', 'user_founder');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('minor_risk');
    expect(alertSpy).toHaveBeenCalledOnce();
    const msg = String(alertSpy.mock.calls[0][0].message);
    expect(msg).toContain(sha);
    expect(msg).toContain('user_founder');
    expect(msg).toContain('photodna');
    expect(msg).not.toContain('data:image');
    expect(msg).not.toContain(tinyPng.slice(0, 40));
    expect(reportSpy.mock.calls[0][0].reporterId).toBe('system:photodna');
    expect(String(reportSpy.mock.calls[0][0].details)).toContain(sha);
    alertSpy.mockRestore();
    reportSpy.mockRestore();
  });
});

describe('buildCsamHashMatchEscalation', () => {
  it('n’inclut que des métadonnées', () => {
    const built = buildCsamHashMatchEscalation({
      context: 'reel',
      uploaderId: 'u1',
      username: 'alice',
      sha256: 'a'.repeat(64),
      source: 'photodna',
      at: new Date('2026-08-20T19:00:00.000Z'),
    });
    expect(built.reporterId).toBe('system:photodna');
    expect(built.alertMessage).toContain('alice (u1)');
    expect(built.alertMessage).toContain('a'.repeat(64));
    expect(built.alertMessage).not.toContain('data:image');
    expect(built.details).toContain('PHAROS');
  });
});

describe('evaluateSightenginePayload baseline', () => {
  it('reste cohérent pour image seule', () => {
    expect(evaluateSightenginePayload({
      nudity: { sexual_activity: 0.99 },
    }).allowed).toBe(false);
  });
});
