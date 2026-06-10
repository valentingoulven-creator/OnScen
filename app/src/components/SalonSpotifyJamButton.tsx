import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { normalizeSpotifyJamUrl } from '../lib/spotifyJam';
import { SpotifyJamJoinCard, SpotifyJamLinkField } from './SpotifyJamLinkField';
import type { Salon } from '../types';

interface SalonSpotifyJamButtonProps {
  salon: Salon;
  token: string | null;
  isHost: boolean;
  onSalonUpdated: (salon: Salon) => void;
  onToast?: (message: string) => void;
}

function JamSpeakerIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 5L6 9H3v6h3l5 4V5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {active ? (
        <>
          <path d="M15.5 8.5a4 4 0 010 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M18 6a7.5 7.5 0 010 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : (
        <path d="M15 9.5a3.5 3.5 0 010 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function SalonSpotifyJamButton({
  salon,
  token,
  isHost,
  onSalonUpdated,
  onToast,
}: SalonSpotifyJamButtonProps) {
  const [open, setOpen] = useState(false);
  const [hostJamDraft, setHostJamDraft] = useState(salon.spotifyJamUrl ?? '');
  const [editingHostJam, setEditingHostJam] = useState(false);
  const [savingJam, setSavingJam] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const jamActive = Boolean(salon.spotifyJamUrl);

  useEffect(() => {
    setHostJamDraft(salon.spotifyJamUrl ?? '');
    if (salon.spotifyJamUrl) setEditingHostJam(false);
  }, [salon.spotifyJamUrl]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isHost && !jamActive) return null;

  const saveHostJamLink = async (overrideValue?: string) => {
    if (!token || !isHost) return;
    const trimmed = (overrideValue ?? hostJamDraft).trim();
    if (trimmed && !normalizeSpotifyJamUrl(trimmed)) {
      onToast?.('Lien Jam invalide');
      return;
    }
    setSavingJam(true);
    try {
      const { salon: updated } = await api.updateSalonSettings(token, salon.id, {
        spotifyJamUrl: trimmed ? normalizeSpotifyJamUrl(trimmed) : '',
      });
      onSalonUpdated(updated);
      setHostJamDraft(updated.spotifyJamUrl ?? '');
      setEditingHostJam(false);
      onToast?.(trimmed ? 'Lien Jam enregistré' : 'Lien Jam retiré');
      if (trimmed) setOpen(false);
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setSavingJam(false);
    }
  };

  const label = isHost
    ? jamActive
      ? 'Jam Spotify actif'
      : 'Configurer le Jam Spotify'
    : 'Rejoindre le Jam Spotify';

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`salon-header-icon-btn ${jamActive ? 'salon-header-icon-btn--active-green' : ''}`}
        aria-label={label}
        aria-expanded={open}
        title={label}
      >
        <JamSpeakerIcon active={jamActive} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.35rem)] z-[80] w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-[#2a2a3a] bg-[#12121a] shadow-xl p-3 space-y-2.5">
          {isHost ? (
            jamActive && !editingHostJam ? (
              <>
                <SpotifyJamJoinCard jamUrl={salon.spotifyJamUrl!} isHost onCopy={onToast} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHostJamDraft(salon.spotifyJamUrl ?? '');
                      setEditingHostJam(true);
                    }}
                    className="flex-1 py-1.5 rounded-lg border border-[#2a2a3a] text-[11px] text-gray-300 hover:text-white"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveHostJamLink('')}
                    disabled={savingJam}
                    className="px-3 py-1.5 rounded-lg border border-red-500/30 text-[11px] text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Retirer
                  </button>
                </div>
              </>
            ) : (
              <>
                <SpotifyJamLinkField
                  value={hostJamDraft}
                  onChange={setHostJamDraft}
                  variant="inline"
                  disabled={savingJam}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveHostJamLink()}
                    disabled={savingJam || !hostJamDraft.trim()}
                    className="flex-1 py-2 rounded-xl bg-green-600/80 hover:bg-green-600 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {savingJam ? 'Enregistrement…' : 'Activer le Jam'}
                  </button>
                  {jamActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setHostJamDraft(salon.spotifyJamUrl ?? '');
                        setEditingHostJam(false);
                      }}
                      className="px-3 py-2 rounded-xl border border-[#2a2a3a] text-xs text-gray-400"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </>
            )
          ) : (
            <SpotifyJamJoinCard jamUrl={salon.spotifyJamUrl!} onCopy={onToast} />
          )}
        </div>
      )}
    </div>
  );
}
