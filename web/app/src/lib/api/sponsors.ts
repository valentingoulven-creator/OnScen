import { request } from './core';

export const sponsorsApi = {
  getAdminSponsors: (
    token: string,
    opts: {
      filter?: import('../../types').SponsorFilter;
      placement?: import('../../types').SponsorPlacement;
      q?: string;
    } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('filter', opts.filter ?? 'all');
    if (opts.placement) params.set('placement', opts.placement);
    if (opts.q) params.set('q', opts.q);
    return request<import('../../types').AdminSponsorsListResponse>(
      `/access/admin/sponsors?${params.toString()}`,
      {},
      token
    );
  },

  createAdminSponsor: (token: string, body: Partial<import('../../types').Sponsor>) =>
    request<{ sponsor: import('../../types').Sponsor }>(
      '/access/admin/sponsors',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  updateAdminSponsor: (token: string, sponsorId: string, body: Partial<import('../../types').Sponsor>) =>
    request<{ sponsor: import('../../types').Sponsor }>(
      `/access/admin/sponsors/${sponsorId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
      token
    ),

  toggleAdminSponsor: (token: string, sponsorId: string) =>
    request<{ sponsor: import('../../types').Sponsor }>(
      `/access/admin/sponsors/${sponsorId}/toggle`,
      { method: 'POST' },
      token
    ),

  reorderAdminSponsors: (token: string, ids: string[]) =>
    request<{ items: import('../../types').Sponsor[] }>(
      '/access/admin/sponsors/reorder',
      { method: 'POST', body: JSON.stringify({ ids }) },
      token
    ),

  deleteAdminSponsor: (token: string, sponsorId: string) =>
    request<{ ok: boolean }>(`/access/admin/sponsors/${sponsorId}`, { method: 'DELETE' }, token),

  uploadAdminSponsorLogo: (token: string | null, image: string) =>
    request<{ url: string }>(
      '/access/admin/sponsors/upload-logo',
      { method: 'POST', body: JSON.stringify({ image }) },
      token
    ),

  uploadAdminSponsorBanner: (token: string | null, image: string) =>
    request<{ url: string }>(
      '/access/admin/sponsors/upload-banner',
      { method: 'POST', body: JSON.stringify({ image }) },
      token
    ),

  getMapSponsors: (query?: {
    lat?: number;
    lng?: number;
    zoom?: number;
    north?: number;
    south?: number;
    east?: number;
    west?: number;
  }) => {
    const params = new URLSearchParams();
    if (query?.lat != null && Number.isFinite(query.lat)) params.set('lat', String(query.lat));
    if (query?.lng != null && Number.isFinite(query.lng)) params.set('lng', String(query.lng));
    if (query?.zoom != null && Number.isFinite(query.zoom)) params.set('zoom', String(query.zoom));
    if (query?.north != null && Number.isFinite(query.north)) params.set('north', String(query.north));
    if (query?.south != null && Number.isFinite(query.south)) params.set('south', String(query.south));
    if (query?.east != null && Number.isFinite(query.east)) params.set('east', String(query.east));
    if (query?.west != null && Number.isFinite(query.west)) params.set('west', String(query.west));
    const qs = params.toString();
    return request<{ items: import('../../types').MapAdItem[] }>(
      `/sponsors/map${qs ? `?${qs}` : ''}`,
      { cache: 'no-store' }
    );
  },

  getFeedSponsors: () =>
    request<{ items: import('../../types').MapAdItem[] }>('/sponsors/feed', { cache: 'no-store' }),

  getStoriesSponsors: () =>
    request<{ items: import('../../types').MapAdItem[] }>('/sponsors/stories', { cache: 'no-store' }),

  getReelsSponsors: () =>
    request<import('../../types').ReelsSponsorsResponse>('/sponsors/reels', { cache: 'no-store' }),

  getStoriesViewerSponsors: () =>
    request<import('../../types').StoriesSponsorsResponse>('/sponsors/stories-viewer', { cache: 'no-store' }),

  getSalonSponsors: () =>
    request<{ items: import('../../types').MapAdItem[] }>('/sponsors/salon', { cache: 'no-store' }),

  getMapSidebarEventSponsors: (token: string) =>
    request<{ posts: import('../../types').FeedPost[] }>(
      '/sponsors/map-sidebar-events',
      { cache: 'no-store' },
      token
    ),

  getDevMapSidebarEventSponsorIds: (token: string) =>
    request<{ postIds: string[] }>('/access/dev/map-sidebar-event-sponsors', { cache: 'no-store' }, token),

  getDevMapSidebarEventSponsor: (token: string, postId: string) =>
    request<{ sponsor: import('../../types').Sponsor | null }>(
      `/access/dev/map-sidebar-event-sponsor/${encodeURIComponent(postId)}`,
      { cache: 'no-store' },
      token
    ),

  getDevReelsSponsor: (token: string, reelId: string) =>
    request<{ sponsor: import('../../types').Sponsor | null }>(
      `/access/dev/reels-sponsor/${encodeURIComponent(reelId)}`,
      { cache: 'no-store' },
      token
    ),

  setDevMapSidebarEventSponsor: (token: string, postId: string, sponsored: boolean) =>
    request<{ sponsor: import('../../types').Sponsor | null; sponsored: boolean }>(
      '/access/dev/map-sidebar-event-sponsor',
      { method: 'POST', body: JSON.stringify({ postId, sponsored }) },
      token
    ),

  getAdminSponsorsConfig: (token: string) =>
    request<{ config: import('../../types').SponsorPlatformConfig }>(
      '/access/admin/sponsors/config',
      {},
      token
    ),

  patchAdminSponsorsConfig: (
    token: string,
    body: Partial<import('../../types').SponsorPlatformConfig>
  ) =>
    request<{ config: import('../../types').SponsorPlatformConfig }>(
      '/access/admin/sponsors/config',
      { method: 'PATCH', body: JSON.stringify(body) },
      token
    ),

  estimateAdminSponsorAudience: (
    token: string,
    body: {
      placement?: import('../../types').SponsorPlacement;
      mapVisibilityScope?: import('../../types').SponsorMapVisibilityScope;
      mapTargetLat?: number | null;
      mapTargetLng?: number | null;
    }
  ) =>
    request<{ estimate: import('../../types').SponsorAudienceEstimate }>(
      '/access/admin/sponsors/estimate-audience',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),
} as const;
