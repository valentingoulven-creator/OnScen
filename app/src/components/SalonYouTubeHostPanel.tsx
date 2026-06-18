import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SalonYouTubeSearch } from './SalonYouTubeSearch';
import { SalonYouTubePlaylist } from './SalonYouTubePlaylist';
import { SalonQueueSection } from './SalonQueueSection';
import { SalonProposalsSection } from './SalonProposalsSection';
import type { PlaybackState, Salon, SalonQueueItem, SalonTrackProposal } from '../types';

type HostTab = 'search' | 'playlist' | 'queue' | 'settings';

interface SalonYouTubeHostPanelProps {
  salon: Salon;
  token: string;
  playback: PlaybackState;
  queue: SalonQueueItem[];
  proposals: SalonTrackProposal[];
  loadingProposals?: boolean;
  hostCanControl: boolean;
  skipping?: boolean;
  reordering?: boolean;
  accessSaving?: boolean;
  validatingGuests?: boolean;
  pendingGuestIds: Set<string>;
  contacts: { id: string; username: string }[];
  onQueueChanged: (queue: SalonQueueItem[]) => void;
  onTrackChanged: (state: PlaybackState) => void;
  onSkip?: () => void;
  onPlayItem?: (id: string) => void;
  onReorder?: (orderedIds: string[]) => void | Promise<void>;
  onAccept?: (proposalId: string, playNow: boolean) => Promise<void>;
  onReject?: (proposalId: string) => Promise<void>;
  settingsContent?: ReactNode;
  /** Modérateur VIP sans playlist ni réglages. */
  vipOnly?: boolean;
}

const TAB_ORDER: HostTab[] = ['search', 'playlist', 'queue', 'settings'];

function readExpanded(): boolean {
  return false;
}

export function SalonYouTubeHostPanel({
  salon,
  token,
  playback,
  queue,
  proposals,
  loadingProposals,
  hostCanControl,
  skipping,
  reordering,
  settingsContent,
  vipOnly = false,
  onQueueChanged,
  onTrackChanged,
  onSkip,
  onPlayItem,
  onReorder,
  onAccept,
  onReject,
}: SalonYouTubeHostPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(readExpanded);
  const [tab, setTab] = useState<HostTab>('search');

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 640 && expanded) {
        /* Ne force pas la fermeture si l'utilisateur a ouvert manuellement. */
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [expanded]);

  const tabs: { id: HostTab; label: string; badge?: number; hidden?: boolean }[] = [
    { id: 'search', label: t('salon.youtubeHost.tabSearch', { defaultValue: 'Recherche' }) },
    {
      id: 'playlist',
      label: t('salon.youtubeHost.tabPlaylist', { defaultValue: 'Playlist' }),
      hidden: vipOnly,
    },
    {
      id: 'queue',
      label: t('salon.youtubeHost.tabQueue', { defaultValue: 'File' }),
      badge: queue.length > 0 ? queue.length : undefined,
    },
    {
      id: 'settings',
      label: t('salon.youtubeHost.tabSettings', { defaultValue: 'Réglages' }),
      hidden: vipOnly || !settingsContent,
    },
  ];

  const visibleTabs = tabs.filter((item) => !item.hidden);

  const tabContent = (() => {
    switch (tab) {
      case 'search':
        return (
          <SalonYouTubeSearch
            salonId={salon.id}
            token={token}
            currentTitle={playback.title}
            currentArtist={playback.artist}
            onQueueChanged={onQueueChanged}
            embedded
          />
        );
      case 'playlist':
        return (
          <SalonYouTubePlaylist
            salonId={salon.id}
            token={token}
            onTrackChanged={onTrackChanged}
            onQueueChanged={onQueueChanged}
            embedded
          />
        );
      case 'queue':
        return (
          <div className="space-y-3">
            <SalonQueueSection
              queue={queue}
              isHost={hostCanControl}
              allowQueue={salon.allowQueue}
              salonId={salon.id}
              onSkip={onSkip}
              onPlayItem={onPlayItem}
              onReorder={onReorder}
              skipping={skipping}
              reordering={reordering}
              compact
              collapsible={false}
            />
            <SalonProposalsSection
              isHost={hostCanControl}
              allowQueue={salon.allowQueue}
              proposals={proposals}
              loadingProposals={loadingProposals}
              onAccept={onAccept}
              onReject={onReject}
              compact
            />
          </div>
        );
      case 'settings':
        return settingsContent ?? null;
      default:
        return null;
    }
  })();

  return (
    <div
      className={`salon-youtube-host-drawer${expanded ? ' salon-youtube-host-drawer--expanded' : ''}`}
      data-expanded={expanded ? 'true' : 'false'}
    >
      <div className="salon-youtube-host-drawer__chrome flex items-center gap-1 px-2 py-1.5 border-t border-[#1e1e2f] bg-[#0b0b0f]/98 backdrop-blur-md">
        <div className="flex flex-1 min-w-0 items-center gap-0.5" role="tablist">
          {visibleTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => {
                setTab(item.id);
                setExpanded(true);
              }}
              className={`salon-youtube-host-drawer__tab flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition ${
                tab === item.id
                  ? 'bg-purple-600/25 text-purple-200 border border-purple-500/35'
                  : 'text-[#6b6b8a] hover:text-gray-300 border border-transparent'
              }`}
            >
              <span className="truncate">{item.label}</span>
              {item.badge != null ? (
                <span className="ml-1 tabular-nums text-purple-300/90">({item.badge})</span>
              ) : null}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#6b6b8a] hover:text-white hover:bg-white/5 transition"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? t('salon.youtubeHost.collapse', { defaultValue: 'Replier le panneau' })
              : t('salon.youtubeHost.expand', { defaultValue: 'Déplier le panneau' })
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className={expanded ? '' : 'rotate-180'}>
            <polyline
              points="6,14 12,8 18,14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div
        className="salon-youtube-host-drawer__content px-3 pt-3 pb-2"
        hidden={!expanded}
        aria-hidden={!expanded}
      >
        {tabContent}
      </div>
    </div>
  );
}

export function isYoutubeHostDrawerTab(value: string): value is HostTab {
  return TAB_ORDER.includes(value as HostTab);
}
