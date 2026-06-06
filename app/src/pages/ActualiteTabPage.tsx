import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { applyFeedPreferences } from '../lib/feedFilter';
import {
  HOME_FEED_DISPLAY_PREFS,
  NEWS_PREFS_CHANGED_EVENT,
  newsPrefsFiltersActive,
  readNewsUserPrefs,
  writeNewsUserPrefs,
  type NewsUserPrefs,
} from '../lib/feedUserPrefs';
import { applyNewsPreferences } from '../lib/newsFilter';
import { UsernameDisplay } from '../components/UsernameDisplay';
import { FilterIcon } from '../components/FilterIcon';
import { NewsFiltersPanel } from '../components/NewsFiltersPanel';
import { PhotoImageEditor } from '../components/PhotoImageEditor';
import {
  clipboardItemsToImageFile,
  dataUrlToFeedImageDataUrl,
} from '../lib/feedImagePaste';
import { ACCEPTED_IMAGE_FORMATS, validateImageFile } from '../lib/imageConstraints';
import { buildMapStoryEntries, buildViewableStories, type MapStoryEntry } from '../lib/mapStoriesFeed';
import {
  getNearbyPanelPreferences,
  NEARBY_PANEL_CHANGED_EVENT,
  setNearbyPanelPreferences,
  setNearbyPanelRadiusKm,
  type NearbyPanelPreferences,
} from '../lib/nearbyPanelSettings';
import {
  clampNearbyRadiusKm,
  getNearbyRadiusKm,
  NEARBY_RADIUS_MAX,
  NEARBY_RADIUS_MIN,
  SETTINGS_CHANGED_EVENT,
} from '../lib/settings';
import {
  getLivesGeo,
  MAP_GEO_CHANGED_EVENT,
  setLivesGeoRadiusKm,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import {
  isMapStoriesCollapsed,
  isMapStoriesHidden,
  setMapStoriesCollapsed,
  setMapStoriesHidden,
} from '../lib/mapStoriesPrefs';
import { normalizeProfileReelFromApi } from '../content/reelsFeed';
import type { MusicReel } from '../content/reels';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';
import type { CommentAlign, FeedPost, FeedPostComment, MapStory, MusicNewsItem, NearbyPerson } from '../types';
import { MapStorySheet } from '../components/MapStorySheet';
import { MapStoryRing, MyMapStoryRing } from '../components/MapStoryRings';
import { ShareLinkMenu } from '../components/ShareLinkMenu';

interface ActualiteTabPageProps {
  onOpenProfile: (userId: string) => void;
  onOpenReel?: (reelId: string) => void;
  onOpenLive?: (liveId: string) => void;
  isActive: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatWhen(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "À l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Il y a ${d} j`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function badgeStyle(badge?: string): string {
  if (!badge) return 'bg-gray-800/80 text-gray-400 border-gray-700/60';
  const b = badge.toLowerCase();
  if (b.includes('une')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  if (b.includes('festival')) return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
  if (b.includes('concert')) return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  if (b.includes('album') || b.includes('nouveau')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (b.includes('promo')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
}

function promoBorderColor(badge?: string): string {
  if (!badge) return 'border-l-[#2d2d3d]';
  const b = badge.toLowerCase();
  if (b.includes('festival')) return 'border-l-purple-500/60';
  if (b.includes('concert')) return 'border-l-rose-500/60';
  if (b.includes('album') || b.includes('nouveau')) return 'border-l-emerald-500/60';
  if (b.includes('promo')) return 'border-l-blue-500/60';
  return 'border-l-amber-500/60';
}

function genreGradient(genres?: string[]): string {
  const g = (genres?.[0] ?? '').toLowerCase();
  if (g.includes('r&b') || g.includes('pop')) return 'from-purple-900 to-pink-900';
  if (g.includes('rock') || g.includes('indie')) return 'from-rose-900 to-orange-900';
  if (g.includes('hip-hop') || g.includes('rap')) return 'from-amber-900 to-yellow-900';
  if (g.includes('electro') || g.includes('electronic')) return 'from-cyan-900 to-blue-900';
  if (g.includes('festival') || g.includes('concert') || g.includes('streaming')) return 'from-emerald-900 to-teal-900';
  return 'from-violet-900 to-purple-900';
}

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 15-5-5L5 21" />
    </svg>
  );
}


// ─── Post interaction icons ───────────────────────────────────────────────────

function HeartIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ReshareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 23l-4-4 4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

function BookmarkIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ─── Comment alignment helpers ────────────────────────────────────────────────

function AlignLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
      <line x1="3" y1="12" x2="15" y2="12" strokeLinecap="round" />
      <line x1="3" y1="18" x2="18" y2="18" strokeLinecap="round" />
    </svg>
  );
}

function AlignCenterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
      <line x1="6" y1="12" x2="18" y2="12" strokeLinecap="round" />
      <line x1="4" y1="18" x2="20" y2="18" strokeLinecap="round" />
    </svg>
  );
}

function AlignRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
      <line x1="9" y1="12" x2="21" y2="12" strokeLinecap="round" />
      <line x1="6" y1="18" x2="21" y2="18" strokeLinecap="round" />
    </svg>
  );
}

function AlignJustifyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
      <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
      <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
    </svg>
  );
}

const ALIGN_OPTIONS: { value: CommentAlign; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { value: 'left',   label: 'Aligner à gauche', Icon: AlignLeftIcon    },
  { value: 'center', label: 'Centrer',           Icon: AlignCenterIcon  },
  { value: 'right',  label: 'Aligner à droite',  Icon: AlignRightIcon   },
  { value: 'full',   label: 'Pleine largeur',    Icon: AlignJustifyIcon },
];

function commentRowClass(align?: CommentAlign): string {
  if (align === 'right')  return 'flex-row-reverse';
  if (align === 'center') return 'justify-center';
  return '';
}

function commentBubbleClass(align?: CommentAlign): string {
  if (align === 'right')  return 'text-right';
  if (align === 'center') return 'text-center';
  if (align === 'full')   return 'w-full text-justify';
  return 'text-left';
}

// ─── News card components ──────────────────────────────────────────────────────

