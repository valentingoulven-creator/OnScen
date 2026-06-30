type TagColor = 'cyan' | 'purple' | 'pink';

const CHIP_COLORS: Record<TagColor, string> = {
  cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
  purple: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
  pink: 'bg-pink-500/10 text-pink-300 border-pink-500/25',
};

const LABEL_COLORS: Record<TagColor, string> = {
  cyan: 'text-cyan-400/70',
  purple: 'text-purple-400/70',
  pink: 'text-pink-400/70',
};

function CompactTagSection({
  label,
  tags,
  color,
  compact = false,
}: {
  label: string;
  tags: string[];
  color: TagColor;
  compact?: boolean;
}) {
  if (!tags.length) return null;

  return (
    <section>
      <p
        className={`uppercase tracking-widest font-semibold ${LABEL_COLORS[color]} ${
          compact ? 'text-[9px] mb-1' : 'text-[10px] mb-2'
        }`}
      >
        {label}
      </p>
      <div
        className={`flex overflow-x-auto ${compact ? 'gap-1.5 pb-0.5' : 'gap-2 pb-1'}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        {tags.map((t) => (
          <span
            key={`${color}-${t}`}
            className={`shrink-0 rounded-full font-medium border whitespace-nowrap ${CHIP_COLORS[color]} ${
              compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1.5 text-[11px]'
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}

export function CompactTagChips({
  interests,
  genres,
  artists,
  align = 'center',
  compact = false,
}: {
  interests: string[];
  genres: string[];
  artists: string[];
  align?: 'center' | 'start';
  compact?: boolean;
}) {
  const hasAny = interests.length > 0 || genres.length > 0 || artists.length > 0;
  if (!hasAny) return null;

  return (
    <div
      className={`flex flex-col ${compact ? 'space-y-1.5' : 'space-y-4'} ${
        align === 'start' ? 'items-start' : 'items-center'
      }`}
    >
      <CompactTagSection label="Centres d'intérêt" tags={interests} color="cyan" compact={compact} />
      <CompactTagSection label="Genres favoris" tags={genres} color="purple" compact={compact} />
      <CompactTagSection label="Artistes" tags={artists} color="pink" compact={compact} />
    </div>
  );
}
