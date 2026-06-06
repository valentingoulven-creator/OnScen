import { useState } from 'react';
import { api } from '../lib/api';
import type { Live } from '../types';

interface StartLiveMapButtonProps {
  token: string;
  username: string;
  lives: Live[];
  userId: string;
  /** Hauteur du panneau bas (salon sélectionné) pour rester au-dessus. */
  bottomSheetHeightPx?: number;
  latitude?: number;
  longitude?: number;
  onStarted: (liveId: string) => void;
}

export function StartLiveMapButton({
  token,
  username,
  lives,
  userId,
  bottomSheetHeightPx = 0,
  latitude,
  longitude,
  onStarted,
}: StartLiveMapButtonProps) {
  const bottomCss = `calc(${bottomSheetHeightPx}px + 0.75rem)`;
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const myLive = lives.find((l) => l.hostId === userId && l.isActive);

  const close = () => {
    setOpen(false);
  };

  const openConfirm = () => {
    if (myLive) {
      onStarted(myLive.id);
      return;
    }
    setOpen(true);
  };

  const launchLive = async () => {
    setStarting(true);
    try {
      const { live } = await api.startLive(token, `Live — ${username}`, {
        latitude,
        longitude,
      });
      close();
      onStarted(live.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible de démarrer le live');
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openConfirm}
        style={{ bottom: bottomCss }}
        className={`absolute left-1/2 -translate-x-1/2 z-40 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 min-w-[10.75rem] px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-white text-xs sm:text-sm shadow-lg shadow-red-900/40 border border-red-400/30 active:scale-95 transition-[transform,background-color] duration-200 ${
          myLive
            ? 'bg-red-600/95 hover:bg-red-500'
            : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500'
        }`}
        aria-label={myLive ? 'Ouvrir mon live' : 'Démarrer un live'}
      >
        <span
          className={`w-2 h-2 shrink-0 rounded-full bg-white ${myLive ? 'animate-pulse' : ''}`}
        />
        <span className="truncate text-center">{myLive ? 'Mon LIVE' : 'Démarrer LIVE'}</span>
        <span className="w-2 shrink-0" aria-hidden />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="start-live-title"
        >
          <div className="w-full max-w-sm bg-[#12121a] border border-[#2d2d3d] rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600" />

            <div className="p-5">
              <p id="start-live-title" className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-red-400">●</span> Passer en live ?
              </p>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Vous serez visible sur la carte en direct en tant que{' '}
                <span className="text-white font-semibold">{username}</span>. Chat public, réactions et messages
                privés seront activés — sans avoir à créer un salon.
              </p>
              <ul className="mt-3 text-xs text-gray-500 space-y-1 list-disc list-inside">
                <li>Position floutée sur la carte</li>
                <li>Salon d&apos;écoute optionnel (+ Salon)</li>
              </ul>
            </div>
            <div className="flex gap-2 p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/50">
              <button
                type="button"
                onClick={close}
                disabled={starting}
                className="flex-1 py-3 rounded-xl border border-[#2d2d3d] text-gray-300 text-sm font-semibold hover:text-white disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={launchLive}
                disabled={starting}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {starting ? 'Lancement...' : 'Lancer le live'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
