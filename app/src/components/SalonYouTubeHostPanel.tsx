import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SalonYouTubePlaylist } from './SalonYouTubePlaylist';
import { SalonQueueSection } from './SalonQueueSection';
import { SalonProposalsSection } from './SalonProposalsSection';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import { CompactTagChips } from './CompactTagChips';
import { api } from '../lib/api';
import { formatCompactCount } from '../lib/formatCount';
import type { PlaybackState, Salon, SalonQueueItem, SalonTrackProposal, User } from '../types';

type HostTab = 'playlist' | 'queue' | 'settings' | 'profil';

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
    case 'profil':
      return (
        <svg {...svgBase} className={className} aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21c0-3.314 2.686-6 6-6s6 2.686 6 6" />
        </svg>
      );
    default:
      return null;
  }
}

// ─── Host profile tab ────────────────────────────────────────────────────────

function HostProfilTab({
  salon,
  token,
  onOpenProfile,
}: {
  salon: Salon;
  token: string;
  onOpenProfile?: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullBio, setShowFullBio] = useState(false);

  useEffect(() => {
    if (!token || !salon.hostId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getUserProfile(token, salon.hostId)
      .then((res) => { if (!cancelled) setProfile(res.user); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Profil introuvable'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, salon.hostId]);

  const username = profile?.username ?? salon.hostName;
  const usernameColor = profile?.usernameColor ?? salon.hostUsernameColor;
  const usernameWaveFrom = profile?.usernameWaveFrom ?? salon.hostUsernameWaveFrom;
  const usernameWaveTo = profile?.usernameWaveTo ?? salon.hostUsernameWaveTo;
  const avatarUrl = profile?.avatarUrl ?? salon.hostAvatarUrl;

  if (loading) {
    return (
      <div className="flex flex-col gap-4 py-3 animate-pulse">
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-[#1e1e2f]" />
          <div className="h-4 w-28 bg-[#1e1e2f] rounded-lg" />
          <div className="h-3 w-16 bg-[#1e1e2f] rounded" />
        </div>
        <div className="flex rounded-2xl bg-[#12121a] border border-[#1e1e2f] overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 py-3 flex flex-col items-center gap-1.5">
              <div className="h-5 w-10 bg-[#1e1e2f] rounded" />
              <div className="h-2 w-8 bg-[#1e1e2f] rounded mt-0.5" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-[#1e1e2f] rounded" />
          <div className="h-3 w-4/5 bg-[#1e1e2f] rounded" />
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <UserAvatarOnline
          userId={salon.hostId}
          avatarUrl={salon.hostAvatarUrl}
          username={salon.hostName}
          size="xl"
        />
        <UsernameDisplay
          username={salon.hostName}
          usernameColor={salon.hostUsernameColor}
          usernameWaveFrom={salon.hostUsernameWaveFrom}
          usernameWaveTo={salon.hostUsernameWaveTo}
          className="text-sm font-semibold leading-tight"
        />
        <p className="text-[11px] text-red-400/80">{error}</p>
        {onOpenProfile && (
          <button
            type="button"
            onClick={() => onOpenProfile(salon.hostId)}
            className="mt-1 px-4 py-2 rounded-lg text-xs font-semibold bg-[#42426a] text-white hover:bg-[#52527a] active:scale-95 transition"
          >
            {t('salon.youtubeHost.viewFullProfile', { defaultValue: 'Voir le profil complet' })}
          </button>
        )}
      </div>
    );
  }

  const bioText = profile?.bio?.trim() ?? '';
  const BIO_LIMIT = 100;
  const bioIsTruncatable = bioText.length > BIO_LIMIT;

  const statsItems = [
    { value: formatCompactCount(profile?.favoritesCount ?? 0), label: 'Favoris' },
    { value: formatCompactCount(profile?.subscriberCount ?? 0), label: 'Abonnés' },
    { value: formatCompactCount(profile?.stats?.salonsHosted ?? 0), label: 'Salons' },
  ];

  return (
    <div className="flex flex-col gap-4 py-3">
      {/* Avatar + username + listener count */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="rounded-full p-[2px] bg-gradient-to-tr from-purple-600 via-pink-500 to-purple-400 shadow-[0_0_18px_rgba(168,85,247,0.4)]">
          <div className="rounded-full bg-[#0d0d15] p-0.5">
            <UserAvatarOnline
              userId={salon.hostId}
              avatarUrl={avatarUrl}
              username={username}
              size="xl"
            />
          </div>
        </div>
        <UsernameDisplay
          username={username}
          usernameColor={usernameColor}
          usernameWaveFrom={usernameWaveFrom}
          usernameWaveTo={usernameWaveTo}
          className="text-sm font-semibold leading-tight"
        />
        <p className="text-[11px] text-gray-400">
          {salon.listenersCount}{' '}
          {salon.listenersCount === 1
            ? t('salon.youtubeHost.profilListenerSingular', { defaultValue: 'auditeur' })
            : t('salon.youtubeHost.profilListenerPlural', { defaultValue: 'auditeurs' })}
        </p>
      </div>

      {/* Stats row */}
      <div className="flex rounded-2xl bg-[#12121a] border border-[#1e1e2f] overflow-hidden">
        {statsItems.map((item, i) => (
          <div key={item.label} className="flex-1 relative">
            {i > 0 && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-7 bg-[#1e1e2f]" />
            )}
            <div className="w-full py-3 flex flex-col items-center gap-0.5">
              <span className="text-base font-extrabold text-white tabular-nums leading-none">
                {item.value}
              </span>
              <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mt-0.5">
                {item.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bio */}
      {bioText ? (
        <div>
          <p className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
            {bioIsTruncatable && !showFullBio
              ? bioText.slice(0, BIO_LIMIT) + '…'
              : bioText}
          </p>
          {bioIsTruncatable && (
            <button
              type="button"
              onClick={() => setShowFullBio((v) => !v)}
              className="mt-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition"
            >
              {showFullBio ? 'voir moins' : 'voir plus'}
            </button>
          )}
        </div>
      ) : null}

      {/* Genres favoris & Centres d'intérêt chips */}
      <CompactTagChips
        interests={profile?.interests ?? []}
        genres={profile?.favoriteGenres ?? []}
        artists={[]}
        align="start"
      />

      {/* Voir le profil complet */}
      {onOpenProfile ? (
        <button
          type="button"
          onClick={() => onOpenProfile(salon.hostId)}
          className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#1a1a28] border border-[#2d2d42] text-purple-300 hover:bg-[#22223a] hover:border-purple-500/40 hover:text-purple-200 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M6 21c0-3.314 2.686-6 6-6s6 2.686 6 6" />
          </svg>
          {t('salon.youtubeHost.viewFullProfile', { defaultValue: 'Voir le profil complet' })}
        </button>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
  /** Ouvre le profil complet d'un utilisateur (remonté depuis App). */
  onOpenProfile?: (userId: string) => void;
}

const TAB_ORDER: HostTab[] = ['playlist', 'queue', 'settings', 'profil'];

function readExpanded(): boolean {
  return false;
}

export function SalonYouTubeHostPanel({
  salon,
  token,
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
  onOpenProfile,
}: SalonYouTubeHostPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(readExpanded);
  const [tab, setTab] = useState<HostTab>('queue');

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
    {
      id: 'profil',
      label: t('salon.youtubeHost.tabProfil', { defaultValue: 'Profil' }),
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
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
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
            </div>
            <div className="flex-1 min-w-0">
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
          </div>
        );
      case 'settings':
        return settingsContent ?? null;
      case 'profil':
        return (
          <HostProfilTab
            salon={salon}
            token={token}
            onOpenProfile={onOpenProfile}
          />
        );
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
