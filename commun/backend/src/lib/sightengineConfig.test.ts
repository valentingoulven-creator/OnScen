import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getSightengineModels } from './sightengineConfig';

describe('getSightengineModels', () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      'SIGHTENGINE_MODELS',
      'SIGHTENGINE_MINOR_DETECTION_ENABLED',
      'SIGHTENGINE_VIOLENCE_MODELS_ENABLED',
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

  it('ajoute face-age/gore/weapon aux modèles par défaut (audit MOD-1/MOD-8)', () => {
    const models = getSightengineModels().split(',');
    expect(models).toContain('nudity-2.1');
    expect(models).toContain('offensive-2.0');
    expect(models).toContain('face-age');
    expect(models).toContain('gore-2.0');
    expect(models).toContain('weapon');
  });

  it('respecte une liste custom en y ajoutant les modèles de sécurité manquants', () => {
    process.env.SIGHTENGINE_MODELS = 'nudity-2.1';
    const models = getSightengineModels().split(',');
    expect(models).toContain('nudity-2.1');
    expect(models).toContain('face-age');
    expect(models).toContain('gore-2.0');
    expect(models).toContain('weapon');
  });

  it('ne duplique pas un modèle déjà présent dans la liste custom', () => {
    process.env.SIGHTENGINE_MODELS = 'nudity-2.1,face-age';
    const models = getSightengineModels().split(',');
    expect(models.filter((m) => m === 'face-age')).toHaveLength(1);
  });

  it('permet de désactiver explicitement la détection mineur', () => {
    process.env.SIGHTENGINE_MINOR_DETECTION_ENABLED = '0';
    const models = getSightengineModels().split(',');
    expect(models).not.toContain('face-age');
  });

  it('permet de désactiver explicitement les modèles violence', () => {
    process.env.SIGHTENGINE_VIOLENCE_MODELS_ENABLED = '0';
    const models = getSightengineModels().split(',');
    expect(models).not.toContain('gore-2.0');
    expect(models).not.toContain('weapon');
  });
});
