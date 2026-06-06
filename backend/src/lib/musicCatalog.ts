/** Morceaux msdev avec IDs YouTube / Spotify connus pour résolution et recherche. */
export const MUSIC_CATALOG: Array<{
  title: string;
  artist: string;
  spotify?: { trackId: string };
  youtube?: { trackId: string };
}> = [
  {
    title: 'Midnight City',
    artist: 'M83',
    spotify: { trackId: '2P91MQbaiQKBR4c9sEgqsl' },
    youtube: { trackId: 'dX3kIQ6KlLi' },
  },
  {
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    spotify: { trackId: '4cOdK2wGLETKBW3PvgPWoT' },
    youtube: { trackId: 'dQw4w9WgXcQ' },
  },
  {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    spotify: { trackId: '0VjIjW4GlUZAMYd2vXMi3b' },
    youtube: { trackId: '4NRXx6W78buQNiQ3q5wEkP' },
  },
  {
    title: 'Levitating',
    artist: 'Dua Lipa',
    spotify: { trackId: '463CkQjx2Zk1yXoBuierZF' },
    youtube: { trackId: 'TUVcZfQe-Kw' },
  },
  {
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    spotify: { trackId: '7qiZfU4dY1lWllz35msBac' },
    youtube: { trackId: 'JGwWNGJdvx8' },
  },
  {
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    spotify: { trackId: '4u7Enebt6tX6NcPAXnPxA0' },
    youtube: { trackId: 'fJ9rUzIMcZQ' },
  },
  {
    title: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    spotify: { trackId: '5ghIJDpPoe3CfHMGuNKV83' },
    youtube: { trackId: 'hTWKbFBike8' },
  },
  {
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    spotify: { trackId: '5ChkMS8OtdzJeqyy99Cc0H' },
    youtube: { trackId: 'Zi_XLOBDo_Y' },
  },
  {
    title: 'Uptown Funk',
    artist: 'Mark Ronson ft. Bruno Mars',
    spotify: { trackId: '32OlwWuMpZ6b0aNer3O4od' },
    youtube: { trackId: 'OPf0YbXqDm0' },
  },
  {
    title: 'Happy',
    artist: 'Pharrell Williams',
    spotify: { trackId: '60nZcImufyMA1MKQY3dcCH' },
    youtube: { trackId: 'ZbZSe6N_BXs' },
  },
  {
    title: 'Bad Guy',
    artist: 'Billie Eilish',
    spotify: { trackId: '2Fxmhks0bxGSBdJ92vM42m' },
    youtube: { trackId: 'DyDfgMOUjCI' },
  },
  {
    title: 'As It Was',
    artist: 'Harry Styles',
    spotify: { trackId: '4LRPiXqCikLlN15cys7Esu' },
    youtube: { trackId: 'H5v3kku4y6Q' },
  },
  {
    title: 'Starboy',
    artist: 'The Weeknd',
    spotify: { trackId: '07hk0H0anV3ylJ89CBA3Fy' },
    youtube: { trackId: '34Na4j8AVgA' },
  },
  {
    title: 'Lose Yourself',
    artist: 'Eminem',
    spotify: { trackId: '5Z01UMMwpFJPWVWeScl8Vm' },
    youtube: { trackId: '_Yhyp-_hLt2' },
  },
  {
    title: 'Hotel California',
    artist: 'Eagles',
    spotify: { trackId: '40riOy7x9W7GXjyGp4pjAv' },
    youtube: { trackId: 'BciS5krYL80' },
  },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findMockMatch(title: string, artist: string) {
  const nt = normalize(title);
  const na = normalize(artist);
  return MUSIC_CATALOG.find((entry) => {
    const et = normalize(entry.title);
    const ea = normalize(entry.artist);
    return (nt.includes(et) || et.includes(nt)) && (na.includes(ea) || ea.includes(na) || !na);
  });
}

/** Piste YouTube sûres pour bots msdev (catalogue démo). */
export function getYoutubeDemoPool(): Array<{ trackId: string; title: string; artist: string }> {
  return MUSIC_CATALOG.filter((e) => e.youtube).map((e) => ({
    trackId: e.youtube!.trackId,
    title: e.title,
    artist: e.artist,
  }));
}

export function searchCatalogYoutube(query: string, limit = 10) {
  const nq = normalize(query);
  if (!nq) return [];

  const tokens = nq.split(' ').filter((t) => t.length > 1);
  const scored = MUSIC_CATALOG.filter((e) => e.youtube).map((entry) => {
    const hay = normalize(`${entry.title} ${entry.artist}`);
    let score = 0;
    if (hay.includes(nq)) score += 10;
    for (const t of tokens) {
      if (hay.includes(t)) score += 2;
    }
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => entry);
}
