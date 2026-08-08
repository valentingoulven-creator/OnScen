import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ShareLinkMenu } from './ShareLinkMenu';
import { ShareToUserSheet } from './ShareToUserSheet';
import { getProfileShareUrl } from '../lib/shareLink';

export interface ShareProfileLinkProps {
  userId: string;
  username: string;
  className?: string;
  /** Contrôle externe du menu partage (sans bouton visible si hideTrigger). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function ShareProfileLink({
  userId,
  username,
  className,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: ShareProfileLinkProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [menuOpenInternal, setMenuOpenInternal] = useState(false);
  const menuOpen = openProp ?? menuOpenInternal;
  const setMenuOpen = (next: boolean) => {
    if (openProp === undefined) setMenuOpenInternal(next);
    onOpenChange?.(next);
  };
  const [toUserOpen, setToUserOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const shareText = `Découvre le profil de ${username} sur OnScen`;

  useEffect(() => {
    let cancelled = false;
    void getProfileShareUrl(userId).then((url) => {
      if (!cancelled) setShareUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const label = t('share.title');

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          disabled={!shareUrl}
          className={
            className ??
            'px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-purple-300 border border-purple-500/30 hover:bg-purple-900/20 disabled:opacity-45 disabled:cursor-not-allowed'
          }
          title={t('share.copyLink')}
          aria-label={label}
        >
          {label}
        </button>
      )}

      {menuOpen && shareUrl && !toUserOpen && (
        <ShareLinkMenu
          open
          onClose={() => setMenuOpen(false)}
          url={shareUrl}
          title={`${username} — OnScen`}
          text={shareText}
          onToast={setToast}
          onSendToUser={token ? () => setToUserOpen(true) : undefined}
        />
      )}

      {menuOpen && toUserOpen && shareUrl && token && (
        <ShareToUserSheet
          open
          onBack={() => setToUserOpen(false)}
          onClose={() => {
            setToUserOpen(false);
            setMenuOpen(false);
          }}
          token={token}
          shareUrl={shareUrl}
          shareText={shareText}
          onToast={setToast}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full bg-[#1a1a28] border border-purple-500/40 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
    </>
  );
}
