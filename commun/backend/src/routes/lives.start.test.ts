import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { db } from '../models/schema';
import { signTokenForUser } from '../middleware/auth';
import { livesRouter } from './lives';

/**
 * Régression pour le finding C1 (revue de code « création de live ») : deux requêtes
 * POST /lives/start quasi simultanées pour le même hôte (double-tap, retry réseau) ne
 * doivent créer qu'un seul live actif — jamais deux lives « fantômes » en parallèle.
 */
describe('POST /lives/start — garde anti-doublon (concurrence)', () => {
  let server: Server;
  let baseUrl: string;
  const hostId = 'host_concurrency_test';

  beforeEach(async () => {
    db.users.clear();
    db.lives.clear();
    db.salons.clear();
    db.activeLiveByHost.clear();
    db.liveChats.clear();
    db.liveBans.clear();

    db.users.set(hostId, {
      id: hostId,
      username: 'ConcurrencyHost',
      email: 'concurrency-host@test.local',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: Date.now(),
      age: 25,
      liveTermsAcceptedAt: Date.now(),
    } as (typeof db.users extends Map<string, infer U> ? U : never));

    const app = express();
    app.use(express.json());
    app.use('/lives', livesRouter);

    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('ne crée qu’un seul live quand deux requêtes concurrentes arrivent pour le même hôte', async () => {
    const token = signTokenForUser(db.users.get(hostId)!);
    const startRequest = () =>
      fetch(`${baseUrl}/lives/start`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({ title: 'Live concurrent test', latitude: 43.6, longitude: 3.88 }),
      }).then((r) => r.json());

    const [resA, resB] = await Promise.all([startRequest(), startRequest()]);

    expect(resA.live?.id).toBeTruthy();
    expect(resB.live?.id).toBeTruthy();
    // Les deux réponses doivent porter sur le même live — pas deux lives distincts.
    expect(resA.live.id).toBe(resB.live.id);

    const hostLives = [...db.lives.values()].filter((l) => l.hostId === hostId && l.isActive);
    expect(hostLives).toHaveLength(1);
  });

  it('refuse de démarrer un live si l’hôte a déjà un salon', async () => {
    db.salons.set('salon_host_exclusive', {
      id: 'salon_host_exclusive',
      hostId,
      hostName: 'ConcurrencyHost',
      title: 'Salon déjà ouvert',
      platform: 'youtube',
      playbackState: {
        platform: 'youtube',
        trackId: 'demo',
        title: 'Track',
        artist: 'Artist',
        isPlaying: true,
        progressMs: 0,
        updatedAt: Date.now(),
        startedAt: Date.now(),
      },
      latitude: 43.6,
      longitude: 3.88,
      blurredLatitude: 43.6,
      blurredLongitude: 3.88,
      listenersCount: 1,
      isGhostMode: false,
      isPublic: true,
      accessMode: 'public',
      allowedUserIds: [hostId],
      allowQueue: true,
      createdAt: Date.now(),
    });

    const token = signTokenForUser(db.users.get(hostId)!);
    const res = await fetch(`${baseUrl}/lives/start`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ title: 'Live interdit', latitude: 43.6, longitude: 3.88 }),
    });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('SALON_ACTIVE');
    expect([...db.lives.values()].filter((l) => l.hostId === hostId && l.isActive)).toHaveLength(0);
  });

  it('refuse de démarrer un live si PhotoDNA est requis sans clé', async () => {
    const prevRequired = process.env.PHOTODNA_REQUIRED;
    const prevKey = process.env.PHOTODNA_SUBSCRIPTION_KEY;
    process.env.PHOTODNA_REQUIRED = '1';
    delete process.env.PHOTODNA_SUBSCRIPTION_KEY;
    try {
      const token = signTokenForUser(db.users.get(hostId)!);
      const res = await fetch(`${baseUrl}/lives/start`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({ title: 'Live PhotoDNA', latitude: 43.6, longitude: 3.88 }),
      });
      const body = await res.json();
      expect(res.status).toBe(503);
      expect(body.code).toBe('PHOTODNA_UNAVAILABLE');
      expect([...db.lives.values()].filter((l) => l.hostId === hostId && l.isActive)).toHaveLength(0);
    } finally {
      if (prevRequired === undefined) delete process.env.PHOTODNA_REQUIRED;
      else process.env.PHOTODNA_REQUIRED = prevRequired;
      if (prevKey === undefined) delete process.env.PHOTODNA_SUBSCRIPTION_KEY;
      else process.env.PHOTODNA_SUBSCRIPTION_KEY = prevKey;
    }
  });
});
