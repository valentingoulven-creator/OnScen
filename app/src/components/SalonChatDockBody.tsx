import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessagesView } from './ChatPanel';
import { SalonQueueSection } from './SalonQueueSection';
import { SalonProposalsSection } from './SalonProposalsSection';
import { SalonYouTubeSearch } from './SalonYouTubeSearch';
import { SalonChatDockPlaylistPicker } from './SalonChatDockPlaylistPicker';
import type { PlaybackState, Salon, SalonQueueItem, SalonTrackProposal } from '../types';

export type SalonChatDockTab = 'chat' | 'queue';
type DockTab = SalonChatDockTab;

const dockTabSvgBase = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function DockTabIcon({ tab }: { tab: DockTab }) {
  const className = 'salon-chat-dock-tab__icon';
  if (tab === 'chat') {
    return (
      <svg {...dockTabSvgBase} className={className} aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  return (
    <svg {...dockTabSvgBase} className={className} aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h12" />
      <path d="M4 17h8" />
    </svg>
  );
}

interface SalonChatDockBodyProps {
  salon: Salon;
  queue: SalonQueueItem[];
  proposals: SalonTrackProposal[];
  loadingProposals?: boolean;
  hostCanControl: boolean;
  participantMode?: boolean;
  skipping?: boolean;
  reordering?: boolean;
  onSkip?: () => void;
  onPlayItem?: (id: string) => void;
  onReorder?: (orderedIds: string[]) => void | Promise<void>;
  onAccept?: (proposalId: string, playNow: boolean) => Promise<void>;
  onReject?: (proposalId: string) => Promise<void>;
  onUpvote?: (proposalId: string) => Promise<void>;
  currentUserId?: string;
  /** YouTube search in queue tab (host/VIP queue mode or participant propose mode). */
  youtubeSearch?: {
    token: string;
    submitMode: 'queue' | 'propose';
    currentTitle: string;
    currentArtist: string;
    onTrackChanged?: (state: PlaybackState) => void;
    onQueueChanged?: (queue: SalonQueueItem[]) => void;
  };
  chatInput?: ReactNode;
  /** Controlled active tab (defaults to internal state when omitted). */
  activeTab?: SalonChatDockTab;
  /** Called when the user clicks a tab — required in controlled mode. */
  onSelectTab?: (tab: SalonChatDockTab) => void;
  /** Actions dans la barre d’onglets (ex. participants) — visible onglet Chat uniquement. */
  chatHeaderExtra?: ReactNode;
  /** Charger une playlist depuis le compte connecté (hôte / modérateur). */
  playlist?: {
    token: string;
    userId: string;
    platform: 'youtube';
    onTrackChanged: (state: PlaybackState) => void;
    onQueueChanged: (queue: SalonQueueItem[]) => void;
  };
}

export interface SalonChatDockTabButtonsProps {
  activeTab: SalonChatDockTab;
  onSelect: (tab: SalonChatDockTab) => void;
  queueBadge?: number;
  showPlaylistButton?: boolean;
  playlistPanelOpen?: boolean;
  onTogglePlaylist?: () => void;
}

export function SalonChatDockTabButtons({
  activeTab,
  onSelect,
  queueBadge,
  showPlaylistButton,
  playlistPanelOpen,
  onTogglePlaylist,
}: SalonChatDockTabButtonsProps) {
  const { t } = useTranslation();

  return (
    <div className="salon-chat-dock-tabs__tabs" role="tablist">
      <DockTabButton
        tab="chat"
        activeTab={activeTab}
        label={t('salon.chatDock.tabChat', { defaultValue: 'Chat' })}
        onSelect={onSelect}
      />
      <DockTabButton
        tab="queue"
        activeTab={activeTab}
        label={t('salon.chatDock.tabQueue', { defaultValue: "File d'attente" })}
        badge={queueBadge}
        onSelect={onSelect}
      />
      {showPlaylistButton && onTogglePlaylist ? (
        <button
          type="button"
          role="tab"
          aria-selected={playlistPanelOpen}
          aria-label={t('salon.chatDock.playlistButton', { defaultValue: 'Ajouter une playlist' })}
          title={t('salon.chatDock.playlistButton', { defaultValue: 'Ajouter une playlist' })}
          onClick={onTogglePlaylist}
          className={`salon-chat-dock-tab${playlistPanelOpen ? ' salon-chat-dock-tab--active' : ''}`}
        >
          <svg
            {...dockTabSvgBase}
            className="salon-chat-dock-tab__icon"
            aria-hidden="true"
          >
            <path d="M21 15V6" />
            <path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
            <path d="M12 12H3" />
            <path d="M16 6H3" />
            <path d="M12 18H3" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function DockTabButton({
  tab,
  activeTab,
  label,
  badge,
  onSelect,
}: {
  tab: DockTab;
  activeTab: DockTab;
  label: string;
  badge?: number;
  onSelect: (tab: DockTab) => void;
}) {
  const active = activeTab === tab;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      title={label}
      onClick={() => onSelect(tab)}
      className={`salon-chat-dock-tab${active ? ' salon-chat-dock-tab--active' : ''}`}
    >
      <DockTabIcon tab={tab} />
      {badge != null && badge > 0 ? (
        <span className="salon-chat-dock-tab__badge" aria-label={`${badge} en file`}>
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  );
}

export function SalonChatDockBody({
  salon,
  queue,
  proposals,
  loadingProposals,
  hostCanControl,
  participantMode = false,
  skipping,
  reordering,
  onSkip,
  onPlayItem,
  onReorder,
  onAccept,
  onReject,
  onUpvote,
  currentUserId,
  youtubeSearch,
  chatInput,
  activeTab: activeTabProp,
  onSelectTab,
  chatHeaderExtra,
  playlist,
}: SalonChatDockBodyProps) {
  const [internalTab, setInternalTab] = useState<DockTab>('chat');
  const [youtubeSearchActive, setYoutubeSearchActive] = useState(false);
  const [playlistPanelOpen, setPlaylistPanelOpen] = useState(false);
  const dockTab = activeTabProp ?? internalTab;
  const handleSelectTab = onSelectTab ?? setInternalTab;
  const queueBadge = queue.length > 0 ? queue.length : undefined;

  const handleTogglePlaylist = () => {
    setPlaylistPanelOpen((open) => {
      const next = !open;
      if (next) handleSelectTab('queue');
      return next;
    });
  };

  return (
    <div className="salon-chat-dock-tabs flex flex-col flex-1 min-h-0">
      <div className="shrink-0 flex items-center gap-2 px-3 min-h-[44px] border-b border-[#1e1e2f] bg-[#0b0b0f]">
        <div className="flex-1 min-w-0">
          <SalonChatDockTabButtons
            activeTab={dockTab}
            onSelect={(tab) => {
              handleSelectTab(tab);
              if (tab === 'chat') setPlaylistPanelOpen(false);
            }}
            queueBadge={queueBadge}
            showPlaylistButton={Boolean(playlist)}
            playlistPanelOpen={playlistPanelOpen}
            onTogglePlaylist={playlist ? handleTogglePlaylist : undefined}
          />
        </div>
        {dockTab === 'chat' && chatHeaderExtra ? (
          <div className="shrink-0">{chatHeaderExtra}</div>
        ) : null}
      </div>
      <div className="salon-chat-dock-tabs__content flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {dockTab === 'chat' ? (
          <>
            <div className="flex-1 min-h-0 h-0 overflow-hidden flex flex-col">
              <ChatMessagesView />
            </div>
            {chatInput ? (
              <div className="room-theater-chat-dock__input shrink-0">{chatInput}</div>
            ) : null}
          </>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2.5 flex flex-col gap-4">
            {playlist && playlistPanelOpen ? (
              <SalonChatDockPlaylistPicker
                salonId={salon.id}
                token={playlist.token}
                userId={playlist.userId}
                onTrackChanged={playlist.onTrackChanged}
                onQueueChanged={playlist.onQueueChanged}
                onLoaded={() => setPlaylistPanelOpen(false)}
              />
            ) : null}
            {youtubeSearch ? (
              <div className="shrink-0">
                <SalonYouTubeSearch
                  salonId={salon.id}
                  token={youtubeSearch.token}
                  currentTitle={youtubeSearch.currentTitle}
                  currentArtist={youtubeSearch.currentArtist}
                  submitMode={youtubeSearch.submitMode}
                  onTrackChanged={youtubeSearch.onTrackChanged}
                  onQueueChanged={youtubeSearch.onQueueChanged}
                  embedded
                  layout="inline"
                  onSearchActiveChange={setYoutubeSearchActive}
                />
              </div>
            ) : null}
            {!youtubeSearchActive ? (
              <>
                <div className="shrink-0">
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
                {!participantMode ? (
                  <SalonProposalsSection
                    isHost={hostCanControl}
                    allowQueue={salon.allowQueue}
                    proposals={proposals}
                    loadingProposals={loadingProposals}
                    currentUserId={currentUserId}
                    onAccept={onAccept}
                    onReject={onReject}
                    onUpvote={onUpvote}
                    compact
                    fillHeight
                  />
                ) : (
                  <SalonProposalsSection
                    isHost={false}
                    allowQueue={salon.allowQueue}
                    proposals={proposals}
                    currentUserId={currentUserId}
                    onUpvote={onUpvote}
                    compact
                    fillHeight
                  />
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
