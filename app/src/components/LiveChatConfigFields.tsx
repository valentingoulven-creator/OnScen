import type { LiveChatConfig } from '../types';

export type LiveChatConfigValue = LiveChatConfig;

type LiveChatConfigFieldsProps = {
  value: LiveChatConfigValue;
  onChange: (patch: Partial<LiveChatConfigValue>) => void;
};

export function LiveChatConfigFields({ value, onChange }: LiveChatConfigFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        Modération du chat
      </p>

      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Liens interdits</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
            Supprime automatiquement les liens (http, www…) des messages des participants non
            modérateurs.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!value.noLinksForParticipants}
          onClick={() =>
            onChange({ noLinksForParticipants: !value.noLinksForParticipants })
          }
          className={`shrink-0 w-11 h-6 rounded-full border transition-colors ${
            value.noLinksForParticipants
              ? 'bg-purple-600 border-purple-500'
              : 'bg-[#1e1e2f] border-[#2a2a3a]'
          }`}
        >
          <span
            className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${
              value.noLinksForParticipants ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </label>

      <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Mode lent</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
              Délai minimum entre deux messages d&apos;un même participant (0 = désactivé).
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={120}
              step={5}
              value={value.slowModeSeconds ?? 0}
              onChange={(e) =>
                onChange({
                  slowModeSeconds: Math.max(0, Math.min(120, Number(e.target.value) || 0)),
                })
              }
              className="w-16 px-2 py-1 rounded-lg bg-[#0b0b0f] border border-[#2a2a3a] text-white text-sm text-center focus:border-purple-500/60 focus:outline-none"
            />
            <span className="text-[11px] text-gray-500">s</span>
          </div>
        </div>
        {(value.slowModeSeconds ?? 0) > 0 && (
          <p className="text-[11px] text-purple-400">
            Mode lent actif : {value.slowModeSeconds}s entre chaque message
          </p>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Abonnés uniquement</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
            Réserve le chat aux abonnés de votre profil.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!value.subscribersOnly}
          onClick={() => onChange({ subscribersOnly: !value.subscribersOnly })}
          className={`shrink-0 w-11 h-6 rounded-full border transition-colors ${
            value.subscribersOnly
              ? 'bg-purple-600 border-purple-500'
              : 'bg-[#1e1e2f] border-[#2a2a3a]'
          }`}
        >
          <span
            className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${
              value.subscribersOnly ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </label>
    </div>
  );
}
