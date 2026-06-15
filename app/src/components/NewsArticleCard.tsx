import { useState } from 'react';

export interface NewsArticleCardProps {
  imageUrl?: string;
  title: string;
  excerpt: string;
  source?: string;
  timeAgo: string;
  href?: string;
  /** Badge overlay on hero (e.g. « À la une », « Musique », « Festival »). */
  badge?: string;
  genres?: string[];
  readMoreLabel?: string;
  /** In-app navigation (replaces external link when set). */
  onReadMoreClick?: () => void;
}

function badgeStyle(badge?: string): string {
  if (!badge) return 'bg-gray-800/80 text-gray-300 border-gray-600/60';
  const b = badge.toLowerCase();
  if (b.includes('une')) return 'bg-amber-500/25 text-amber-200 border-amber-400/60';
  if (b.includes('musique')) return 'bg-violet-500/20 text-violet-200 border-violet-400/50';
  if (b.includes('festival')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  if (b.includes('concert')) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (b.includes('album') || b.includes('nouveau')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  if (b.includes('promo')) return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
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

export function NewsArticleCard({
  imageUrl,
  title,
  excerpt,
  source,
  timeAgo,
  href = '#',
  badge,
  genres,
  readMoreLabel = 'Lire plus →',
  onReadMoreClick,
}: NewsArticleCardProps) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <article className="overflow-hidden rounded-xl border border-[#2a2a3d] bg-[#12121a] shadow-lg">
      <div className={`relative aspect-video w-full overflow-hidden bg-gradient-to-br ${genreGradient(genres)}`}>
        {imageUrl && imgOk ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
        {badge ? (
          <div className="absolute bottom-2 left-2">
            <span
              className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${badgeStyle(badge)}`}
            >
              {badge}
            </span>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 p-3">
        <h2 className="text-sm font-bold text-white leading-snug line-clamp-2">{title}</h2>
        <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{excerpt}</p>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {source ? (
              <span className="truncate text-[10px] text-gray-500">{source}</span>
            ) : null}
            {source ? <span className="shrink-0 text-[10px] text-gray-600">·</span> : null}
            <span className="shrink-0 text-[10px] text-gray-600">{timeAgo}</span>
          </div>
          {onReadMoreClick ? (
            <button
              type="button"
              onClick={onReadMoreClick}
              className="shrink-0 text-[10px] font-semibold text-purple-400 transition hover:text-purple-300"
            >
              {readMoreLabel}
            </button>
          ) : (
            <a
              href={href}
              className="shrink-0 text-[10px] font-semibold text-purple-400 transition hover:text-purple-300"
            >
              {readMoreLabel}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
