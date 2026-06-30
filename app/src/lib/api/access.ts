import { request } from './core';

export const accessApi = {
  getAccessConfig: () =>
    request<import('../../types').PublicAccessConfig>('/access/config', {}),

  getAccessAdminStatus: (token: string) =>
    request<{
      accessControlEnabled: boolean;
      isAdmin: boolean;
      accountStatus: string | null;
    }>('/access/admin/status', {}, token),

  getAccessAdminOverview: (token: string) =>
    request<{
      policy: { registrationMode: string; updatedAt: number };
      config: import('../../types').PublicAccessConfig;
      counts: {
        total: number;
        active: number;
        pending: number;
        blocked: number;
      };
      inviteCodes: import('../../types').AccessInviteCode[];
    }>('/access/admin/overview', {}, token),

  getAccessAdminUsers: (
    token: string,
    opts: {
      status?: 'all' | 'active' | 'pending' | 'blocked';
      q?: string;
      sort?: import('../../types').AdminUserSort;
      limit?: number;
      offset?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('status', opts.status ?? 'all');
    if (opts.q) params.set('q', opts.q);
    if (opts.sort) params.set('sort', opts.sort);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    return request<import('../../types').AccessAdminUsersResponse>(
      `/access/admin/users?${params.toString()}`,
      {},
      token
    );
  },

  getAccessAdminUser: (token: string, userId: string) =>
    request<{ user: import('../../types').AccessManagedUser }>(
      `/access/admin/users/${userId}`,
      {},
      token
    ),

  patchAccessPolicy: (token: string, registrationMode: string) =>
    request<{ policy: { registrationMode: string }; config: import('../../types').PublicAccessConfig }>(
      '/access/admin/policy',
      { method: 'PATCH', body: JSON.stringify({ registrationMode }) },
      token
    ),

  approveAccessUser: (token: string, userId: string) =>
    request<{ user: import('../../types').User }>(
      `/access/admin/users/${userId}/approve`,
      { method: 'POST' },
      token
    ),

  blockAccessUser: (
    token: string,
    userId: string,
    opts?: { days?: number | null; reason?: string }
  ) =>
    request<{ user: import('../../types').AccessManagedUser }>(
      `/access/admin/users/${userId}/block`,
      { method: 'POST', body: JSON.stringify(opts ?? {}) },
      token
    ),

  unblockAccessUser: (token: string, userId: string) =>
    request<{ user: import('../../types').AccessManagedUser }>(
      `/access/admin/users/${userId}/unblock`,
      { method: 'POST' },
      token
    ),

  getAccessAdminUserSocial: (token: string, userId: string, limit = 40) =>
    request<import('../../types').AdminUserSocialResponse>(
      `/access/admin/users/${userId}/social?limit=${limit}`,
      {},
      token
    ),

  promoteAccessUser: (token: string, userId: string) =>
    request<{ user: import('../../types').AccessManagedUser }>(
      `/access/admin/users/${userId}/promote`,
      { method: 'POST' },
      token
    ),

  demoteAccessUser: (token: string, userId: string) =>
    request<{ user: import('../../types').AccessManagedUser }>(
      `/access/admin/users/${userId}/demote`,
      { method: 'POST' },
      token
    ),

  assignAdminPlatformPlan: (
    token: string,
    userId: string,
    planId: 'free' | 'soundy_plus' | 'soundy_ultra'
  ) =>
    request<{ ok: boolean; status: import('../subscriptions').PlatformPlanStatusResponse }>(
      `/access/admin/users/${userId}/platform-plan`,
      { method: 'POST', body: JSON.stringify({ planId }) },
      token
    ),

  createAccessInvite: (
    token: string,
    body: { code?: string; label?: string; maxUses?: number }
  ) =>
    request<{ invite: import('../../types').AccessInviteCode }>(
      '/access/admin/invites',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  setAccessInviteDisabled: (token: string, id: string, disabled: boolean) =>
    request<{ invite: import('../../types').AccessInviteCode }>(
      `/access/admin/invites/${id}`,
      { method: 'PATCH', body: JSON.stringify({ disabled }) },
      token
    ),

  deleteAccessInvite: (token: string, id: string) =>
    request<{ ok: boolean }>(`/access/admin/invites/${id}`, { method: 'DELETE' }, token),

  submitSupportContact: (token: string, body: string) =>
    request<{ message: import('../../types').SupportContactMessage }>(
      '/support/contact',
      { method: 'POST', body: JSON.stringify({ body }) },
      token
    ),

  getMySupportMessages: (token: string) =>
    request<{ messages: import('../../types').SupportContactMessage[] }>('/support/my', {}, token),

  getAdminSupportMessages: (
    token: string,
    opts: { status?: 'open' | 'replied' | 'resolved' | 'all' } = {}
  ) => {
    const params = new URLSearchParams();
    if (opts.status && opts.status !== 'all') params.set('status', opts.status);
    const qs = params.toString();
    return request<{ messages: import('../../types').SupportContactMessage[] }>(
      `/access/admin/support${qs ? `?${qs}` : ''}`,
      {},
      token
    );
  },

  replyAdminSupportMessage: (token: string, messageId: string, reply: string) =>
    request<{ message: import('../../types').SupportContactMessage }>(
      `/access/admin/support/${messageId}/reply`,
      { method: 'POST', body: JSON.stringify({ reply }) },
      token
    ),

  resolveAdminSupportMessage: (token: string, messageId: string) =>
    request<{ message: import('../../types').SupportContactMessage }>(
      `/access/admin/support/${messageId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) },
      token
    ),

  replySupportContact: (token: string, messageId: string, body: string) =>
    request<{ message: import('../../types').SupportContactMessage }>(
      `/support/contact/${messageId}/reply`,
      { method: 'POST', body: JSON.stringify({ body }) },
      token
    ),

  resolveSupportContact: (token: string, messageId: string) =>
    request<{ message: import('../../types').SupportContactMessage }>(
      `/support/contact/${messageId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) },
      token
    )
} as const;
