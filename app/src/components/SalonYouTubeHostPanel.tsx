import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SalonYouTubeSearch } from './SalonYouTubeSearch';
import { SalonYouTubePlaylist } from './SalonYouTubePlaylist';
import { SalonQueueSection } from './SalonQueueSection';
import { SalonProposalsSection } from './SalonProposalsSection';
import type { PlaybackState, Salon, SalonQueueItem, SalonTrackProposal } from '../types';

type HostTab = 'search' | 'playlist' | 'queue' | 'settings';

const svgBase = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function HostTabIcon({ tab }: { tab: HostTab }) {
  const className = 'salon-youtube-host-drawer__tab-icon';
  switch (tab) {
    case 'search':
      return (
        <svg {...svgBase} className={className} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case 'playlist':
      return (
        <svg {...svgBase} className={className} aria-hidden="true">
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </svg>
      );
    case 'queue':
      return (
        <svg {...svgBase} className={className} aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M4 12h12" />
          <path d="M4 17h8" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...svgBase} className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    default:
      return null;
  }
}

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
  /** Participant — même tiroir, onglets en lecture seule / proposition. */
  participantMode?: boolean;
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
  participantMode = false,
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
      hidden: vipOnly || participantMode || !settingsContent,
    },
  ];

  const visibleTabs = tabs.filter((item) => !item.hidden);
  const activeTabIndex = Math.max(
    0,
    visibleTabs.findIndex((item) => item.id === tab),
  );

  const tabRailStyle = {
    '--salon-host-tab-count': visibleTabs.length,
    '--salon-host-tab-index': activeTabIndex,
  } as CSSProperties;

  const tabContent = (() => {
    switch (tab) {
      case 'search':
        if (participantMode) {
          if (!salon.allowQueue) {
            return (
              <p className="text-xs text-gray-500 text-center py-2">
                {t('salon.youtubeHost.proposalsDisabled', {
                  defaultValue: "Les propositions sont désactivées dans ce salon.",
                })}
              </p>
            );
          }
          return (
            <SalonYouTubeSearch
              salonId={salon.id}
              token={token}
              currentTitle={playback.title}
              currentArtist={playback.artist}
              submitMode="propose"
              embedded
            />
          );
        }
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
        if (participantMode) {
          return (
            <div className="space-y-2 py-1">
              <p className="text-[10px] text-gray-500 leading-snug">
                {t('salon.youtubeHost.playlistParticipantHint', {
                  defaultValue:
                    "Seul l'hôte peut lancer une playlist YouTube. Utilisez Recherche pour proposer une vidéo.",
                })}
              </p>
            </div>
          );
        }
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
              onSkip={hostCanControl ? onSkip : undefined}
              onPlayItem={hostCanControl ? onPlayItem : undefined}
              onReorder={hostCanControl ? onReorder : undefined}
              skipping={skipping}
              reordering={reordering}
              compact
              collapsible={false}
            />
            {!participantMode ? (
              <SalonProposalsSection
                isHost={hostCanControl}
                allowQueue={salon.allowQueue}
                proposals={proposals}
                loadingProposals={loadingProposals}
                onAccept={onAccept}
                onReject={onReject}
                compact
              />
            ) : (
              <SalonProposalsSection
                isHost={false}
                allowQueue={salon.allowQueue}
                proposals={proposals}
                compact
              />
            )}
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
      <div className="salon-youtube-host-drawer__chrome">
        <div
          className="salon-youtube-host-drawer__tab-rail"
          role="tablist"
          style={tabRailStyle}
        >
          <span className="salon-youtube-host-drawer__tab-indicator" aria-hidden="true" />
          {visibleTabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-tab={item.id}
                onClick={() => {
                  setTab(item.id);
                  setExpanded(true);
                }}
                className={`salon-youtube-host-drawer__tab${active ? ' salon-youtube-host-drawer__tab--active' : ''}`}
              >
                <span className="salon-youtube-host-drawer__tab-icon-wrap">
                  <HostTabIcon tab={item.id} />
                  {item.badge != null ? (
                    <span className="salon-youtube-host-drawer__tab-badge" aria-label={`${item.badge} en file`}>
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="salon-youtube-host-drawer__tab-label">{item.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="salon-youtube-host-drawer__toggle"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? t('salon.youtubeHost.collapse', { defaultValue: 'Replier le panneau' })
              : t('salon.youtubeHost.expand', { defaultValue: 'Déplier le panneau' })
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className={`salon-youtube-host-drawer__toggle-icon${expanded ? '' : ' salon-youtube-host-drawer__toggle-icon--collapsed'}`}
          >
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
