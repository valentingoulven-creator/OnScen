import { useEffect, useState } from 'react';
import { geocodeCountryFromQuery } from '../lib/geocodeAddress';
import { EVENTS_COUNTRY_FALLBACK } from '../lib/countryDisplay';

export function useEventsCountry(options: {
  enabled: boolean;
  profileCity?: string;
}): {
  countryCode: string;
  countryName: string;
} {
  const { enabled, profileCity } = options;
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [countryName, setCountryName] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const applyCountryFallback = async () => {
      const city = profileCity?.trim();
      if (city) {
        try {
          const fromCity = await geocodeCountryFromQuery(city);
          if (!cancelled && fromCity) {
            setCountryCode(fromCity.code);
            setCountryName(fromCity.name);
            return;
          }
        } catch {
          /* ville profil non résolue → France */
        }
      }
      if (!cancelled) {
        setCountryCode(EVENTS_COUNTRY_FALLBACK.code);
        setCountryName(EVENTS_COUNTRY_FALLBACK.name);
      }
    };

    if (!navigator.geolocation) {
      void applyCountryFallback();
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { 'Accept-Language': 'fr', 'User-Agent': 'MeloSong/1.0' } }
        )
          .then((res) => res.json())
          .then((data: { address?: { country_code?: string; country?: string } }) => {
            if (cancelled) return;
            const code = (data.address?.country_code ?? '').toUpperCase();
            const name = data.address?.country ?? '';
            if (code) {
              setCountryCode(code);
              if (name) setCountryName(name);
            } else {
              void applyCountryFallback();
            }
          })
          .catch(() => {
            void applyCountryFallback();
          });
      },
      () => {
        void applyCountryFallback();
      },
      { timeout: 8000 }
    );

    return () => {
      cancelled = true;
    };
  }, [enabled, profileCity]);

  return {
    countryCode: countryCode ?? EVENTS_COUNTRY_FALLBACK.code,
    countryName: countryName ?? EVENTS_COUNTRY_FALLBACK.name,
  };
}
