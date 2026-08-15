import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../../public');

describe('PWA assets', () => {
  it('PNG brand icons exist for favicon and manifest', () => {
    for (const file of ['icon.png', 'favicon.svg', 'favicon-32x32.png', 'favicon-48x48.png']) {
      expect(existsSync(join(publicDir, file))).toBe(true);
    }
  });

  it('PNG icons exist for home-screen install', () => {
    for (const file of ['pwa-192x192.png', 'pwa-512x512.png']) {
      const buf = readFileSync(join(publicDir, file));
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
    }
  });
});
