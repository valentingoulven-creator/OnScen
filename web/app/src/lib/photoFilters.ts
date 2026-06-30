export type PhotoFilterCategory = 'classic' | 'ai' | 'atypical';

export type PhotoFilterId =
  | 'none'
  | 'vivid'
  | 'warm'
  | 'cool'
  | 'bw'
  | 'sepia'
  | 'ai_clarendon'
  | 'ai_valencia'
  | 'ai_lark'
  | 'ai_xpro'
  | 'ai_lofi'
  | 'ai_gingham'
  | 'ai_juno'
  | 'ai_aden'
  | 'ai_hudson'
  | 'atyp_neon'
  | 'atyp_dream'
  | 'atyp_negative'
  | 'atyp_vhs';

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
    id: 'ai_clarendon',
    label: 'Clarendon · punch',
    cssFilter: 'contrast(1.28) saturate(1.22) brightness(1.1)',
    category: 'ai',
  },
  {
    id: 'ai_valencia',
    label: 'Valencia · chaleur',
    cssFilter: 'sepia(0.18) saturate(1.08) contrast(1.02) brightness(1.12) hue-rotate(-14deg)',
    category: 'ai',
  },
  {
    id: 'ai_lark',
    label: 'Lark · lumineux',
    cssFilter: 'brightness(1.14) contrast(0.92) saturate(0.82) hue-rotate(4deg)',
    category: 'ai',
  },
  {
    id: 'ai_xpro',
    label: 'X-Pro · rétro',
    cssFilter: 'sepia(0.38) contrast(1.34) saturate(1.18) hue-rotate(172deg) brightness(0.86)',
    category: 'ai',
  },
  {
    id: 'ai_lofi',
    label: 'Lo-fi · grainé',
    cssFilter: 'contrast(1.38) saturate(1.14) brightness(0.9) sepia(0.12)',
    category: 'ai',
  },
  {
    id: 'ai_gingham',
    label: 'Gingham · pastel',
    cssFilter: 'brightness(1.08) contrast(0.88) saturate(0.72) sepia(0.14) hue-rotate(6deg)',
    category: 'ai',
  },
  {
    id: 'ai_juno',
    label: 'Juno · doux',
    cssFilter: 'brightness(1.06) contrast(0.94) saturate(0.88) sepia(0.12) hue-rotate(-8deg)',
    category: 'ai',
  },
  {
    id: 'ai_aden',
    label: 'Aden · froid',
    cssFilter: 'brightness(1.12) contrast(0.9) saturate(0.78) hue-rotate(22deg) sepia(0.06)',
    category: 'ai',
  },
  {
    id: 'ai_hudson',
    label: 'Hudson · bleu',
    cssFilter: 'brightness(1.04) contrast(1.12) saturate(0.7) sepia(0.2) hue-rotate(168deg)',
    category: 'ai',
  },
  {
    id: 'atyp_neon',
    label: 'Néon',
    cssFilter: 'saturate(2.4) contrast(1.35) brightness(1.08) hue-rotate(300deg)',
    category: 'atypical',
  },
  {
    id: 'atyp_dream',
    label: 'Rêve',
    cssFilter: 'saturate(1.45) brightness(1.18) contrast(0.88) hue-rotate(-8deg) blur(0.4px)',
    category: 'atypical',
  },
  {
    id: 'atyp_negative',
    label: 'Négatif',
    cssFilter: 'invert(1) hue-rotate(180deg) contrast(1.1)',
    category: 'atypical',
  },
  {
    id: 'atyp_vhs',
    label: 'VHS',
    cssFilter: 'contrast(1.25) saturate(0.65) sepia(0.35) hue-rotate(8deg) brightness(0.92)',
    category: 'atypical',
  },
];

export const PHOTO_CLASSIC_FILTERS = PHOTO_FILTERS.filter((f) => f.category === 'classic');
export const PHOTO_AI_FILTERS = PHOTO_FILTERS.filter((f) => f.category === 'ai');
export const PHOTO_ATYPICAL_FILTERS = PHOTO_FILTERS.filter((f) => f.category === 'atypical');

export function getPhotoFilterCss(id: PhotoFilterId): string {
  return PHOTO_FILTERS.find((f) => f.id === id)?.cssFilter ?? 'none';
}

export function getPhotoFilterLabel(id: PhotoFilterId): string {
  return PHOTO_FILTERS.find((f) => f.id === id)?.label ?? 'Aucun';
}

export function isAiPhotoFilter(id: PhotoFilterId): boolean {
  return PHOTO_FILTERS.find((f) => f.id === id)?.category === 'ai';
}
