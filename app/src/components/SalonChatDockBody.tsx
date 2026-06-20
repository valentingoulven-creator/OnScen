import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessagesView } from './ChatPanel';
import { SalonQueueSection } from './SalonQueueSection';
import { SalonProposalsSection } from './SalonProposalsSection';
import { SalonYouTubeSearch } from './SalonYouTubeSearch';
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
}

export interface SalonChatDockTabButtonsProps {
  activeTab: SalonChatDockTab;
  onSelect: (tab: SalonChatDockTab) => void;
  queueBadge?: number;
}

export function SalonChatDockTabButtons({
  activeTab,
  onSelect,
  queueBadge,
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
}: SalonChatDockBodyProps) {
  const [internalTab] = useState<DockTab>('chat');
  const [youtubeSearchActive, setYoutubeSearchActive] = useState(false);
  const dockTab = activeTabProp ?? internalTab;

  return (
    <div className="salon-chat-dock-tabs flex flex-1 min-h-0 h-full">
      <div className="salon-chat-dock-tabs__content flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {dockTab === 'chat' ? (
          <>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <ChatMessagesView />
            </div>
            {chatInput ? (
              <div className="room-theater-chat-dock__input shrink-0">{chatInput}</div>
            ) : null}
          </>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden p-2.5 flex flex-col gap-4">
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
