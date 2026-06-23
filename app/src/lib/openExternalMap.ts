export type ExternalMapProvider = 'google' | 'waze' | 'apple';

export interface ExternalMapTarget {
  label: string;
  latitude?: number | null;
  longitude?: number | null;
}

function hasCoords(
  target: ExternalMapTarget
): target is ExternalMapTarget & { latitude: number; longitude: number } {
  return (
    typeof target.latitude === 'number' &&
    Number.isFinite(target.latitude) &&
    typeof target.longitude === 'number' &&
    Number.isFinite(target.longitude)
  );
}

export function buildExternalMapUrl(
  provider: ExternalMapProvider,
  target: ExternalMapTarget
): string {
  const label = target.label.trim();
  const encodedLabel = encodeURIComponent(label);

  if (provider === 'google') {
    const query = hasCoords(target)
      ? `${target.latitude},${target.longitude}`
      : label;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  if (provider === 'waze') {
    if (hasCoords(target)) {
      return `https://waze.com/ul?ll=${target.latitude},${target.longitude}&navigate=yes`;
    }
    return `https://waze.com/ul?q=${encodedLabel}&navigate=yes`;
  }

  if (hasCoords(target)) {
    return `https://maps.apple.com/?ll=${target.latitude},${target.longitude}&q=${encodedLabel}`;
  }
  return `https://maps.apple.com/?q=${encodedLabel}`;
}

export function openExternalMap(provider: ExternalMapProvider, target: ExternalMapTarget): void {
  const url = buildExternalMapUrl(provider, target);
  window.open(url, '_blank', 'noopener,noreferrer');
}
