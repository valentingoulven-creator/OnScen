/** Pays affiché / filtré quand la géoloc est refusée ou indisponible. */
export const EVENTS_COUNTRY_FALLBACK = { code: 'FR', name: 'France' } as const;

export function countryCodeToFlag(code: string): string {
  const cc = code.toUpperCase();
  if (cc.length !== 2) return '🌍';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

export function formatTrendsCountrySubtitle(countryCode: string, countryName: string): string {
  return `${countryCodeToFlag(countryCode)} · ${countryName}`;
}

export function rankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}
