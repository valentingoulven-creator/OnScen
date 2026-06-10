import { useEffect, useState } from 'react';
import { ShareLinkMenu } from './ShareLinkMenu';
import { SUPPORT } from '../content/support';
import { getAppShareUrl } from '../lib/shareLink';
import { getSupportClickCount, incrementSupportClick } from '../lib/support';

const APP_SHARE_TITLE = 'Soundy';
const APP_SHARE_TEXT = 'Découvre Soundy — salons musicaux, lives et carte autour de toi.';

interface SupportMeloSongSectionProps {
  onToast?: (msg: string) => void;
}

export function SupportMeloSongSection({ onToast }: SupportMeloSongSectionProps) {
  const [clickCount, setClickCount] = useState(getSupportClickCount);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getAppShareUrl().then((url) => {
      if (!cancelled) setShareUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toast = (msg: string) => onToast?.(msg);

  const handleAmount = (amount: number) => {
    const next = incrementSupportClick();
    setClickCount(next);
    toast(SUPPORT.thankYou(amount));
  };

  const handleShared = () => {
    incrementSupportClick();
    setClickCount(getSupportClickCount());
  };

  return (
    <div className="px-4 pb-4 space-y-4">
      <div className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-4 space-y-3">
        <p className="text-sm text-gray-300 leading-relaxed">{SUPPORT.intro}</p>
        <p className="text-[10px] text-gray-500">{SUPPORT.demoNote}</p>

        <div>
          <p className="text-xs text-gray-400 mb-2">Montant symbolique</p>
          <div className="grid grid-cols-3 gap-2">
            {SUPPORT.amounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleAmount(amount)}
                className="flex flex-col items-center py-3 rounded-xl bg-purple-950/40 border border-purple-500/40 hover:border-purple-400 active:scale-95 transition"
              >
                <span className="text-xl">💜</span>
                <span className="text-sm font-bold text-purple-200 mt-1">{amount} €</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#1e1e2f]/80">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{SUPPORT.externalPaymentLabel}</p>
            <p className="text-[10px] text-gray-500">{SUPPORT.externalPaymentHint}</p>
          </div>
          <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold">
            {SUPPORT.externalPaymentSoon}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShareMenuOpen(true)}
          disabled={!shareUrl}
          className="w-full py-3 rounded-xl bg-[#1a1a26] border border-purple-500/30 hover:border-purple-400/50 disabled:opacity-50 text-sm font-semibold text-purple-200 transition"
        >
          {SUPPORT.shareLabel}
        </button>

        {clickCount > 0 && (
          <p className="text-[10px] text-center text-gray-600">{SUPPORT.clickCount(clickCount)}</p>
        )}
      </div>

      {shareMenuOpen && shareUrl && (
        <ShareLinkMenu
          open={shareMenuOpen}
          onClose={() => setShareMenuOpen(false)}
          url={shareUrl}
          title={APP_SHARE_TITLE}
          text={APP_SHARE_TEXT}
          onToast={toast}
          onShared={handleShared}
        />
      )}
    </div>
  );
}

export function SupportMeloSongTeaser({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-purple-950/30 border border-purple-500/25 hover:border-purple-400/40 text-left transition"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-purple-200">💜 {SUPPORT.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{SUPPORT.profileTeaser}</p>
      </div>
      <span className="text-gray-500 shrink-0">›</span>
    </button>
  );
}
