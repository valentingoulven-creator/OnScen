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
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-reel-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label={t('reels.createClose', { defaultValue: 'Fermer' })}
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#0b0b0f] border border-[#2d2d3d] shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[#3d3d55]" />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#1e1e2f] shrink-0">
          <h2 id="create-reel-title" className="text-sm font-bold text-white">
            {t('reels.createTitle', { defaultValue: 'Ajouter un reel' })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10"
            aria-label={t('reels.createClose', { defaultValue: 'Fermer' })}
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4">
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
