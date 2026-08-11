import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { db } from '../models/schema';
import { resolveShareOgMeta, injectOgMetaIntoHtml } from './shareOgMeta';

describe('shareOgMeta', () => {
  const baseUrl = 'https://onscen.com';

  beforeEach(() => {
    db.salons.clear();
    db.users.clear();
  });

  it('génère les meta pour un salon public', () => {
    db.salons.set('salon_test', {
      id: 'salon_test',
      hostId: 'host1',
      hostName: 'DJ Test',
      title: 'Soirée Funk',
      platform: 'youtube',
      playbackState: { isPlaying: false, positionMs: 0, updatedAt: Date.now() },
      latitude: 0,
      longitude: 0,
      blurredLatitude: 0,
      blurredLongitude: 0,
      listenersCount: 3,
      isGhostMode: false,
      isPublic: true,
      accessMode: 'public',
      allowedUserIds: [],
      allowQueue: true,
      createdAt: Date.now(),
    });

    const meta = resolveShareOgMeta('/salon/salon_test', baseUrl);
    expect(meta?.title).toContain('Soirée Funk');
    expect(meta?.title).toContain('YouTube');
    expect(meta?.description).toContain('DJ Test');
    expect(meta?.canonicalUrl).toBe('https://onscen.com/salon/salon_test');
  });

  it('ignore les salons bloqués admin', () => {
    db.salons.set('salon_blocked', {
      id: 'salon_blocked',
      hostId: 'host1',
      hostName: 'Host',
      title: 'Hidden',
      platform: 'youtube',
      playbackState: { isPlaying: false, positionMs: 0, updatedAt: Date.now() },
      latitude: 0,
      longitude: 0,
      blurredLatitude: 0,
      blurredLongitude: 0,
      listenersCount: 0,
      isGhostMode: false,
      isPublic: true,
      accessMode: 'public',
      allowedUserIds: [],
      allowQueue: true,
      createdAt: Date.now(),
      adminBlocked: true,
    });

    expect(resolveShareOgMeta('/salon/salon_blocked', baseUrl)).toBeNull();
  });

  it('injecte les balises OG dans index.html', () => {
    db.users.set('user1', {
      id: 'user1',
      username: 'MeloFan',
      email: 'fan@test.com',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: Date.now(),
      bio: 'Amateur de jazz',
    } as (typeof db.users extends Map<string, infer U> ? U : never));

    const meta = resolveShareOgMeta('/profile/user1', baseUrl);
    expect(meta).not.toBeNull();

    const html = injectOgMetaIntoHtml(
      '<!doctype html><html><head><title>OnScen</title></head><body></body></html>',
      meta!
    );
    expect(html).toContain('og:title');
    expect(html).toContain('MeloFan');
    expect(html).not.toContain('<title>OnScen</title>');
  });
});
