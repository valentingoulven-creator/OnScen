/** Lieux fréquents (seeds feed-event / user-event). */
export const POPULAR_EVENT_VENUES = [
  'Accor Arena, Paris, France',
  "L'Olympia, Paris, France",
  'Salle Pleyel, Paris, France',
  'Zénith Sud, Montpellier, France',
  'Le Rockstore, Montpellier, France',
] as const;

export interface EventLocationPreset {
  id: string;
  label: string;
  kind: 'venue' | 'profile_city' | 'my_position';
}

export function normalizeCityLabel(city: string): string {
  const c = city.trim();
  if (!c) return '';
  if (/,/.test(c)) return c;
  return `${c}, France`;
}

/** Jusqu'à 5 propositions : ma position, ville profil, salles populaires. */
export function buildEventLocationPresets(opts: {
  profileCity?: string;
  geoAvailable?: boolean;
  max?: number;
}): EventLocationPreset[] {
  const max = opts.max ?? 5;
  const out: EventLocationPreset[] = [];
  const seen = new Set<string>();

  const push = (preset: EventLocationPreset) => {
    const key = preset.label.trim().toLowerCase();
    if (!key || seen.has(key) || out.length >= max) return;
    seen.add(key);
    out.push(preset);
  };

  if (opts.geoAvailable) {
    push({ id: 'my_position', label: '', kind: 'my_position' });
  }

  const profileLabel = normalizeCityLabel(opts.profileCity ?? '');
  if (profileLabel) {
    push({ id: 'profile_city', label: profileLabel, kind: 'profile_city' });
  }

  for (const venue of POPULAR_EVENT_VENUES) {
    push({ id: venue, label: venue, kind: 'venue' });
    if (out.length >= max) break;
  }

  return out;
}
