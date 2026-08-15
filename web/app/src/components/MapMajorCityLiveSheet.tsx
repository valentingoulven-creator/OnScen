import { useTranslation } from 'react-i18next';
import { UsernameDisplay } from './UsernameDisplay';
import { UserAvatarOnline } from './UserAvatarOnline';
import type { MapMajorCityLiveCluster } from '../lib/mapMajorCityLiveClusters';
import type { Live, Salon } from '../types';

interface MapMajorCityLiveSheetProps {
  cluster: MapMajorCityLiveCluster;
  onClose: () => void;
  onLiveClick: (live: Live) => void;
  onSalonClick: (salon: Salon) => void;
}

function SessionRow({
  label,
  subtitle,
  hostId,
  hostName,
  isLive,
  onSelect,
}: {
  label: string;
  subtitle: string;
  hostId: string;
  hostName: string;
  isLive: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left flex items-center gap-3 px-3 py-2.5 min-h-11 hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent hover:border-purple-500/40 transition"
      >
        <UserAvatarOnline userId={hostId} username={hostName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{label}</p>
          <p className="text-[11px] text-gray-500 truncate">
            <UsernameDisplay username={hostName} className="inline" />
            {subtitle ? ` · ${subtitle}` : ''}
          </p>
        </div>
        {isLive ? (
          <span className="shrink-0 text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
            LIVE
          </span>
        ) : (
          <span className="shrink-0 text-[10px] font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/30">
            Salon
          </span>
        )}
      </button>
    </li>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="shrink-0">
      <div className="px-4 pt-3 pb-1.5 border-b border-white/5 bg-[#0a0a10]/80">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-purple-300">{title}</h3>
        {hint ? <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{hint}</p> : null}
      </div>
      <ul className="divide-y divide-white/5">{children}</ul>
    </section>
  );
}

export function MapMajorCityLiveSheet({
  cluster,
  onClose,
  onLiveClick,
  onSalonClick,
}: MapMajorCityLiveSheetProps) {
  const { t } = useTranslation();
  const anchoredCount =
    cluster.cityAnchoredSalons.length + cluster.cityAnchoredLives.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center ms-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={cluster.cityLabel}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[min(90dvh,32rem)] rounded-2xl ms-modal-panel bg-[#0e0e14] border border-white/10 shadow-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/25">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M3 21h18" strokeLinecap="round" />
                  <path d="M6 21V9l6-4 6 4v12" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {cluster.cityLabel}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {t('map.majorCitySessionCount', { count: cluster.count })}
              {cluster.liveCount > 0
                ? ` · ${t('map.majorCityLiveCount', { count: cluster.liveCount })}`
                : ''}
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

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {anchoredCount > 0 ? (
            <Section
              title={t('map.majorCityAnchoredSection')}
              hint={t('map.majorCityAnchoredHint')}
            >
              {cluster.cityAnchoredSalons
                .filter((salon) => !salon.isLive)
                .map((salon) => (
                <SessionRow
                  key={`as-${salon.id}`}
                  hostId={salon.hostId}
                  hostName={salon.hostName}
                  label={salon.title}
                  subtitle={`Salon · ${Math.max(0, salon.listenersCount ?? 0)} spectateurs`}
                  isLive={false}
                  onSelect={() => onSalonClick(salon)}
                />
              ))}
              {cluster.cityAnchoredLives.map((live) => (
                <SessionRow
                  key={`al-${live.id}`}
                  hostId={live.hostId}
                  hostName={live.hostName}
                  label={live.title.trim() || live.playbackState.title}
                  subtitle={`Live · ${Math.max(0, live.viewersCount ?? 0)} spectateurs`}
                  isLive
                  onSelect={() => onLiveClick(live)}
                />
              ))}
            </Section>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-gray-500">{t('map.majorCityEmpty')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
