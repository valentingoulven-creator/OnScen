import { request } from './core';

export const adminApi = {
  getAdminSalons: (
    token: string,
    opts: { filter?: import('../../types').AdminContentFilter; q?: string; limit?: number; offset?: number } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('filter', opts.filter ?? 'all');
    if (opts.q) params.set('q', opts.q);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    return request<import('../../types').AdminContentListResponse>(
      `/access/admin/content/salons?${params.toString()}`,
      {},
      token
    );
  },

  getAdminLives: (
    token: string,
    opts: { filter?: import('../../types').AdminContentFilter; q?: string; limit?: number; offset?: number } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('filter', opts.filter ?? 'all');
    if (opts.q) params.set('q', opts.q);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    return request<import('../../types').AdminContentListResponse>(
      `/access/admin/content/lives?${params.toString()}`,
      {},
      token
    );
  },

  getAdminEvents: (
    token: string,
    opts: { filter?: import('../../types').AdminContentFilter; q?: string; limit?: number; offset?: number } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('filter', opts.filter ?? 'all');
    if (opts.q) params.set('q', opts.q);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    return request<import('../../types').AdminContentListResponse>(
      `/access/admin/content/events?${params.toString()}`,
      {},
      token
    );
  },

  adminBlockSalon: (token: string, salonId: string) =>
    request<{ salon: import('../../types').AdminSalonRow }>(
      `/access/admin/content/salons/${salonId}/block`,
      { method: 'POST' },
      token
    ),

  adminUnblockSalon: (token: string, salonId: string) =>
    request<{ salon: import('../../types').AdminSalonRow }>(
      `/access/admin/content/salons/${salonId}/unblock`,
      { method: 'POST' },
      token
    ),

  adminDeleteSalon: (token: string, salonId: string) =>
    request<{ ok: boolean }>(`/access/admin/content/salons/${salonId}`, { method: 'DELETE' }, token),

  adminBlockLive: (token: string, liveId: string) =>
    request<{ live: import('../../types').AdminLiveRow }>(
      `/access/admin/content/lives/${liveId}/block`,
      { method: 'POST' },
      token
    ),

  adminUnblockLive: (token: string, liveId: string) =>
    request<{ live: import('../../types').AdminLiveRow }>(
      `/access/admin/content/lives/${liveId}/unblock`,
      { method: 'POST' },
      token
    ),

  adminDeleteLive: (token: string, liveId: string) =>
    request<{ ok: boolean }>(`/access/admin/content/lives/${liveId}`, { method: 'DELETE' }, token),

  adminBlockEvent: (token: string, eventId: string) =>
    request<{ event: import('../../types').AdminEventRow }>(
      `/access/admin/content/events/${eventId}/block`,
      { method: 'POST' },
      token
    ),

  adminUnblockEvent: (token: string, eventId: string) =>
    request<{ event: import('../../types').AdminEventRow }>(
      `/access/admin/content/events/${eventId}/unblock`,
      { method: 'POST' },
      token
    ),

  adminDeleteEvent: (token: string, eventId: string) =>
    request<{ ok: boolean }>(`/access/admin/content/events/${eventId}`, { method: 'DELETE' }, token),

  getAdminReels: (
    token: string,
    opts: { filter?: import('../../types').AdminContentFilter; q?: string; limit?: number; offset?: number } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('filter', opts.filter ?? 'all');
    if (opts.q) params.set('q', opts.q);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    return request<import('../../types').AdminContentListResponse>(
      `/access/admin/content/reels?${params.toString()}`,
      {},
      token
    );
  },

  adminBlockReel: (token: string, reelId: string) =>
    request<{ reel: import('../../types').AdminReelRow }>(
      `/access/admin/content/reels/${reelId}/block`,
      { method: 'POST' },
      token
    ),

  adminUnblockReel: (token: string, reelId: string) =>
    request<{ reel: import('../../types').AdminReelRow }>(
      `/access/admin/content/reels/${reelId}/unblock`,
      { method: 'POST' },
      token
    ),

  adminDeleteReel: (token: string, reelId: string) =>
    request<{ ok: boolean }>(`/access/admin/content/reels/${reelId}`, { method: 'DELETE' }, token),

  adminGetReports: (token: string) =>
    request<{ reports: import('../../types').ContentReport[] }>('/admin/reports', {}, token),

  adminPatchReport: (token: string, id: string, status: 'reviewed' | 'dismissed') =>
    request<{ ok: boolean }>(`/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, token),

  adminDeleteReport: (token: string, id: string) =>
    request<{ ok: boolean }>(`/admin/reports/${id}`, { method: 'DELETE' }, token),

  getAnalyticsSummary: (
    token: string,
    options?: { period?: 'day' | 'week' | 'month' | 'year'; locale?: string }
  ) => {
    const params = new URLSearchParams();
    if (options?.period) params.set('period', options.period);
    if (options?.locale) params.set('locale', options.locale);
    const qs = params.toString();
    return request<{
      period: 'day' | 'week' | 'month' | 'year';
      snapshot: {
        totalUsers: number;
        dau24h: number;
        dau30d: number;
        newUsersToday: number;
        activeSalons: number;
        activeLives: number;
        totalMessages: number;
        totalReels: number;
        totalMatches: number;
        totalFeedPosts: number;
      };
      series: {
        labels: string[];
        logins: number[];
        messagesSent: number[];
        salonsCreated: number[];
        livesStarted: number[];
        reelsViewed: number[];
        matchesCreated: number[];
        favoritesAdded: number[];
      };
    }>(`/analytics/summary${qs ? `?${qs}` : ''}`, {}, token);
  },

  getCloudflareUsage: (token: string) =>
    request<import('../../types').CloudflareUsageReport>('/admin/cloudflare-usage', {}, token),

  getProdSaasStatus: (token: string) =>
    request<import('../../types').ProdSaasStatusReport>('/admin/prod-saas-status', {}, token),

  getDonationsSummary: (token: string) =>
    request<import('../../types').DonationsSummaryReport>('/admin/donations-summary', {}, token),

  getDonationsHistory: (
    token: string,
    opts: { limit?: number; offset?: number } = {}
  ) => {
    const params = new URLSearchParams();
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return request<import('../../types').AdminDonationsHistoryResponse>(
      `/admin/donations-history${qs ? `?${qs}` : ''}`,
      {},
      token
    );
  },

  getVpsMetrics: (token: string) =>
    request<import('../../types').VpsMetricsReport>('/admin/vps-metrics', {}, token),

  getVpsSyslog: (token: string, opts: { lines?: number; type?: 'pm2' | 'system' }) =>
    request<import('../../types').SyslogResponse>(
      `/admin/vps/syslog?lines=${opts.lines ?? 100}&type=${opts.type ?? 'pm2'}`,
      {},
      token,
    ),

  getAiAgentsStatus: (token: string) =>
    request<import('../../types').AiAgentsStatus>('/admin/ai-agents', {}, token),

  sendAiAgentChat: (
    token: string,
    agentId: 'ceo' | 'dev',
    messages: import('../../types').AiChatMessage[]
  ) =>
    request<import('../../types').AiChatResponse>(`/admin/ai-agents/${agentId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }, token),

  getAppDiagnosticLogs: (
    token: string,
    opts: {
      limit?: number;
      level?: import('../../types').AppDiagnosticLog['level'] | 'all';
      userId?: string;
      clientId?: string;
      since?: string;
      q?: string;
    } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('limit', String(opts.limit ?? 200));
    params.set('level', opts.level ?? 'all');
    if (opts.userId) params.set('userId', opts.userId);
    if (opts.clientId) params.set('clientId', opts.clientId);
    if (opts.since) params.set('since', opts.since);
    if (opts.q) params.set('q', opts.q);
    return request<import('../../types').AppDiagnosticLogsResponse>(
      `/admin/diagnostic-logs?${params.toString()}`,
      {},
      token
    );
  },

  // ── WebAuthn / Passkeys (Face ID, Touch ID, empreinte Android, Windows Hello) ──
} as const;
