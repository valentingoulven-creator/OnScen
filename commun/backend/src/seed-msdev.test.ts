import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from './models/schema';
import { ensureMsdevDemoAccounts } from './seed-msdev';
import { MSDEV_DEMO_EMAILS } from './lib/msdevDemoAccounts';

describe('ensureMsdevDemoAccounts', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, APP_ENV: 'msdev' };
    db.users.clear();
    db.users.set('onscen_world_salon_01', {
      id: 'onscen_world_salon_01',
      username: 'bot',
      email: 'bot@bot.onscen.local',
      passwordHash: 'bot',
      meloCoins: 0,
      isGhostMode: false,
    });
  });

  afterEach(() => {
    process.env = envBackup;
    db.users.clear();
  });

  it('crée les comptes démo manquants dans un store partiel', async () => {
    const added = await ensureMsdevDemoAccounts();
    expect(added).toBe(3);
    for (const email of MSDEV_DEMO_EMAILS) {
      expect([...db.users.values()].some((u) => u.email === email)).toBe(true);
    }
  });

  it('est idempotent si les comptes démo existent déjà', async () => {
    await ensureMsdevDemoAccounts();
    const added = await ensureMsdevDemoAccounts();
    expect(added).toBe(0);
  });
});
