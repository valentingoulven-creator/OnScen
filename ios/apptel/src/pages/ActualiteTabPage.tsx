import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { applyFeedPreferences } from '../lib/feedFilter';
import {
  FEED_PREFS_CHANGED_EVENT,
  feedPrefsFiltersActive,
  readFeedUserPrefs,
  writeFeedUserPrefs,
  type FeedAudienceScope,
  type FeedUserPrefs,
} from '../lib/feedUserPrefs';
import { viewerHasTasteProfile } from '../lib/musicAffinities';
import { UsernameDisplay } from '../components/UsernameDisplay';
import { PROFILE_TYPE_OPTIONS } from '../lib/profileTypes';
import { clipboardItemsToFeedImageDataUrl, fileToFeedImageDataUrl } from '../lib/feedImagePaste';
import type { FeedPost, MusicNewsItem, ProfileType } from '../types';

interface ActualiteTabPageProps {
  onOpenProfile: (userId: string) => void;
  isActive: boolean;
}

type MainTab = 'communaute' | 'actualites';

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

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      />
    </svg>
  );
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

// ─── News tab content ─────────────────────────────────────────────────────────

function ActualitesContent({
  newsItems,
  newsLoading,
  newsError,
  onRefresh,
  refreshing,
}: {
  newsItems: MusicNewsItem[];
  newsLoading: boolean;
  newsError: string | null;
  onRefresh: () => void;
  refreshing: boolean;
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
    <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6 space-y-5">

      {/* Header actualités */}
      <div className="flex items-center justify-between pt-3 pb-1">
        <p className="text-[10px] text-gray-600 uppercase tracking-wide font-medium">Actualités musicales</p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 disabled:opacity-50"
        >
          {refreshing ? '…' : 'Actualiser'}
        </button>
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
        <p className="text-sm text-gray-500 text-center py-8">Aucune actualité pour le moment.</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ActualiteTabPage({ onOpenProfile, isActive }: ActualiteTabPageProps) {
  const { token, user } = useAuth();

  // ── Communauté state ──
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [draft, setDraft] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAttaching, setImageAttaching] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<FeedUserPrefs>(() => readFeedUserPrefs());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());

  // ── Actualités state ──
  const [activeTab, setActiveTab] = useState<MainTab>('communaute');
  const [newsItems, setNewsItems] = useState<MusicNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  // ── Feed prefs ──
  const viewerTastes = useMemo(
    () => ({
      interests: user?.interests,
      favoriteGenres: user?.favoriteGenres,
      favoriteArtists: user?.favoriteArtists,
    }),
    [user?.interests, user?.favoriteGenres, user?.favoriteArtists]
  );

  const filtersActive = feedPrefsFiltersActive(prefs);

  const visiblePosts = useMemo(() => {
    if (!user?.id) return posts;
    return applyFeedPreferences(posts, prefs, {
      viewerId: user.id,
      favoriteIds,
      viewerTastes,
    });
  }, [posts, prefs, user?.id, favoriteIds, viewerTastes]);

  const updatePrefs = useCallback((patch: Partial<FeedUserPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      writeFeedUserPrefs(next);
      return next;
    });
  }, []);

  const toggleProfileType = (profileType: ProfileType) => {
    setPrefs((prev) => {
      const has = prev.profileTypes.includes(profileType);
      const profileTypes = has
        ? prev.profileTypes.filter((t) => t !== profileType)
        : [...prev.profileTypes, profileType];
      const next = { ...prev, profileTypes };
      writeFeedUserPrefs(next);
      return next;
    });
  };

  useEffect(() => {
    const onChanged = () => setPrefs(readFeedUserPrefs());
    window.addEventListener(FEED_PREFS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(FEED_PREFS_CHANGED_EVENT, onChanged);
  }, []);

  // ── Load community feed ──
  const loadFeed = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const r = await api.getFeedPosts(token);
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
    if (!isActive || !token) return;
    void loadFeed();
  }, [isActive, token, loadFeed]);

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

  // Load news when tab becomes active; auto-refresh every 5 min
  useEffect(() => {
    if (!isActive || activeTab !== 'actualites') return;
    void loadNews();
    const timer = setInterval(() => void loadNews(true), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isActive, activeTab, loadNews]);

  // ── Image helpers ──
  const attachImageFromFile = async (file: File) => {
    setImageAttaching(true);
    setError(null);
    try {
      setImageUrl(await fileToFeedImageDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter l'image.");
    } finally {
      setImageAttaching(false);
    }
  };

  const handleComposePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        hasImage = true;
        break;
      }
    }
    if (!hasImage) return;
    e.preventDefault();
    void (async () => {
      setImageAttaching(true);
      setError(null);
      try {
        const dataUrl = await clipboardItemsToFeedImageDataUrl(items);
        if (!dataUrl) {
          setError("Impossible de lire l'image du presse-papiers.");
          return;
        }
        setImageUrl(dataUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible d'ajouter l'image.");
      } finally {
        setImageAttaching(false);
      }
    })();
  };

  const canPublish = Boolean(draft.trim() || imageUrl.trim());

  const publish = async () => {
    if (!token || !canPublish || publishing || imageAttaching) return;
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

  // ── Chip classes ──
  const scopeChipClass = (active: boolean) =>
    `flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition ${
      active
        ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
        : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300'
    }`;

  const profileTypeChipClass = (active: boolean) =>
    `flex items-start gap-1.5 p-2 rounded-lg border text-left transition ${
      active
        ? 'border-purple-500/50 bg-purple-500/15 text-purple-200'
        : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300 hover:border-purple-500/30'
    }`;

  const affinityNeedsProfile =
    prefs.musicalAffinitiesOnly && !viewerHasTasteProfile(viewerTastes);

  const tabBtnClass = (active: boolean) =>
    `flex-1 py-2.5 text-xs font-semibold transition border-b-2 ${
      active
        ? 'text-white border-purple-500'
        : 'text-gray-500 hover:text-gray-300 border-transparent'
    }`;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0b0b0f]">
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-2xl mx-auto">

        {/* ── Global header ── */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-[#1e1e2f]">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white">Actualité</h1>
            {activeTab === 'communaute' && !loading && posts.length > 0 && (
              <p className="text-[10px] text-gray-500 truncate">
                {visiblePosts.length} publication{visiblePosts.length !== 1 ? 's' : ''}
                {filtersActive && visiblePosts.length !== posts.length ? ' (filtré)' : ''}
              </p>
            )}
          </div>
          {activeTab === 'communaute' && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                title="Filtrer mon fil"
                aria-label="Filtrer mon fil"
                aria-expanded={filtersOpen}
                className={`p-1.5 rounded-lg transition ${
                  filtersOpen || filtersActive
                    ? 'text-purple-300 bg-purple-900/40'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e1e2f]'
                }`}
              >
                <GearIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void loadFeed(true)}
                disabled={refreshing || loading}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 disabled:opacity-50 px-1"
              >
                {refreshing ? '…' : 'Actualiser'}
              </button>
            </div>
          )}
        </div>

        {/* ── Inner tab bar ── */}
        <div className="shrink-0 flex border-b border-[#1e1e2f] bg-[#0b0b0f]">
          <button type="button" className={tabBtnClass(activeTab === 'communaute')} onClick={() => setActiveTab('communaute')}>
            Communauté
          </button>
          <button type="button" className={tabBtnClass(activeTab === 'actualites')} onClick={() => setActiveTab('actualites')}>
            Actualités
          </button>
        </div>

        {/* ══ COMMUNAUTÉ TAB ══════════════════════════════════════════════════ */}
        {activeTab === 'communaute' && (
          <>
            {filtersOpen && (
              <div className="shrink-0 border-b border-[#1e1e2f] px-3 py-3 space-y-3 bg-[#12121a] max-h-[min(50vh,20rem)] overflow-y-auto">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Mon fil</p>

                <div>
                  <p className="text-[10px] text-gray-400 mb-1.5">Qui afficher</p>
                  <div className="flex gap-1.5">
                    {(
                      [
                        { value: 'all' as FeedAudienceScope, label: 'Tout le monde' },
                        { value: 'favorites_only' as FeedAudienceScope, label: 'Favoris seulement' },
                      ] as const
                    ).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updatePrefs({ audienceScope: value })}
                        className={scopeChipClass(prefs.audienceScope === value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-gray-400 mb-1.5">Type de profil</p>
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                    {PROFILE_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleProfileType(opt.value)}
                        className={profileTypeChipClass(prefs.profileTypes.includes(opt.value))}
                      >
                        <span className="text-sm shrink-0 leading-none">{opt.emoji}</span>
                        <span className="text-[10px] font-semibold leading-tight">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-gray-600 mt-1">Aucune sélection = tous les profils</p>
                </div>

                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-[10px] text-gray-300 leading-snug pr-2">
                    Affinités musicales
                    <span className="block text-[9px] text-gray-500 font-normal">
                      Mêmes centres d&apos;intérêt, genres ou artistes que mon profil
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs.musicalAffinitiesOnly}
                    onChange={(e) => updatePrefs({ musicalAffinitiesOnly: e.target.checked })}
                    className="melosong-checkbox scale-90 shrink-0"
                  />
                </label>

                {affinityNeedsProfile && (
                  <p className="text-[10px] text-amber-500/90">
                    Complétez vos goûts musicaux dans votre profil pour utiliser ce filtre.
                  </p>
                )}

                {prefs.audienceScope === 'all' && (
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-[10px] text-gray-300">Voir les favoris en premier</span>
                    <input
                      type="checkbox"
                      checked={prefs.favoritesFirst}
                      onChange={(e) => updatePrefs({ favoritesFirst: e.target.checked })}
                      className="melosong-checkbox scale-90"
                    />
                  </label>
                )}

                {filtersActive && (
                  <button
                    type="button"
                    onClick={() => {
                      writeFeedUserPrefs({
                        audienceScope: 'all',
                        profileTypes: [],
                        musicalAffinitiesOnly: false,
                        favoritesFirst: false,
                      });
                      setPrefs(readFeedUserPrefs());
                    }}
                    className="text-[10px] font-semibold text-gray-400 hover:text-white"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            )}

            <div className="shrink-0 border-b border-[#1e1e2f] p-3 space-y-2 bg-[#12121a]">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Publier</p>
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
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
                    disabled={imageAttaching}
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
                    disabled={!canPublish || publishing || imageAttaching}
                    onClick={() => void publish()}
                    className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {publishing ? 'Envoi…' : 'Publier'}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <div className="ms-feed-fullbleed flex-1 min-h-0 overflow-y-auto space-y-3">
              {loading && posts.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">Chargement…</p>
              )}
              {!loading && visiblePosts.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  {posts.length === 0
                    ? 'Aucune publication pour le moment. Sois le premier !'
                    : filtersActive
                      ? 'Aucune publication ne correspond à vos filtres.'
                      : 'Aucune publication pour le moment.'}
                </p>
              )}
              {visiblePosts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-2"
                >
                  <button
                    type="button"
                    onClick={() => onOpenProfile(post.author.id)}
                    className="flex items-center gap-2 text-left w-full"
                  >
                    <img
                      src={post.author.avatarUrl || '/icon.svg'}
                      alt=""
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
                      <p className="text-[11px] text-gray-500">{formatWhen(post.createdAt)}</p>
                    </div>
                  </button>
                  {post.content.trim() ? (
                    <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{post.content}</p>
                  ) : null}
                  {post.imageUrl && (
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="w-full rounded-lg max-h-64 object-cover bg-[#1e1e2f]"
                    />
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        {/* ══ ACTUALITÉS TAB ══════════════════════════════════════════════════ */}
        {activeTab === 'actualites' && (
          <ActualitesContent
            newsItems={newsItems}
            newsLoading={newsLoading}
            newsError={newsError}
            onRefresh={() => void loadNews(true)}
            refreshing={newsRefreshing}
          />
        )}
      </div>
    </div>
  );
}
