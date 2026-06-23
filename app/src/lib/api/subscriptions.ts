import { request } from './core';

export const subscriptionsApi = {
  getSubscriptionsConfig: (token?: string | null) =>
    request<import('../subscriptions').SubscriptionsConfig>('/subscriptions/config', {}, token),

  getPlatformPlan: (token: string) =>
    request<import('../subscriptions').PlatformPlanStatusResponse>(
      '/subscriptions/platform-plan',
      {},
      token
    ),

  getSubscriptionStatus: (
    token: string,
    params: { creatorId?: string; targetType?: 'creator' | 'platform' }
  ) => {
    const q = new URLSearchParams();
    if (params.creatorId) q.set('creatorId', params.creatorId);
    if (params.targetType) q.set('targetType', params.targetType);
    const qs = q.toString();
    return request<import('../subscriptions').SubscriptionStatus>(
      `/subscriptions/status${qs ? `?${qs}` : ''}`,
      {},
      token
    );
  },

  simulateSubscription: (
    token: string,
    body: {
      creatorId?: string;
      tierId: string;
      targetType?: 'creator' | 'platform';
      ageConfirmed: boolean;
    }
  ) =>
    request<{ subscription: object; simulation: boolean; message: string }>(
      '/subscriptions/simulate',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  createSubscriptionCheckout: (
    token: string,
    body: {
      creatorId?: string;
      tierId: string;
      targetType?: 'creator' | 'platform';
      ageConfirmed: boolean;
    }
  ) =>
    request<{ checkoutUrl: string | null; sessionId: string }>(
      '/subscriptions/create-checkout',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  createSubscriptionPortal: (
    token: string,
    body: { creatorId?: string; targetType?: 'creator' | 'platform' }
  ) =>
    request<{ portalUrl: string }>(
      '/subscriptions/create-portal',
      { method: 'POST', body: JSON.stringify(body) },
      token
    )
} as const;
