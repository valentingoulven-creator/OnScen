import { UsernameDisplay } from './UsernameDisplay';
import { UserAvatarOnline } from './UserAvatarOnline';
import type { MapLiveLocationCluster } from '../lib/mapLiveClusters';
import type { Live, Salon } from '../types';

interface MapLiveClusterSheetProps {
  cluster: MapLiveLocationCluster;
  onClose: () => void;
  onLiveClick: (live: Live) => void;
  onSalonClick: (salon: Salon) => void;
}

function LiveRow({
  label,
  subtitle,
  hostId,
  hostName,
  onSelect,
}: {
  label: string;
  subtitle: string;
  hostId: string;
  hostName: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left flex items-center gap-3 px-3 py-2.5 min-h-11 hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent hover:border-red-500/40 transition"
      >
        <UserAvatarOnline userId={hostId} username={hostName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{label}</p>
          <p className="text-[11px] text-gray-500 truncate">
            <UsernameDisplay username={hostName} className="inline" />
            {subtitle ? ` · ${subtitle}` : ''}
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
          LIVE
        </span>
      </button>
    </li>
  );
}

export function MapLiveClusterSheet({
  cluster,
  onClose,
  onLiveClick,
  onSalonClick,
}: MapLiveClusterSheetProps) {
  const total = cluster.count;
  const locationLabel =
    total === 1
      ? '1 live ici'
      : `${total} lives au même endroit`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center ms-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={locationLabel}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[min(90dvh,28rem)] rounded-2xl ms-modal-panel bg-[#0e0e14] border border-white/10 shadow-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden />
              {locationLabel}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5 truncate">
              {cluster.latitude.toFixed(3)}°, {cluster.longitude.toFixed(3)}°
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/5"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-white/5">
          {cluster.salons.map((salon) => (
            <LiveRow
              key={`salon-${salon.id}`}
              hostId={salon.hostId}
              hostName={salon.hostName}
              label={salon.title}
              subtitle={`Salon · ${Math.max(0, salon.listenersCount ?? 0)} spectateurs`}
              onSelect={() => onSalonClick(salon)}
            />
          ))}
          {cluster.lives.map((live) => (
            <LiveRow
              key={`live-${live.id}`}
              hostId={live.hostId}
              hostName={live.hostName}
              label={live.title.trim() || live.playbackState.title}
              subtitle={`Live · ${Math.max(0, live.viewersCount ?? 0)} spectateurs`}
              onSelect={() => onLiveClick(live)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
