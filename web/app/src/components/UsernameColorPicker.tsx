import { useState } from 'react';
import {
  DEFAULT_USERNAME_WAVE_FROM,
  DEFAULT_USERNAME_WAVE_TO,
  USERNAME_COLOR_WAVE,
  USERNAME_SOLID_PRESETS,
  isDefaultUsernameWaveTint,
  isWaveUsernameColor,
  resolveUsernameWaveColors,
  usernameWaveDisplayStyle,
} from '../lib/usernameColor';

type UsernameColorPickerProps = {
  value: string;
  onChange: (value: string) => void;
  waveFrom: string;
  waveTo: string;
  onWaveFromChange: (value: string) => void;
  onWaveToChange: (value: string) => void;
};

function isCustomUsernameColor(value: string, waveFrom: string, waveTo: string): boolean {
  if (isWaveUsernameColor(value)) {
    return !isDefaultUsernameWaveTint({ from: waveFrom, to: waveTo });
  }
  return !USERNAME_SOLID_PRESETS.some((p) => p.hex === value);
}

export function UsernameColorPicker({
  value,
  onChange,
  waveFrom,
  waveTo,
  onWaveFromChange,
  onWaveToChange,
}: UsernameColorPickerProps) {
  const waveActive = isWaveUsernameColor(value);
  const resolved = resolveUsernameWaveColors({ from: waveFrom, to: waveTo });
  const wavePresetStyle = usernameWaveDisplayStyle({
    from: DEFAULT_USERNAME_WAVE_FROM,
    to: DEFAULT_USERNAME_WAVE_TO,
  });
  const wavePresetActive =
    waveActive && isDefaultUsernameWaveTint({ from: waveFrom, to: waveTo });

  const [showAdvancedPicker, setShowAdvancedPicker] = useState(() =>
    isCustomUsernameColor(value, waveFrom, waveTo)
  );

  const selectWavePreset = () => {
    onChange(USERNAME_COLOR_WAVE);
    onWaveFromChange(DEFAULT_USERNAME_WAVE_FROM);
    onWaveToChange(DEFAULT_USERNAME_WAVE_TO);
    setShowAdvancedPicker(false);
  };

  const selectSolidPreset = (hex: string) => {
    onChange(hex);
    setShowAdvancedPicker(false);
  };

  const selectCustom = () => {
    setShowAdvancedPicker(true);
    if (!isCustomUsernameColor(value, waveFrom, waveTo) && !waveActive && !value) {
      onChange('#a78bfa');
    }
  };

  const chipClass = (active: boolean) =>
    `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
      active
        ? 'border-purple-500/60 bg-purple-500/15 text-white'
        : 'border-[#2d2d3d] bg-[#1a1a26] text-gray-400 hover:text-white'
    }`;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Couleur du pseudo</p>

      <div className="flex flex-wrap gap-2">
        {USERNAME_SOLID_PRESETS.map((preset) => {
          const active = !showAdvancedPicker && !waveActive && value === preset.hex;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectSolidPreset(preset.hex)}
              title={preset.label}
              className={chipClass(active)}
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                style={{
                  background: preset.hex || 'linear-gradient(135deg, #fff 40%, #6b7280 100%)',
                }}
              />
              {preset.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={selectWavePreset}
          title="Wave Soundy"
          className={chipClass(wavePresetActive && !showAdvancedPicker)}
        >
          <span
            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
            style={{
              background: `linear-gradient(135deg, ${DEFAULT_USERNAME_WAVE_FROM}, ${DEFAULT_USERNAME_WAVE_TO})`,
            }}
          />
          <span style={wavePresetStyle}>Wave</span>
        </button>

        <button
          type="button"
          onClick={selectCustom}
          title="Personnalisé"
          className={chipClass(showAdvancedPicker)}
        >
          <span
            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
            style={{
              background:
                'conic-gradient(from 180deg, #c084fc, #f472b6, #67e8f9, #fcd34d, #c084fc)',
            }}
          />
          Personnalisé
        </button>
      </div>

      {showAdvancedPicker && (
        <div className="rounded-xl border border-[#2d2d3d] bg-[#1a1a26] p-3 space-y-4">
          <div className="space-y-3">
            <p className="text-[10px] text-gray-500">Dégradé wave personnalisé</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] text-gray-500">Couleur de départ</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={resolved.from}
                    onChange={(e) => {
                      onChange(USERNAME_COLOR_WAVE);
                      onWaveFromChange(e.target.value);
                    }}
                    className="w-10 h-10 rounded-lg border border-[#2d2d3d] bg-[#1a1a26] cursor-pointer"
                    aria-label="Couleur de départ du dégradé wave"
                  />
                  <input
                    type="text"
                    value={waveFrom || resolved.from}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
                        onChange(USERNAME_COLOR_WAVE);
                        onWaveFromChange(v);
                      }
                    }}
                    placeholder={DEFAULT_USERNAME_WAVE_FROM}
                    className="flex-1 bg-[#12121a] border border-[#2d2d3d] rounded-lg px-2 py-1.5 text-white text-[10px] font-mono"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] text-gray-500">Couleur de fin</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={resolved.to}
                    onChange={(e) => {
                      onChange(USERNAME_COLOR_WAVE);
                      onWaveToChange(e.target.value);
                    }}
                    className="w-10 h-10 rounded-lg border border-[#2d2d3d] bg-[#1a1a26] cursor-pointer"
                    aria-label="Couleur de fin du dégradé wave"
                  />
                  <input
                    type="text"
                    value={waveTo || resolved.to}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
                        onChange(USERNAME_COLOR_WAVE);
                        onWaveToChange(v);
                      }
                    }}
                    placeholder={DEFAULT_USERNAME_WAVE_TO}
                    className="flex-1 bg-[#12121a] border border-[#2d2d3d] rounded-lg px-2 py-1.5 text-white text-[10px] font-mono"
                  />
                </div>
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(USERNAME_COLOR_WAVE);
                onWaveFromChange(DEFAULT_USERNAME_WAVE_FROM);
                onWaveToChange(DEFAULT_USERNAME_WAVE_TO);
              }}
              className="text-[10px] text-purple-400 hover:text-purple-300"
            >
              Réinitialiser le dégradé Soundy
            </button>
          </div>

          <div className="border-t border-[#2d2d3d] pt-3">
            <label className="block">
              <span className="text-[10px] text-gray-500">Couleur unie personnalisée</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={waveActive || !value ? '#c4b5fd' : value}
                  disabled={waveActive}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-[#2d2d3d] bg-[#1a1a26] cursor-pointer disabled:opacity-40"
                  aria-label="Couleur personnalisée du pseudo"
                />
                <input
                  type="text"
                  value={waveActive ? 'wave' : value}
                  readOnly={waveActive}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (v.toLowerCase() === USERNAME_COLOR_WAVE) onChange(USERNAME_COLOR_WAVE);
                    else if (/^#[0-9a-fA-F]{3,8}$/.test(v)) onChange(v);
                  }}
                  placeholder="#a78bfa"
                  className="flex-1 bg-[#12121a] border border-[#2d2d3d] rounded-xl px-3 py-2 text-white text-xs font-mono"
                />
              </div>
              {waveActive && (
                <p className="mt-1.5 text-[10px] text-gray-600">
                  Mode wave actif — modifiez le dégradé ci-dessus ou saisissez une couleur unie.
                </p>
              )}
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
