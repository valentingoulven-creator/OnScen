import type { SalonQueueItem } from '../types';

interface SalonQueueSectionProps {
  queue: SalonQueueItem[];
  isHost: boolean;
  allowQueue: boolean;
  onSkip?: () => void;
  onPlayItem?: (id: string) => void;
  skipping?: boolean;
  compact?: boolean;
}

export function SalonQueueSection({
  queue,
  isHost,
  allowQueue,
  onSkip,
  onPlayItem,
  skipping,
  compact,
}: SalonQueueSectionProps) {
  if (!allowQueue) {
    return (
      <p className="text-[10px] text-gray-600 text-center">La file d&apos;attente est désactivée dans ce salon.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">File d&apos;attente</h4>
        {isHost && queue.length > 0 && onSkip && (
          <button
            type="button"
            disabled={skipping}
            onClick={onSkip}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white font-semibold disabled:opacity-50 transition"
          >
            Suivant
          </button>
        )}
      </div>
      {queue.length === 0 ? (
        <p className={`text-gray-600 text-center ${compact ? 'text-[10px] py-1' : 'text-xs py-2'}`}>
          Aucun morceau en attente
        </p>
      ) : (
        <ul className={`overflow-y-auto space-y-1 ${compact ? 'max-h-32' : 'max-h-40'}`}>
          {queue.map((item, i) => (
            <li
              key={item.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0b0b0f] border border-[#222233] text-left"
            >
              <span className="text-[10px] text-gray-600 w-4 tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{item.title}</p>
                <p className="text-[10px] text-gray-500 truncate">
                  {item.artist} · {item.addedByName}
                </p>
              </div>
              {isHost && onPlayItem && (
                <button
                  type="button"
                  onClick={() => onPlayItem(item.id)}
                  className="text-[10px] px-2 py-0.5 rounded-md border border-purple-500/30 text-purple-300 font-semibold shrink-0 hover:bg-purple-500/10 transition"
                >
                  Lire
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
