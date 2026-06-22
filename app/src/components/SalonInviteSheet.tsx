import { useEffect, useRef, useState } from 'react';
import type { DmContact } from '../types';
import { SalonInviteUserSearch } from './SalonInviteUserSearch';
import { ShareLinkMenu } from './ShareLinkMenu';
import { ShareToUserSheet } from './ShareToUserSheet';
import { getSalonShareUrl } from '../lib/shareLink';

interface SalonInviteSheetProps {
  salonId: string;
  salonTitle: string;
  hostName: string;
  token: string;
  contacts: DmContact[];
  pendingGuestIds: Set<string>;
  validating: boolean;
  onToggleGuest: (userId: string, add: boolean) => void;
  onValidate: () => Promise<void>;
}

export function SalonInviteSheet({
  salonId,
  salonTitle,
  hostName,
  token,
  contacts,
  pendingGuestIds,
  validating,
  onToggleGuest,
  onValidate,
}: SalonInviteSheetProps) {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareToUserOpen, setShareToUserOpen] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(id);
  }, [copied]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!shareToast) return;
    const id = window.setTimeout(() => setShareToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [shareToast]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // clipboard may be restricted in some contexts
    }
  };

  const handleValidate = async () => {
    setSubmitting(true);
    try {
      await onValidate();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Inviter des personnes dans le salon"
        aria-expanded={open}
        className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-full text-[10px] font-semibold transition border ${
          open
            ? 'bg-purple-600/30 border-purple-500/60 text-purple-200'
            : 'border-[#2a2a3a] text-gray-400 hover:text-white hover:border-gray-500'
        }`}
      >
        <svg
          className="w-3 h-3 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
        </svg>
        <span className="hidden sm:inline">Inviter</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-[60] w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-[#2a2a3a] bg-[#12121a] shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-[#1e1e2f] bg-[#14141c]/90 flex items-center justify-between">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
              Inviter des personnes
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-white text-sm leading-none w-5 h-5 flex items-center justify-center rounded"
              aria-label="Fermer le panneau d'invitation"
            >
              ×
            </button>
          </div>

          <div className="p-3 space-y-3.5">
            {/* Copy / share link */}
            <section className="space-y-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                Lien d'invitation
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={!shareUrl}
                  onClick={() => void handleCopy()}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold border border-purple-500/40 text-purple-200 bg-purple-600/15 hover:bg-purple-600/25 disabled:opacity-45 disabled:cursor-not-allowed transition"
                >
                  {copied ? '✓ Lien copié !' : '🔗 Copier le lien'}
                </button>
                {shareUrl && (
                  <button
                    type="button"
                    onClick={() => setShareMenuOpen(true)}
                    title="Partager via une autre application"
                    className="px-3 py-2 rounded-xl text-gray-300 border border-[#2a2a3a] bg-[#1a1a26] hover:bg-[#242434] transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Partager via une autre application"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                    </svg>
                  </button>
                )}
              </div>
              {shareUrl && (
                <p className="text-[10px] text-gray-500 break-all leading-snug">{shareUrl}</p>
              )}
            </section>

            <div className="border-t border-[#1e1e2f]" />

            {/* Invite specific users */}
            <section className="space-y-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                Inviter un utilisateur Soundy
              </p>
              <SalonInviteUserSearch
                token={token}
                contacts={contacts}
                allowedUserIds={pendingGuestIds}
                onToggle={onToggleGuest}
              />
              <button
                type="button"
                disabled={submitting || validating}
                onClick={() => void handleValidate()}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-purple-600/25 text-purple-200 border border-purple-500/40 hover:bg-purple-600/35 disabled:opacity-50 transition"
              >
                {submitting || validating ? 'Envoi…' : '✉ Envoyer les invitations'}
              </button>
            </section>
          </div>
        </div>
      )}

      {shareMenuOpen && shareUrl && !shareToUserOpen && (
        <ShareLinkMenu
          open
          onClose={() => setShareMenuOpen(false)}
          url={shareUrl}
          title={salonTitle}
          text={shareText}
          onToast={setShareToast}
          onSendToUser={() => setShareToUserOpen(true)}
        />
      )}

      {shareMenuOpen && shareToUserOpen && shareUrl && (
        <ShareToUserSheet
          open
          onBack={() => setShareToUserOpen(false)}
          onClose={() => {
            setShareToUserOpen(false);
            setShareMenuOpen(false);
          }}
          token={token}
          shareUrl={shareUrl}
          shareText={shareText}
          onToast={setShareToast}
        />
      )}

      {shareToast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full bg-[#1a1a28] border border-purple-500/40 text-sm text-white shadow-lg"
          role="status"
        >
          {shareToast}
        </div>
      )}
    </div>
  );
}
