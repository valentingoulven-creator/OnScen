import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import { donationOptionEmoji, GIFT_EMOJI, LIVE_DON_TIERS } from '../lib/liveReactions';
import type { LiveDonationOption } from '../types';

interface GiftBurst {
  id: string;
  emoji: string;
  senderName: string;
  amount?: number;
  giftType: string;
}

interface LiveGiftOverlayProps {
  liveId: string;
  visible: boolean;
  tiers?: readonly number[];
  /** Menu récompenses hôte (libellés + montants). */
  donationOptions?: LiveDonationOption[];
  onOpenGiftSheet: (amount?: number) => void;
}

export function LiveGiftOverlay({
  liveId,
  visible,
  tiers = LIVE_DON_TIERS,
  donationOptions,
  onOpenGiftSheet,
}: LiveGiftOverlayProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bursts, setBursts] = useState<GiftBurst[]>([]);
  const burstSeq = useRef(0);

  useEffect(() => {
    if (!visible) {
      setPickerOpen(false);
      return;
    }
    const socket = getSocket();
    if (!socket) return;
    const onGiftAnimation = (gift: {
      liveId: string;
      id?: string;
      senderName: string;
      giftType: string;
      amount?: number;
    }) => {
      if (gift.liveId !== liveId) return;
      const emoji =
        gift.giftType === 'don' && gift.amount
          ? donationOptionEmoji({ amount: gift.amount })
          : GIFT_EMOJI[gift.giftType] ?? '✨';
      const id = gift.id ?? `burst_${Date.now()}_${burstSeq.current++}`;
      setBursts((prev) => [
        ...prev.slice(-8),
        { id, emoji, senderName: gift.senderName, amount: gift.amount, giftType: gift.giftType },
      ]);
      window.setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, 2600);
    };
    socket.on('gift_animation', onGiftAnimation);
    return () => {
      socket.off('gift_animation', onGiftAnimation);
    };
  }, [liveId, visible]);

  if (!visible) return null;

  const openTier = (amount: number) => {
    setPickerOpen(false);
    onOpenGiftSheet(amount);
  };

  const pickerOptions =
    donationOptions?.filter((o) => o.label?.trim() && o.amount >= 1 && o.amount <= 100) ?? [];
  const useRewardMenu = pickerOptions.length > 0;

  return (
    <>
      <div className="absolute inset-0 z-[25] pointer-events-none overflow-hidden" aria-hidden>
        {bursts.map((burst, index) => (
          <div
            key={burst.id}
            className="live-gift-burst absolute right-4 flex flex-col items-center gap-0.5"
            style={{ bottom: `${4.5 + index * 0.35}rem` }}
          >
            <span className="text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]">{burst.emoji}</span>
            <span className="max-w-[7rem] truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
              {burst.senderName}
              {burst.giftType === 'don' && burst.amount ? ` · ${burst.amount} €` : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-14 right-3 z-30 flex flex-col items-end gap-2 pointer-events-auto">
        {pickerOpen && (
          <div className="live-gift-picker flex items-center gap-1.5 rounded-2xl border border-pink-500/35 bg-[#12121a]/95 p-1.5 shadow-xl backdrop-blur-md max-w-[min(100vw-1.5rem,22rem)] overflow-x-auto">
            {useRewardMenu
              ? pickerOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => openTier(opt.amount)}
                    className="flex flex-col items-center justify-center min-w-[3.75rem] max-w-[4.5rem] py-2 px-1.5 rounded-xl bg-pink-950/50 border border-pink-500/30 hover:border-pink-400 hover:bg-pink-900/40 active:scale-95 transition"
                    aria-label={`${opt.label} — ${opt.amount} euros`}
                  >
                    <span className="text-lg leading-none">{donationOptionEmoji(opt)}</span>
                    <span className="text-[9px] font-semibold text-pink-100 mt-0.5 text-center line-clamp-2 leading-tight">
                      {opt.label}
                    </span>
                    <span className="text-[10px] font-bold text-pink-200 mt-0.5">{opt.amount} €</span>
                  </button>
                ))
              : tiers.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => openTier(tier)}
                    className="flex flex-col items-center justify-center min-w-[3.25rem] py-2 px-1.5 rounded-xl bg-pink-950/50 border border-pink-500/30 hover:border-pink-400 hover:bg-pink-900/40 active:scale-95 transition"
                    aria-label={`Pourboire ${tier} euros`}
                  >
                    <span className="text-xl leading-none">{donationOptionEmoji({ amount: tier })}</span>
                    <span className="text-[10px] font-bold text-pink-200 mt-0.5">{tier} €</span>
                  </button>
                ))}
            <button
              type="button"
              onClick={() => {
                setPickerOpen(false);
                onOpenGiftSheet();
              }}
              className="flex h-[3.25rem] min-w-[2.75rem] items-center justify-center rounded-xl border border-[#2d2d3d] bg-[#1a1a26] text-[10px] font-bold text-gray-300 hover:border-white/20"
              aria-label="Autre montant"
            >
              ···
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className={`flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg backdrop-blur-md transition active:scale-95 ${
            pickerOpen
              ? 'bg-pink-600 border-pink-400 text-white shadow-pink-900/50'
              : 'bg-[#12121a]/90 border-pink-500/50 text-2xl shadow-black/40 hover:border-pink-400'
          }`}
          aria-label={pickerOpen ? 'Fermer les cadeaux' : 'Envoyer un pourboire'}
          aria-expanded={pickerOpen}
        >
          {pickerOpen ? '✕' : '💝'}
        </button>
      </div>
    </>
  );
}
