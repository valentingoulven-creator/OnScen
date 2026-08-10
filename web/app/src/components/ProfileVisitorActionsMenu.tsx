import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportContentContext } from './ReportContentModal';
import { ReportContentButton } from './ReportContentModal';
import { ShareProfileLink } from './ShareProfileLink';

export interface ProfileVisitorActionsMenuProps {
  userId: string;
  username: string;
  reportContext: ReportContentContext;
}

export function ProfileVisitorActionsMenu({
  userId,
  username,
  reportContext,
}: ProfileVisitorActionsMenuProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        title={t('profile.moreOptionsAria')}
        aria-label={t('profile.moreOptionsAria')}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="w-11 h-11 rounded-full bg-black/45 border border-white/15 backdrop-blur-md flex items-center justify-center text-gray-200 hover:bg-black/65 hover:text-white transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/60 sm:bg-transparent"
            aria-label={t('common.close')}
            onClick={closeMenu}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center ms-modal-overlay pointer-events-none sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-1 sm:p-0 sm:pointer-events-none">
            <div
              role="menu"
              className="pointer-events-auto w-[min(calc(100%-0.5rem),20rem)] min-w-[12rem] rounded-2xl border border-[#2d2d3d] bg-[#1a1a26] shadow-xl overflow-hidden sm:w-auto sm:max-w-none"
            >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                setShareOpen(true);
              }}
              className="w-full px-4 py-3.5 text-left text-sm text-white hover:bg-[#2d2d3d] min-h-[44px]"
            >
              {t('share.title')}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                setReportOpen(true);
              }}
              className="w-full px-4 py-3.5 text-left text-sm text-red-400 hover:bg-red-500/10 border-t border-[#2d2d3d] min-h-[44px]"
            >
              {t('profile.report')}
            </button>
            </div>
          </div>
        </>
      )}

      <ShareProfileLink
        userId={userId}
        username={username}
        open={shareOpen}
        onOpenChange={setShareOpen}
        hideTrigger
      />
      <ReportContentButton
        context={reportContext}
        open={reportOpen}
        onOpenChange={setReportOpen}
        hideTrigger
      />
    </div>
  );
}
