import { isDisplayableProfilePhotoUrl } from '../lib/profilePhotos';

interface PublicProfilePhotoHeroProps {
  photos: string[];
  isLive?: boolean;
  onPhotoClick?: (index: number) => void;
}

function HeroCell({
  url,
  index,
  className,
  onPhotoClick,
}: {
  url: string;
  index: number;
  className?: string;
  onPhotoClick?: (index: number) => void;
}) {
  const cell = (
    <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
  );

  if (onPhotoClick) {
    return (
      <button
        type="button"
        onClick={() => onPhotoClick(index)}
        className={`relative overflow-hidden bg-[#1a1a26] cursor-pointer hover:opacity-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${className ?? ''}`}
        aria-label="Voir la photo en grand"
      >
        {cell}
      </button>
    );
  }

  return <div className={`relative overflow-hidden bg-[#1a1a26] ${className ?? ''}`}>{cell}</div>;
}

/** Bandeau / mosaïque en tête de profil public (style réseau social). */
export function PublicProfilePhotoHero({ photos, isLive, onPhotoClick }: PublicProfilePhotoHeroProps) {
  const viewable = photos.filter(isDisplayableProfilePhotoUrl);
  if (viewable.length === 0) {
    return (
      <div
        className="relative h-44 sm:h-52 w-full overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-[#1a1035] to-pink-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(147,51,234,0.35),transparent_60%),radial-gradient(ellipse_at_bottom-left,rgba(236,72,153,0.25),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b0b0f] via-[#0b0b0f]/60 to-transparent" />
      </div>
    );
  }

  const liveRing = isLive
    ? 'ring-2 ring-red-500/80 ring-inset shadow-[inset_0_0_24px_rgba(239,68,68,0.25)]'
    : '';

  if (viewable.length === 1) {
    return (
      <div className={`relative h-52 sm:h-60 w-full ${liveRing}`}>
        <HeroCell url={viewable[0]!} index={0} className="absolute inset-0" onPhotoClick={onPhotoClick} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b0f] via-[#0b0b0f]/20 to-black/30" />
        {isLive ? (
          <span className="absolute top-3 left-3 z-10 rounded-full bg-red-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-lg">
            🔴 LIVE
          </span>
        ) : null}
      </div>
    );
  }

  const secondary = viewable.slice(1, 4);

  return (
    <div className={`relative grid grid-cols-3 grid-rows-2 gap-0.5 h-52 sm:h-60 w-full ${liveRing}`}>
      <HeroCell
        url={viewable[0]!}
        index={0}
        className="col-span-2 row-span-2"
        onPhotoClick={onPhotoClick}
      />
      {secondary.map((url, i) => (
        <HeroCell key={`${url}-${i + 1}`} url={url} index={i + 1} onPhotoClick={onPhotoClick} />
      ))}
      {secondary.length < 3
        ? Array.from({ length: 3 - secondary.length }).map((_, i) => (
            <div
              key={`pad-${i}`}
              className="bg-[#12121a]"
              aria-hidden
            />
          ))
        : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b0f] via-[#0b0b0f]/30 to-transparent" />
      {isLive ? (
        <span className="absolute top-3 left-3 z-10 rounded-full bg-red-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-lg">
          🔴 LIVE
        </span>
      ) : null}
      {viewable.length > 4 ? (
        <span className="absolute bottom-2 right-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          +{viewable.length - 4} photos
        </span>
      ) : null}
    </div>
  );
}
