import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  evaluateSightenginePayload,
  userFacingModerationMessage,
} from './sightengineModeration';

describe('evaluateSightenginePayload', () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      'SIGHTENGINE_EXPLICIT_THRESHOLD',
      'SIGHTENGINE_EROTICA_THRESHOLD',
      'SIGHTENGINE_OFFENSIVE_THRESHOLD',
    ]) {
      envBackup[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('autorise un contenu sûr', () => {
    const result = evaluateSightenginePayload({
      status: 'success',
      nudity: {
        sexual_activity: 0.01,
        sexual_display: 0.02,
        erotica: 0.05,
      },
      offensive: { prob: 0.01 },
    });
    expect(result.allowed).toBe(true);
  });

  it('refuse sexual_activity au-dessus du seuil', () => {
    const result = evaluateSightenginePayload({
      nudity: { sexual_activity: 0.9, sexual_display: 0.1, erotica: 0.1 },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('explicit');
  });

  it('refuse erotica au-dessus du seuil dédié', () => {
    const result = evaluateSightenginePayload({
      nudity: { sexual_activity: 0.1, sexual_display: 0.1, erotica: 0.95 },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('erotica');
  });

  it('refuse contenu offensant', () => {
    const result = evaluateSightenginePayload({
      nudity: { sexual_activity: 0, sexual_display: 0, erotica: 0 },
      offensive: { prob: 0.99 },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('offensive');
  });

  it('refuse gore au-dessus du seuil violence (MOD-1)', () => {
    const result = evaluateSightenginePayload({
      nudity: { sexual_activity: 0, sexual_display: 0, erotica: 0 },
      offensive: { prob: 0 },
      gore: { prob: 0.92 },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('violent');
  });

  it('refuse arme au-dessus du seuil violence (MOD-1)', () => {
    const result = evaluateSightenginePayload({
      nudity: { sexual_activity: 0, sexual_display: 0, erotica: 0 },
      offensive: { prob: 0 },
      weapon: { classes: { firearm: 0.05, knife: 0.9 } },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('violent');
  });

  it('refuse la combinaison mineur + suggestif (MOD-8, CSAM)', () => {
    const result = evaluateSightenginePayload({
      nudity: { sexual_activity: 0.1, sexual_display: 0.4, erotica: 0.05 },
      offensive: { prob: 0 },
      faces: [{ attributes: { age: { minor: 0.87 } } }],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('minor_risk');
  });

  it('autorise un visage mineur détecté SANS signal de nudité/suggestif', () => {
    const result = evaluateSightenginePayload({
      nudity: { sexual_activity: 0, sexual_display: 0, erotica: 0 },
      offensive: { prob: 0 },
      faces: [{ attributes: { age: { minor: 0.95 } } }],
    });
    expect(result.allowed).toBe(true);
  });

  it('autorise un adulte dans une pose suggestive (score minor bas)', () => {
    const result = evaluateSightenginePayload({
      nudity: { sexual_activity: 0.1, sexual_display: 0.4, erotica: 0.05 },
      offensive: { prob: 0 },
      faces: [{ attributes: { age: { minor: 0.04 } } }],
    });
    expect(result.allowed).toBe(true);
  });
});

describe('userFacingModerationMessage', () => {
  it('retourne un message pour chaque raison', () => {
    expect(userFacingModerationMessage('explicit')).toMatch(/nudité/i);
    expect(userFacingModerationMessage('erotica')).toMatch(/suggestif/i);
    expect(userFacingModerationMessage('offensive')).toMatch(/choquants/i);
    expect(userFacingModerationMessage('violent')).toMatch(/violence/i);
    expect(userFacingModerationMessage('minor_risk')).toMatch(/mineurs/i);
  });
});
