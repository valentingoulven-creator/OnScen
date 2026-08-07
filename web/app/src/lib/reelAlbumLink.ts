import type { ReelStreamingLinks } from '../content/reelsDemoStreamingLinks';

/** Un seul lien externe par reel — priorité au champ `link`, sinon une plateforme du legacy `streamingLinks`. */
export function pickReelAlbumLink(reel: {
  link?: string;
  streamingLinks?: Partial<ReelStreamingLinks>;
}): string | undefined {
  const primary = reel.link?.trim();
  if (primary) return primary;
  const sl = reel.streamingLinks;
  if (!sl) return undefined;
  const spotify = sl.spotify?.trim();
  if (spotify) return spotify;
  const youtube = sl.youtube?.trim();
  if (youtube) return youtube;
  const deezer = sl.deezer?.trim();
  if (deezer) return deezer;
  return undefined;
}
