import { request } from './core';

export const donationsApi = {
  getDonationsConfig: (token?: string | null) =>
    request<import('../donations').DonationsConfig>('/donations/config', {}, token),

  simulateDonation: (token: string, liveId: string, amount: number, ageConfirmed: boolean) =>
    request<{ gift: object; simulation: boolean; message: string }>(
      '/donations/simulate',
      {
        method: 'POST',
        body: JSON.stringify({ liveId, amount, ageConfirmed }),
      },
      token
    ),

  createDonationIntent: (token: string, liveId: string, amount: number, ageConfirmed: boolean) =>
    request<{ clientSecret: string; paymentIntentId: string; amount: number; currency: string }>(
      '/donations/create-intent',
      {
        method: 'POST',
        body: JSON.stringify({ liveId, amount, ageConfirmed }),
      },
      token
    ),

  getStripeConnectStatus: (token: string) =>
    request<import('../donations').StripeConnectStatus>('/donations/connect-status', {}, token),

  startStripeConnectOnboard: (token: string) =>
    request<{ url: string; stripeConnectAccountId: string }>(
      '/donations/connect-onboard',
      { method: 'POST', body: JSON.stringify({}) },
      token
    )
} as const;
