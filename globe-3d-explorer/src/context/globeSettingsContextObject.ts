import { createContext, useContext } from 'react';
import type { FocusTarget } from '../types';

export interface SelectedCountry {
  name: string;
  lon: number;
  lat: number;
}

export interface GlobeSettingsValue {
  darkMode: boolean;
  toggleDarkMode: () => void;

  selectedCountry: SelectedCountry | null;
  /** Sélectionne un pays (clic globe ou recherche) et déclenche le recentrage caméra. */
  selectCountry: (country: SelectedCountry) => void;
  clearSelection: () => void;

  /** Cible de recentrage courante — `null` quand aucune animation n'est en cours. */
  focusTarget: FocusTarget | null;
  /** Marque le recentrage comme terminé (consommé par la scène 3D). */
  consumeFocusTarget: () => void;
}

export const GlobeSettingsContext = createContext<GlobeSettingsValue | null>(null);

export function useGlobeSettings(): GlobeSettingsValue {
  const ctx = useContext(GlobeSettingsContext);
  if (!ctx) throw new Error('useGlobeSettings must be used within GlobeSettingsProvider');
  return ctx;
}
