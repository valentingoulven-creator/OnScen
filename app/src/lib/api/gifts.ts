import { request } from './core';

export const giftsApi = {
  giftCatalog: (token: string) => request<{ gifts: { type: string; label: string }[] }>('/gifts/catalog', {}, token),

  getLiveGifts: (token: string, liveId: string) =>
    request<{
      gifts: {
        id: string;
        senderId: string;
        senderName: string;
        giftType: string;
        amount: number;
        timestamp: number;
      }[];
    }>(`/gifts/live/${liveId}`, {}, token),

  sendGift: (token: string, liveId: string, giftType: string, amount?: number) =>
    request<{ gift: object }>(
      '/gifts/send',
      {
        method: 'POST',
        body: JSON.stringify({
          liveId,
          giftType,
          ...(amount != null ? { amount } : {}),
        }),
      },
      token
    )
} as const;
