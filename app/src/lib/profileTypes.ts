export const PROFILE_TYPE_OPTIONS = [
  { value: 'melomane', label: 'Mélomane', emoji: '🎵' },
  { value: 'bar', label: 'Bar', emoji: '🍸' },
  { value: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { value: 'cafe', label: 'Café / Bar à musique', emoji: '☕' },
  { value: 'club', label: 'Club / Discothèque', emoji: '🪩' },
  { value: 'salle_concert', label: 'Salle de concert', emoji: '🎭' },
  { value: 'festival', label: 'Festival', emoji: '🎪' },
  { value: 'dj', label: 'DJ', emoji: '🎧' },
  { value: 'compositeur', label: 'Compositeur·rice', emoji: '🎹' },
  { value: 'rapper', label: 'Rapper / MC', emoji: '🎤' },
  { value: 'musicien', label: 'Musicien·ne', emoji: '🎸' },
  { value: 'chanteur', label: 'Chanteur·se', emoji: '🎙️' },
  { value: 'producteur', label: 'Producteur·rice', emoji: '🎛️' },
  { value: 'label', label: 'Label / Maison de disques', emoji: '💿' },
  { value: 'promoteur', label: 'Promoteur·rice', emoji: '📣' },
  { value: 'autre', label: 'Autre', emoji: '✨' },
] as const;

export type ProfileType = (typeof PROFILE_TYPE_OPTIONS)[number]['value'];

export function getProfileTypeLabel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return PROFILE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? undefined;
}

export function getProfileTypeOption(value: string | undefined) {
  if (!value) return undefined;
  return PROFILE_TYPE_OPTIONS.find((o) => o.value === value);
}
