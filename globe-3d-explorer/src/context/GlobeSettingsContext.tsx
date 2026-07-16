import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FocusTarget } from '../types';
import { GlobeSettingsContext, type GlobeSettingsValue, type SelectedCountry } from './globeSettingsContextObject';

export function GlobeSettingsProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const requestIdRef = useRef(0);

  const toggleDarkMode = useCallback(() => setDarkMode((v) => !v), []);

  const selectCountry = useCallback((country: SelectedCountry) => {
    setSelectedCountry(country);
    requestIdRef.current += 1;
    setFocusTarget({ lon: country.lon, lat: country.lat, requestId: requestIdRef.current });
  }, []);

  const clearSelection = useCallback(() => setSelectedCountry(null), []);
  const consumeFocusTarget = useCallback(() => setFocusTarget(null), []);

  const value = useMemo<GlobeSettingsValue>(
    () => ({
      darkMode,
      toggleDarkMode,
      selectedCountry,
      selectCountry,
      clearSelection,
      focusTarget,
      consumeFocusTarget,
    }),
    [darkMode, toggleDarkMode, selectedCountry, selectCountry, clearSelection, focusTarget, consumeFocusTarget]
  );

  return <GlobeSettingsContext.Provider value={value}>{children}</GlobeSettingsContext.Provider>;
}
