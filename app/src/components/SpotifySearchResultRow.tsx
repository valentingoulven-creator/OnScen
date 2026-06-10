import { memo } from 'react';

export interface SpotifySearchResultRowData {
  id: string;
  name: string;
  artist: string;
  albumArtUrl: string;
}

interface SpotifySearchResultRowProps {
  item: SpotifySearchResultRowData;
  onSelect: (item: SpotifySearchResultRowData) => void;
  disabled?: boolean;
  actionLabel: string;
  compact?: boolean;
}

export const SpotifySearchResultRow = memo(function SpotifySearchResultRow({
  item,
  onSelect,
  disabled = false,
  actionLabel,
  compact = false,
}: SpotifySearchResultRowProps) {
  const artClass = compact ? 'w-10 h-10' : 'w-14 h-10';
  const badgeClass = compact
    ? 'absolute bottom-0 right-0 bg-[#1DB954] rounded px-0.5 text-[6px] font-bold text-black leading-none py-px'
    : 'absolute bottom-0.5 right-0.5 bg-[#1DB954] rounded px-1 text-[7px] font-bold text-black leading-none py-px tracking-tight';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(item)}
      className={`w-full flex items-center gap-2.5 text-left disabled:opacity-50 transition hover:bg-[#1a1a26] ${
        compact ? 'px-3 py-2' : 'px-2.5 py-2'
      }`}
      role="option"
    >
      <div className="relative shrink-0">
        {item.albumArtUrl ? (
          <img src={item.albumArtUrl} alt="" className={`${artClass} rounded-md object-cover bg-[#1e1e2f]`} />
        ) : (
          <div className={`${artClass} rounded-md bg-[#1e1e2f] flex items-center justify-center text-lg`}>
            🎧
          </div>
        )}
        <span className={badgeClass}>Spotify</span>
      </div>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-white font-medium truncate">{item.name}</span>
        <span className="block text-[10px] text-gray-500 truncate">{item.artist}</span>
      </span>
      {!compact ? (
        <span className="text-[10px] text-green-300 font-bold shrink-0">{actionLabel}</span>
      ) : null}
    </button>
  );
});
