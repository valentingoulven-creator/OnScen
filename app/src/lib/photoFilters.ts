export type PhotoFilterCategory = 'classic' | 'ai';

export type PhotoFilterId =
  | 'none'
  | 'vivid'
  | 'warm'
  | 'cool'
  | 'bw'
  | 'sepia'
  | 'ai_enhance'
  | 'ai_portrait'
  | 'ai_cinematic'
  | 'ai_vintage'
  | 'ai_neon'
  | 'ai_dream';

export interface PhotoFilterPreset {
  id: PhotoFilterId;
  label: string;
  cssFilter: string;
  category: PhotoFilterCategory;
}

export const PHOTO_FILTERS: PhotoFilterPreset[] = [
  { id: 'none', label: 'Aucun', cssFilter: 'none', category: 'classic' },
  {
    id: 'vivid',
    label: 'Vif',
    cssFilter: 'saturate(1.45) contrast(1.12) brightness(1.03)',
    category: 'classic',
  },
  {
    id: 'warm',
    label: 'Chaud',
    cssFilter: 'sepia(0.28) saturate(1.25) hue-rotate(-12deg) brightness(1.04)',
    category: 'classic',
  },
  {
    id: 'cool',
    label: 'Froid',
    cssFilter: 'saturate(0.92) hue-rotate(18deg) brightness(1.06) contrast(1.05)',
    category: 'classic',
  },
  { id: 'bw', label: 'N&B', cssFilter: 'grayscale(1) contrast(1.08)', category: 'classic' },
  {
    id: 'sepia',
    label: 'Sépia',
    cssFilter: 'sepia(0.85) contrast(1.06) brightness(0.98)',
    category: 'classic',
  },
  {
    id: 'ai_enhance',
    label: 'Amélioration IA',
    cssFilter: 'saturate(1.22) contrast(1.14) brightness(1.05) hue-rotate(-3deg)',
    category: 'ai',
  },
  {
    id: 'ai_portrait',
    label: 'Portrait éclat',
    cssFilter: 'brightness(1.1) contrast(0.93) saturate(1.08) sepia(0.1) hue-rotate(-10deg)',
    category: 'ai',
  },
  {
    id: 'ai_cinematic',
    label: 'Cinéma IA',
    cssFilter: 'contrast(1.22) saturate(1.08) sepia(0.18) hue-rotate(168deg) brightness(0.9)',
    category: 'ai',
  },
  {
    id: 'ai_vintage',
    label: 'Vintage IA',
    cssFilter: 'sepia(0.42) contrast(0.85) saturate(0.68) brightness(1.08) hue-rotate(8deg)',
    category: 'ai',
  },
  {
    id: 'ai_neon',
    label: 'Néon nocturne',
    cssFilter: 'saturate(1.6) contrast(1.28) brightness(0.88) hue-rotate(20deg)',
    category: 'ai',
  },
  {
    id: 'ai_dream',
    label: 'Rêve pastel',
    cssFilter: 'saturate(0.65) brightness(1.14) contrast(0.88) hue-rotate(-8deg)',
    category: 'ai',
  },
];

export const PHOTO_CLASSIC_FILTERS = PHOTO_FILTERS.filter((f) => f.category === 'classic');
export const PHOTO_AI_FILTERS = PHOTO_FILTERS.filter((f) => f.category === 'ai');

export function getPhotoFilterCss(id: PhotoFilterId): string {
  return PHOTO_FILTERS.find((f) => f.id === id)?.cssFilter ?? 'none';
}

export function getPhotoFilterLabel(id: PhotoFilterId): string {
  return PHOTO_FILTERS.find((f) => f.id === id)?.label ?? 'Aucun';
}

export function isAiPhotoFilter(id: PhotoFilterId): boolean {
  return PHOTO_FILTERS.find((f) => f.id === id)?.category === 'ai';
}
