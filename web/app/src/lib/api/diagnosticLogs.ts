import { request } from './core';

export const diagnosticLogsApi = {
  postLogs: (
    entries: Array<{
      id: string;
      createdAt: string;
      level: string;
      source: string;
      message: string;
      stack?: string;
      context?: Record<string, unknown>;
      userId?: string;
      username?: string;
      url?: string;
      clientId: string;
    }>,
    token?: string | null
  ) =>
    request<{ ok: boolean; stored: number; persisted: boolean }>(
      '/diagnostic-logs',
      { method: 'POST', body: JSON.stringify({ entries }) },
      token
    ),
};
