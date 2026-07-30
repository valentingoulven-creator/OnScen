import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '../models/schema';
import {
  PRESENTATION_DEMO_CHAT_SEED_COUNT,
  PRESENTATION_DEMO_VIEWERS,
  PRESENTATION_LIVE_ID,
  buildPresentationDemoChat,
  ensurePresentationDemoAudienceUsers,
  pushPresentationDemoChatMessage,
} from './presentationDemoLive';

describe('presentationDemoLive chat', () => {
  beforeEach(() => {
    db.users.clear();
    db.lives.clear();
    db.liveChats.clear();
    ensurePresentationDemoAudienceUsers();
  });

  it('seed 60 messages from 40 audience bots', () => {
    const messages = buildPresentationDemoChat(PRESENTATION_LIVE_ID);
    expect(messages).toHaveLength(PRESENTATION_DEMO_CHAT_SEED_COUNT);
    const senders = new Set(messages.map((m) => m.senderId));
    expect(senders.size).toBe(PRESENTATION_DEMO_VIEWERS);
    expect(messages.every((m) => m.roomType === 'live' && m.roomId === PRESENTATION_LIVE_ID)).toBe(true);
  });

  it('pushPresentationDemoChatMessage requires active presentation live', () => {
    db.lives.set(PRESENTATION_LIVE_ID, {
      id: PRESENTATION_LIVE_ID,
      salonId: PRESENTATION_LIVE_ID,
      hostId: 'host',
      hostName: 'BeatCastel',
      title: 'Live Rap',
      platform: 'youtube',
      playbackState: {
        platform: 'youtube',
        trackId: 'x',
        title: 'x',
        artist: 'x',
        isPlaying: true,
        progressMs: 0,
        updatedAt: Date.now(),
        startedAt: Date.now(),
      },
      latitude: 43.63,
      longitude: 3.89,
      blurredLatitude: 43.63,
      blurredLongitude: 3.89,
      viewersCount: 40,
      isActive: true,
      startedAt: Date.now(),
      presentationDemoStream: true,
    });

    const msg = pushPresentationDemoChatMessage(PRESENTATION_LIVE_ID);
    expect(msg).not.toBeNull();
    expect(msg?.senderId.startsWith('pres_demo_castel_')).toBe(true);
    expect(db.liveChats.get(PRESENTATION_LIVE_ID)).toHaveLength(1);
  });
});
