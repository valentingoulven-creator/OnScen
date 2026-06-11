import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type SalonBanDurationPreset = '5m' | '1h' | '24h' | 'custom';

const PRESET_MS: Record<Exclude<SalonBanDurationPreset, 'custom'>, number> = {
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

interface SalonUserBanModalProps {
  username: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (opts: { permanent: boolean; durationMs?: number }) => void;
}

export function SalonUserBanModal({ username, open, onClose, onConfirm }: SalonUserBanModalProps) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<SalonBanDurationPreset>('5m');
  const [customMinutes, setCustomMinutes] = useState('30');
  const [permanent, setPermanent] = useState(false);

  if (!open) return null;

  const submit = () => {
    if (permanent) {
      onConfirm({ permanent: true });
      return;
    }
    let durationMs: number;
    if (preset === 'custom') {
      const mins = parseInt(customMinutes, 10);
      if (!Number.isFinite(mins) || mins < 1) {
        alert(t('salon.participants.banInvalidDuration', { defaultValue: 'Indiquez une durée valide en minutes (minimum 1).' }));
        return;
      }
      durationMs = mins * 60 * 1000;
    } else {
      durationMs = PRESET_MS[preset];
    }
    onConfirm({ permanent: false, durationMs });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[#2d2d3d] bg-[#12121a] shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-white">
            {t('salon.participants.banTitle', { username, defaultValue: 'Bloquer {{username}}' })}
          </p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2" aria-label={t('common.close', { defaultValue: 'Fermer' })}>
            ✕
          </button>
        </div>

        <p className="text-[11px] text-gray-400 mb-4">
          {t('salon.participants.banHint', { defaultValue: 'Cette personne ne pourra plus rejoindre le salon.' })}
        </p>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-200">{t('salon.participants.banPermanent', { defaultValue: 'Bannissement permanent' })}</span>
        </label>

        {!permanent && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
              {t('salon.participants.banDuration', { defaultValue: 'Durée' })}
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(['5m', '1h', '24h'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    preset === p
                      ? 'bg-red-950/50 border-red-500/50 text-red-200'
                      : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300 hover:border-red-500/30'
                  }`}
                >
                  {p === '5m' ? '5 min' : p === '1h' ? '1 h' : '24 h'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPreset('custom')}
              className={`w-full py-2 rounded-xl text-xs font-bold border transition mb-2 ${
                preset === 'custom'
                  ? 'bg-red-950/50 border-red-500/50 text-red-200'
                  : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300 hover:border-red-500/30'
              }`}
            >
              {t('salon.participants.banCustom', { defaultValue: 'Personnalisé' })}
            </button>
            {preset === 'custom' && (
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  min={1}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-white text-sm"
                />
                <span className="text-xs text-gray-400">{t('salon.participants.banMinutes', { defaultValue: 'min' })}</span>
              </div>
            )}
          </>
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-300 border border-[#2d2d3d] hover:bg-[#1a1a26]"
          >
            {t('common.cancel', { defaultValue: 'Annuler' })}
          </button>
          <button
            type="button"
            onClick={submit}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500"
          >
            {t('salon.participants.banConfirm', { defaultValue: 'Bloquer' })}
          </button>
        </div>
      </div>
    </div>
  );
}
