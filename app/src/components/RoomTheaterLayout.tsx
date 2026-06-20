import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { FloatingSalonChat } from './FloatingSalonChat';

const DOCK_MODE_KEY = 'soundly_theater_chat_dock_mode';
const CHAT_DOCK_WIDTH_KEY = 'salon-theater-chat-width';
const CHAT_DOCK_MIN_WIDTH = 240;
const CHAT_DOCK_MAX_WIDTH = 480;

function getChatDockMaxWidth(viewportWidth = window.innerWidth) {
  return Math.min(CHAT_DOCK_MAX_WIDTH, Math.floor(viewportWidth * 0.5));
}

function clampChatDockWidth(width: number, viewportWidth = window.innerWidth) {
  return Math.min(getChatDockMaxWidth(viewportWidth), Math.max(CHAT_DOCK_MIN_WIDTH, Math.round(width)));
}

function readChatDockWidth(): number | null {
  try {
    const raw = localStorage.getItem(CHAT_DOCK_WIDTH_KEY);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return clampChatDockWidth(n);
  } catch {
    return null;
  }
}

function persistChatDockWidth(width: number) {
  try {
    localStorage.setItem(CHAT_DOCK_WIDTH_KEY, String(width));
  } catch {
    /* ignore */
  }
}

export type TheaterChatDock = 'floating' | 'bottom' | 'right' | 'left';

