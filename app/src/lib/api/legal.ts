import { request } from './core';

export const legalApi = {
  getLegalPublisher: () =>
    request<{
      config: import('../../types').LegalPublisherConfig;
      complete: boolean;
      termsVersion: string;
    }>('/legal/publisher', {}),

  submitContentReport: (
    token: string,
    body: {
      category: string;
      details: string;
      targetUserId?: string;
      roomType?: string;
      roomId?: string;
      messageId?: string;
    }
  ) =>
    request<{ ok: boolean; reportId: string; blocked?: boolean }>('/legal/reports', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  /** Fetches the current user. Passes token header if available; also relies on the httpOnly cookie. */
} as const;
