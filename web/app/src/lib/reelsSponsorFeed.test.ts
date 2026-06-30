import { describe, expect, it } from 'vitest';
import type { MusicReel } from '../content/reels';
import type { ReelsSponsorAd } from '../types';
import {
  DEFAULT_REELS_SPONSOR_CONFIG,
  interleaveReelsSponsors,
  normalizeReelsSponsorEveryN,
  sponsorDisplayKey,
} from './reelsSponsorFeed';

function mockReel(id: string): MusicReel {
  return {
    id,
    title: id,
    artist: 'A',
    genre: 'pop',
    mediaType: 'video',
    videoUrl: 'https://example.com/v.mp4',
    posterUrl: 'https://example.com/p.jpg',
    hasAudio: true,
    authorId: 'u1',
    authorUsername: 'user',
    visibility: 'public',
    viewCount: 0,
  };
}

function mockAd(id: string): ReelsSponsorAd {
  return {
    id,
    title: 'Sponsor',
    subtitle: 'Offre',
    cta: 'Voir',
    accent: 'purple',
    kind: 'sponsored',
    videoUrl: 'https://example.com/ad.mp4',
  };
}

describe('reelsSponsorFeed', () => {
  it('normalise reelsSponsorEveryN entre 1 et 50', () => {
    expect(normalizeReelsSponsorEveryN(0)).toBe(1);
    expect(normalizeReelsSponsorEveryN(100)).toBe(50);
    expect(normalizeReelsSponsorEveryN(5)).toBe(5);
  });

  it('n’insère pas de sponsor si désactivé ou liste vide', () => {
    const reels = [mockReel('r1'), mockReel('r2')];
    expect(interleaveReelsSponsors(reels, [mockAd('a1')], { ...DEFAULT_REELS_SPONSOR_CONFIG, reelsSponsorEnabled: false })).toHaveLength(2);
    expect(interleaveReelsSponsors(reels, [], DEFAULT_REELS_SPONSOR_CONFIG)).toHaveLength(2);
  });

  it('insère un sponsor tous les N reels organiques', () => {
    const reels = [mockReel('r1'), mockReel('r2'), mockReel('r3'), mockReel('r4'), mockReel('r5'), mockReel('r6')];
    const items = interleaveReelsSponsors(reels, [mockAd('a1')], {
      reelsSponsorEnabled: true,
      reelsSponsorEveryN: 2,
    });
    expect(items.map((i) => i.key)).toEqual([
      'r1',
      'r2',
      sponsorDisplayKey(mockAd('a1')),
      'r3',
      'r4',
      sponsorDisplayKey(mockAd('a1')),
      'r5',
      'r6',
      sponsorDisplayKey(mockAd('a1')),
    ]);
  });

  it('fait tourner plusieurs sponsors actifs', () => {
    const reels = [mockReel('r1'), mockReel('r2'), mockReel('r3'), mockReel('r4')];
    const items = interleaveReelsSponsors(reels, [mockAd('a1'), mockAd('a2')], {
      reelsSponsorEnabled: true,
      reelsSponsorEveryN: 2,
    });
    const sponsorKeys = items.filter((i) => i.kind === 'sponsor').map((i) => i.key);
    expect(sponsorKeys).toEqual([sponsorDisplayKey(mockAd('a1')), sponsorDisplayKey(mockAd('a2'))]);
  });
});
