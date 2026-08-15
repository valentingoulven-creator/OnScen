import { useTranslation } from 'react-i18next';
import { ProfileReelRecorder } from './ProfileReelRecorder';
import type { MusicReel } from '../content/reels';

interface CreateReelSheetProps {
  open: boolean;
  token: string;
  defaultArtist?: string;
  onClose: () => void;
  onCreated: (reel: MusicReel) => void;
}

export function CreateReelSheet({
  open,
  token,
  defaultArtist = '',
  onClose,
  onCreated,
}: CreateReelSheetProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center ms-modal-overlay bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-reel-title"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t('reels.createClose', { defaultValue: 'Fermer' })}
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-lg min-h-0 flex flex-col overflow-hidden rounded-t-[1.75rem] sm:rounded-[1.75rem] bg-[#050505] shadow-[0_-8px_40px_rgba(0,0,0,0.6)] max-h-[min(94dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] sm:max-h-[min(92dvh,calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] pb-[env(safe-area-inset-bottom,0px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 shrink-0 bg-gradient-to-r from-cyan-400 via-pink-500 to-fuchsia-600" aria-hidden />

        <div className="flex justify-center pt-2 pb-0.5 sm:hidden shrink-0">
          <div className="w-9 h-1 rounded-full bg-white/20" aria-hidden />
        </div>

        <div className="shrink-0 px-4 pt-2 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 pt-0.5">
            <h2 id="create-reel-title" className="text-base font-bold text-white tracking-tight">
              {t('reels.createTitle', { defaultValue: 'Créer un Reel' })}
            </h2>
            <p className="text-[11px] text-white/45 mt-0.5 leading-snug">
              {t('reels.createSubtitle', {
                defaultValue: 'Privé d’abord · publie quand tu veux',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-white/8 text-white/70 hover:text-white hover:bg-white/12 border border-white/10 backdrop-blur-sm transition-colors"
            aria-label={t('reels.createClose', { defaultValue: 'Fermer' })}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y px-4 pb-4">
          <ProfileReelRecorder
            embedded
            token={token}
            defaultArtist={defaultArtist}
            onSaved={(reel) => {
              if (reel) onCreated(reel);
              else onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
