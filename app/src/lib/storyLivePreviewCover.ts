import { dicebearAdventurerAvatar } from './avatarUrl';
import type { Live } from '../types';

export function resolveStoryLivePreviewCoverUrl(
  live: Live | null | undefined,
  entry: { userId: string; avatarUrl?: string }
): string {
  const albumArt = live?.playbackState?.albumArtUrl?.trim();
  if (albumArt) return albumArt;
  const avatar = entry.avatarUrl?.trim();
  if (avatar) return avatar;
  return dicebearAdventurerAvatar(entry.userId);
}
