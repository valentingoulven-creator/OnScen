import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAnchoredPopoverPosition } from '../hooks/useAnchoredPopoverPosition';

export type LiveVipModeratorEntry = { id: string; name: string };
export type LiveVipChatParticipant = { id: string; name: string };

type LiveVipModeratorsPopoverProps = {
  vipEntries: LiveVipModeratorEntry[];
  chatParticipants: LiveVipChatParticipant[];
  onSetVip: (userId: string, isVip: boolean) => void;
  panelAbove?: boolean;
  /** false — liste lecture seule (spectateurs). */
  canManage?: boolean;
};

const POPOVER_TRIGGER_CLASS =
  'w-11 h-11 flex items-center justify-center rounded-lg transition text-sm leading-none touch-manipulation';

export function LiveVipModeratorsPopover({
  vipEntries,
  chatParticipants,
  onSetVip,
  panelAbove = false,
  canManage = true,
}: LiveVipModeratorsPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const countLabel =
    vipEntries.length === 0
      ? t('live.vipModeratorsCountNone')
      : t('live.vipModeratorsCount', { count: vipEntries.length });

  const panelPos = useAnchoredPopoverPosition(open, buttonRef, panelRef, [
    vipEntries.length,
    chatParticipants.length,
  ], { estimatedWidth: 288, estimatedHeight: 280, preferAbove: panelAbove });

  const panel =
    open && typeof document !== 'undefined' ? (
      <div
        ref={panelRef}
        className="fixed z-[70] w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-amber-500/30 bg-[#12100a] shadow-2xl overflow-hidden"
        style={{
          top: panelPos?.top ?? (buttonRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
          left: panelPos?.left ?? 8,
          visibility: panelPos ? 'visible' : 'hidden',
        }}
      >
          <div className="px-3 py-2 border-b border-amber-500/20 bg-[#1a1200]/80 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-gray-500 tabular-nums min-w-0 truncate">{countLabel}</p>
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest shrink-0">
                {t('live.vipModeratorsShort')}
              </p>
            </div>
          </div>

          <div className="p-2 space-y-1 max-h-56 overflow-y-auto">
            {vipEntries.length === 0 ? (
              <p className="text-[11px] text-gray-500 px-1 py-1">{t('live.noVipModerators')}</p>
            ) : (
              <ul className="space-y-1">
                {vipEntries.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#2a2010] bg-[#1a1200] px-2 py-1.5"
                  >
                    <span className="text-[11px] text-gray-200 truncate flex-1 min-w-0">
                      <span className="text-amber-400 font-bold text-[10px]">VIP</span> {v.name}
                    </span>
                    {canManage ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(t('live.removeVipConfirm', { name: v.name }))) return;
                        onSetVip(v.id, false);
                      }}
                      className="shrink-0 min-h-11 min-w-11 flex items-center justify-center text-[10px] font-bold text-red-400 hover:text-red-300 transition touch-manipulation"
                      aria-label={t('live.removeVip')}
                    >
                      ✕
                    </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {canManage && chatParticipants.length > 0 && (
              <div className="pt-1 border-t border-amber-500/15 mt-1">
                <p className="text-[9px] text-gray-500 px-1 mb-1 uppercase tracking-wide">
                  {t('live.vipModeratorsAdd')}
                </p>
                <ul className="flex flex-wrap gap-1">
                  {chatParticipants.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onSetVip(p.id, true)}
                        className="min-h-11 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#1a1200] border border-amber-500/30 text-amber-200 hover:bg-amber-950/40 transition touch-manipulation"
                      >
                        + {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {chatParticipants.length === 0 && vipEntries.length === 0 && (
              <p className="text-[11px] text-gray-500 px-1">{t('live.addModeratorFromChat')}</p>
            )}
          </div>
      </div>
    ) : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${POPOVER_TRIGGER_CLASS} ${
          open
            ? 'text-amber-300 bg-amber-950/50'
            : 'text-gray-500 hover:text-amber-300 hover:bg-white/10'
        }`}
        aria-label={t('live.vipModerators')}
        aria-expanded={open}
        title={t('live.vipModerators')}
      >
        <span aria-hidden>⭐</span>
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
