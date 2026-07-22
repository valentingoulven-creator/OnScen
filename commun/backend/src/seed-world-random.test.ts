import { describe, expect, it } from 'vitest';
import {
  FRANCE_POPULATED_CITY_NAMES,
  NON_FRANCE_POPULATED_CITIES,
} from './lib/botPopulatedCities';
import { WORLD_EVENT_COUNT, seedWorldEventPosts } from './seed-world-random';
import { db } from './models/schema';

describe('seedWorldEventPosts', () => {
  it('places events outside France only', () => {
    db.feedPosts.length = 0;
    db.users.clear();

    const result = seedWorldEventPosts({ force: true });

    expect(result.eventsTotal).toBe(WORLD_EVENT_COUNT);
    expect(result.eventsCreated).toBe(WORLD_EVENT_COUNT);

    const worldEvents = db.feedPosts.filter((p) => p.id.startsWith('feed-world-event-'));
    expect(worldEvents).toHaveLength(WORLD_EVENT_COUNT);

    for (const post of worldEvents) {
      const location = post.eventLocation ?? '';
      for (const frCity of FRANCE_POPULATED_CITY_NAMES) {
        expect(location).not.toContain(frCity);
      }
    }

    expect(NON_FRANCE_POPULATED_CITIES.length).toBeGreaterThan(WORLD_EVENT_COUNT);
  });
});
