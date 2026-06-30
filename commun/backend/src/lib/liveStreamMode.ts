import { isCloudflareStreamConfigured } from './cloudflareStream';
import { isLiveKitConfigured } from './livekit';

export type LiveStreamMode = 'webrtc' | 'cloudflare' | 'livekit';

/** Priority: LiveKit Cloud > Cloudflare Stream > WebRTC mesh fallback. */
export function defaultLiveStreamMode(): LiveStreamMode {
  if (isLiveKitConfigured()) return 'livekit';
  if (isCloudflareStreamConfigured()) return 'cloudflare';
  return 'webrtc';
}
