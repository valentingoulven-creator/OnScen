type PlaceSearchCityHit = {
  kind: 'city';
  label: string;
  latitude: number;
  longitude: number;
  postalCode?: string;
};

type PlaceSearchCountryHit = {
  kind: 'country';
  label: string;
  code?: string;
  latitude: number;
  longitude: number;
};

type PlaceSearchHit = PlaceSearchCityHit | PlaceSearchCountryHit;

/** Nom de ville normalisé sans CP ni suffixe pays — clé de déduplication. */
export function normalizeCityLabelForDedupe(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\(\d{5}\)\s*/g, '')
    .replace(/\s*,.*$/, '')
    .trim();
}

export function isPostcodeSearchQuery(query: string): boolean {
  return /^\d{2,5}$/.test(query.trim());
}

export function cityPlaceDedupeKey(
  hit: PlaceSearchCityHit,
  postcodeQuery: boolean
): string {
  const name = normalizeCityLabelForDedupe(hit.label);
  if (postcodeQuery && hit.postalCode?.trim()) {
    return `${name}|${hit.postalCode.trim()}`;
  }
  return name;
}

/** Garde l’entrée la plus informative (CP présent, libellé plus court). */
export function preferPlaceCityHit(
  current: PlaceSearchCityHit,
  candidate: PlaceSearchCityHit
): PlaceSearchCityHit {
  const currentHasCp = Boolean(current.postalCode?.trim());
  const candidateHasCp = Boolean(candidate.postalCode?.trim());
  if (candidateHasCp && !currentHasCp) return candidate;
  if (currentHasCp && !candidateHasCp) return current;
  return candidate.label.length < current.label.length ? candidate : current;
}

export function dedupePlaceHits(
  hits: PlaceSearchHit[],
  query: string
): PlaceSearchHit[] {
  const postcodeQuery = isPostcodeSearchQuery(query);
  const out: PlaceSearchHit[] = [];
  const cityByKey = new Map<string, PlaceSearchCityHit>();
  const seenCountries = new Set<string>();

  for (const hit of hits) {
    if (hit.kind === 'country') {
      const key = hit.label.trim().toLowerCase();
      if (seenCountries.has(key)) continue;
      seenCountries.add(key);
      out.push(hit);
      continue;
    }

    const key = cityPlaceDedupeKey(hit, postcodeQuery);
    const existing = cityByKey.get(key);
    cityByKey.set(key, existing ? preferPlaceCityHit(existing, hit) : hit);
  }

  for (const city of cityByKey.values()) {
    out.push(city);
  }

  return out;
}