function FeaturedCard({ item }: { item: MusicNewsItem }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <article className="rounded-xl overflow-hidden border border-[#2a2a3d] bg-[#12121a] shadow-lg">
      <div className={`relative w-full h-44 bg-gradient-to-br ${genreGradient(item.genres)}`}>
        {item.imageUrl && imgOk && (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {item.badge && (
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mb-1.5 ${badgeStyle(item.badge)}`}>
              {item.badge}
            </span>
          )}
          <h2 className="text-sm font-bold text-white leading-snug line-clamp-2">{item.title}</h2>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{item.excerpt}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {item.source && (
              <span className="text-[10px] text-gray-500 truncate">{item.source}</span>
            )}
            <span className="text-[10px] text-gray-600">·</span>
            <span className="text-[10px] text-gray-600 shrink-0">{formatWhen(item.publishedAt)}</span>
          </div>
          <a
            href={item.url ?? '#'}
            className="shrink-0 text-[10px] font-semibold text-purple-400 hover:text-purple-300 transition"
          >
            Lire plus →
          </a>
        </div>
      </div>
    </article>
  );
}

function NewsCard({ item }: { item: MusicNewsItem }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <article className="flex gap-3 rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3">
      <div className={`shrink-0 w-[88px] h-[88px] rounded-lg overflow-hidden bg-gradient-to-br ${genreGradient(item.genres)}`}>
        {item.imageUrl && imgOk && (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-between gap-1">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.source && (
              <span className="text-[9px] font-semibold text-purple-400 uppercase tracking-wide">{item.source}</span>
            )}
            <span className="text-[9px] text-gray-600">{formatWhen(item.publishedAt)}</span>
          </div>
          <p className="text-[12px] font-semibold text-white leading-snug line-clamp-2">{item.title}</p>
          <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{item.excerpt}</p>
        </div>
        <a
          href={item.url ?? '#'}
          className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 transition w-fit"
        >
          Lire plus →
        </a>
      </div>
    </article>
  );
}

function PromoCard({ item }: { item: MusicNewsItem }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <article className={`rounded-xl border border-[#1e1e2f] border-l-4 ${promoBorderColor(item.badge)} bg-[#12121a] p-3`}>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.badge && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle(item.badge)}`}>
                {item.badge}
              </span>
            )}
            {item.source && (
              <span className="text-[9px] text-gray-600">{item.source}</span>
            )}
            <span className="text-[9px] text-gray-600">{formatWhen(item.publishedAt)}</span>
          </div>
          <p className="text-[12px] font-bold text-white leading-snug">{item.title}</p>
          <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{item.excerpt}</p>
          <a
            href={item.url ?? '#'}
            className="inline-block text-[10px] font-semibold text-purple-400 hover:text-purple-300 transition"
          >
            Voir l'annonce →
          </a>
        </div>
        {item.imageUrl && imgOk && (
          <div className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br ${genreGradient(item.genres)}`}>
            <img
              src={item.imageUrl}
              alt=""
              onError={() => setImgOk(false)}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </article>
  );
}

function TrendingArtistCard({ item }: { item: MusicNewsItem }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="flex flex-col items-center gap-1.5 w-20 shrink-0">
      <div className={`relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br ${genreGradient(item.genres)} border-2 border-[#2a2a3d]`}>
        {item.imageUrl && imgOk && (
          <img
            src={item.imageUrl}
            alt=""
            onError={() => setImgOk(false)}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute top-0 left-0 bg-black/50 rounded-br-lg px-1 py-0.5 text-[10px] font-bold text-white leading-none">
          {item.trendingRank && item.trendingRank <= 3 ? rankMedal(item.trendingRank) : `#${item.trendingRank ?? ''}`}
        </div>
      </div>
      <p className="text-[10px] font-semibold text-white text-center leading-tight line-clamp-1 w-full">{item.artist ?? item.title}</p>
      <p className="text-[9px] text-gray-500 text-center leading-tight">{item.excerpt}</p>
    </div>
  );
}

function SectionHeader({ label, emoji }: { label: string; emoji: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-base leading-none">{emoji}</span>
      <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">{label}</h3>
    </div>
  );
}

// ─── Stories inline bar ───────────────────────────────────────────────────────

type StorySheetState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'view'; story: MapStory; isOwn: boolean };

function StoriesInlineBar({
  onOpenProfile,
  onOpenReel,
  onOpenLive,
  isActive,
}: {
  onOpenProfile: (userId: string) => void;
  onOpenReel?: (reelId: string) => void;
  onOpenLive?: (liveId: string) => void;
  isActive: boolean;
}) {
  const { token, user } = useAuth();
  const [entries, setEntries] = useState<MapStoryEntry[]>([]);
  const [myStory, setMyStory] = useState<MapStory | null>(null);
  const [storiesByUser, setStoriesByUser] = useState<Map<string, MapStory>>(new Map());
  const [sheet, setSheet] = useState<StorySheetState>({ kind: 'closed' });
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(isMapStoriesHidden);
  const [collapsed, setCollapsed] = useState(isMapStoriesCollapsed);
  const [filterOpen, setFilterOpen] = useState(false);
  const [prefs, setPrefs] = useState<NearbyPanelPreferences>(() => getNearbyPanelPreferences());
  const [mapGeo, setMapGeo] = useState<LivesGeoPrefs>(() => getLivesGeo());
  const [radiusKm, setRadiusKm] = useState(() => getNearbyRadiusKm());

  const updatePrefs = useCallback(
    (patch: Partial<Pick<NearbyPanelPreferences, 'favoritesFirst' | 'filterByDistance'>>) => {
      setPrefs(setNearbyPanelPreferences(patch));
    },
    []
  );

  const applyRadius = (km: number) => {
    const clamped = clampNearbyRadiusKm(km);
    const v = setNearbyPanelRadiusKm(clamped);
    setRadiusKm(v);
    setLivesGeoRadiusKm(v);
  };

  useEffect(() => {
    const syncPrefs = () => setPrefs(getNearbyPanelPreferences());
    const syncGeo = () => setMapGeo(getLivesGeo());
    const syncRadius = () => setRadiusKm(getNearbyRadiusKm());
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, syncRadius);
    window.addEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    window.addEventListener(SETTINGS_CHANGED_EVENT, syncRadius);
    return () => {
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, syncRadius);
      window.removeEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, syncRadius);
    };
  }, []);

  const filterActive = prefs.favoritesFirst || prefs.filterByDistance;

  const countLabel = useMemo(() => {
    if (loading) return '…';
    return String(entries.length + (user && token ? 1 : 0));
  }, [entries.length, loading, token, user]);

  const loadStories = useCallback(async () => {
    if (!token) {
      setEntries([]);
      setMyStory(null);
      setStoriesByUser(new Map());
      return;
    }
    setLoading(true);
    try {
      const storyRadius = prefs.filterByDistance ? radiusKm : undefined;
      // Fetch favorites, reels, lives and ephemeral stories in parallel.
      const [favRes, feedRes, livesOrNull, storiesRes, mineRes] = await Promise.all([
        api.getMyFavorites(token),
        api.getReelsFeed(token),
        api.getLives(token, { distanceFilter: false }).catch(() => null),
        api.getStories(token, {
          latitude: mapGeo.latitude,
          longitude: mapGeo.longitude,
          radius: storyRadius,
        }),
        api.getMyStory(token),
      ]);
      const favoriteIds = new Set(favRes.favorites.map((f) => f.id));

      // Build a username+avatar lookup: start with favorites (have full User objects).
      const userInfoById = new Map<string, { username: string; avatarUrl?: string }>(
        favRes.favorites.map((f) => [f.id, { username: f.username, avatarUrl: f.avatarUrl }])
      );

      // Raw reel objects from the API may carry authorUsername/authorAvatarUrl as extra
      // server fields even though the MusicReel TS type doesn't declare them.
      type RawReel = MusicReel & { authorUsername?: string; authorAvatarUrl?: string };
      const rawReels = feedRes.reels as RawReel[];
      for (const raw of rawReels) {
        const aid = raw.authorId?.trim();
        if (aid && !userInfoById.has(aid) && raw.authorUsername) {
          userInfoById.set(aid, { username: raw.authorUsername, avatarUrl: raw.authorAvatarUrl });
        }
      }

      const reels = rawReels
        .map((r) => normalizeProfileReelFromApi(r as Parameters<typeof normalizeProfileReelFromApi>[0]))
        .filter((r): r is MusicReel => r != null);

      // Synthetic NearbyPerson list: live hosts first, then reel authors whose display
      // info we know. This lets buildMapStoryEntries populate stories without requiring
      // the user to be on the Map tab (which is the only place that calls api.nearby()).
      const syntheticIds = new Set<string>();
      const syntheticPeople: NearbyPerson[] = [];

      for (const live of livesOrNull?.lives ?? []) {
        if (!live.isActive) continue;
        syntheticIds.add(live.hostId);
        syntheticPeople.push({
          id: live.hostId,
          username: live.hostName,
          isLive: true,
          liveId: live.id,
          liveViewersCount: live.viewersCount,
        });
      }

      for (const reel of reels) {
        const aid = reel.authorId?.trim();
        if (!aid || syntheticIds.has(aid)) continue;
        const info = userInfoById.get(aid);
        if (!info) continue;
        syntheticIds.add(aid);
        syntheticPeople.push({ id: aid, username: info.username, avatarUrl: info.avatarUrl });
      }

      const ephemeral = storiesRes.stories ?? [];
      const byUser = new Map<string, MapStory>();
      for (const s of ephemeral) {
        const prev = byUser.get(s.userId);
        if (!prev || s.createdAt > prev.createdAt) byUser.set(s.userId, s);
      }
      setStoriesByUser(byUser);
      setMyStory(mineRes.story);

      const filteredPeople = syntheticPeople.filter((p) => p.id !== user?.id);
      setEntries(
        buildMapStoryEntries(filteredPeople, favRes.favorites, reels, {
          favoritesFirst: prefs.favoritesFirst,
          favoriteIds,
          ephemeralStories: ephemeral,
        }).filter((e) => e.userId !== user?.id)
      );
    } catch {
      setEntries([]);
      setMyStory(null);
      setStoriesByUser(new Map());
    } finally {
      setLoading(false);
    }
  }, [token, prefs.favoritesFirst, prefs.filterByDistance, radiusKm, mapGeo.latitude, mapGeo.longitude, user?.id]);

  useEffect(() => {
    if (!isActive) return;
    void loadStories();
  }, [isActive, loadStories]);

  const openEntry = (entry: MapStoryEntry) => {
    if (entry.hasActiveStory && entry.storyId) {
      const story = storiesByUser.get(entry.userId);
      if (story) {
        setSheet({ kind: 'view', story, isOwn: entry.userId === user?.id });
        return;
      }
    }
    if (entry.isLive && entry.liveId && onOpenLive) {
      onOpenLive(entry.liveId);
      return;
    }
    if (entry.reelId && onOpenReel) {
      onOpenReel(entry.reelId);
      return;
    }
    onOpenProfile(entry.userId);
  };

  const openMyStory = () => {
    if (myStory) {
      setSheet({ kind: 'view', story: myStory, isOwn: true });
    } else {
      setSheet({ kind: 'create' });
    }
  };

  const handlePublished = (story: MapStory) => {
    setMyStory(story);
    setStoriesByUser((prev) => new Map(prev).set(story.userId, story));
    void loadStories();
  };

  const showEmpty = !loading && entries.length === 0 && !user;

  const viewableStories = useMemo(
    () => buildViewableStories(entries, storiesByUser, myStory),
    [entries, storiesByUser, myStory]
  );

  const navigateStory = useCallback(
    (delta: 1 | -1) => {
      if (sheet.kind !== 'view') return;
      const idx = viewableStories.findIndex((s) => s.id === sheet.story.id);
      if (idx < 0) return;
      const next = viewableStories[idx + delta];
      if (!next) return;
      setSheet({ kind: 'view', story: next, isOwn: next.userId === user?.id });
    },
    [sheet, viewableStories, user?.id]
  );

  const currentStoryIndex =
    sheet.kind === 'view' ? viewableStories.findIndex((s) => s.id === sheet.story.id) : -1;

  return (
    <>
    <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a] overflow-hidden">
      {hidden ? (
        <div className="flex justify-center px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setHidden(false);
              setMapStoriesHidden(false);
            }}
            className="px-3 py-1 rounded-full bg-[#12121a]/95 border border-[#2d2d3d] text-[10px] font-semibold text-purple-300 hover:border-purple-500/50 shadow-lg"
          >
            Afficher les stories
          </button>
        </div>
      ) : (
        <div className="w-full overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#2d2d3d]/80">
              <button
                type="button"
                onClick={() => {
                  const next = !collapsed;
                  setCollapsed(next);
                  setMapStoriesCollapsed(next);
                }}
                className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                aria-expanded={!collapsed}
              >
                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${USERNAME_WAVE_CLASS}`}>
                  Stories
                </span>
                <span className="text-[9px] text-gray-500">({countLabel})</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition ${collapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                title="Filtrer les stories (favoris et distance)"
                aria-label="Filtrer les stories par favoris et distance"
                aria-expanded={filterOpen}
                className={`p-1 rounded-lg shrink-0 transition ${
                  filterOpen || filterActive
                    ? 'text-purple-300 bg-purple-900/30 hover:bg-purple-900/40'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a26]'
                }`}
              >
                <FilterIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setHidden(true);
                  setMapStoriesHidden(true);
                }}
                title="Masquer les stories"
                aria-label="Masquer les stories"
                className="p-1 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-[#1a1a26]"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l18 18M10.5 10.7a3 3 0 0 0 4.2 4.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {filterOpen && (
              <div className="px-2.5 pb-2.5 pt-0 border-b border-[#2d2d3d]/80 space-y-2 max-h-[min(52vh,20rem)] overflow-y-auto overscroll-contain">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-[10px] text-gray-300">Favoris en premier</span>
                  <input
                    type="checkbox"
                    checked={prefs.favoritesFirst}
                    onChange={(e) => updatePrefs({ favoritesFirst: e.target.checked })}
                    className="melosong-checkbox scale-90"
                    aria-label="Afficher les favoris en premier dans les stories"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-[10px] text-gray-300">Filtrer par distance</span>
                  <input
                    type="checkbox"
                    checked={prefs.filterByDistance}
                    onChange={(e) => updatePrefs({ filterByDistance: e.target.checked })}
                    className="melosong-checkbox scale-90"
                    aria-label="Filtrer les stories par distance"
                  />
                </label>

                {prefs.filterByDistance && (
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-gray-400">Rayon</span>
                      <span className="text-purple-400 font-bold">{radiusKm} km</span>
                    </div>
                    <input
                      type="range"
                      min={NEARBY_RADIUS_MIN}
                      max={NEARBY_RADIUS_MAX}
                      step={1}
                      value={radiusKm}
                      onChange={(e) => applyRadius(Number(e.target.value))}
                      className="w-full accent-purple-500 h-1.5"
                      aria-label="Rayon en kilomètres pour les stories"
                    />
                    <p className="text-[9px] text-gray-600 mt-1">
                      Stories des personnes dans ~{radiusKm} km autour de {mapGeo.label}.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!collapsed && (
              <div className="px-2 py-2">
                {loading && entries.length === 0 && !user ? (
                  <p className="text-[10px] text-gray-500 text-center py-2">Chargement des stories…</p>
                ) : showEmpty ? (
                  <p className="text-[10px] text-gray-500 text-center py-2 leading-snug">
                    Aucune story pour le moment.
                  </p>
                ) : (
                  <div className="stories-rings-carousel flex gap-2 pb-0.5 snap-x snap-mandatory -mx-0.5 px-0.5">
                    {user && token ? (
                      <MyMapStoryRing
                        userId={user.id}
                        username={user.username}
                        avatarUrl={user.avatarUrl}
                        hasActiveStory={!!myStory}
                        storyImageUrl={myStory?.imageUrl}
                        onClick={openMyStory}
                      />
                    ) : null}
                    {entries.map((entry) => (
                      <MapStoryRing key={entry.userId} entry={entry} onClick={() => openEntry(entry)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
    </div>

    {token && sheet.kind === 'create' ? (
      <MapStorySheet
        token={token}
        mode="create"
        onClose={() => setSheet({ kind: 'closed' })}
        onPublished={handlePublished}
      />
    ) : null}

    {token && sheet.kind === 'view' ? (
      <MapStorySheet
        token={token}
        mode="view"
        story={sheet.story}
        isOwn={sheet.isOwn}
        onClose={() => setSheet({ kind: 'closed' })}
        onPublished={handlePublished}
        onRequestCreate={sheet.isOwn ? () => setSheet({ kind: 'create' }) : undefined}
        onSwipeNext={
          currentStoryIndex >= 0 && currentStoryIndex < viewableStories.length - 1
            ? () => navigateStory(1)
            : undefined
        }
        onSwipePrev={currentStoryIndex > 0 ? () => navigateStory(-1) : undefined}
      />
    ) : null}
    </>
  );
}

// ─── Pull-to-refresh container ────────────────────────────────────────────────

function PullToRefreshContainer({
  onRefresh,
  refreshing,
  className,
  children,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [pullY, setPullY] = useState(0);
  const isPulling = useRef(false);
  const startY = useRef(0);
  const pullYRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const onRefreshRef = useRef(onRefresh);
  const THRESHOLD = 64;

  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 2) return;
      startY.current = e.touches[0].clientY;
      pullYRef.current = 0;
      isPulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return;
      if (el.scrollTop > 2) {
        isPulling.current = false;
        pullYRef.current = 0;
        setPullY(0);
        return;
      }
      const delta = e.touches[0].clientY - startY.current;
      const v = delta > 0 ? Math.min(delta * 0.45, 80) : 0;
      pullYRef.current = v;
      setPullY(v);
    };

    const onTouchEnd = () => {
      if (!isPulling.current) return;
      isPulling.current = false;
      if (pullYRef.current >= THRESHOLD) {
        onRefreshRef.current();
      }
      pullYRef.current = 0;
      setPullY(0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const progress = Math.min(pullY / THRESHOLD, 1);

  return (
    <div ref={containerRef} className={className}>
      {refreshing ? (
        <div className="flex items-center justify-center h-11 pointer-events-none" aria-hidden>
          <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      ) : pullY > 0 ? (
        <div
          className="flex items-center justify-center overflow-hidden pointer-events-none"
          style={{ height: pullY }}
          aria-hidden
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-purple-500/70 border-t-transparent shrink-0"
            style={{
              opacity: 0.3 + progress * 0.7,
              transform: `rotate(${pullY * 4}deg) scale(${0.5 + progress * 0.5})`,
            }}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}

// ─── News tab content ─────────────────────────────────────────────────────────

function ActualitesContent({
  newsItems,
  newsLoading,
  newsError,
  onRefresh,
  refreshing,
  filtersActive = false,
  totalCount = 0,
  storiesBar,
}: {
  newsItems: MusicNewsItem[];
  newsLoading: boolean;
  newsError: string | null;
  onRefresh: () => void;
  refreshing: boolean;
  filtersActive?: boolean;
  totalCount?: number;
  storiesBar?: ReactNode;
}) {
  const featured = newsItems.filter((n) => n.category === 'une');
  const musicNews = newsItems.filter((n) => n.category === 'musique');
  const promos = newsItems.filter((n) => n.category === 'promo');
  const trending = newsItems
    .filter((n) => n.category === 'tendance')
    .sort((a, b) => (a.trendingRank ?? 99) - (b.trendingRank ?? 99));

  if (newsLoading && newsItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-500">Chargement des actualités…</p>
      </div>
    );
  }

  if (newsError && newsItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
        <p className="text-sm text-gray-500 text-center">{newsError}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <PullToRefreshContainer
      onRefresh={onRefresh}
      refreshing={refreshing}
      className="flex-1 min-h-0 overflow-y-auto px-3 pb-6 space-y-5"
    >
      {storiesBar}

      {/* Header actualités */}
      <div className="flex items-center pt-3 pb-1">
        <p className="text-[10px] text-gray-600 uppercase tracking-wide font-medium">Actualités musicales</p>
      </div>

      {/* À la une */}
      {featured.length > 0 && (
        <div className="space-y-2.5">
          <SectionHeader label="À la une" emoji="🌟" />
          {featured.map((item) => (
            <FeaturedCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Musique */}
      {musicNews.length > 0 && (
        <div className="space-y-2.5">
          <SectionHeader label="Musique" emoji="🎵" />
          {musicNews.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Promotions */}
      {promos.length > 0 && (
        <div className="space-y-2.5">
          <SectionHeader label="Promotions & Annonces" emoji="🎪" />
          {promos.map((item) => (
            <PromoCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Tendances */}
      {trending.length > 0 && (
        <div className="space-y-2.5">
          <SectionHeader label="Tendances" emoji="🔥" />
          <div className="overflow-x-auto -mx-3 px-3">
            <div className="flex gap-4 w-max pb-1">
              {trending.map((item) => (
                <TrendingArtistCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      )}

      {newsItems.length === 0 && !newsLoading && (
        <p className="text-sm text-gray-500 text-center py-8">
          {totalCount > 0 && filtersActive
            ? 'Aucune actualité ne correspond à vos filtres.'
            : 'Aucune actualité pour le moment.'}
        </p>
      )}
    </PullToRefreshContainer>
  );
}

// ─── PostCard component ───────────────────────────────────────────────────────

interface PostCardProps {
  post: FeedPost;
  onOpenProfile: (id: string) => void;
  commentOpenPostId: string | null;
  commentDraft: string;
  onCommentDraftChange: (v: string) => void;
  commentAlign: CommentAlign;
  onCommentAlignChange: (v: CommentAlign) => void;
  fullComments: FeedPostComment[] | undefined;
  commentsLoading: boolean;
  commentPosting: boolean;
  onToggleLike: () => void;
  onToggleComments: () => void;
  onPostComment: () => void;
  onReshare: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
}

const PostCard = memo(function PostCard({
  post,
  onOpenProfile,
  commentOpenPostId,
  commentDraft,
  onCommentDraftChange,
  commentAlign,
  onCommentAlignChange,
  fullComments,
  commentsLoading,
  commentPosting,
  onToggleLike,
  onToggleComments,
  onPostComment,
  onReshare,
  onShare,
  onToggleFavorite,
}: PostCardProps) {
  const commentsOpen = commentOpenPostId === post.id;
  const displayedComments = fullComments ?? post.recentComments ?? [];

  return (
    <article className="rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-2">
      {/* Author row */}
      <button
        type="button"
        onClick={() => onOpenProfile(post.author.id)}
        className="flex items-center gap-2 text-left w-full"
      >
        <img
          src={post.author.avatarUrl || '/icon.svg'}
          alt=""
          loading="lazy"
          className="w-9 h-9 rounded-full object-cover bg-[#1e1e2f]"
        />
        <div className="min-w-0 flex-1">
          <UsernameDisplay
            username={post.author.username}
            usernameColor={post.author.usernameColor}
            usernameWaveFrom={post.author.usernameWaveFrom}
            usernameWaveTo={post.author.usernameWaveTo}
            className="text-sm font-semibold truncate block"
          />
          <p className="text-[11px] text-gray-500">
            {post.resharedFromId && <span className="text-green-500/80 mr-1">🔁 Repartagé ·</span>}
            {formatWhen(post.createdAt)}
          </p>
        </div>
      </button>

      {/* Content */}
      {post.content.trim() ? (
        <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{post.content}</p>
      ) : null}
      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt=""
          loading="lazy"
          className="w-full rounded-lg max-h-64 object-cover bg-[#1e1e2f]"
        />
      )}

      {/* Reshared original post embed */}
      {post.resharedFrom && (
        <div className="rounded-lg border border-[#2a2a3d] bg-[#0e0e18] p-2.5 space-y-1.5">
          <button
            type="button"
            onClick={() => onOpenProfile(post.resharedFrom!.author.id)}
            className="flex items-center gap-2 text-left w-full"
          >
            <img
              src={post.resharedFrom.author.avatarUrl || '/icon.svg'}
              alt=""
              loading="lazy"
              className="w-6 h-6 rounded-full object-cover bg-[#1e1e2f] shrink-0"
            />
            <UsernameDisplay
              username={post.resharedFrom.author.username}
              usernameColor={post.resharedFrom.author.usernameColor}
              usernameWaveFrom={post.resharedFrom.author.usernameWaveFrom}
              usernameWaveTo={post.resharedFrom.author.usernameWaveTo}
              className="text-xs font-semibold truncate"
            />
            <span className="text-[10px] text-gray-600 shrink-0">{formatWhen(post.resharedFrom.createdAt)}</span>
          </button>
          {post.resharedFrom.content.trim() && (
            <p className="text-xs text-gray-300 whitespace-pre-wrap break-words line-clamp-4">
              {post.resharedFrom.content}
            </p>
          )}
          {post.resharedFrom.imageUrl && (
            <img
              src={post.resharedFrom.imageUrl}
              alt=""
              className="w-full rounded-md max-h-40 object-cover bg-[#1e1e2f]"
            />
          )}
        </div>
      )}

      {/* ── Interaction bar ── */}
      <div className="flex items-center gap-0.5 pt-1 border-t border-[#1a1a28]">
        {/* Like */}
        <button
          type="button"
          onClick={onToggleLike}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition text-xs font-medium ${
            post.likedByMe ? 'text-red-400' : 'text-gray-500 hover:text-red-300 hover:bg-red-900/10'
          }`}
          title={post.likedByMe ? 'Ne plus aimer' : 'Aimer'}
        >
          <HeartIcon filled={post.likedByMe} className="w-3.5 h-3.5 shrink-0" />
          {post.likeCount > 0 && <span>{post.likeCount}</span>}
        </button>

        {/* Comment */}
        <button
          type="button"
          onClick={onToggleComments}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition text-xs font-medium ${
            commentsOpen ? 'text-purple-400' : 'text-gray-500 hover:text-purple-300 hover:bg-purple-900/10'
          }`}
          title="Commenter"
        >
          <CommentIcon className="w-3.5 h-3.5 shrink-0" />
          {post.commentCount > 0 && <span>{post.commentCount}</span>}
        </button>

        {/* Reshare */}
        <button
          type="button"
          onClick={onReshare}
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition text-xs font-medium text-gray-500 hover:text-green-300 hover:bg-green-900/10"
          title="Repartager"
        >
          <ReshareIcon className="w-3.5 h-3.5 shrink-0" />
        </button>

        {/* External share */}
        <button
          type="button"
          onClick={onShare}
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition text-xs font-medium text-gray-500 hover:text-blue-300 hover:bg-blue-900/10"
          title="Partager"
        >
          <ShareIcon className="w-3.5 h-3.5 shrink-0" />
        </button>

        {/* Bookmark (pushed right) */}
        <button
          type="button"
          onClick={onToggleFavorite}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition text-xs font-medium ml-auto ${
            post.favoriteByMe
              ? 'text-amber-400'
              : 'text-gray-500 hover:text-amber-300 hover:bg-amber-900/10'
          }`}
          title={post.favoriteByMe ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <BookmarkIcon filled={post.favoriteByMe} className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      {/* ── Comments section ── */}
      {commentsOpen && (
        <div className="space-y-2 pt-1">
          {commentsLoading && (
            <p className="text-xs text-gray-600 text-center">Chargement des commentaires…</p>
          )}
          {!commentsLoading && displayedComments.length === 0 && (
            <p className="text-xs text-gray-600 text-center">Aucun commentaire. Soyez le premier !</p>
          )}
          <div className="post-comments-scroll max-h-[280px] space-y-2">
            {displayedComments.map((c) => (
              <div key={c.id} className={`flex gap-2 ${commentRowClass(c.textAlign)}`}>
                {c.textAlign !== 'center' && (
                  <img
                    src={c.avatarUrl || '/icon.svg'}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover bg-[#1e1e2f] shrink-0 mt-0.5"
                  />
                )}
                <div className={`min-w-0 bg-[#0e0e18] rounded-xl px-3 py-2 ${commentBubbleClass(c.textAlign)} ${c.textAlign === 'full' ? 'flex-1' : 'max-w-[85%]'}`}>
                  <p className="text-[11px] font-semibold text-white truncate">{c.username}</p>
                  <p className="text-xs text-gray-300 break-words">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Comment input */}
          <div className="pt-1 space-y-1.5">
            {/* Alignment toolbar */}
            <div className="flex items-center gap-0.5">
              <span className="text-[9px] text-gray-600 mr-1 shrink-0">Alignement :</span>
              {ALIGN_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => onCommentAlignChange(value)}
                  className={`p-1 rounded transition ${
                    commentAlign === value
                      ? 'text-purple-300 bg-purple-900/30'
                      : 'text-gray-600 hover:text-gray-400 hover:bg-[#1a1a26]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            {/* Input row */}
            <div className="flex gap-2">
              <textarea
                value={commentDraft}
                onChange={(e) => onCommentDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onPostComment(); }
                }}
                placeholder="Ajouter un commentaire…"
                rows={1}
                maxLength={500}
                style={{ textAlign: commentAlign === 'right' ? 'right' : commentAlign === 'center' ? 'center' : 'left' }}
                className="flex-1 rounded-xl bg-[#0b0b0f] border border-[#2a2a3d] px-3 py-2 text-xs text-white placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <button
                type="button"
                disabled={!commentDraft.trim() || commentPosting}
                onClick={onPostComment}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white disabled:opacity-40 transition shrink-0"
              >
                {commentPosting ? '…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

export function ActualiteTabPage({ onOpenProfile, onOpenReel, onOpenLive, isActive }: ActualiteTabPageProps) {
  const { token, user } = useAuth();

  // ── Fil state ──
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [draft, setDraft] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAttaching, setImageAttaching] = useState(false);
  const [editorSource, setEditorSource] = useState<File | string | null>(null);
  const [editorPreviewUrl, setEditorPreviewUrl] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newsPrefs, setNewsPrefs] = useState<NewsUserPrefs>(() => readNewsUserPrefs());
  const [newsFiltersOpen, setNewsFiltersOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());

  // ── News panel (toggle depuis Accueil) ──
  const [showNews, setShowNews] = useState(false);
  const [newsItems, setNewsItems] = useState<MusicNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  // ── Post interactions ──
  const [commentOpenPostId, setCommentOpenPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentAligns, setCommentAligns] = useState<Record<string, CommentAlign>>({});
  const [fullComments, setFullComments] = useState<Record<string, FeedPostComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentPosting, setCommentPosting] = useState<Record<string, boolean>>({});

  // ── Share & Toast ──
  const [sharePost, setSharePost] = useState<FeedPost | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ── Feed prefs ──
  const viewerTastes = useMemo(
    () => ({
      interests: user?.interests,
      favoriteGenres: user?.favoriteGenres,
      favoriteArtists: user?.favoriteArtists,
    }),
    [user?.interests, user?.favoriteGenres, user?.favoriteArtists]
  );

  const newsFiltersActive = newsPrefsFiltersActive(newsPrefs);

  const visiblePosts = useMemo(() => {
    if (!user?.id) return posts;
    return applyFeedPreferences(posts, HOME_FEED_DISPLAY_PREFS, {
      viewerId: user.id,
      favoriteIds,
      viewerTastes,
    });
  }, [posts, user?.id, favoriteIds, viewerTastes]);

  const visibleNewsItems = useMemo(
    () => applyNewsPreferences(newsItems, newsPrefs, viewerTastes),
    [newsItems, newsPrefs, viewerTastes]
  );

  const handleNewsPrefsChange = useCallback((next: NewsUserPrefs) => {
    writeNewsUserPrefs(next);
    setNewsPrefs(next);
  }, []);

  useEffect(() => {
    const onChanged = () => setNewsPrefs(readNewsUserPrefs());
    window.addEventListener(NEWS_PREFS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NEWS_PREFS_CHANGED_EVENT, onChanged);
  }, []);

  useEffect(() => {
    if (!isActive) setShowNews(false);
  }, [isActive]);

  // ── Load feed posts (GET /api/feed) ──
  const loadFeed = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const r = await api.getFeedPosts(token, { limit: 100 });
        setPosts(r.posts);
      } catch {
        setError('Impossible de charger le fil.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!isActive || !token || showNews) return;
    void loadFeed();
  }, [isActive, token, showNews, loadFeed]);

  useEffect(() => {
    if (!isActive || !token) return;
    void api
      .getMyFavorites(token)
      .then((r) => setFavoriteIds(new Set(r.favorites.map((f) => f.id))))
      .catch(() => setFavoriteIds(new Set()));
  }, [isActive, token]);

  // ── Load news ──
  const loadNews = useCallback(async (silent = false) => {
    if (silent) setNewsRefreshing(true);
    else setNewsLoading(true);
    setNewsError(null);
    try {
      const r = await api.getNews();
      setNewsItems(r.news);
    } catch {
      setNewsError('Impossible de charger les actualités.');
    } finally {
      setNewsLoading(false);
      setNewsRefreshing(false);
    }
  }, []);

  // Load news when panel opens; auto-refresh every 5 min
  useEffect(() => {
    if (!isActive || !showNews) return;
    void loadNews();
    const timer = setInterval(() => void loadNews(true), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isActive, showNews, loadNews]);

  useEffect(() => {
    if (!editorSource) {
      setEditorPreviewUrl(null);
      return;
    }
    if (typeof editorSource === 'string') {
      setEditorPreviewUrl(editorSource);
      return;
    }
    const url = URL.createObjectURL(editorSource);
    setEditorPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editorSource]);

  // ── Image helpers ──
  const openFeedImageEditor = (source: File | string) => {
    setError(null);
    setEditorSource(source);
  };

  const attachImageFromFile = (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error ?? 'Fichier non valide.');
      return;
    }
    openFeedImageEditor(file);
  };

  const onFeedEditorConfirm = async (composedUrl: string) => {
    setEditorSource(null);
    setImageAttaching(true);
    setError(null);
    try {
      setImageUrl(await dataUrlToFeedImageDataUrl(composedUrl));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter l'image.");
    } finally {
      setImageAttaching(false);
    }
  };

  const onFeedEditorCancel = () => {
    setEditorSource(null);
  };

  const handleComposePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    const file = clipboardItemsToImageFile(items);
    if (!file) return;
    e.preventDefault();
    openFeedImageEditor(file);
  };

  const canPublish = Boolean(draft.trim() || imageUrl.trim());
  const editorOpen = Boolean(editorSource && editorPreviewUrl);

  const publish = async () => {
    if (!token || !canPublish || publishing || imageAttaching || editorOpen) return;
    setPublishing(true);
    setError(null);
    try {
      const body: { content: string; imageUrl?: string } = { content: draft.trim() };
      const img = imageUrl.trim();
      if (img) body.imageUrl = img;
      const r = await api.createFeedPost(token, body);
      setPosts((prev) => [r.post, ...prev]);
      setDraft('');
      setImageUrl('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publication impossible.');
    } finally {
      setPublishing(false);
    }
  };

  // ── Interaction handlers ──

  const updatePostInList = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
  }, []);

  const handleLike = useCallback(async (post: FeedPost) => {
    if (!token) return;
    const wasLiked = post.likedByMe;
    updatePostInList(post.id, {
      likedByMe: !wasLiked,
      likeCount: wasLiked ? Math.max(0, post.likeCount - 1) : post.likeCount + 1,
    });
    try {
      if (wasLiked) {
        await api.unlikeFeedPost(token, post.id);
      } else {
        await api.likeFeedPost(token, post.id);
      }
    } catch {
      updatePostInList(post.id, { likedByMe: wasLiked, likeCount: post.likeCount });
    }
  }, [token, updatePostInList]);

  const handleToggleFavorite = useCallback(async (post: FeedPost) => {
    if (!token) return;
    const wasFav = post.favoriteByMe;
    if (wasFav && !window.confirm('Retirer cette publication de vos favoris ?')) return;
    updatePostInList(post.id, { favoriteByMe: !wasFav });
    try {
      if (wasFav) {
        await api.removeFeedPostFavorite(token, post.id);
        showToast('Retiré des favoris');
      } else {
        await api.addFeedPostFavorite(token, post.id);
        showToast('Ajouté aux favoris ⭐');
      }
    } catch {
      updatePostInList(post.id, { favoriteByMe: wasFav });
      showToast('Erreur — réessayez');
    }
  }, [token, updatePostInList, showToast]);

  const handleReshare = useCallback(async (post: FeedPost) => {
    if (!token) return;
    try {
      const r = await api.reshareFeedPost(token, post.id);
      setPosts((prev) => [r.post, ...prev]);
      showToast('Publication repartagée 🔁');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Impossible de repartager');
    }
  }, [token, showToast]);

  const handleToggleComments = useCallback(async (post: FeedPost) => {
    if (!token) return;
    const isOpen = commentOpenPostId === post.id;
    setCommentOpenPostId(isOpen ? null : post.id);
    if (!isOpen && !fullComments[post.id]) {
      setCommentsLoading((prev) => ({ ...prev, [post.id]: true }));
      try {
        const r = await api.getFeedPostComments(token, post.id);
        setFullComments((prev) => ({ ...prev, [post.id]: r.comments }));
      } catch { /* ignore */ } finally {
        setCommentsLoading((prev) => ({ ...prev, [post.id]: false }));
      }
    }
  }, [token, commentOpenPostId, fullComments]);

  const handlePostComment = useCallback(async (postId: string) => {
    if (!token || commentPosting[postId]) return;
    const content = (commentDrafts[postId] ?? '').trim();
    if (!content) return;
    const textAlign = commentAligns[postId] ?? 'left';
    setCommentPosting((prev) => ({ ...prev, [postId]: true }));
    try {
      const r = await api.postFeedComment(token, postId, content, textAlign);
      const commentWithAlign: FeedPostComment = { ...r.comment, textAlign };
      setFullComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] ?? []), commentWithAlign],
      }));
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      setCommentAligns((prev) => ({ ...prev, [postId]: 'left' }));
      updatePostInList(postId, { commentCount: r.commentCount });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Impossible de commenter');
    } finally {
      setCommentPosting((prev) => ({ ...prev, [postId]: false }));
    }
  }, [token, commentDrafts, commentAligns, commentPosting, updatePostInList, showToast]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0b0b0f]">
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-2xl mx-auto">

        {/* ── Header actualités (fil d'accueil sans titre ni compteur) ── */}
        {showNews && (
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-[#1e1e2f]">
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white">Actualités</h1>
              {!newsLoading && newsItems.length > 0 && (
                <p className="text-[10px] text-gray-500 truncate">
                  {visibleNewsItems.length} actualité{visibleNewsItems.length !== 1 ? 's' : ''}
                  {newsFiltersActive && visibleNewsItems.length !== newsItems.length ? ' (filtré)' : ''}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setNewsFiltersOpen((v) => !v)}
                title="Filtrer les actualités"
                aria-label="Filtrer les actualités"
                aria-expanded={newsFiltersOpen}
                className={`p-1.5 rounded-lg transition ${
                  newsFiltersOpen || newsFiltersActive
                    ? 'text-purple-300 bg-purple-900/40'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e1e2f]'
                }`}
              >
                <FilterIcon />
              </button>
              <button
                type="button"
                onClick={() => setShowNews(false)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-purple-300 bg-purple-900/30 hover:bg-purple-900/50 transition"
                aria-label="Retour aux publications"
              >
                ← Accueil
              </button>
            </div>
          </div>
        )}

        {/* ══ FIL D'ACCUEIL ═════════════════════════════════════════════════ */}
        {!showNews && (
          <>
            <PullToRefreshContainer
              onRefresh={() => void loadFeed(true)}
              refreshing={refreshing}
              className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3"
            >
              <StoriesInlineBar
                onOpenProfile={onOpenProfile}
                onOpenReel={onOpenReel}
                onOpenLive={onOpenLive}
                isActive={isActive}
              />

              <button
                type="button"
                onClick={() => setShowNews(true)}
                className="w-full px-3 py-2 rounded-xl text-sm font-semibold text-amber-300 bg-amber-500/15 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/25 transition"
                aria-label="Voir l'actualité musicale"
              >
                Actualités
              </button>

              <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-2">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Publier</p>
                    <input
                      ref={imageFileInputRef}
                      type="file"
                      accept={ACCEPTED_IMAGE_FORMATS}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void attachImageFromFile(file);
                      }}
                    />
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onPaste={handleComposePaste}
                      placeholder="Quoi de neuf ?"
                      title="Coller une image (Ctrl+V)"
                      rows={3}
                      maxLength={2000}
                      className="w-full rounded-xl bg-[#0b0b0f] border border-[#2a2a3d] px-3 py-2 text-sm text-white placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    {(imageUrl.trim() || imageAttaching) && (
                      <div className="flex items-start gap-2">
                        {imageUrl.trim() ? (
                          <img
                            src={imageUrl}
                            alt="Aperçu"
                            className="h-20 w-20 rounded-lg object-cover bg-[#1e1e2f] border border-[#2a2a3d] shrink-0"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-lg bg-[#1e1e2f] border border-[#2a2a3d] animate-pulse shrink-0" />
                        )}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-[10px] text-gray-400">
                            {imageAttaching ? "Préparation de l'image…" : 'Image jointe'}
                          </p>
                          {imageUrl.trim() && !imageAttaching && (
                            <button
                              type="button"
                              onClick={() => setImageUrl('')}
                              className="mt-1 text-[10px] font-semibold text-gray-500 hover:text-white"
                            >
                              Retirer l'image
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-gray-600">{draft.length}/2000</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={imageAttaching || editorOpen}
                          onClick={() => imageFileInputRef.current?.click()}
                          title="Choisir une image"
                          aria-label="Choisir une image"
                          className={`p-1.5 rounded-lg transition disabled:opacity-40 ${
                            imageUrl.trim()
                              ? 'text-purple-300 bg-purple-900/40'
                              : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e1e2f]'
                          }`}
                        >
                          <PhotoIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={!canPublish || publishing || imageAttaching || editorOpen}
                          onClick={() => void publish()}
                          className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          {publishing ? 'Envoi…' : 'Publier'}
                        </button>
                      </div>
                    </div>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                  </div>

              {loading && posts.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">Chargement…</p>
              )}
              {!loading && visiblePosts.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  {posts.length === 0
                    ? 'Aucune publication pour le moment. Sois le premier !'
                    : 'Aucune publication pour le moment.'}
                </p>
              )}
              {visiblePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onOpenProfile={onOpenProfile}
                  commentOpenPostId={commentOpenPostId}
                  commentDraft={commentDrafts[post.id] ?? ''}
                  onCommentDraftChange={(v: string) => setCommentDrafts((p) => ({ ...p, [post.id]: v }))}
                  commentAlign={commentAligns[post.id] ?? 'left'}
                  onCommentAlignChange={(v) => setCommentAligns((p) => ({ ...p, [post.id]: v }))}
                  fullComments={fullComments[post.id]}
                  commentsLoading={commentsLoading[post.id] ?? false}
                  commentPosting={commentPosting[post.id] ?? false}
                  onToggleLike={() => void handleLike(post)}
                  onToggleComments={() => void handleToggleComments(post)}
                  onPostComment={() => void handlePostComment(post.id)}
                  onReshare={() => void handleReshare(post)}
                  onShare={() => setSharePost(post)}
                  onToggleFavorite={() => void handleToggleFavorite(post)}
                />
              ))}
            </PullToRefreshContainer>
          </>
        )}

        {/* ══ ACTUALITÉS (news) ══════════════════════════════════════════════ */}
        {showNews && (
          <>
            {newsFiltersOpen ? (
              <NewsFiltersPanel
                prefs={newsPrefs}
                onPrefsChange={handleNewsPrefsChange}
                viewerTastes={viewerTastes}
              />
            ) : null}
            <ActualitesContent
              newsItems={visibleNewsItems}
              newsLoading={newsLoading}
              newsError={newsError}
              onRefresh={() => void loadNews(true)}
              refreshing={newsRefreshing}
              filtersActive={newsFiltersActive}
              totalCount={newsItems.length}
              storiesBar={
                <StoriesInlineBar
                  onOpenProfile={onOpenProfile}
                  onOpenReel={onOpenReel}
                  onOpenLive={onOpenLive}
                  isActive={isActive}
                />
              }
            />
          </>
        )}

      </div>

      {editorOpen ? (
        <PhotoImageEditor
          mode="feed"
          initialImage={editorPreviewUrl!}
          initialSource={editorSource!}
          onConfirm={(result) => void onFeedEditorConfirm(result.imageUrl)}
          onCancel={onFeedEditorCancel}
        />
      ) : null}

      {/* ── Share sheet ── */}
      {sharePost && (
        <ShareLinkMenu
          open
          onClose={() => setSharePost(null)}
          url={`${window.location.origin}/#/post/${sharePost.id}`}
          title={sharePost.content ? sharePost.content.slice(0, 80) : 'Publication MeloSong'}
          text={sharePost.content ? sharePost.content.slice(0, 120) : undefined}
          onToast={showToast}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-[#1e1e2f]/95 border border-[#2d2d3d] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl backdrop-blur-sm whitespace-nowrap">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
