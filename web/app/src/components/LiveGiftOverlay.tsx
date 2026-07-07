import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import { donationOptionEmoji, GIFT_EMOJI } from '../lib/liveReactions';

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
}

export function LiveGiftOverlay({ liveId, visible }: LiveGiftOverlayProps) {
  const [bursts, setBursts] = useState<GiftBurst[]>([]);
  const burstSeq = useRef(0);

  useEffect(() => {
    if (!visible) return;
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

  return (
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
  );
}
