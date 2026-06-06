export type PhotoFilterId = 'none' | 'vivid' | 'warm' | 'cool' | 'bw' | 'sepia';

export interface PhotoFilterPreset {
  id: PhotoFilterId;
  label: string;
  cssFilter: string;
}

export const PHOTO_FILTERS: PhotoFilterPreset[] = [
  { id: 'none', label: 'Aucun', cssFilter: 'none' },
  { id: 'vivid', label: 'Vif', cssFilter: 'saturate(1.45) contrast(1.12) brightness(1.03)' },
  { id: 'warm', label: 'Chaud', cssFilter: 'sepia(0.28) saturate(1.25) hue-rotate(-12deg) brightness(1.04)' },
  { id: 'cool', label: 'Froid', cssFilter: 'saturate(0.92) hue-rotate(18deg) brightness(1.06) contrast(1.05)' },
  { id: 'bw', label: 'N&B', cssFilter: 'grayscale(1) contrast(1.08)' },
  { id: 'sepia', label: 'Sépia', cssFilter: 'sepia(0.85) contrast(1.06) brightness(0.98)' },
];

export function getPhotoFilterCss(id: PhotoFilterId): string {
  return PHOTO_FILTERS.find((f) => f.id === id)?.cssFilter ?? 'none';
}

export function getPhotoFilterLabel(id: PhotoFilterId): string {
  return PHOTO_FILTERS.find((f) => f.id === id)?.label ?? 'Aucun';
}
