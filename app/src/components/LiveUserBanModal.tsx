import { useState } from 'react';

export type LiveBanDurationPreset = '5m' | '1h' | '24h' | 'custom';
export type LiveBanScope = 'chat' | 'live';

const PRESET_MS: Record<Exclude<LiveBanDurationPreset, 'custom'>, number> = {
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

interface LiveUserBanModalProps {
  username: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (opts: { permanent: boolean; durationMs?: number; scope: LiveBanScope }) => void;
}

export function LiveUserBanModal({ username, open, onClose, onConfirm }: LiveUserBanModalProps) {
  const [preset, setPreset] = useState<LiveBanDurationPreset>('5m');
  const [customMinutes, setCustomMinutes] = useState('30');
  const [permanent, setPermanent] = useState(false);
  const [scope, setScope] = useState<LiveBanScope>('chat');

  if (!open) return null;

  const submit = () => {
    if (permanent) {
      onConfirm({ permanent: true, scope });
      return;
    }
    let durationMs: number;
    if (preset === 'custom') {
      const mins = parseInt(customMinutes, 10);
      if (!Number.isFinite(mins) || mins < 1) {
        alert('Indiquez une durée valide en minutes (minimum 1).');
        return;
      }
      durationMs = mins * 60 * 1000;
    } else {
      durationMs = PRESET_MS[preset];
    }
    onConfirm({ permanent: false, durationMs, scope });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-[#2d2d3d] bg-[#12121a] shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-white">Bannir {username}</p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2" aria-label="Fermer">
            ✕
          </button>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Portée</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setScope('chat')}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition text-left ${
              scope === 'chat'
                ? 'bg-red-950/50 border-red-500/50 text-red-200'
                : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300 hover:border-red-500/30'
            }`}
          >
            Chat uniquement
            <span className="block font-normal text-[10px] text-gray-400 mt-0.5">Peut encore regarder</span>
          </button>
          <button
            type="button"
            onClick={() => setScope('live')}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition text-left ${
              scope === 'live'
                ? 'bg-red-950/50 border-red-500/50 text-red-200'
                : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300 hover:border-red-500/30'
            }`}
          >
            Tout le live
            <span className="block font-normal text-[10px] text-gray-400 mt-0.5">Expulsion + visionnage</span>
          </button>
        </div>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={permanent}
            onChange={(e) => setPermanent(e.target.checked)}
            className="rounded border-[#2d2d3d]"
          />
          <span className="text-sm text-red-300 font-medium">Bannissement définitif</span>
        </label>

        {!permanent && (
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Durée</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(
                [
                  ['5m', '5 min'],
                  ['1h', '1 h'],
                  ['24h', '24 h'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreset(key)}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    preset === key
                      ? 'bg-red-950/50 border-red-500/50 text-red-200'
                      : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300 hover:border-red-500/30'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPreset('custom')}
              className={`w-full py-2 rounded-xl text-xs font-bold border mb-2 transition ${
                preset === 'custom'
                  ? 'bg-red-950/50 border-red-500/50 text-red-200'
                  : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300 hover:border-red-500/30'
              }`}
            >
              Durée personnalisée
            </button>
            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10080}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="flex-1 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] px-3 py-2 text-sm text-white"
                />
                <span className="text-xs text-gray-400 shrink-0">minutes</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-300 bg-[#1a1a26] border border-[#2d2d3d] hover:bg-[#222230]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500"
          >
            Bannir
          </button>
        </div>
      </div>
    </div>
  );
}
