/** Comptes msdev existants — profil ouvrable en démo (reels sans auteur réel). */
const DEMO_REEL_AUTHOR_USER_IDS = [
  'user_dj',
  'user_bass',
  'user_listener',
  'msdev_showcase_eu_bot-berlin',
  'msdev_showcase_eu_bot-london',
  'msdev_showcase_eu_bot-barcelona',
  'msdev_showcase_eu_bot-amsterdam',
  'bot_luna',
  'bot_nova',
  'bot_kira',
] as const;

const ARTIST_TO_USER_ID: Record<string, string> = {
  'DJ Melody': 'user_dj',
  'Vocal Live': 'user_listener',
  'Electric Soul': 'user_bass',
  'MeloSession': 'user_dj',
  'Arena Pulse': 'msdev_showcase_eu_bot-berlin',
  'RetroWave': 'msdev_showcase_eu_bot-amsterdam',
};

function hashArtist(artist: string): number {
  let h = 0;
  for (let i = 0; i < artist.length; i++) {
    h = (h * 31 + artist.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Auteur affiché (nom artiste) + userId démo pour navigation profil. */
export function getReelDemoAuthorProfile(artist: string): {
  authorId: string;
  authorUsername: string;
} {
  const authorUsername = artist.trim() || 'OnScen';
  const mapped = ARTIST_TO_USER_ID[authorUsername];
  const authorId =
    mapped ?? DEMO_REEL_AUTHOR_USER_IDS[hashArtist(authorUsername) % DEMO_REEL_AUTHOR_USER_IDS.length]!;
  return { authorId, authorUsername };
}
