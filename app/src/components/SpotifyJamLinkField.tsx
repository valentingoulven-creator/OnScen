import { useState } from 'react';
import {
  normalizeSpotifyJamUrl,
  parseSpotifyJamLink,
  SPOTIFY_JAM_AUTO_FETCH_UNAVAILABLE,
  SPOTIFY_JAM_START_HINT,
} from '../lib/spotifyJam';

interface SpotifyJamLinkFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Affiche l’aide complète (création salon) ou version compacte (salon ouvert). */
  variant?: 'create' | 'inline';
  disabled?: boolean;
}

export function SpotifyJamLinkField({
  value,
  onChange,
  variant = 'create',
  disabled = false,
}: SpotifyJamLinkFieldProps) {
  const [pasteError, setPasteError] = useState<string | null>(null);
  const parsed = value.trim() ? parseSpotifyJamLink(value) : null;
  const invalid = value.trim().length > 0 && !parsed;

  const pasteFromClipboard = async () => {
    setPasteError(null);
    if (!navigator.clipboard?.readText) {
      setPasteError('Presse-papiers indisponible sur cet appareil.');
      return;
    }
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setPasteError('Presse-papiers vide.');
        return;
      }
      const normalized = normalizeSpotifyJamUrl(text);
      if (!normalized) {
        setPasteError('Ce n’est pas un lien Jam Spotify valide.');
        return;
      }
      onChange(normalized);
    } catch {
      setPasteError('Autorisez l’accès au presse-papiers ou collez manuellement.');
    }
  };

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-green-500/25 bg-green-500/5 px-3 py-2.5 text-[11px] text-green-100/90 leading-snug space-y-1.5">
        <p>
          <strong className="text-white">Lien Jam Spotify</strong>
          {variant === 'create' ? ' (recommandé)' : ''}
        </p>
        <p className="text-green-200/80">{SPOTIFY_JAM_AUTO_FETCH_UNAVAILABLE}</p>
        <p className="text-green-200/70">{SPOTIFY_JAM_START_HINT}</p>
      </div>

      <label className="block">
        <span className="text-xs text-gray-400">Lien d’invitation Jam</span>
        <input
          value={value}
          onChange={(e) => {
            setPasteError(null);
            onChange(e.target.value);
          }}
          onBlur={() => {
            const normalized = normalizeSpotifyJamUrl(value);
            if (normalized && normalized !== value) onChange(normalized);
          }}
          disabled={disabled}
          placeholder="https://open.spotify.com/socialsession/…"
          className={`mt-1 w-full bg-[#1a1a26] border rounded-xl px-3 py-2 text-sm text-white ${
            invalid ? 'border-red-500/50' : 'border-[#2d2d3d]'
          }`}
        />
      </label>

      {invalid && (
        <p className="text-[11px] text-red-400">Format attendu : open.spotify.com/socialsession/…</p>
      )}
      {parsed && (
        <p className="text-[11px] text-green-400/90">✓ Lien Jam valide</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void pasteFromClipboard()}
          disabled={disabled}
          className="px-3 py-1.5 rounded-lg border border-green-500/30 text-xs font-semibold text-green-300 hover:bg-green-500/10 disabled:opacity-50"
        >
          Coller depuis le presse-papiers
        </button>
        <a
          href="https://open.spotify.com/"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-lg border border-[#2d2d3d] text-xs font-semibold text-gray-300 hover:text-white"
        >
          Ouvrir Spotify ↗
        </a>
      </div>

      {pasteError && <p className="text-[11px] text-amber-400">{pasteError}</p>}
    </div>
  );
}

interface SpotifyJamJoinCardProps {
  jamUrl: string;
  isHost?: boolean;
  onCopy?: (message: string) => void;
}

export function SpotifyJamJoinCard({ jamUrl, isHost = false, onCopy }: SpotifyJamJoinCardProps) {
  const parsed = parseSpotifyJamLink(jamUrl);
  if (!parsed) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(parsed.url);
      onCopy?.('Lien Jam copié');
    } catch {
      onCopy?.('Impossible de copier le lien');
    }
  };

  return (
    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 space-y-2">
      <p className="text-xs font-semibold text-green-200">
        {isHost ? 'Votre Jam Spotify' : 'Rejoindre le Jam de l’hôte'}
      </p>
      <p className="text-[11px] text-green-100/70 break-all">{parsed.url}</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={parsed.url}
          target="_blank"
          rel="noreferrer"
          className="flex-1 min-w-[8rem] text-center py-2 rounded-xl bg-green-600 hover:bg-green-500 text-xs font-bold text-white"
        >
          {isHost ? 'Ouvrir mon Jam' : 'Rejoindre le Jam'}
        </a>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="px-3 py-2 rounded-xl border border-green-500/40 text-xs font-semibold text-green-200"
        >
          Copier
        </button>
      </div>
    </div>
  );
}
