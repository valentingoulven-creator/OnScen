type TagColor = 'cyan' | 'purple' | 'pink';

const CHIP_COLORS: Record<TagColor, string> = {
  cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
  purple: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
  pink: 'bg-pink-500/10 text-pink-300 border-pink-500/25',
};

function CompactTagSection({
  label,
  tags,
  color,
  align = 'center',
}: {
  label: string;
  tags: string[];
  color: TagColor;
  align?: 'center' | 'start';
}) {
  if (!tags.length) return null;

  return (
    <section className={align === 'start' ? 'text-left' : 'text-center'}>
      <p className="text-xs uppercase text-gray-500 tracking-wide mb-1.5">{label}</p>
      <div
        className={`flex flex-wrap gap-1.5 ${align === 'start' ? 'justify-start' : 'justify-center'}`}
      >
        {tags.map((t) => (
          <span
            key={`${color}-${t}`}
            className={`px-2.5 py-1 rounded-full text-[11px] border ${CHIP_COLORS[color]}`}
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
      <CompactTagSection label="Centres d'intérêt" tags={interests} color="cyan" align={align} />
      <CompactTagSection label="Genres favoris" tags={genres} color="purple" align={align} />
      <CompactTagSection label="Artistes" tags={artists} color="pink" align={align} />
    </div>
  );
}
