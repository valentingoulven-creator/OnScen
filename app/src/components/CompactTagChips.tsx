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
}: {
  label: string;
  tags: string[];
  color: TagColor;
}) {
  if (!tags.length) return null;

  return (
    <section>
      <p className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${LABEL_COLORS[color]}`}>
        {label}
      </p>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        {tags.map((t) => (
          <span
            key={`${color}-${t}`}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${CHIP_COLORS[color]}`}
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
}: {
  interests: string[];
  genres: string[];
  artists: string[];
  align?: 'center' | 'start';
}) {
  const hasAny = interests.length > 0 || genres.length > 0 || artists.length > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-4">
      <CompactTagSection label="Centres d'intérêt" tags={interests} color="cyan" />
      <CompactTagSection label="Genres favoris" tags={genres} color="purple" />
      <CompactTagSection label="Artistes" tags={artists} color="pink" />
    </div>
  );
}
