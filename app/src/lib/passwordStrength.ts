import zxcvbn from 'zxcvbn';

export type PasswordStrength = 'vide' | 'tres-faible' | 'faible' | 'moyen' | 'bon' | 'fort';

export function getPasswordStrength(pwd: string): PasswordStrength {
  if (!pwd) return 'vide';
  const { score } = zxcvbn(pwd);
  const map: PasswordStrength[] = ['tres-faible', 'faible', 'moyen', 'bon', 'fort'];
  return map[score];
}

export interface StrengthConfig {
  label: string;
  color: string;
  bars: number;
  textColor: string;
}

export const STRENGTH_CONFIG: Record<PasswordStrength, StrengthConfig> = {
  vide:          { label: '',            color: 'bg-gray-700',   bars: 0, textColor: '' },
  'tres-faible': { label: 'Très faible', color: 'bg-red-600',    bars: 1, textColor: 'text-red-400' },
  faible:        { label: 'Faible',      color: 'bg-orange-500', bars: 2, textColor: 'text-orange-400' },
  moyen:         { label: 'Moyen',       color: 'bg-yellow-400', bars: 3, textColor: 'text-yellow-400' },
  bon:           { label: 'Bon',         color: 'bg-teal-400',   bars: 4, textColor: 'text-teal-400' },
  fort:          { label: 'Fort',        color: 'bg-green-500',  bars: 5, textColor: 'text-green-400' },
};

export const TOTAL_BARS = 5;
