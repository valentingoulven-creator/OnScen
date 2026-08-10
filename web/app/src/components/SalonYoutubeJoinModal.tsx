import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  canJoinSalonAsParticipant,
  salonParticipantAccessMessageKey,
} from '../lib/platformConnect';
import {
  closeSalonYoutubeJoinGate,
  subscribeSalonYoutubeJoinGate,
} from '../lib/salonYoutubeJoinGate';
import { PlatformConnectCard } from './PlatformConnectCard';
import type { User } from '../types';

interface SalonYoutubeJoinModalProps {
  token: string | null;
  user: User | null;
  onUserUpdated?: (user: User) => void;
}

/** Modal bottom-sheet : liaison YouTube obligatoire pour rejoindre un salon en auditeur. */
export function SalonYoutubeJoinModal({ token, user, onUserUpdated }: SalonYoutubeJoinModalProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeSalonYoutubeJoinGate(setOpen), []);

  if (!open) return null;

  const messageKey = salonParticipantAccessMessageKey('youtube');

  const handleUserUpdated = (next: User) => {
    onUserUpdated?.(next);
    if (canJoinSalonAsParticipant('youtube', next.connectedPlatforms, false)) {
      closeSalonYoutubeJoinGate();
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center ms-modal-overlay bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="salon-youtube-join-title"
      onClick={() => closeSalonYoutubeJoinGate()}
    >
      <div
        className="w-full max-w-md bg-[#12121a] border border-[#2d2d3d] rounded-2xl ms-modal-panel shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-2 overflow-y-auto">
          <p id="salon-youtube-join-title" className="text-lg font-bold text-white">
            {t('salon.joinYoutubeGateTitle', { defaultValue: 'YouTube requis' })}
          </p>
          <p className="text-sm text-amber-300/95 leading-relaxed">{t(messageKey)}</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            {t('salon.accessYoutubeRequiredHint')}
          </p>
          {token ? (
            <div className="pt-2">
              <PlatformConnectCard
                token={token}
                platform="youtube"
                connectedPlatforms={user?.connectedPlatforms}
                platformLinks={user?.platformLinks}
                onUserUpdated={handleUserUpdated}
              />
            </div>
          ) : (
            <p className="text-xs text-gray-500 pt-1">
              {t('auth.loginRequired', { defaultValue: 'Connectez-vous pour continuer.' })}
            </p>
          )}
        </div>
        <div className="p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/50 shrink-0">
          <button
            type="button"
            onClick={() => closeSalonYoutubeJoinGate()}
            className="w-full min-h-[44px] py-3 rounded-xl border border-[#2d2d3d] text-gray-300 text-sm font-semibold hover:text-white"
          >
            {t('common.close', { defaultValue: 'Fermer' })}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
