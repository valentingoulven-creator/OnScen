import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { canUseMockPlatformConnect } from './platformMockConnect';
import type { User } from '../models/schema';

describe('platformMockConnect', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.MOCK_PLATFORM_CONNECT_USERNAMES;
  });

  afterEach(() => {
    process.env = envBackup;
  });

  const dye = { id: 'u1', username: 'Dye', email: 'kev.sainto@hotmail.fr' } as User;

  it('refuse si la variable env est absente', () => {
    expect(canUseMockPlatformConnect(dye)).toBe(false);
  });

  it('autorise un pseudo listé (insensible à la casse)', () => {
    process.env.MOCK_PLATFORM_CONNECT_USERNAMES = 'dye,other';
    expect(canUseMockPlatformConnect(dye)).toBe(true);
    expect(canUseMockPlatformConnect({ ...dye, username: 'other' })).toBe(true);
    expect(canUseMockPlatformConnect({ ...dye, username: 'random' })).toBe(false);
  });
});
