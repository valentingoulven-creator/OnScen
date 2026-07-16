interface ControlsPanelProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  selectedCountryName: string | null;
}

/** Panneau de contrôle : mode sombre, pays sélectionné. */
export function ControlsPanel({ darkMode, onToggleDarkMode, selectedCountryName }: ControlsPanelProps) {
  return (
    <div className="controls-panel">
      <div className="controls-panel__buttons">
        <button type="button" className="toggle-btn" onClick={onToggleDarkMode} aria-pressed={darkMode}>
          {darkMode ? '🌙 Sombre' : '☀️ Clair'}
        </button>
      </div>

      {selectedCountryName && <div className="selected-chip">📍 {selectedCountryName}</div>}
    </div>
  );
}
