export type PasswordStrength = 'vide' | 'tres-faible' | 'faible' | 'moyen' | 'bon' | 'fort';

type ZxcvbnFn = (password: string) => { score: number };

let zxcvbnLib: ZxcvbnFn | null = null;
let zxcvbnLoad: Promise<void> | null = null;

/** Charge zxcvbn à la demande (évite ~400 KB dans le bundle d'entrée). */
export function preloadPasswordStrength(): Promise<void> {
  if (zxcvbnLib) return Promise.resolve();
  if (!zxcvbnLoad) {
    zxcvbnLoad = import('zxcvbn').then((m) => {
      zxcvbnLib = m.default;
    });
  }
  return zxcvbnLoad;
}

function heuristicScore(pwd: string): number {
  if (pwd.length >= 14 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) return 4;
  if (pwd.length >= 10 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) return 3;
  if (pwd.length >= 8) return 2;
  if (pwd.length >= 6) return 1;
  return 0;
}

function scorePassword(pwd: string): number {
  if (zxcvbnLib) return zxcvbnLib(pwd).score;
  return heuristicScore(pwd);
}

export function getPasswordStrength(pwd: string): PasswordStrength {
  if (!pwd) return 'vide';
  const map: PasswordStrength[] = ['tres-faible', 'faible', 'moyen', 'bon', 'fort'];
  return map[scorePassword(pwd)] ?? 'tres-faible';
}

export async function getPasswordStrengthAsync(pwd: string): Promise<PasswordStrength> {
  await preloadPasswordStrength();
  return getPasswordStrength(pwd);
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
