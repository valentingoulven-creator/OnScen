/** Effets story « Creator » — 100 % client-side, libre de droit. */
export type StoryCreativeEffectId = 'none' | 'glitch' | 'duotone' | 'vinyl' | 'pulse' | 'waveform';

export interface StoryCreativeEffectPreset {
  id: StoryCreativeEffectId;
  label: string;
  /** Exporte une courte vidéo loop au lieu d'une photo seule. */
  exportsVideo: boolean;
  /** Nécessite une piste musique pour le duotone genre. */
  prefersMusic?: boolean;
}

export const STORY_CREATIVE_EFFECTS: StoryCreativeEffectPreset[] = [
  { id: 'none', label: 'Aucun', exportsVideo: false },
  { id: 'glitch', label: 'Glitch', exportsVideo: false },
  { id: 'duotone', label: 'Duotone', exportsVideo: false, prefersMusic: true },
  { id: 'vinyl', label: 'Vinyle', exportsVideo: true },
  { id: 'pulse', label: 'Beat pulse', exportsVideo: true, prefersMusic: true },
  { id: 'waveform', label: 'Waveform', exportsVideo: false, prefersMusic: true },
];

export interface DuotoneGenrePreset {
  id: string;
  label: string;
  shadow: string;
  highlight: string;
}

export const DUOTONE_GENRE_PRESETS: DuotoneGenrePreset[] = [
  { id: 'rap', label: 'Rap', shadow: '#0d0a06', highlight: '#d4af37' },
  { id: 'pop', label: 'Pop', shadow: '#2a1040', highlight: '#ff5ec8' },
  { id: 'electro', label: 'Électro', shadow: '#041018', highlight: '#00f5ff' },
  { id: 'rock', label: 'Rock', shadow: '#1a0505', highlight: '#ff4444' },
  { id: 'rnb', label: 'R&B', shadow: '#120818', highlight: '#c084fc' },
  { id: 'jazz', label: 'Jazz', shadow: '#0f1410', highlight: '#fbbf24' },
  { id: 'lofi', label: 'Lo-fi', shadow: '#1a1520', highlight: '#a8c4b8' },
  { id: 'default', label: 'OnScen', shadow: '#120a1f', highlight: '#a855f7' },
];

export function resolveDuotoneGenre(genreHint?: string | null): DuotoneGenrePreset {
  const raw = (genreHint ?? '').trim().toLowerCase();
  if (!raw) return DUOTONE_GENRE_PRESETS.find((g) => g.id === 'default')!;
  const exact = DUOTONE_GENRE_PRESETS.find((g) => g.id === raw);
  if (exact) return exact;
  const partial = DUOTONE_GENRE_PRESETS.find(
    (g) => g.id !== 'default' && (raw.includes(g.id) || g.label.toLowerCase().includes(raw))
  );
  return partial ?? DUOTONE_GENRE_PRESETS.find((g) => g.id === 'default')!;
}

/** Hash stable pour waveform synthétique à partir du titre / artiste. */
export function waveformSeedFromText(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join('|').trim().toLowerCase() || 'onscen';
}
