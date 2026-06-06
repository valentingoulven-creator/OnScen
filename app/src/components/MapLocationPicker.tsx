import { useCallback, useState } from 'react';
import {
  getLivesGeo,
  PRESET_CITIES,
  type LivesGeoPrefs,
  type LivesGeoSource,
} from '../lib/livesGeo';
import { geocodeAddress, geocodeQuery, type AddressSuggestion } from '../lib/geocodeAddress';
import type { CitySuggestion } from '../lib/citySearch';
import { CityAutocomplete } from './CityAutocomplete';
import { AddressAutocomplete } from './AddressAutocomplete';

export type MapLocationPickerAccent = 'purple' | 'red';

interface MapLocationPickerProps {
  mapGeo: LivesGeoPrefs;
  onPersist: (next: LivesGeoPrefs) => void;
  /** compact = panneau carte ; default = onglet Lives */
  size?: 'compact' | 'default';
  accent?: MapLocationPickerAccent;
}

type LocationMode = LivesGeoSource;

const MODE_OPTIONS: { id: LocationMode; label: string }[] = [
  { id: 'my_position', label: 'Ma position (GPS)' },
  { id: 'address', label: 'Adresse précise' },
  { id: 'city', label: 'Ville' },
];

function truncateLabel(label: string, max = 60): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function MapLocationPicker({
  mapGeo,
  onPersist,
  size = 'default',
  accent = 'purple',
}: MapLocationPickerProps) {
  const compact = size === 'compact';
  const [mode, setMode] = useState<LocationMode>(mapGeo.source);
  const [cityQuery, setCityQuery] = useState(() =>
    mapGeo.source === 'city' ? mapGeo.label.split(',')[0]?.trim() || mapGeo.label : ''
  );
  const [addressQuery, setAddressQuery] = useState(() =>
    mapGeo.source === 'address' && mapGeo.addressLine ? mapGeo.addressLine : ''
  );
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [street, setStreet] = useState(() =>
    mapGeo.source === 'address' && mapGeo.addressLine ? mapGeo.addressLine : ''
  );
  const [postalCode, setPostalCode] = useState('');
  const [cityField, setCityField] = useState('');

  const accentBtn =
    accent === 'red'
      ? 'text-red-300 border-red-500/40 hover:bg-red-900/20'
      : 'text-purple-300 border-purple-500/30 hover:bg-purple-900/20';
  const accentActive =
    accent === 'red' ? 'bg-red-600/25 border-red-500/50 text-red-200' : 'bg-purple-600/25 border-purple-500/50 text-purple-200';

  const persist = useCallback(
    (next: LivesGeoPrefs) => {
      setGeoError(null);
      onPersist(next);
    },
    [onPersist]
  );

  const applyCoords = useCallback(
    (opts: {
      latitude: number;
      longitude: number;
      label: string;
      source: LivesGeoSource;
      addressLine?: string;
    }) => {
      const current = getLivesGeo();
      persist({
        latitude: opts.latitude,
        longitude: opts.longitude,
        radiusKm: current.radiusKm,
        label: truncateLabel(opts.label),
        source: opts.source,
        addressLine: opts.addressLine,
      });
    },
    [persist]
  );

  const useMyPosition = () => {
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non disponible sur cet appareil');
      return;
    }
    setLocating(true);
    setGeoError(null);
    const current = getLivesGeo();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        persist({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          radiusKm: current.radiusKm,
          label: 'Ma position',
          source: 'my_position',
        });
        setMode('my_position');
        setLocating(false);
      },
      () => {
        setLocating(false);
        setGeoError('Impossible d\'obtenir votre position. Autorisez la géolocalisation ou choisissez une adresse.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const selectPresetCity = (city: (typeof PRESET_CITIES)[number]) => {
    applyCoords({
      latitude: city.latitude,
      longitude: city.longitude,
      label: city.label,
      source: 'city',
    });
    setMode('city');
    setCityQuery(city.label.split(',')[0]?.trim() || city.label);
  };

  const selectCitySuggestion = async (suggestion: CitySuggestion) => {
    setMode('city');
    setCityQuery(suggestion.value);
    setGeoError(null);

    if (
      typeof suggestion.latitude === 'number' &&
      typeof suggestion.longitude === 'number'
    ) {
      applyCoords({
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        label: suggestion.label,
        source: 'city',
      });
      return;
    }

    setGeocoding(true);
    try {
      const result = await geocodeQuery(`${suggestion.value}, France`);
      applyCoords({
        latitude: result.latitude,
        longitude: result.longitude,
        label: suggestion.label,
        source: 'city',
      });
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : 'Ville introuvable');
    } finally {
      setGeocoding(false);
    }
  };

  const selectAddressSuggestion = (suggestion: AddressSuggestion) => {
    setMode('address');
    setAddressQuery(suggestion.label);
    setStreet(suggestion.label);
    applyCoords({
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      label: suggestion.label,
      source: 'address',
      addressLine: suggestion.label,
    });
  };

  const submitAddress = async () => {
    setGeocoding(true);
    setGeoError(null);
    try {
      const result = await geocodeAddress({
        street,
        postalCode,
        city: cityField,
      });
      const line = [street, postalCode, cityField]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ');
      applyCoords({
        latitude: result.latitude,
        longitude: result.longitude,
        label: result.label,
        source: 'address',
        addressLine: line,
      });
      setMode('address');
      setAddressQuery(line);
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : 'Géocodage impossible');
    } finally {
      setGeocoding(false);
    }
  };

  const switchMode = (next: LocationMode) => {
    setMode(next);
    setGeoError(null);
    if (next === 'my_position') {
      useMyPosition();
    }
  };

  const textXs = compact ? 'text-[9px]' : 'text-xs';
  const text10 = compact ? 'text-[10px]' : 'text-xs';
  const inputClass = compact
    ? 'w-full px-2 py-1.5 rounded-lg bg-[#0b0b0f] border border-[#2a2a3f] text-[10px] text-white placeholder:text-gray-500'
    : 'w-full px-3 py-2 rounded-lg bg-[#0b0b0f] border border-[#2a2a3f] text-xs text-white placeholder:text-gray-500';

  return (
    <div className="space-y-2">
      <p className={`${text10} text-gray-400`}>Point de référence carte</p>
      <div className={`flex flex-wrap gap-1 ${compact ? '' : 'gap-1.5'}`}>
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => switchMode(opt.id)}
            className={`${textXs} font-semibold px-2 py-1 rounded-lg border transition ${
              mode === opt.id ? accentActive : 'border-[#2a2a3f] text-gray-400 hover:border-[#3d3d50]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p className={`${text10} text-gray-500 truncate`} title={mapGeo.label}>
        {mapGeo.label}
      </p>

      {mode === 'my_position' && (
        <button
          type="button"
          onClick={useMyPosition}
          disabled={locating}
          className={`w-full px-2 py-1.5 rounded-lg ${textXs} font-semibold border disabled:opacity-50 ${accentBtn}`}
        >
          {locating ? 'Localisation…' : 'Actualiser ma position GPS'}
        </button>
      )}

      {mode === 'address' && (
        <div className="space-y-1.5">
          <p className={`${text10} text-gray-500`}>Rechercher une adresse</p>
          <AddressAutocomplete
            value={addressQuery}
            onChange={setAddressQuery}
            onSelect={selectAddressSuggestion}
            placeholder="Rue, code postal, ville…"
            inputClassName={inputClass}
            listMaxHeightClass={compact ? 'max-h-28' : 'max-h-40'}
          />
          <details className="group">
            <summary className={`${textXs} text-gray-500 cursor-pointer hover:text-gray-400 list-none flex items-center gap-1`}>
              <span className="group-open:rotate-90 transition inline-block">›</span>
              Saisie manuelle
            </summary>
            <div className="space-y-1.5 mt-1.5">
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Rue et numéro"
                className={inputClass}
                autoComplete="street-address"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Code postal"
                  className={`${inputClass} w-24 shrink-0`}
                  autoComplete="postal-code"
                />
                <input
                  type="text"
                  value={cityField}
                  onChange={(e) => setCityField(e.target.value)}
                  placeholder="Ville"
                  className={`${inputClass} flex-1 min-w-0`}
                  autoComplete="address-level2"
                />
              </div>
              <button
                type="button"
                onClick={() => void submitAddress()}
                disabled={geocoding}
                className={`w-full px-2 py-1.5 rounded-lg ${textXs} font-semibold border disabled:opacity-50 ${accentBtn}`}
              >
                {geocoding ? 'Recherche de l\'adresse…' : 'Valider cette adresse'}
              </button>
            </div>
          </details>
          <p className={`${compact ? 'text-[8px]' : 'text-[10px]'} text-gray-600`}>
            Choisissez une proposition ou validez une adresse (OpenStreetMap).
          </p>
        </div>
      )}

      {mode === 'city' && (
        <div className="space-y-1.5">
          <p className={`${text10} text-gray-500`}>Rechercher une ville</p>
          <CityAutocomplete
            value={cityQuery}
            onChange={setCityQuery}
            onSelect={(s) => void selectCitySuggestion(s)}
            placeholder="Tapez le nom de la ville…"
            inputClassName={inputClass}
            emptyHint="Aucune ville — essayez un autre nom"
          />
          {geocoding && (
            <p className={`${textXs} text-gray-500`}>Localisation de la ville…</p>
          )}
          {!cityQuery.trim() && (
            <>
              <p className={`${textXs} text-gray-600`}>Villes populaires</p>
              <ul className={`${compact ? 'max-h-24' : 'max-h-32'} overflow-y-auto space-y-0.5`}>
                {PRESET_CITIES.slice(0, compact ? 6 : 10).map((city) => (
                  <li key={city.id}>
                    <button
                      type="button"
                      onClick={() => selectPresetCity(city)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg ${text10} text-gray-200 hover:bg-[#1a1a26]`}
                    >
                      {city.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {geoError && <p className={`${textXs} text-red-400`}>{geoError}</p>}
    </div>
  );
}
