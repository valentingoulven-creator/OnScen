/** Polices story : piles système / web-safe, libres de droit, sans chargement réseau. */

export type StoryTextFontId =
  | 'modern'
  | 'elegant'
  | 'display'
  | 'handwritten'
  | 'bold'
  | 'mono'
  | 'playful';

export interface StoryTextFontPreset {
  id: StoryTextFontId;
  /** Libellé affiché dans le panneau Texte */
  label: string;
  fontFamily: string;
  fontWeight: number;
}

export const STORY_TEXT_FONTS: StoryTextFontPreset[] = [
  {
    id: 'modern',
    label: 'Moderne',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: 700,
  },
  {
    id: 'elegant',
    label: 'Élégante',
    fontFamily: 'Georgia, "Times New Roman", Times, serif',
    fontWeight: 700,
  },
  {
    id: 'display',
    label: 'Affichage',
    fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
    fontWeight: 400,
  },
  {
    id: 'handwritten',
    label: 'Manuscrite',
    fontFamily: '"Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive',
    fontWeight: 400,
  },
  {
    id: 'bold',
    label: 'Grasse',
    fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
    fontWeight: 900,
  },
  {
    id: 'mono',
    label: 'Machine à écrire',
    fontFamily: '"Courier New", Courier, monospace',
    fontWeight: 700,
  },
  {
    id: 'playful',
    label: 'Décontractée',
    fontFamily: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", cursive',
    fontWeight: 700,
  },
];

export const DEFAULT_STORY_TEXT_FONT_ID: StoryTextFontId = 'modern';

export function resolveStoryTextFont(fontId?: StoryTextFontId): StoryTextFontPreset {
  return STORY_TEXT_FONTS.find((f) => f.id === fontId) ?? STORY_TEXT_FONTS[0];
}
