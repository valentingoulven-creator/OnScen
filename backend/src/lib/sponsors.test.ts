import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSponsor,
  deleteSponsor,
  ensureDefaultSponsors,
  isSponsorActiveAt,
  listActiveFeedAds,
  listActiveMapAds,
  listActiveReelsAds,
  listActiveStoriesAds,
  listSponsors,
  reorderSponsors,
  toggleSponsorActive,
  updateSponsor,
} from './sponsors';
import {
  getSponsorPlatformConfig,
  normalizeReelsSponsorEveryN,
  updateSponsorPlatformConfig,
} from './sponsorPlatformConfig';
import { db } from '../models/schema';

describe('sponsors', () => {
  beforeEach(() => {
    db.sponsors.length = 0;
    db.sponsorPlatformConfig = { reelsSponsorEnabled: true, reelsSponsorEveryN: 5 };
  });

  it('seed les sponsors par défaut si la liste est vide', () => {
    ensureDefaultSponsors();
    expect(db.sponsors.length).toBeGreaterThan(0);
    expect(listActiveMapAds().length).toBeGreaterThan(0);
  });

  it('filtre par placement et statut actif avec dates', () => {
    const now = Date.now();
    createSponsor({
      name: 'Test',
      placement: 'map_banner',
      active: true,
      title: 'Titre',
      subtitle: 'Sous-titre',
      cta: 'Go',
      startsAt: now + 60_000,
    });
    createSponsor({
      name: 'Feed',
      placement: 'feed_inline',
      active: true,
      title: 'Feed',
      subtitle: 'Inline',
      cta: 'Voir',
    });
    expect(listSponsors({ placement: 'map_banner', activeOnly: true }).length).toBe(0);
    expect(listSponsors({ placement: 'feed_inline' }).length).toBe(1);
    expect(isSponsorActiveAt(db.sponsors[0], now + 120_000)).toBe(true);
  });

  it('crée, met à jour, bascule et supprime un sponsor', () => {
    const created = createSponsor({
      name: 'Partner',
      title: 'Offre',
      subtitle: 'Détail',
      cta: 'Cliquer',
      linkUrl: 'https://example.com',
      kind: 'sponsored',
    });
    expect(created.active).toBe(true);
    const updated = updateSponsor(created.id, { title: 'Nouvelle offre' });
    expect(updated.title).toBe('Nouvelle offre');
    const toggled = toggleSponsorActive(created.id);
    expect(toggled.active).toBe(false);
    deleteSponsor(created.id);
    expect(db.sponsors.length).toBe(0);
  });

  it('réordonne les sponsors par priorité', () => {
    const a = createSponsor({
      name: 'A',
      title: 'A',
      subtitle: 'A',
      cta: 'A',
      priority: 0,
    });
    const b = createSponsor({
      name: 'B',
      title: 'B',
      subtitle: 'B',
      cta: 'B',
      priority: 1,
    });
    reorderSponsors([b.id, a.id]);
    const ordered = listSponsors();
    expect(ordered[0].id).toBe(b.id);
    expect(ordered[0].priority).toBe(0);
    expect(ordered[1].id).toBe(a.id);
    expect(ordered[1].priority).toBe(1);
  });

  it('refuse la création sans champs obligatoires', () => {
    expect(() => createSponsor({ name: '', title: 'x', subtitle: 'y', cta: 'z' })).toThrow(
      /nom du sponsor/
    );
    expect(() =>
      createSponsor({ name: 'X', title: '', subtitle: 'y', cta: 'z' })
    ).toThrow(/Titre/);
  });

  it('normalise displayDurationSec et l expose dans listActiveMapAds', () => {
    const created = createSponsor({
      name: 'Timer',
      title: 'T',
      subtitle: 'S',
      cta: 'Go',
      displayDurationSec: 2,
    });
    expect(created.displayDurationSec).toBe(3);
    const updated = updateSponsor(created.id, { displayDurationSec: 15 });
    expect(updated.displayDurationSec).toBe(15);
    const ad = listActiveMapAds().find((item) => item.id === created.id);
    expect(ad?.displayDurationSec).toBe(15);
  });

  it('expose les sponsors actifs par emplacement feed et stories', () => {
    createSponsor({
      name: 'FeedCo',
      placement: 'feed_inline',
      title: 'Feed',
      subtitle: 'Inline',
      cta: 'Voir',
      kind: 'sponsored',
    });
    createSponsor({
      name: 'StoryCo',
      placement: 'stories_banner',
      title: 'Stories',
      subtitle: 'Bandeau',
      cta: 'Go',
      active: false,
    });
    expect(listActiveFeedAds()).toHaveLength(1);
    expect(listActiveFeedAds()[0].sponsor).toBe('FeedCo');
    expect(listActiveStoriesAds()).toHaveLength(0);
    toggleSponsorActive(listSponsors({ placement: 'stories_banner' })[0].id);
    expect(listActiveStoriesAds()).toHaveLength(1);
  });

  it('expose les reels sponsorisés actifs avec videoUrl', () => {
    createSponsor({
      name: 'ReelCo',
      placement: 'reels_sponsored',
      title: 'Offre',
      subtitle: 'Détail',
      cta: 'Voir',
      videoUrl: 'https://example.com/ad.mp4',
      kind: 'sponsored',
    });
    const ads = listActiveReelsAds();
    expect(ads).toHaveLength(1);
    expect(ads[0].videoUrl).toBe('https://example.com/ad.mp4');
  });

  it('refuse un reel sponsorisé sans vidéo ni vignette', () => {
    expect(() =>
      createSponsor({
        name: 'Bad',
        placement: 'reels_sponsored',
        title: 'T',
        subtitle: 'S',
        cta: 'Go',
      })
    ).toThrow(/vidéo ou vignette/);
  });

  it('normalise reelsSponsorEveryN dans la config plateforme', () => {
    const updated = updateSponsorPlatformConfig({ reelsSponsorEveryN: 0 });
    expect(updated.reelsSponsorEveryN).toBe(1);
    expect(normalizeReelsSponsorEveryN(99)).toBe(50);
    expect(getSponsorPlatformConfig().reelsSponsorEnabled).toBe(true);
  });
});
