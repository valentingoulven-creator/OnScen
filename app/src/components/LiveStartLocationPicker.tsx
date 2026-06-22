import { useState } from 'react';
import { PRESET_CITIES, type LivesGeoPrefs } from '../lib/livesGeo';

function chipClass(active: boolean): string {
  return `flex-1 min-h-[44px] px-2 py-2 rounded-xl text-xs font-semibold border transition ${
    active
      ? 'border-red-500/50 bg-red-500/15 text-red-200'
      : 'border-[#2d2d3d] text-gray-400 hover:text-gray-200 hover:border-[#3d3d4d]'
  }`;
}

export interface LiveStartLocationPickerProps {
  value: LivesGeoPrefs;
  onChange: (next: LivesGeoPrefs) => void;
}

export function LiveStartLocationPicker({ value, onChange }: LiveStartLocationPickerProps) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const geoAvailable = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

  const selectedCityId =
    value.source === 'city'
      ? PRESET_CITIES.find(
          (c) =>
            Math.abs(c.latitude - value.latitude) < 0.0001 &&
            Math.abs(c.longitude - value.longitude) < 0.0001
        )?.id ?? ''
      : '';

  const useMyPosition = async () => {
    if (!geoAvailable) {
      setGeoError('Géolocalisation non disponible sur cet appareil.');
      return;
    }
    setLocating(true);
    setGeoError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 120_000,
        })
      );
      onChange({
        ...value,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        label: 'Ma position',
        source: 'my_position',
      });
    } catch {
      setGeoError('Impossible d\'obtenir votre position. Choisissez une ville.');
    } finally {
      setLocating(false);
    }
  };

  const pickCity = (cityId: string) => {
    if (!cityId) return;
    const preset = PRESET_CITIES.find((c) => c.id === cityId);
    if (!preset) return;
    setGeoError(null);
    onChange({
      ...value,
      latitude: preset.latitude,
      longitude: preset.longitude,
      label: preset.label,
      source: 'city',
    });
  };

  return (
    <div className="space-y-2 rounded-xl border border-[#2d2d3d] bg-[#0b0b0f]/80 p-3">
      <p className="text-xs font-semibold text-gray-200">Position sur la carte</p>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Où votre live apparaîtra sur la carte pour les autres utilisateurs.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void useMyPosition()}
          disabled={locating || !geoAvailable}
          className={chipClass(value.source === 'my_position')}
        >
          {locating ? 'Localisation…' : 'Ma position'}
        </button>
      </div>

      <label className="block text-[11px] text-gray-400">
        Ou choisir une ville
        <select
          value={selectedCityId}
          onChange={(e) => pickCity(e.target.value)}
          className="w-full mt-1 px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] text-sm text-white"
        >
          <option value="">Sélectionner une ville…</option>
          {PRESET_CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <p className="text-[10px] text-red-300/90 truncate" title={value.label}>
        {value.label}
      </p>
      {geoError && <p className="text-[10px] text-red-300">{geoError}</p>}
    </div>
  );
}
