import { beforeEach, describe, expect, it } from 'vitest';



import { db } from './models/schema';

import { getFollowingIds } from './lib/follows';

import { MSDEV_LISTENER_ID } from './seed-favorite-feed';

import { SALON_LIVE_BOT_SEEDS, seedProductionSalonsLives } from './seed-salons-lives';

import { getDistanceKm } from './lib/geo';

import {

  SHOWCASE_LIVE_HOST_IDS,

  SHOWCASE_MONTPELLIER_EVENT_COUNT,

  SHOWCASE_MONTPELLIER_RADIUS_KM,

  SHOWCASE_OFFLINE_SALON_HOST_IDS,

  SHOWCASE_OFFLINE_SALON_RADIUS_KM,

  SHOWCASE_FOLLOW_TARGET_IDS,

  SHOWCASE_EU_EVENT_COUNT,

  SHOWCASE_EU_LIVE_BOT_SEEDS,

  SHOWCASE_EU_LIVE_HOST_IDS,

  SHOWCASE_FOLLOWED_EVENT_COUNT,

  MSDEV_SHOWCASE_HOST_EVENT_PREFIX,

  countListenerShowcaseEvents,

  countShowcaseActiveLives,

  countShowcaseFollowedHostEvents,

  countShowcaseOfflineSalons,

  countShowcaseReels,

  needsMsdevShowcaseRepair,

  resolveShowcaseFollowTargetIds,

  seedMsdevShowcase,

  showcaseFollowsNeedRepair,

  showcaseHostContentNeedRepair,

  showcaseHostCoordinates,

  stablePointWithinMontpellierRadius,

  upgradeListenerShowcaseProfile,

} from './seed-msdev-showcase';



function resetDb() {

  db.users.clear();

  db.userFollows.clear();

  db.userFavorites.clear();

  db.feedPosts.length = 0;

  db.salons.clear();

  db.lives.clear();

  db.userReels.length = 0;

  db.albums.length = 0;

  db.compositions.length = 0;

}



function seedUser(id: string, username: string, email: string) {

  db.users.set(id, {

    id,

    username,

    email,

    passwordHash: 'x',

    meloCoins: 0,

    isGhostMode: false,

    lastSeenAt: Date.now(),

  });

}



function seedShowcaseFollowTargets() {

  seedUser(MSDEV_LISTENER_ID, 'Auditeur', 'listener@msdev.local');

  seedUser('user_dj', 'DJ Melody', 'dj@msdev.local');

  seedProductionSalonsLives();

}



function activeLiveForHost(hostId: string) {

  for (const live of db.lives.values()) {

    if (live.hostId === hostId && live.isActive !== false) return live;

  }

  return undefined;

}



