import { useCallback, useState, type ReactNode } from 'react';
import { FloatingSalonChat } from './FloatingSalonChat';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../lib/storageKeys';

const DOCK_MODE_KEY = STORAGE_KEYS.theaterChatDockMode;

export type TheaterChatDock = 'floating' | 'bottom' | 'right' | 'left';

function readDockMode(): 'floating' | 'right' {
  try {
    const v = getStorageItem(DOCK_MODE_KEY);
    if (v === 'floating' || v === 'right') return v;
  } catch {
    /* ignore */
  }
  return 'right';
}

function ChatLayoutToggle({
  dockMode,
  onToggle,
}: {
  dockMode: 'floating' | 'right';
  onToggle: () => void;
}) {
  const toFloating = dockMode === 'right';
  return (
    <button
      type="button"
      onClick={onToggle}
      title={toFloating ? 'Mode flottant sur la vidéo' : 'Colonne fixe à droite'}
      className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/10 transition"
      aria-label={toFloating ? 'Passer en mode flottant' : 'Passer en colonne à droite'}
      aria-pressed={dockMode === 'floating'}
    >
      {toFloating ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="1" y="1" width="6.5" height="10" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="8" y="1" width="3" height="10" rx="0.8" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      )}
    </button>
  );
}

function DockChatBody({ chat, chatInput }: { chat: ReactNode; chatInput?: ReactNode }) {
  return (
    <div className="room-theater-chat-dock__body flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{chat}</div>
      {chatInput ? <div className="room-theater-chat-dock__input shrink-0">{chatInput}</div> : null}
    </div>
  );
}

