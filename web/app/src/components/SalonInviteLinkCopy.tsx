import { useEffect, useState } from 'react';
import { copyShareLink, getSalonShareUrl } from '../lib/shareLink';

interface SalonInviteLinkCopyProps {
  salonId?: string;
  className?: string;
}

export function SalonInviteLinkCopy({ salonId, className = '' }: SalonInviteLinkCopyProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!salonId) {
      setShareUrl('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getSalonShareUrl(salonId)
      .then((url) => {
        if (!cancelled) setShareUrl(url);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salonId]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    const ok = await copyShareLink(shareUrl);
    if (ok) setCopied(true);
  };

  const ready = Boolean(salonId && shareUrl && !loading);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => void handleCopy()}
        disabled={!ready}
        className="w-full py-2 rounded-xl text-xs font-semibold border border-purple-500/40 text-purple-200 bg-purple-600/15 hover:bg-purple-600/25 disabled:opacity-45 disabled:cursor-not-allowed"
      >
        {copied ? '✓ Lien copié' : '🔗 Copier le lien d\'invitation'}
      </button>
      {ready && (
        <p className="text-[10px] text-gray-400 break-all leading-snug">{shareUrl}</p>
      )}
      {!salonId && (
        <p className="text-[10px] text-gray-500 leading-snug">
          Le lien sera généré à la création du salon.
        </p>
      )}
    </div>
  );
}
