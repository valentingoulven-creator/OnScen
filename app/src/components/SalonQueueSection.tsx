import type { SalonQueueItem } from '../types';

interface SalonQueueSectionProps {
  queue: SalonQueueItem[];
  isHost: boolean;
  allowQueue: boolean;
  onSkip?: () => void;
  onPlayItem?: (id: string) => void;
  skipping?: boolean;
}

export function SalonQueueSection({
  queue,
  isHost,
  allowQueue,
  onSkip,
  onPlayItem,
  skipping,
}: SalonQueueSectionProps) {
  if (!allowQueue) {
    return (
      <p className="text-[10px] text-gray-500 text-center">La file d&apos;attente est désactivée dans ce salon.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase">File d&apos;attente</h4>
        {isHost && queue.length > 0 && onSkip && (
          <button
            type="button"
            disabled={skipping}
            onClick={onSkip}
            className="text-[10px] px-2 py-1 rounded-lg bg-purple-600/80 text-white font-bold disabled:opacity-50"
          >
            Morceau suivant
          </button>
        )}
      </div>
      {queue.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-2">Aucun morceau en attente</p>
      ) : (
        <ul className="max-h-40 overflow-y-auto space-y-1">
          {queue.map((item, i) => (
            <li
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-left"
            >
              <span className="text-[10px] text-gray-500 w-4">{i + 1}</span>
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
                  className="text-[10px] px-2 py-1 rounded-lg border border-purple-500/40 text-purple-300 font-bold shrink-0"
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
