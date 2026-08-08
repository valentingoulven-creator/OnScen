import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { upsertEnvFileKeys } from './envFileWriter';

describe('upsertEnvFileKeys', () => {
  const tmpFiles: string[] = [];

  function tmpEnvPath(): string {
    const file = path.join(os.tmpdir(), `onscen-env-writer-test-${Date.now()}-${Math.random()}.env`);
    tmpFiles.push(file);
    return file;
  }

  afterEach(() => {
    for (const file of tmpFiles.splice(0)) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  it('replaces an existing key in place and preserves other lines/comments', () => {
    const file = tmpEnvPath();
    fs.writeFileSync(
      file,
      ['# comment', 'FOO=bar', 'STRIPE_SECRET_KEY=sk_test_old', 'OTHER=1', ''].join('\n')
    );

    upsertEnvFileKeys(file, { STRIPE_SECRET_KEY: 'sk_live_newvalue1234' });

    const out = fs.readFileSync(file, 'utf8');
    const lines = out.split('\n');
    expect(lines).toContain('# comment');
    expect(lines).toContain('FOO=bar');
    expect(lines).toContain('STRIPE_SECRET_KEY=sk_live_newvalue1234');
    expect(lines).toContain('OTHER=1');
    expect(out).not.toContain('sk_test_old');
  });

  it('appends missing keys at the end', () => {
    const file = tmpEnvPath();
    fs.writeFileSync(file, 'FOO=bar\n');

    upsertEnvFileKeys(file, {
      STRIPE_SECRET_KEY: 'sk_live_abc1234567890123',
      STRIPE_WEBHOOK_SECRET: 'whsec_abc1234567890123',
    });

    const out = fs.readFileSync(file, 'utf8');
    expect(out).toContain('FOO=bar');
    expect(out).toContain('STRIPE_SECRET_KEY=sk_live_abc1234567890123');
    expect(out).toContain('STRIPE_WEBHOOK_SECRET=whsec_abc1234567890123');
  });

  it('creates the file when it does not exist', () => {
    const file = tmpEnvPath();
    expect(fs.existsSync(file)).toBe(false);

    upsertEnvFileKeys(file, { STRIPE_SECRET_KEY: 'sk_test_abc1234567890123' });

    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toContain('STRIPE_SECRET_KEY=sk_test_abc1234567890123');
  });
});
