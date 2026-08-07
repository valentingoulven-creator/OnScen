import { db, type Live } from './models/schema';
import { schedulePersist } from './lib/persist';
import { persistLiveToPgAsync, upsertSalonToPgAsync } from './lib/pgSalonsLives';
import { getPool, isPostgresEnabled } from './db/pool';
import { SALON_LIVE_ID_PREFIX } from './seed-salons-lives';
import { CREATOR_MONETIZATION_MIN_AGE } from './lib/ageGates';
import { defaultDonationOptionsForLive } from './lib/liveDonationDefaults';
import {
  PRESENTATION_DEMO_HLS,
  PRESENTATION_DEMO_PLAYBACK,
  PRESENTATION_DEMO_VIEWERS,
  PRESENTATION_LIVE_ID,
  buildPresentationDemoChat,
  ensurePresentationDemoAudienceUsers,
} from './lib/presentationDemoLive';
import { buildPlatformTrackUrl } from './lib/musicLinks';

export interface SeedPresentationLiveResult {
  liveId: string;
  updated: boolean;
  audienceUsersCreated: number;
  chatMessages: number;
  viewersCount: number;
}

/** Live présentation Castelnau — 40 spectateurs, chat actif, vidéo chanteur·se (msdev). */
export function seedMsdevPresentationLive(): SeedPresentationLiveResult {
  const audienceUsersCreated = ensurePresentationDemoAudienceUsers();
  const chatMessages = buildPresentationDemoChat(PRESENTATION_LIVE_ID);

  const ensurePresentationHostMonetization = (hostId: string) => {
    const host = db.users.get(hostId);
    if (!host) return;
    if (typeof host.age === 'number' && host.age >= CREATOR_MONETIZATION_MIN_AGE) return;
    host.age = CREATOR_MONETIZATION_MIN_AGE;
    db.users.set(host.id, host);
  };

  const syncPresentationSalonPlayback = () => {
    const salon = db.salons.get(PRESENTATION_LIVE_ID);
    if (!salon) return;
    const now = Date.now();
    const { title, artist, trackId } = PRESENTATION_DEMO_PLAYBACK;
    salon.playbackState = {
      platform: 'youtube',
      trackId,
      title,
      artist,
      albumArtUrl: `https://img.youtube.com/vi/${trackId}/hqdefault.jpg`,
      isPlaying: true,
      progressMs: 45_000,
      updatedAt: now,
      startedAt: now - 45_000,
      externalUrl: buildPlatformTrackUrl('youtube', trackId),
    };
    db.salons.set(salon.id, salon);
    const liveRef = db.lives.get(PRESENTATION_LIVE_ID);
    if (liveRef) {
      liveRef.playbackState = salon.playbackState;
      db.lives.set(liveRef.id, liveRef);
    }
  };

  const applyPresentationDemoLiveFields = (target: Live) => {
    target.isActive = true;
    target.viewersCount = PRESENTATION_DEMO_VIEWERS;
    target.peakViewersCount = Math.max(target.peakViewersCount ?? 0, PRESENTATION_DEMO_VIEWERS);
    target.cameraActive = true;
    target.streamMode = 'cloudflare';
    target.presentationDemoStream = true;
    target.cloudflareLiveInputId = target.cloudflareLiveInputId ?? 'presentation-demo-castel';
    target.cloudflarePlaybackUrl = PRESENTATION_DEMO_HLS;
    target.contentCategory = target.contentCategory ?? 'music';
    target.videoAspectRatio = target.videoAspectRatio ?? '16:9';
    target.title = 'Live voix — session chanteur·se';
    target.tipsEnabled = true;
    target.donationOptions = defaultDonationOptionsForLive();
    target.donationGoals = [
      {
        id: 'pres_demo_goal_castel',
        type: 'amount',
        target: 500,
        label: 'Objectif démo — 500 €',
      },
    ];
    if (!target.startedAt) target.startedAt = Date.now() - 1_800_000;
  };

  let live = db.lives.get(PRESENTATION_LIVE_ID);
  let updated: boolean;

  if (!live) {
    const hostId = `${SALON_LIVE_ID_PREFIX}bot-beat-castel`;
    const host = db.users.get(hostId);
    const salon = db.salons.get(PRESENTATION_LIVE_ID);
    if (!host || !salon) {
      return {
        liveId: PRESENTATION_LIVE_ID,
        updated: false,
        audienceUsersCreated,
        chatMessages: 0,
        viewersCount: 0,
      };
    }
    ensurePresentationHostMonetization(host.id);
    live = {
      id: PRESENTATION_LIVE_ID,
      salonId: PRESENTATION_LIVE_ID,
      hostId: host.id,
      hostName: host.username,
      title: 'Live voix — session chanteur·se',
      platform: 'youtube',
      playbackState: salon.playbackState,
      latitude: salon.latitude,
      longitude: salon.longitude,
      blurredLatitude: salon.blurredLatitude,
      blurredLongitude: salon.blurredLongitude,
      viewersCount: PRESENTATION_DEMO_VIEWERS,
      peakViewersCount: PRESENTATION_DEMO_VIEWERS,
      isActive: true,
      startedAt: Date.now() - 1_800_000,
      cameraActive: true,
      streamMode: 'cloudflare',
      presentationDemoStream: true,
      cloudflareLiveInputId: 'presentation-demo-castel',
      cloudflarePlaybackUrl: PRESENTATION_DEMO_HLS,
      contentCategory: 'music',
      videoAspectRatio: '16:9',
    };
    applyPresentationDemoLiveFields(live);
    db.lives.set(live.id, live);
    updated = true;
  } else {
    ensurePresentationHostMonetization(live.hostId);
    applyPresentationDemoLiveFields(live);
    db.lives.set(live.id, live);
    updated = true;
  }

  const salon = db.salons.get(PRESENTATION_LIVE_ID);
  if (salon) {
    salon.listenersCount = PRESENTATION_DEMO_VIEWERS;
    db.salons.set(salon.id, salon);
  }

  syncPresentationSalonPlayback();

  db.liveChats.set(PRESENTATION_LIVE_ID, chatMessages);
  if (!db.liveBans.has(PRESENTATION_LIVE_ID)) {
    db.liveBans.set(PRESENTATION_LIVE_ID, new Map());
  }

  schedulePersist();
  void persistPresentationLiveData();

  return {
    liveId: PRESENTATION_LIVE_ID,
    updated,
    audienceUsersCreated,
    chatMessages: chatMessages.length,
    viewersCount: PRESENTATION_DEMO_VIEWERS,
  };
}

