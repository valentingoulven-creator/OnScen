import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSponsor,
  deleteSponsor,
  ensureDefaultSponsors,
  filterMapSponsorsByViewport,
  isSponsorActiveAt,
  isSponsorVisibleOnMap,
  listActiveFeedAds,
  listActiveMapAds,
  listActiveMapSidebarEventPostIds,
  listActiveReelsAds,
  listActiveStoriesAds,
  listSponsors,
  MAP_REGION_MIN_ZOOM,
  migrateSponsorMapVisibility,
  reorderSponsors,
  setDevMapSidebarEventSponsorship,
  toggleSponsorActive,
  updateSponsor,
  type MapViewportQuery,
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
    const added = ensureDefaultSponsors();
    expect(added).toBeGreaterThan(0);
    expect(db.sponsors.length).toBeGreaterThan(0);
    expect(listActiveMapAds().length).toBeGreaterThan(0);
  });

  it('ajoute les sponsors par défaut manquants sans écraser la liste existante', () => {
    createSponsor({
      name: 'Soundy',
      placement: 'map_banner',
      title: 'Soundy Premium',
      subtitle: 'Sans pub',
      cta: 'Découvrir',
      priority: 0,
    });
    db.sponsors[0].id = 'premium';

    const added = ensureDefaultSponsors();
    expect(added).toBeGreaterThan(0);
    expect(db.sponsors.some((s) => s.id === 'solar-festival-cres')).toBe(true);
    expect(db.sponsors.some((s) => s.id === 'les-deferlantes-2026')).toBe(true);
    expect(db.sponsors.filter((s) => s.id === 'premium')).toHaveLength(1);
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
    const updated = updateSponsorPlatformConfig({ reelsSponsorEveryN:  0 });
    expect(updated.reelsSponsorEveryN).toBe(1);
    expect(normalizeReelsSponsorEveryN(99)).toBe(50);
    expect(getSponsorPlatformConfig().reelsSponsorEnabled).toBe(true);
  });

  const cresViewport: MapViewportQuery = {
    lat: 43.65,
    lng: 3.86,
    zoom: MAP_REGION_MIN_ZOOM,
    north: 43.8,
    south: 43.5,
    east: 4.0,
    west: 3.7,
  };

  const parisViewport: MapViewportQuery = {
    lat: 48.85,
    lng: 2.35,
    zoom: MAP_REGION_MIN_ZOOM,
    north: 49.0,
    south: 48.5,
    east: 2.6,
    west: 2.1,
  };

  const argelesViewport: MapViewportQuery = {
    lat: 42.55,
    lng: 3.02,
    zoom: MAP_REGION_MIN_ZOOM,
    north: 42.7,
    south: 42.4,
    east: 3.2,
    west: 2.8,
  };

  it('affiche Solar au zoom ville quand Le Crès est dans le viewport', () => {
    // Le sponsor par défaut est daté (endsAt = fin de festival réelle) — on fixe
    // l'horloge pendant la fenêtre d'activité pour ne pas dépendre de la date réelle
    // d'exécution du test (sinon le test casse une fois le festival passé).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z'));
    try {
      ensureDefaultSponsors();
      const ids = listActiveMapAds(undefined, cresViewport).map((ad) => ad.id);
      expect(ids).toContain('premium');
      expect(ids).toContain('solar-festival-cres');
      expect(ids).not.toContain('les-deferlantes-2026');
    } finally {
      vi.useRealTimers();
    }
  });

  it('n affiche que les sponsors France au zoom overview', () => {
    ensureDefaultSponsors();
    const overviewViewport = { lat: 46.6, lng: 2.4, zoom: 6 };
    const ids = listActiveMapAds(undefined, overviewViewport).map((ad) => ad.id);
    expect(ids).toContain('premium');
    expect(ids).not.toContain('solar-festival-cres');
    expect(ids).not.toContain('les-deferlantes-2026');
  });

  it('filtre les bandeaux carte par ciblage géographique', () => {
    createSponsor({
      name: 'National',
      placement: 'map_banner',
      title: 'Partout',
      subtitle: 'France',
      cta: 'Go',
      mapVisibilityScope: 'france',
    });
    createSponsor({
      name: 'Local',
      placement: 'map_banner',
      title: 'Crès',
      subtitle: 'Festival',
      cta: 'Go',
      mapVisibilityScope: 'region',
      mapTargetRegionName: 'Le Crès',
      mapTargetLat: 43.6489,
      mapTargetLng: 3.8567,
    });

    expect(listActiveMapAds().map((ad) => ad.title)).toEqual(['Partout']);
    expect(
      listActiveMapAds(undefined, cresViewport).map(
        (ad) => ad.title
      )
    ).toEqual(['Partout', 'Crès']);
    expect(
      listActiveMapAds(undefined, parisViewport).map(
        (ad) => ad.title
      )
    ).toEqual(['Partout']);
    expect(
      listActiveMapAds(undefined, { ...cresViewport, zoom: MAP_REGION_MIN_ZOOM - 1 }).map(
        (ad) => ad.title
      )
    ).toEqual(['Partout']);
  });

  it('refuse un bandeau régional sans coordonnées', () => {
    expect(() =>
      createSponsor({
        name: 'Bad region',
        placement: 'map_banner',
        title: 'T',
        subtitle: 'S',
        cta: 'Go',
        mapVisibilityScope: 'region',
        mapTargetRegionName: 'Le Crès',
      })
    ).toThrow(/Latitude et longitude/);
  });

  it('migre le ciblage géo des sponsors existants', () => {
    createSponsor({
      name: 'Legacy',
      placement: 'map_banner',
      title: 'T',
      subtitle: 'S',
      cta: 'Go',
    });
    const sponsor = db.sponsors[0];
    delete sponsor.mapVisibilityScope;
    expect(migrateSponsorMapVisibility()).toBe(1);
    expect(sponsor.mapVisibilityScope).toBe('france');
  });

  it('filterMapSponsorsByViewport garde France et région si ville cible dans bounds', () => {
    const france = createSponsor({
      name: 'National',
      placement: 'map_banner',
      title: 'Partout',
      subtitle: 'France',
      cta: 'Go',
      mapVisibilityScope: 'france',
    });
    const regional = createSponsor({
      name: 'Local',
      placement: 'map_banner',
      title: 'Crès',
      subtitle: 'Festival',
      cta: 'Go',
      mapVisibilityScope: 'region',
      mapTargetRegionName: 'Le Crès',
      mapTargetLat: 43.6489,
      mapTargetLng: 3.8567,
    });
    const visible = filterMapSponsorsByViewport(db.sponsors, cresViewport).map((s) => s.id);
    expect(visible).toEqual(expect.arrayContaining([france.id, regional.id]));
    const parisVisible = filterMapSponsorsByViewport(db.sponsors, parisViewport).map((s) => s.id);
    expect(parisVisible).toContain(france.id);
    expect(parisVisible).not.toContain(regional.id);
  });

  it('isSponsorVisibleOnMap exige zoom ville et ville cible dans le viewport', () => {
    const regional = createSponsor({
      name: 'Regional',
      placement: 'map_banner',
      title: 'T',
      subtitle: 'S',
      cta: 'Go',
      mapVisibilityScope: 'region',
      mapTargetRegionName: 'Le Crès',
      mapTargetLat: 43.6489,
      mapTargetLng: 3.8567,
    });
    expect(isSponsorVisibleOnMap(regional, cresViewport)).toBe(true);
    expect(isSponsorVisibleOnMap(regional, parisViewport)).toBe(false);
    expect(
      isSponsorVisibleOnMap(regional, { ...parisViewport, zoom: MAP_REGION_MIN_ZOOM - 1 })
    ).toBe(false);
    expect(
      isSponsorVisibleOnMap(regional, { lat: 43.65, lng: 3.86, zoom: MAP_REGION_MIN_ZOOM })
    ).toBe(false);
  });

  it('affiche Les Déferlantes quand Argelès est dans le viewport', () => {
    // Cf. commentaire du test Solar ci-dessus : horloge fixée pendant la fenêtre
    // d'activité réelle du sponsor par défaut (endsAt daté).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z'));
    try {
      ensureDefaultSponsors();
      const ids = listActiveMapAds(undefined, argelesViewport).map((ad) => ad.id);
      expect(ids).toContain('les-deferlantes-2026');
      expect(ids).not.toContain('solar-festival-cres');
    } finally {
      vi.useRealTimers();
    }
  });

  it('exclut les sponsors désactivés de listActiveMapAds', () => {
    const created = createSponsor({
      name: 'Inactive',
      placement: 'map_banner',
      title: 'T',
      subtitle: 'S',
      cta: 'Go',
      mapVisibilityScope: 'france',
    });
    updateSponsor(created.id, { active: false });
    expect(listActiveMapAds()).toEqual([]);
  });

  it('persiste mapVisibilityScope region sur mise à jour admin partielle', () => {
    const created = createSponsor({
      name: 'Solar',
      placement: 'map_banner',
      title: 'Festival',
      subtitle: 'Local',
      cta: 'Go',
      mapVisibilityScope: 'france',
    });
    const updated = updateSponsor(created.id, {
      mapVisibilityScope: 'region',
      mapTargetRegionName: 'Le Crès',
      mapTargetLat: 43.6489,
      mapTargetLng: 3.8567,
    });
    expect(updated.mapVisibilityScope).toBe('region');
    expect(updated.mapTargetRegionName).toBe('Le Crès');
    expect(updated.mapTargetLat).toBe(43.6489);
    expect(
      listActiveMapAds(undefined, cresViewport).some(
        (ad) => ad.id === created.id
      )
    ).toBe(true);
    expect(listActiveMapAds(undefined, parisViewport).some((ad) => ad.id === created.id)).toBe(
      false
    );
  });

  it('accepte un bandeau image seule sans accent ni texte carte', () => {
    const created = createSponsor({
      name: 'Partner',
      placement: 'map_banner',
      title: 'Campagne visuelle',
      subtitle: '',
      cta: '',
      bannerDisplayMode: 'image_only',
      bannerImageUrl:
        'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1280&h=192&fit=crop',
      linkUrl: 'https://example.com/promo',
      accent: null,
      mapVisibilityScope: 'france',
    });
    expect(created.bannerDisplayMode).toBe('image_only');
    expect(created.accent).toBeUndefined();
    const ad = listActiveMapAds().find((item) => item.id === created.id);
    expect(ad?.bannerDisplayMode).toBe('image_only');
    expect(ad?.accent).toBeUndefined();
    expect(ad?.href).toBe('https://example.com/promo');
  });

  it('refuse image seule sans image ou sans lien/action', () => {
    expect(() =>
      createSponsor({
        name: 'Bad',
        placement: 'map_banner',
        title: 'T',
        bannerDisplayMode: 'image_only',
        linkUrl: 'https://example.com',
        mapVisibilityScope: 'france',
      })
    ).toThrow(/Image du bandeau/);

    expect(() =>
      createSponsor({
        name: 'Bad',
        placement: 'map_banner',
        title: 'T',
        bannerDisplayMode: 'image_only',
        bannerImageUrl:
        'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1280&h=192&fit=crop',
        mapVisibilityScope: 'france',
      })
    ).toThrow(/Lien ou action/);
  });

  it('setDevMapSidebarEventSponsorship active puis désactive un événement', () => {
    db.feedPosts.length = 0;
    db.feedPosts.push({
      id: 'evt-dev-sponso-test',
      userId: 'u1',
      content: 'Concert test\nDescription',
      createdAt: Date.now(),
      isEvent: true,
      eventLocation: 'Montpellier',
    });

    const promoted = setDevMapSidebarEventSponsorship('evt-dev-sponso-test', true);
    expect(promoted.sponsored).toBe(true);
    expect(promoted.sponsor?.placement).toBe('map_sidebar_events');
    expect(promoted.sponsor?.linkedEventPostId).toBe('evt-dev-sponso-test');
    expect(listActiveMapSidebarEventPostIds()).toContain('evt-dev-sponso-test');

    const demoted = setDevMapSidebarEventSponsorship('evt-dev-sponso-test', false);
    expect(demoted.sponsored).toBe(false);
    expect(listActiveMapSidebarEventPostIds()).not.toContain('evt-dev-sponso-test');
  });
});
