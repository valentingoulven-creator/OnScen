import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShareLinkMenu } from './ShareLinkMenu';
import { ShareToUserSheet } from './ShareToUserSheet';
import { getSalonShareUrl } from '../lib/shareLink';

export interface ShareSalonLinkProps {
  salonId: string;
  salonTitle: string;
  hostName: string;
  className?: string;
  variant?: 'button' | 'compact';
}

export function ShareSalonLink({
  salonId,
  salonTitle,
  hostName,
  className = '',
  variant = 'button',
}: ShareSalonLinkProps) {
  const { token } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toUserOpen, setToUserOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const shareText = `Rejoins le salon de ${hostName} sur Soundy`;

  useEffect(() => {
    let cancelled = false;
    void getSalonShareUrl(salonId).then((url) => {
      if (!cancelled) setShareUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [salonId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const label = 'Partager le lien';

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        disabled={!shareUrl}
        className={
          className ||
          (variant === 'compact'
            ? 'text-xs font-semibold text-purple-300 hover:text-purple-200 px-2 py-1 rounded-lg border border-purple-500/30'
            : 'w-full py-2.5 rounded-xl text-sm font-bold bg-purple-600/20 text-purple-200 border border-purple-500/40 hover:bg-purple-600/30')
        }
        aria-label={label}
      >
        {variant === 'compact' ? '🔗 Partager' : `🔗 ${label}`}
      </button>

      {menuOpen && shareUrl && !toUserOpen && (
        <ShareLinkMenu
          open
          onClose={() => setMenuOpen(false)}
          url={shareUrl}
          title={salonTitle}
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
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1a1a28] border border-purple-500/40 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
    </>
  );
}