export function ensureMsdevPresentationLive(): SeedPresentationLiveResult | null {
  if (process.env.APP_ENV !== 'msdev' && process.env.MSENV !== 'msdev') return null;
  const result = seedMsdevPresentationLive();
  if (result.updated) {
    console.log(
      `[msdev] Live présentation Castelnau : ${result.viewersCount} spectateurs, ${result.chatMessages} message(s), vidéo démo chanteur·se`
    );
  }
  return result;
}

export async function persistPresentationLiveData(): Promise<void> {
  if (!isPostgresEnabled()) return;
  const live = db.lives.get(PRESENTATION_LIVE_ID);
  const salon = db.salons.get(PRESENTATION_LIVE_ID);
  const chat = db.liveChats.get(PRESENTATION_LIVE_ID) ?? [];
  try {
    if (salon) upsertSalonToPgAsync(salon);
    if (live) persistLiveToPgAsync(live);
    if (live) {
      await getPool().query(
        `INSERT INTO live_chats (live_id, messages) VALUES ($1, $2::jsonb)
         ON CONFLICT (live_id) DO UPDATE SET messages = EXCLUDED.messages`,
        [PRESENTATION_LIVE_ID, JSON.stringify(chat)]
      );
    }
  } catch (err) {
    console.warn('[msdev] Persistance PG live présentation ignorée:', err);
  }
}
