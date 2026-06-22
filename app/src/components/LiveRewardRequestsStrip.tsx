/**
 * LiveRewardRequestsStrip — Demandes de récompense en attente sur la vidéo live (host).
 */
import type { RewardQueueItem } from '../lib/liveHostTypes';

interface LiveRewardRequestsStripProps {
  items: RewardQueueItem[];
  onOpenPanel?: () => void;
}

export function LiveRewardRequestsStrip({ items, onOpenPanel }: LiveRewardRequestsStripProps) {
  const visible = items.filter((i) => i.status === 'pending' || i.status === 'accepted').slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div className="absolute top-2 right-2 z-20 pointer-events-auto flex flex-col gap-1.5 max-w-[min(100%,16rem)]">
      {visible.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={onOpenPanel}
          className={`text-left rounded-xl border px-3 py-2 backdrop-blur-md shadow-lg transition active:scale-[0.98] ${
            item.status === 'accepted'
              ? 'border-emerald-500/40 bg-emerald-950/80'
              : 'border-amber-500/40 bg-black/75'
          }`}
          aria-label={`Récompense ${item.rewardLabel} de ${item.donorName}`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`text-[9px] font-black uppercase tracking-widest ${
                item.status === 'accepted' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {item.status === 'accepted' ? 'Accepté' : 'Demande'}
            </span>
            <span className="text-[10px] font-bold text-amber-300 tabular-nums">{item.amount}€</span>
          </div>
          <p className="text-xs font-semibold text-white truncate">{item.rewardLabel}</p>
          <p className="text-[10px] text-gray-300 truncate">{item.donorName}</p>
          {item.note ? (
            <p className="text-[10px] text-purple-200 truncate mt-0.5 italic">&ldquo;{item.note}&rdquo;</p>
          ) : null}
        </button>
      ))}
      {items.filter((i) => i.status === 'pending').length > 3 ? (
        <button
          type="button"
          onClick={onOpenPanel}
          className="self-end px-2 py-1 rounded-lg bg-black/70 border border-white/15 text-[10px] font-bold text-white backdrop-blur"
        >
          +{items.filter((i) => i.status === 'pending').length - 3} en attente
        </button>
      ) : null}
    </div>
  );
}
