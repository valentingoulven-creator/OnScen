import type { Live, Salon } from '../types';
import { resolveSalonYoutubeTrackId } from './salonPlayback';

/** Live vidéo réel (HLS / WebRTC) — pas un salon YouTube synchronisé. */
export function isTrueVideoLive(live: Live): boolean {
  if (live.presentationDemoStream) return true;
  const mode = live.streamMode;
  if (mode === 'livekit' || mode === 'webrtc') return true;
  if (mode === 'cloudflare' && live.cloudflarePlaybackUrl?.trim()) return true;
  return false;
}

/** Payload nearby / salonToMapLive sans champs stream — enrichir via GET /lives/:id avant routage. */
export function liveNeedsStreamFieldEnrichment(live: Live): boolean {
  return (
    live.presentationDemoStream !== true &&
    live.streamMode == null &&
    !live.cloudflarePlaybackUrl?.trim()
  );
}

/** Salon YouTube vs aperçu live vidéo lors d’un clic marqueur live / profil en direct. */
export function shouldOpenSalonPreviewForLive(live: Live, salon: Salon | undefined): boolean {
  if (!salon) return false;
  if (isTrueVideoLive(live)) return false;
  return !!resolveSalonYoutubeTrackId(salon.playbackState);
}