describe('seedMsdevShowcase', () => {

  beforeEach(() => {

    process.env.APP_ENV = 'msdev';

    resetDb();

    seedShowcaseFollowTargets();

  });



  it('détecte un store incomplet', () => {

    expect(needsMsdevShowcaseRepair()).toBe(true);

  });



  it('crée un écosystème showcase Montpellier pour listener@msdev.local', () => {

    const result = seedMsdevShowcase({ force: true });

    expect(result.profileUpdated || result.reelsCreated > 0).toBe(true);

    expect(upgradeListenerShowcaseProfile()).toBe(false);



    const listener = db.users.get(MSDEV_LISTENER_ID)!;

    expect(listener.username).toBe('demo_test_founder');

    expect(listener.city).toBe('Montpellier');

    expect(getFollowingIds(MSDEV_LISTENER_ID).length).toBe(SHOWCASE_FOLLOW_TARGET_IDS.length);

    expect(showcaseFollowsNeedRepair()).toBe(false);

    expect(showcaseHostContentNeedRepair()).toBe(false);

    expect(countShowcaseReels()).toBeGreaterThanOrEqual(5);

    expect(countListenerShowcaseEvents()).toBeGreaterThanOrEqual(4);

    expect(countShowcaseFollowedHostEvents()).toBe(SHOWCASE_FOLLOWED_EVENT_COUNT);

    expect(countShowcaseActiveLives()).toBe(
      SHOWCASE_LIVE_HOST_IDS.length + SHOWCASE_EU_LIVE_HOST_IDS.length
    );

    expect(countShowcaseOfflineSalons()).toBe(SHOWCASE_OFFLINE_SALON_HOST_IDS.length);

    expect(db.salons.has('msdev_showcase_salon_01')).toBe(true);

    expect(db.lives.has('msdev_showcase_salon_01')).toBe(true);

    expect(db.lives.has('msdev_showcase_live_01')).toBe(false);

    expect(db.salons.has('msdev_showcase_salon_02')).toBe(true);

    expect(db.lives.has('msdev_showcase_live_02')).toBe(false);

  });



  it('limite les abonnements aux 10 hôtes curatés (5 MTP + 5 EU live)', () => {

    for (let i = 0; i < 200; i++) {

      seedUser(`bot_fr_${i}`, `Bot ${i}`, `bot_fr_${i}@bot.melosong.local`);

    }

    seedMsdevShowcase({ force: true });



    const following = new Set(getFollowingIds(MSDEV_LISTENER_ID));

    expect(following.size).toBe(SHOWCASE_FOLLOW_TARGET_IDS.length);

    expect(following.size).toBe(resolveShowcaseFollowTargetIds().length);



    for (const hostId of SHOWCASE_FOLLOW_TARGET_IDS) {

      expect(following.has(hostId)).toBe(true);

    }

    expect([...following].some((id) => id.startsWith('bot_fr_'))).toBe(false);

  });



  it('aligne Live suivi (8) et Salon suivi (2) sur des hôtes distincts', () => {

    seedMsdevShowcase({ force: true });



    for (const hostId of [...SHOWCASE_LIVE_HOST_IDS, ...SHOWCASE_EU_LIVE_HOST_IDS]) {

      expect(activeLiveForHost(hostId)).toBeDefined();

    }



    for (const hostId of SHOWCASE_OFFLINE_SALON_HOST_IDS) {

      expect(activeLiveForHost(hostId)).toBeUndefined();

      expect([...db.salons.values()].some((s) => s.hostId === hostId)).toBe(true);

    }



    const overlap = SHOWCASE_LIVE_HOST_IDS.filter((id) =>

      (SHOWCASE_OFFLINE_SALON_HOST_IDS as readonly string[]).includes(id)

    );

    expect(overlap).toHaveLength(0);

  });



  it('place les pins live sur villes seed et salons offline ≤ 5 km Montpellier', () => {

    seedMsdevShowcase({ force: true });



    const expectedListener = stablePointWithinMontpellierRadius('showcase-listener');

    const listener = db.users.get(MSDEV_LISTENER_ID)!;

    expect(listener.latitude).toBe(expectedListener.lat);

    expect(listener.longitude).toBe(expectedListener.lon);

    expect(getDistanceKm(43.6108, 3.8767, expectedListener.lat, expectedListener.lon)).toBeLessThanOrEqual(

      SHOWCASE_MONTPELLIER_RADIUS_KM

    );



    const hostCoords = new Set<string>();

    for (const hostId of SHOWCASE_FOLLOW_TARGET_IDS) {

      const expected = showcaseHostCoordinates(hostId);

      const user = db.users.get(hostId)!;

      expect(user.latitude).toBe(expected.lat);

      expect(user.longitude).toBe(expected.lon);



      if ((SHOWCASE_OFFLINE_SALON_HOST_IDS as readonly string[]).includes(hostId)) {

        expect(user.city).toBe('Montpellier');

        expect(getDistanceKm(43.6108, 3.8767, expected.lat, expected.lon)).toBeLessThanOrEqual(

          SHOWCASE_OFFLINE_SALON_RADIUS_KM

        );

      } else if ((SHOWCASE_EU_LIVE_HOST_IDS as readonly string[]).includes(hostId)) {

        expect(user.city).toBe(expected.city);

        expect(user.latitude).toBe(expected.lat);

        expect(user.longitude).toBe(expected.lon);

      } else {

        const seed = SALON_LIVE_BOT_SEEDS.find((s) => s.userId === hostId)!;

        expect(user.city).toBe(seed.city);

        expect(expected.lat).toBe(seed.lat);

        expect(expected.lon).toBe(seed.lng);

      }



      hostCoords.add(`${expected.lat},${expected.lon}`);



      for (const salon of [...db.salons.values()].filter((s) => s.hostId === hostId)) {

        expect(salon.latitude).toBe(expected.lat);

        expect(salon.longitude).toBe(expected.lon);

        expect(salon.blurredLatitude).toBe(expected.lat);

        expect(salon.blurredLongitude).toBe(expected.lon);

      }



      const live = activeLiveForHost(hostId);

      if (live) {

        expect(live.latitude).toBe(expected.lat);

        expect(live.longitude).toBe(expected.lon);

      }

    }



    expect(hostCoords.size).toBe(SHOWCASE_FOLLOW_TARGET_IDS.length);

  });



  it('crée 4 événements suivis Europe et 4 salons live EU', () => {

    seedMsdevShowcase({ force: true });



    const euEvents = db.feedPosts.filter(

      (p) => p.id.includes(`${MSDEV_SHOWCASE_HOST_EVENT_PREFIX}eu_`) && p.isEvent

    );

    expect(euEvents).toHaveLength(SHOWCASE_EU_EVENT_COUNT);



    const cities = euEvents.map((p) => p.eventLocation ?? '');

    expect(cities.some((c) => /Paris/i.test(c))).toBe(true);

    expect(cities.some((c) => /Berlin/i.test(c))).toBe(true);

    expect(cities.some((c) => /London/i.test(c))).toBe(true);

    expect(cities.some((c) => /Barcelona/i.test(c))).toBe(true);



    for (const hostId of SHOWCASE_EU_LIVE_BOT_SEEDS.map((s) => s.userId)) {

      expect(db.salons.has(`msdev_showcase_eu_salon-${hostId.replace('msdev_showcase_eu_bot-', '')}`)).toBe(

        true

      );

      expect(activeLiveForHost(hostId)).toBeDefined();

    }

  });

});


