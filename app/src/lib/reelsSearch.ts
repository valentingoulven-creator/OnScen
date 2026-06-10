import type { MusicReel } from '../content/reels';

/** Client-side filter on loaded reels (title, artist, genre, author username). */
export function filterReelsBySearch(feed: MusicReel[], query: string): MusicReel[] {
  const q = query.trim().toLowerCase();
  if (!q) return feed;
  return feed.filter((reel) => {
    const fields = [reel.title, reel.artist, reel.genre, reel.authorUsername ?? ''];
    return fields.some((field) => field.toLowerCase().includes(q));
  });
}
