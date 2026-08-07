import { useTranslation } from 'react-i18next';
import type { LivePinnedAnnouncement } from '../types';

type LivePinnedAnnouncementBannerProps = {
  announcement: LivePinnedAnnouncement;
};

/** Annonce épinglée par l'hôte, affichée en tête du chat live (distincte des animations de dons). */
export function LivePinnedAnnouncementBanner({ announcement }: LivePinnedAnnouncementBannerProps) {
  const { t } = useTranslation();
  return (
    <div className="shrink-0 flex items-start gap-2 px-3 py-2 border-b border-amber-500/20 bg-amber-950/20">
      <span className="text-amber-400 text-sm shrink-0 mt-0.5" aria-hidden>
        📌
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">
          {t('live.announcementBadge')}
        </p>
        <p className="text-xs text-amber-100 leading-snug break-words">{announcement.text}</p>
      </div>
    </div>
  );
}
