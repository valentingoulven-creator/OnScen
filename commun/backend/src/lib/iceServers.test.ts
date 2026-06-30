import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildIceServers } from './iceServers';

describe('buildIceServers', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.TURN_URL;
    delete process.env.TURN_USERNAME;
    delete process.env.TURN_CREDENTIAL;
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it('always includes Google STUN', () => {
    const servers = buildIceServers();
    expect(servers[0]).toEqual({ urls: 'stun:stun.l.google.com:19302' });
    expect(servers).toHaveLength(1);
  });

  it('adds TURN when env vars are set', () => {
    process.env.TURN_URL = 'turn:example.com:3478?transport=udp,turn:example.com:3478?transport=tcp';
    process.env.TURN_USERNAME = 'user';
    process.env.TURN_CREDENTIAL = 'pass';
    const servers = buildIceServers();
    expect(servers).toHaveLength(2);
    expect(servers[1]).toEqual({
      urls: ['turn:example.com:3478?transport=udp', 'turn:example.com:3478?transport=tcp'],
      username: 'user',
      credential: 'pass',
    });
  });

  it('omits TURN when credentials are incomplete', () => {
    process.env.TURN_URL = 'turn:example.com:3478';
    process.env.TURN_USERNAME = 'user';
    expect(buildIceServers()).toHaveLength(1);
  });
});