function DockedChatHeader({
  chatTitle,
  chatHeaderExtra,
  dockMode,
  onToggleDock,
  onToggleChat,
  onToggleMinimize,
  chatMinimized,
  showDockToggle = true,
}: {
  chatTitle: string;
  chatHeaderExtra?: ReactNode;
  dockMode: 'floating' | 'right';
  onToggleDock: () => void;
  onToggleChat: () => void;
  onToggleMinimize?: () => void;
  chatMinimized?: boolean;
  showDockToggle?: boolean;
}) {
  return (
    <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-[#1e1e2f] bg-[#14141c]/80">
      <span className="text-purple-400 text-[10px]" aria-hidden>
        💬
      </span>
      <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex-1 truncate min-w-0">
        {chatTitle}
      </p>
      {chatHeaderExtra}
      {showDockToggle ? <ChatLayoutToggle dockMode={dockMode} onToggle={onToggleDock} /> : null}
      {onToggleMinimize && (
        <button
          type="button"
          onClick={onToggleMinimize}
          title={chatMinimized ? 'Agrandir' : 'Réduire'}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/10 transition"
          aria-label={chatMinimized ? 'Agrandir le chat' : 'Réduire le chat'}
          aria-expanded={!chatMinimized}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            {chatMinimized ? (
              <polyline
                points="1,7 5,3 9,7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <polyline
                points="1,3 5,7 9,3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={onToggleChat}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/10 transition text-lg leading-none"
        aria-label="Masquer le chat"
      >
        ×
      </button>
    </div>
  );
}

export interface RoomTheaterLayoutProps {
  stage: ReactNode;
  chat: ReactNode;
  /** Barre de saisie sous la vidéo (hors fenêtre flottante). */
  chatInput?: ReactNode;
  chatHidden: boolean;
  onToggleChat: () => void;
  /** Contenu défilable sous la scène vidéo (file, réglages host…). */
  stageFooter?: ReactNode;
  chatTitle?: string;
  /** Actions hôte dans l'en-tête du chat ancré (ex. participants). */
  chatHeaderExtra?: ReactNode;
  /** Chat réduit au bandeau d'en-tête uniquement (contenu masqué). */
  chatMinimized?: boolean;
  onToggleMinimize?: () => void;
  /**
   * theater — scène vidéo + chat (YouTube, Live).
   * queue-chat — colonne file à gauche, chat ancré à droite (salon YouTube).
   */
  variant?: 'theater' | 'queue-chat';
  /**
   * right — colonne fixe à droite de la vidéo.
   * left — colonne fixe à gauche de la vidéo (salon YouTube).
   * floating — fenêtre flottante sur la vidéo (option utilisateur).
   * bottom — messages dans le panneau bas sous la saisie (Live).
   */
  chatDock?: TheaterChatDock;
  /** false = colonne fixe uniquement (pas de chat flottant sur la vidéo). */
  allowFloatingChat?: boolean;
  /**
   * scroll — panneau bas classique (max 38dvh).
   * drawer — tiroir repliable (salons YouTube).
   */
  stageFooterMode?: 'scroll' | 'drawer';
  /**
   * true — colonne chat alignée sur la scène vidéo 16:9 uniquement (contrôles sous la vidéo).
   */
  sideDockMatchHero?: boolean;
}

export function RoomTheaterLayout({
  stage,
  chat,
  chatInput,
  chatHidden,
  onToggleChat,
  stageFooter,
  chatTitle = 'Chat',
  chatHeaderExtra,
  chatMinimized = false,
  onToggleMinimize,
  variant = 'theater',
  chatDock: chatDockProp = 'right',
  allowFloatingChat = true,
  stageFooterMode = 'scroll',
  sideDockMatchHero = false,
}: RoomTheaterLayoutProps) {
  const [dockMode, setDockMode] = useState<'floating' | 'right'>(() =>
    allowFloatingChat ? readDockMode() : 'right'
  );

  const toggleDockMode = useCallback(() => {
    setDockMode((current) => {
      const next = current === 'right' ? 'floating' : 'right';
      try {
        setStorageItem(DOCK_MODE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const theaterDock: TheaterChatDock =
    chatDockProp === 'bottom'
      ? 'bottom'
      : chatDockProp === 'left'
        ? 'left'
        : chatDockProp === 'floating'
          ? 'floating'
          : allowFloatingChat
            ? dockMode
            : 'right';

  const layoutToggleExtra =
    allowFloatingChat && theaterDock !== 'bottom' && theaterDock !== 'left' ? (
      <ChatLayoutToggle dockMode={theaterDock === 'floating' ? 'floating' : 'right'} onToggle={toggleDockMode} />
    ) : null;

  if (variant === 'queue-chat') {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        <div className="relative flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden bg-[#0b0b0f]">
          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
            {stage ? <div className="shrink-0">{stage}</div> : null}
            {stageFooter ? (
              <div className="room-theater-stage-footer flex-1 min-h-0 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
                {stageFooter}
              </div>
            ) : null}
          </div>

          {!chatHidden ? (
            <aside className="room-theater-chat-dock shrink-0 flex flex-col min-h-0 border-t sm:border-t-0 sm:border-l border-[#1e1e2f] bg-[#101018]">
              <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-[#1e1e2f] bg-[#14141c]/80">
                <span className="text-purple-400 text-[10px]" aria-hidden>
                  💬
                </span>
                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex-1 truncate min-w-0">
                  {chatTitle}
                </p>
                {chatHeaderExtra}
                <button
                  type="button"
                  onClick={onToggleChat}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/10 transition text-lg leading-none"
                  aria-label="Masquer le chat"
                >
                  ×
                </button>
              </div>
              <DockChatBody chat={chat} chatInput={chatInput} />
            </aside>
          ) : (
            <button
              type="button"
              onClick={onToggleChat}
              className="absolute top-2 right-2 z-[25] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a1a26]/90 border border-purple-500/40 text-[10px] font-bold text-purple-300 backdrop-blur hover:border-purple-400 transition pointer-events-auto"
              aria-label="Afficher le chat"
            >
              <span aria-hidden>💬</span>
              Chat
            </button>
          )}
        </div>
      </div>
    );
  }

  const showLeftDock = !chatHidden && theaterDock === 'left';
  const showRightDock = !chatHidden && theaterDock === 'right';
  const showFloating = !chatHidden && theaterDock === 'floating';
  const showSideDock = showLeftDock || showRightDock;
  const useMatchHero = sideDockMatchHero && showSideDock;
  const sideRowClass = showSideDock
    ? ` room-theater-side-row${showRightDock ? ' room-theater-side-row--right' : ' room-theater-side-row--left'}${
        useMatchHero ? ' room-theater-side-row--match-hero' : ''
      }`
    : '';
  const sideRowFlex = useMatchHero ? 'shrink-0' : 'flex-1';

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className={`${sideRowFlex} min-h-0 flex flex-col overflow-hidden${sideRowClass || ' sm:flex-row'}`}>
          {showLeftDock && (
            <aside className="room-theater-chat-dock room-theater-chat-dock--theater room-theater-chat-dock--left hidden sm:flex flex-col min-h-0 min-w-0 border-r border-[#1e1e2f] bg-[#101018]">
              <DockedChatHeader
                chatTitle={chatTitle}
                chatHeaderExtra={chatHeaderExtra}
                dockMode="right"
                onToggleDock={() => {}}
                onToggleChat={onToggleChat}
                onToggleMinimize={onToggleMinimize}
                chatMinimized={chatMinimized}
                showDockToggle={false}
              />
              {!chatMinimized && <DockChatBody chat={chat} chatInput={chatInput} />}
            </aside>
          )}

          <div
            className={`room-theater-video-stage relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden bg-black${
              useMatchHero ? ' room-theater-video-stage--match-hero' : ''
            }`}
          >
            {stage}

            {showFloating && (
              <FloatingSalonChat
                title={chatTitle}
                headerExtra={
                  <>
                    {chatHeaderExtra}
                    {layoutToggleExtra}
                  </>
                }
                minimized={chatMinimized}
                onToggleMinimize={onToggleMinimize}
                onHide={onToggleChat}
              >
                {chat}
              </FloatingSalonChat>
            )}

            {chatHidden && (
              <button
                type="button"
                onClick={onToggleChat}
                className="absolute top-2 right-2 z-[25] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a1a26]/90 border border-purple-500/40 text-[10px] font-bold text-purple-300 backdrop-blur hover:border-purple-400 transition pointer-events-auto"
                aria-label="Afficher le chat"
              >
                <span aria-hidden>💬</span>
                Chat
              </button>
            )}
          </div>

          {showRightDock && (
            <aside className="room-theater-chat-dock room-theater-chat-dock--theater hidden sm:flex flex-col min-h-0 min-w-0 border-l border-[#1e1e2f] bg-[#101018]">
              <DockedChatHeader
                chatTitle={chatTitle}
                chatHeaderExtra={chatHeaderExtra}
                dockMode="right"
                onToggleDock={allowFloatingChat ? toggleDockMode : () => {}}
                onToggleChat={onToggleChat}
                onToggleMinimize={onToggleMinimize}
                chatMinimized={chatMinimized}
                showDockToggle={allowFloatingChat}
              />
              {!chatMinimized && <DockChatBody chat={chat} chatInput={chatInput} />}
            </aside>
          )}
        </div>

        {showSideDock && (
          <div className="room-theater-mobile-chat-sheet sm:hidden shrink-0 flex flex-col border-t border-[#1e1e2f] bg-[#101018] pb-[env(safe-area-inset-bottom)]">
            <DockedChatHeader
              chatTitle={chatTitle}
              chatHeaderExtra={chatHeaderExtra}
              dockMode="right"
              onToggleDock={allowFloatingChat ? toggleDockMode : () => {}}
              onToggleChat={onToggleChat}
              onToggleMinimize={onToggleMinimize}
              chatMinimized={chatMinimized}
              showDockToggle={allowFloatingChat && !showLeftDock}
            />
            {!chatMinimized && <DockChatBody chat={chat} chatInput={chatInput} />}
          </div>
        )}

        {showFloating && chatInput ? <div className="shrink-0 pointer-events-auto">{chatInput}</div> : null}

        {!chatHidden && theaterDock === 'bottom' ? (
          <div className="room-theater-bottom-chat-dock shrink-0 flex flex-col border-t border-[#1e1e2f] bg-[#0b0b0f]/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
            <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-[#1e1e2f] bg-[#14141c]/80">
              <span className="text-purple-400 text-[10px]" aria-hidden>
                💬
              </span>
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex-1 truncate min-w-0">
                {chatTitle}
              </p>
              {chatHeaderExtra}
              <button
                type="button"
                onClick={onToggleChat}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/10 transition text-lg leading-none"
                aria-label="Masquer le chat"
              >
                ×
              </button>
            </div>
            <DockChatBody chat={chat} chatInput={chatInput ? <div className="pointer-events-auto">{chatInput}</div> : undefined} />
          </div>
        ) : null}

        {stageFooter ? (
          <div
            className={
              stageFooterMode === 'drawer'
                ? 'shrink-0 salon-youtube-host-drawer-wrap pb-[env(safe-area-inset-bottom)]'
                : 'shrink-0 max-h-[38dvh] overflow-y-auto border-t border-[#1e1e2f] bg-[#0b0b0f]/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]'
            }
          >
            {stageFooter}
          </div>
        ) : null}
      </div>
    </div>
  );
}
