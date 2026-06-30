import { describe, it, expect, beforeEach } from 'vitest';
import { db, Salon } from '../models/schema';
import { clearSalonPlaybackData, enqueueItem, ensureSalonQueue } from './salonPlaybackOps';

function seedYoutubeSalon(id: string): Salon {
  const salon: Salon = {
    id,
    hostId: 'host1',
    hostName: 'Host',
    title: 'Salon YouTube',
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: 'current_vid',
      title: 'Morceau en cours',
      artist: 'Artiste',
      isPlaying: true,
      progressMs: 45000,
      updatedAt: Date.now(),
      startedAt: Date.now() - 45000,
    },
    allowQueue: true,
    accessMode: 'public',
    createdAt: Date.now(),
  };
  db.salons.set(id, salon);
  return salon;
}

describe('salonPlaybackOps enqueueItem', () => {
  beforeEach(() => {
    db.salons.clear();
    db.salonQueues.clear();
  });

  it('ajoute à la file YouTube sans modifier la lecture en cours', () => {
    const salon = seedYoutubeSalon('salon_yt');
    const before = { ...salon.playbackState };

    const item = enqueueItem(salon.id, {
      title: 'Nouveau morceau',
      artist: 'Chaine',
      trackId: 'next_vid',
      externalUrl: 'https://www.youtube.com/watch?v=next_vid',
      addedById: 'host1',
      addedByName: 'Host',
      source: 'host',
    });

    const queue = ensureSalonQueue(salon.id);
    const after = db.salons.get(salon.id)!.playbackState;

    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(item.id);
    expect(queue[0].trackId).toBe('next_vid');
    expect(after.trackId).toBe(before.trackId);
    expect(after.progressMs).toBe(before.progressMs);
  });

  it('clearSalonPlaybackData vide la file', () => {
    const salon = seedYoutubeSalon('salon_yt2');
    enqueueItem(salon.id, {
      title: 'A',
      artist: 'B',
      trackId: 'vid_a',
      addedById: 'host1',
      addedByName: 'Host',
      source: 'host',
    });
    clearSalonPlaybackData(salon.id);
    expect(ensureSalonQueue(salon.id)).toHaveLength(0);
  });
});