function readDockMode(): 'floating' | 'right' {
  try {
    const v = localStorage.getItem(DOCK_MODE_KEY);
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

function useTheaterChatDockWidth() {
  const [width, setWidthState] = useState<number | null>(() => readChatDockWidth());

  const setWidth = useCallback((next: number, options?: { persist?: boolean }) => {
    const clamped = clampChatDockWidth(next);
    setWidthState(clamped);
    if (options?.persist !== false) {
      persistChatDockWidth(clamped);
    }
  }, []);

  const commitWidth = useCallback(
    (next: number) => {
      setWidth(next, { persist: true });
    },
    [setWidth]
  );

  useEffect(() => {
    const onResize = () => {
      setWidthState((current) => {
        if (current === null) return null;
        const clamped = clampChatDockWidth(current);
        if (clamped !== current) persistChatDockWidth(clamped);
        return clamped;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return { width, setWidth, commitWidth };
}

function TheaterChatDockResizeHandle({
  dockEdge,
  asideRef,
  width,
  setWidth,
  commitWidth,
  onDraggingChange,
}: {
  dockEdge: 'left' | 'right';
  asideRef: RefObject<HTMLElement | null>;
  width: number | null;
  setWidth: (width: number, options?: { persist?: boolean }) => void;
  commitWidth: (width: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const resizeRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startWidth: number;
    lastWidth: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const handleEdge = dockEdge === 'left' ? 'right' : 'left';

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const measured = asideRef.current?.getBoundingClientRect().width;
    const startWidth = width ?? measured ?? 320;
    const clampedStart = clampChatDockWidth(startWidth);
    resizeRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startWidth: clampedStart,
      lastWidth: clampedStart,
    };
    setDragging(true);
    onDraggingChange?.(true);
    setPreviewWidth(clampedStart);
    setWidth(clampedStart, { persist: false });
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize?.active || e.pointerId !== resize.pointerId) return;
      e.preventDefault();
      const delta = e.clientX - resize.startX;
      const next = dockEdge === 'right' ? resize.startWidth - delta : resize.startWidth + delta;
      const clamped = clampChatDockWidth(next);
      if (clamped === resize.lastWidth) return;
      resize.lastWidth = clamped;
      setPreviewWidth(clamped);
      setWidth(clamped, { persist: false });
    };

    const onEnd = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize?.active || e.pointerId !== resize.pointerId) return;
      commitWidth(resize.lastWidth);
      resizeRef.current = null;
      setDragging(false);
      onDraggingChange?.(false);
      setPreviewWidth(null);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [commitWidth, dockEdge, onDraggingChange, setWidth]);

  return (
    <>
      <div
        className={`room-theater-chat-dock__resize-handle room-theater-chat-dock__resize-handle--${handleEdge}${
          dragging ? ' room-theater-chat-dock__resize-handle--active' : ''
        }`}
        onPointerDown={onPointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={previewWidth ?? width ?? undefined}
        aria-valuemin={CHAT_DOCK_MIN_WIDTH}
        aria-valuemax={getChatDockMaxWidth()}
        aria-label="Redimensionner le chat"
        title="Glisser pour ajuster la largeur du chat"
      />
      {dragging && previewWidth !== null ? (
        <div className="room-theater-chat-dock__resize-label" aria-live="polite">
          {previewWidth} px
        </div>
      ) : null}
    </>
  );
}

function TheaterChatDockAside({
  dockEdge,
  width,
  setWidth,
  commitWidth,
  resizable,
  resizing,
  onDraggingChange,
  className,
  children,
}: {
  dockEdge: 'left' | 'right';
  width: number | null;
  setWidth: (width: number, options?: { persist?: boolean }) => void;
  commitWidth: (width: number) => void;
  resizable?: boolean;
  resizing?: boolean;
  onDraggingChange?: (dragging: boolean) => void;
  className: string;
  children: ReactNode;
}) {
  const asideRef = useRef<HTMLElement>(null);
  const widthStyle: CSSProperties | undefined =
    width !== null
      ? {
          width: `${width}px`,
          minWidth: `${width}px`,
          maxWidth: `${width}px`,
          flex: 'none',
        }
      : undefined;

  return (
    <aside
      ref={asideRef}
      className={`${className}${resizable ? ' room-theater-chat-dock--resizable' : ''}${
        width !== null ? ' room-theater-chat-dock--custom-width' : ''
      }${resizing ? ' room-theater-chat-dock--resizing' : ''}`}
      style={widthStyle}
    >
      {resizable ? (
        <TheaterChatDockResizeHandle
          dockEdge={dockEdge}
          asideRef={asideRef}
          width={width}
          setWidth={setWidth}
          commitWidth={commitWidth}
          onDraggingChange={onDraggingChange}
        />
      ) : null}
      {children}
    </aside>
  );
}

function DockedChatHeader({
  chatTitle,
  chatTitleIcon = '💬',
  chatHeaderExtra,
  dockMode,
  onToggleDock,
  onToggleChat,
  onToggleMinimize,
  chatMinimized,
  showDockToggle = true,
}: {
  chatTitle: string;
  chatTitleIcon?: ReactNode;
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
        {chatTitleIcon}
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
  /** Emoji or icon shown before the dock title (default 💬). */
  chatTitleIcon?: ReactNode;
  /** Actions hôte dans l'en-tête du chat ancré (ex. participants). */
  chatHeaderExtra?: ReactNode;
  /** Chat réduit au bandeau d'en-tête uniquement (contenu masqué). */
  chatMinimized?: boolean;
  onToggleMinimize?: () => void;
  /**
   * theater — scène vidéo + chat (YouTube, Live).
   * queue-chat — colonne file à gauche, chat ancré à droite (salon Spotify).
   */
  variant?: 'theater' | 'queue-chat';
  /**
   * right — colonne fixe à droite de la vidéo.
   * left — colonne fixe à gauche de la vidéo (salon YouTube).
   * floating — fenêtre flottante sur la vidéo (option utilisateur).
   * bottom — messages dans le panneau bas sous la saisie (Live).
   */
  chatDock?: TheaterChatDock;
  /**
   * scroll — panneau bas classique (max 38dvh).
   * drawer — tiroir repliable (salons YouTube).
   */
  stageFooterMode?: 'scroll' | 'drawer';
  /** false = colonne fixe uniquement (pas de chat flottant sur la vidéo). */
  allowFloatingChat?: boolean;
  /**
   * true — chat + tiroir hôte empilés sous la vidéo, même largeur que le lecteur 16:9 (salon YouTube).
   */
  stackBelowVideo?: boolean;
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
  chatTitleIcon,
  chatHeaderExtra,
  chatMinimized = false,
  onToggleMinimize,
  variant = 'theater',
  chatDock: chatDockProp = 'right',
  stageFooterMode = 'scroll',
  allowFloatingChat = true,
  stackBelowVideo = false,
  sideDockMatchHero = false,
}: RoomTheaterLayoutProps) {
  const { width: chatDockWidth, setWidth: setChatDockWidth, commitWidth: commitChatDockWidth } =
    useTheaterChatDockWidth();
  const [chatDockResizing, setChatDockResizing] = useState(false);
  const [dockMode, setDockMode] = useState<'floating' | 'right'>(() =>
    allowFloatingChat ? readDockMode() : 'right'
  );

  useEffect(() => {
    if (!chatDockResizing) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [chatDockResizing]);

  const toggleDockMode = useCallback(() => {
    setDockMode((current) => {
      const next = current === 'right' ? 'floating' : 'right';
      try {
        localStorage.setItem(DOCK_MODE_KEY, next);
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

  const chatDockAsideProps = {
    width: chatDockWidth,
    setWidth: setChatDockWidth,
    commitWidth: commitChatDockWidth,
    resizable: true as const,
    resizing: chatDockResizing,
  };

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
            <TheaterChatDockAside
              dockEdge="right"
              {...chatDockAsideProps}
              onDraggingChange={setChatDockResizing}
              className="room-theater-chat-dock shrink-0 flex flex-col min-h-0 border-t sm:border-t-0 sm:border-l border-[#1e1e2f] bg-[#101018]"
            >
              <DockedChatHeader
                chatTitle={chatTitle}
                chatTitleIcon={chatTitleIcon}
                chatHeaderExtra={chatHeaderExtra}
                dockMode="right"
                onToggleDock={() => {}}
                onToggleChat={onToggleChat}
                onToggleMinimize={onToggleMinimize}
                chatMinimized={chatMinimized}
                showDockToggle={false}
              />
              {!chatMinimized && <DockChatBody chat={chat} chatInput={chatInput} />}
            </TheaterChatDockAside>
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
  const showBottomDock = !chatHidden && theaterDock === 'bottom';
  const showSideDock = showLeftDock || showRightDock;
  const useMatchHero = sideDockMatchHero && showSideDock;
  const useVideoStack = stackBelowVideo && theaterDock === 'bottom';
  const sideRowClass = showSideDock
    ? ` room-theater-side-row${showRightDock ? ' room-theater-side-row--right' : ' room-theater-side-row--left'}${
        useMatchHero ? ' room-theater-side-row--match-hero' : ''
      }${chatDockWidth !== null || chatDockResizing ? ' room-theater-side-row--custom-width' : ''}${
        chatDockResizing ? ' room-theater-side-row--resizing' : ''
      }`
    : '';
  const sideRowFlex = useMatchHero ? 'shrink-0' : 'flex-1';
  const sideRowStyle: CSSProperties | undefined =
    chatDockWidth !== null && showSideDock
      ? showRightDock
        ? { gridTemplateColumns: `minmax(0, 1fr) ${chatDockWidth}px` }
        : { gridTemplateColumns: `${chatDockWidth}px minmax(0, 1fr)` }
      : undefined;

  const chevronCollapse = showLeftDock ? '6,1 2,7 6,13' : '2,1 6,7 2,13';
  const chevronExpand = showLeftDock ? '2,1 6,7 2,13' : '6,1 2,7 6,13';

  const chatHiddenButton = chatHidden ? (
    <button
      type="button"
      onClick={onToggleChat}
      className="absolute top-2 right-2 z-[25] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a1a26]/90 border border-purple-500/40 text-[10px] font-bold text-purple-300 backdrop-blur hover:border-purple-400 transition pointer-events-auto"
      aria-label="Afficher le chat"
    >
      <span aria-hidden>💬</span>
      Chat
    </button>
  ) : null;

  const bottomChatDock = showBottomDock ? (
    <div
      className={`room-theater-bottom-chat-dock shrink-0 flex flex-col border-t border-[#1e1e2f] bg-[#0b0b0f]/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]${
        useVideoStack ? ' room-theater-bottom-chat-dock--stacked' : ''
      }`}
    >
      {useVideoStack ? (
        <DockedChatHeader
          chatTitle={chatTitle}
          chatTitleIcon={chatTitleIcon}
          chatHeaderExtra={chatHeaderExtra}
          dockMode="right"
          onToggleDock={() => {}}
          onToggleChat={onToggleChat}
          onToggleMinimize={onToggleMinimize}
          chatMinimized={chatMinimized}
          showDockToggle={false}
        />
      ) : (
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-[#1e1e2f] bg-[#14141c]/80">
          <span className="text-purple-400 text-[10px]" aria-hidden>
            {chatTitleIcon ?? '💬'}
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
      )}
      {(!useVideoStack || !chatMinimized) && (
        <DockChatBody chat={chat} chatInput={chatInput ? <div className="pointer-events-auto">{chatInput}</div> : undefined} />
      )}
    </div>
  ) : null;

  const stageFooterBlock = stageFooter ? (
    <div
      className={
        stageFooterMode === 'drawer'
          ? 'shrink-0 salon-youtube-host-drawer-wrap pb-[env(safe-area-inset-bottom)]'
          : 'shrink-0 max-h-[38dvh] overflow-y-auto border-t border-[#1e1e2f] bg-[#0b0b0f]/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]'
      }
    >
      {stageFooter}
    </div>
  ) : null;

  const videoStage = (
    <div
      className={`room-theater-video-stage relative flex flex-col ${
        useVideoStack ? 'shrink-0' : 'flex-1'
      } min-w-0 min-h-0 overflow-hidden bg-black${useMatchHero ? ' room-theater-video-stage--match-hero' : ''}`}
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

      {(showSideDock || showFloating) && (
        <button
          type="button"
          onClick={onToggleChat}
          className={`room-theater-toggle${showLeftDock ? ' room-theater-toggle--left' : ''}`}
          aria-expanded={!chatHidden}
          aria-label={chatHidden ? 'Afficher le chat' : 'Masquer le chat'}
        >
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden>
            {chatHidden ? (
              <polyline
                points={chevronExpand}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <polyline
                points={chevronCollapse}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </button>
      )}

      {chatHiddenButton}
    </div>
  );

  if (useVideoStack) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-[#0b0b0f]">
          <div className="room-theater-stack-column flex flex-col flex-1 min-h-0">
            {videoStage}
            {bottomChatDock}
            {stageFooterBlock}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div
          className={`${sideRowFlex} min-h-0 flex flex-col overflow-hidden${sideRowClass || ' sm:flex-row'}`}
          style={sideRowStyle}
        >
          {showLeftDock && (
            <TheaterChatDockAside
              dockEdge="left"
              {...chatDockAsideProps}
              onDraggingChange={setChatDockResizing}
              className="room-theater-chat-dock room-theater-chat-dock--theater room-theater-chat-dock--left hidden sm:flex flex-col min-h-0 min-w-0 border-r border-[#1e1e2f] bg-[#101018]"
            >
              <DockedChatHeader
                chatTitle={chatTitle}
                chatTitleIcon={chatTitleIcon}
                chatHeaderExtra={chatHeaderExtra}
                dockMode="right"
                onToggleDock={() => {}}
                onToggleChat={onToggleChat}
                onToggleMinimize={onToggleMinimize}
                chatMinimized={chatMinimized}
                showDockToggle={false}
              />
              {!chatMinimized && <DockChatBody chat={chat} chatInput={chatInput} />}
            </TheaterChatDockAside>
          )}

          {videoStage}

          {showRightDock && (
            <TheaterChatDockAside
              dockEdge="right"
              {...chatDockAsideProps}
              onDraggingChange={setChatDockResizing}
              className="room-theater-chat-dock room-theater-chat-dock--theater hidden sm:flex flex-col min-h-0 min-w-0 border-l border-[#1e1e2f] bg-[#101018]"
            >
              <DockedChatHeader
                chatTitle={chatTitle}
                chatTitleIcon={chatTitleIcon}
                chatHeaderExtra={chatHeaderExtra}
                dockMode="right"
                onToggleDock={allowFloatingChat ? toggleDockMode : () => {}}
                onToggleChat={onToggleChat}
                onToggleMinimize={onToggleMinimize}
                chatMinimized={chatMinimized}
                showDockToggle={allowFloatingChat}
              />
              {!chatMinimized && <DockChatBody chat={chat} chatInput={chatInput} />}
            </TheaterChatDockAside>
          )}
        </div>

        {showSideDock && (
          <div className="room-theater-mobile-chat-sheet sm:hidden shrink-0 flex flex-col border-t border-[#1e1e2f] bg-[#101018] pb-[env(safe-area-inset-bottom)]">
            <DockedChatHeader
              chatTitle={chatTitle}
              chatTitleIcon={chatTitleIcon}
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

        {bottomChatDock}

        {stageFooterBlock}
      </div>
    </div>
  );
}
