/**
 * Cloudflare Stream usage & cost estimation for admin dashboard.
 * Uses GraphQL Analytics (minutes viewed) + REST (live inputs, stored videos).
 */

import { isCloudflareStreamConfigured } from './cloudflareStream';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const CF_GRAPHQL_URL = `${CF_API_BASE}/graphql`;

/** Published Cloudflare Stream rates (USD). */
export const CF_STREAM_DELIVERY_USD_PER_1000_MIN = 1;
export const CF_STREAM_STORAGE_USD_PER_1000_MIN = 5;

export interface CloudflareUsageReport {
  configured: boolean;
  fetchedAt: string;
  periodStart: string;
  periodEnd: string;
  minutesDelivered: number;
  minutesDeliveredSource: 'graphql' | 'unavailable';
  storageMinutes: number;
  storageMinutesSource: 'videos_api' | 'unavailable';
  liveInputsTotal: number;
  liveInputsActive: number;
  estimatedCostUsd: {
    delivery: number;
    storage: number;
    total: number;
  };
  estimatedCostEur: {
    delivery: number;
    storage: number;
    total: number;
  };
  usdToEurRate: number;
  warnings: string[];
}

interface CfApiResponse<T> {
  success: boolean;
  errors?: { message: string }[];
  result?: T;
  result_info?: { page: number; per_page: number; total_count: number };
}

interface CfLiveInputListItem {
  uid: string;
  enabled?: boolean;
  status?: { current?: { state?: string } };
}

interface CfVideoItem {
  uid: string;
  duration?: number;
  status?: { state?: string };
}

function getAccountId(): string {
  return (process.env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
}

function getApiToken(): string {
  return (
    process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim() ||
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    ''
  );
}

function getUsdToEurRate(): number {
  const raw = process.env.CLOUDFLARE_USD_EUR_RATE?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.92;
}

function monthBounds(): { start: string; end: string; endExclusive: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const end = new Date(endExclusive.getTime() - 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end), endExclusive: fmt(endExclusive) };
}

async function cfRestPaginated<T>(pathBuilder: (page: number) => string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  const perPage = 100;
  for (;;) {
    const json = (await fetch(`${CF_API_BASE}${pathBuilder(page)}`, {
      headers: { Authorization: `Bearer ${getApiToken()}` },
    }).then((r) => r.json())) as CfApiResponse<T[]>;
    if (!json.success) {
      const msg =
        json.errors?.map((e) => e.message).join('; ') || 'Cloudflare API pagination error';
      throw new Error(msg);
    }
    const batch = json.result ?? [];
    items.push(...batch);
    const total = json.result_info?.total_count ?? items.length;
    if (items.length >= total || batch.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }
  return items;
}

async function fetchMinutesDeliveredGraphQL(
  start: string,
  endExclusive: string
): Promise<number | null> {
  const accountId = getAccountId();
  const token = getApiToken();
  const query = `
    query StreamMinutesViewed($accountTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          streamMinutesViewedAdaptiveGroups(
            filter: { date_geq: $start, date_lt: $end }
            limit: 10000
          ) {
            sum { minutesViewed }
          }
        }
      }
    }
  `;

  const res = await fetch(CF_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { accountTag: accountId, start, end: endExclusive },
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    data?: {
      viewer?: {
        accounts?: {
          streamMinutesViewedAdaptiveGroups?: { sum?: { minutesViewed?: number } }[];
        }[];
      };
    };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }

  const groups = json.data?.viewer?.accounts?.[0]?.streamMinutesViewedAdaptiveGroups ?? [];
  return groups.reduce((acc, g) => acc + (g.sum?.minutesViewed ?? 0), 0);
}

async function fetchLiveInputs(): Promise<{ total: number; active: number }> {
  const accountId = getAccountId();
  const inputs = await cfRestPaginated<CfLiveInputListItem>(
    (page) => `/accounts/${accountId}/stream/live_inputs?page=${page}&per_page=100`
  );
  const active = inputs.filter((i) => i.status?.current?.state === 'connected').length;
  return { total: inputs.length, active };
}

async function fetchStorageMinutes(): Promise<number> {
  const accountId = getAccountId();
  const videos = await cfRestPaginated<CfVideoItem>(
    (page) => `/accounts/${accountId}/stream?page=${page}&per_page=100`
  );
  const ready = videos.filter((v) => v.status?.state !== 'error');
  const totalSeconds = ready.reduce((acc, v) => acc + (v.duration ?? 0), 0);
  return Math.round((totalSeconds / 60) * 100) / 100;
}

function estimateCosts(minutesDelivered: number, storageMinutes: number, usdToEur: number) {
  const deliveryUsd =
    Math.round(((minutesDelivered / 1000) * CF_STREAM_DELIVERY_USD_PER_1000_MIN) * 100) / 100;
  const storageUsd =
    Math.round(((storageMinutes / 1000) * CF_STREAM_STORAGE_USD_PER_1000_MIN) * 100) / 100;
  const totalUsd = Math.round((deliveryUsd + storageUsd) * 100) / 100;
  const toEur = (usd: number) => Math.round(usd * usdToEur * 100) / 100;
  return {
    estimatedCostUsd: { delivery: deliveryUsd, storage: storageUsd, total: totalUsd },
    estimatedCostEur: {
      delivery: toEur(deliveryUsd),
      storage: toEur(storageUsd),
      total: toEur(totalUsd),
    },
  };
}

export async function getCloudflareUsageReport(): Promise<CloudflareUsageReport> {
  const { start, end, endExclusive } = monthBounds();
  const usdToEurRate = getUsdToEurRate();
  const warnings: string[] = [];

  if (!isCloudflareStreamConfigured()) {
    return {
      configured: false,
      fetchedAt: new Date().toISOString(),
      periodStart: start,
      periodEnd: end,
      minutesDelivered: 0,
      minutesDeliveredSource: 'unavailable',
      storageMinutes: 0,
      storageMinutesSource: 'unavailable',
      liveInputsTotal: 0,
      liveInputsActive: 0,
      estimatedCostUsd: { delivery: 0, storage: 0, total: 0 },
      estimatedCostEur: { delivery: 0, storage: 0, total: 0 },
      usdToEurRate,
      warnings: ['Cloudflare Stream non configuré (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_STREAM_API_TOKEN).'],
    };
  }

  let minutesDelivered = 0;
  let minutesDeliveredSource: CloudflareUsageReport['minutesDeliveredSource'] = 'unavailable';
  try {
    const minutes = await fetchMinutesDeliveredGraphQL(start, endExclusive);
    if (minutes != null) {
      minutesDelivered = minutes;
      minutesDeliveredSource = 'graphql';
    }
  } catch (e) {
    warnings.push(
      `Analytics GraphQL indisponible : ${e instanceof Error ? e.message : String(e)}. Ajoutez la permission Account Analytics au token API.`
    );
  }

  let storageMinutes = 0;
  let storageMinutesSource: CloudflareUsageReport['storageMinutesSource'] = 'unavailable';
  try {
    storageMinutes = await fetchStorageMinutes();
    storageMinutesSource = 'videos_api';
  } catch (e) {
    warnings.push(
      `Stockage Stream indisponible : ${e instanceof Error ? e.message : String(e)}`
    );
  }

  let liveInputsTotal = 0;
  let liveInputsActive = 0;
  try {
    const live = await fetchLiveInputs();
    liveInputsTotal = live.total;
    liveInputsActive = live.active;
  } catch (e) {
    warnings.push(
      `Live inputs indisponibles : ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const costs = estimateCosts(minutesDelivered, storageMinutes, usdToEurRate);

  if (minutesDeliveredSource === 'graphql') {
    warnings.push(
      'Coûts estimés à partir des tarifs publiés ($1/1000 min livrées, $5/1000 min stockées).'
    );
  }

  return {
    configured: true,
    fetchedAt: new Date().toISOString(),
    periodStart: start,
    periodEnd: end,
    minutesDelivered,
    minutesDeliveredSource,
    storageMinutes,
    storageMinutesSource,
    liveInputsTotal,
    liveInputsActive,
    ...costs,
    usdToEurRate,
    warnings,
  };
}
