import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { FloatingSalonChat } from './FloatingSalonChat';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../lib/storageKeys';

const DOCK_MODE_KEY = STORAGE_KEYS.theaterChatDockMode;
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
      <div className="flex-1 min-h-0 h-0 overflow-hidden flex flex-col">{chat}</div>
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

function IntegratedTheaterTopBar({
  topBarStart,
  topBarEnd,
  chatHeaderLeading,
  chatHeaderExtra,
  chatHeaderTrailingExtra,
  chatHidden,
  onToggleChat,
  showDockToggle,
  dockMode,
  onToggleDock,
}: {
  topBarStart?: ReactNode;
  topBarEnd?: ReactNode;
  chatHeaderLeading?: ReactNode;
  chatHeaderExtra?: ReactNode;
  chatHeaderTrailingExtra?: ReactNode;
  chatHidden: boolean;
  onToggleChat: () => void;
  showDockToggle?: boolean;
  dockMode: 'floating' | 'right';
  onToggleDock: () => void;
}) {
  return (
    <div className="room-theater-unified-topbar relative z-30 shrink-0 flex items-center gap-2 sm:gap-2.5 px-3 py-2 border-b border-[#1e1e2f] bg-[#0b0b0f] min-w-0">
      {topBarStart}
      {chatHeaderLeading ? (
        <>
          <div className="w-px h-6 bg-[#2a2a3a] shrink-0" aria-hidden />
          {chatHeaderLeading}
        </>
      ) : null}
      <div className="flex-1 min-w-0" />
      {topBarEnd ? <div className="flex items-center gap-1.5 shrink-0">{topBarEnd}</div> : null}
      {chatHeaderExtra}
      {chatHeaderTrailingExtra}
      {showDockToggle ? <ChatLayoutToggle dockMode={dockMode} onToggle={onToggleDock} /> : null}
      {!chatHidden ? (
        <button
          type="button"
          onClick={onToggleChat}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/10 transition text-lg leading-none"
          aria-label="Masquer le chat"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

const DOCK_HEADER_ICON_BTN =
  'shrink-0 w-11 h-11 flex items-center justify-center rounded transition touch-manipulation';

function DockedChatHeader({
  chatTitle,
  chatTitleIcon = '💬',
  chatHeaderLeading,
  chatHeaderExtra,
  chatHeaderTrailingExtra,
  dockMode,
  onToggleDock,
  onToggleChat,
  showDockToggle = true,
  integratedFullWidth = false,
  pinned = false,
  onTogglePin,
}: {
  chatTitle: string;
  chatTitleIcon?: ReactNode;
  chatHeaderLeading?: ReactNode;
  chatHeaderExtra?: ReactNode;
  chatHeaderTrailingExtra?: ReactNode;
  dockMode: 'floating' | 'right';
  onToggleDock: () => void;
  onToggleChat: () => void;
  onToggleMinimize?: () => void;
  chatMinimized?: boolean;
  showDockToggle?: boolean;
  integratedFullWidth?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  if (integratedFullWidth) {
    return null;
  }

  if (chatHeaderLeading) {
    return (
      <div className="shrink-0 flex flex-col border-b border-[#1e1e2f] bg-[#14141c]/80">
        <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5">
          {chatHeaderLeading}
          <div className="flex-1" />
          {chatHeaderExtra ? (
            <div className="shrink-0 flex items-center gap-0.5">{chatHeaderExtra}</div>
          ) : null}
          {onTogglePin ? (
            <button
              type="button"
              onClick={onTogglePin}
              title={pinned ? 'Détacher le chat' : 'Épingler à gauche'}
              className={`${DOCK_HEADER_ICON_BTN} ${
                pinned
                  ? 'text-amber-300 bg-amber-950/40'
                  : 'text-gray-500 hover:text-amber-300 hover:bg-white/10'
              }`}
              aria-label={pinned ? 'Détacher le chat' : 'Épingler le chat à gauche'}
              aria-pressed={pinned}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path
                  d="M6 1v7M4 3l2-2 2 2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M3 8h6v3H3z" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          ) : null}
          {showDockToggle ? <ChatLayoutToggle dockMode={dockMode} onToggle={onToggleDock} /> : null}
          {chatHeaderTrailingExtra}
          <button
            type="button"
            onClick={onToggleChat}
            className={`${DOCK_HEADER_ICON_BTN} text-gray-500 hover:text-white hover:bg-white/10 text-lg leading-none`}
            aria-label="Masquer le chat"
          >
            ×
          </button>
        </div>
        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest px-3 pb-2">
          {chatTitle}
        </p>
      </div>
    );
  }

  return (
    <div className="shrink-0 flex items-center gap-1.5 min-w-0 overflow-hidden px-3 py-2 border-b border-[#1e1e2f] bg-[#14141c]/80">
      <span className="shrink-0 text-purple-400 text-[10px]" aria-hidden>
        {chatTitleIcon}
      </span>
      <p className="min-w-0 flex-1 truncate text-[10px] font-bold text-purple-400 uppercase tracking-widest">
        {chatTitle}
      </p>
      <div className="shrink-0 flex items-center gap-0.5">
      {chatHeaderExtra ? chatHeaderExtra : null}
      {onTogglePin ? (
        <button
          type="button"
          onClick={onTogglePin}
          title={pinned ? 'Détacher le chat' : 'Épingler à gauche'}
          className={`${DOCK_HEADER_ICON_BTN} ${
            pinned
              ? 'text-amber-300 bg-amber-950/40'
              : 'text-gray-500 hover:text-amber-300 hover:bg-white/10'
          }`}
          aria-label={pinned ? 'Détacher le chat' : 'Épingler le chat à gauche'}
          aria-pressed={pinned}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M6 1v7M4 3l2-2 2 2"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M3 8h6v3H3z" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      ) : null}
      {showDockToggle ? <ChatLayoutToggle dockMode={dockMode} onToggle={onToggleDock} /> : null}
      {chatHeaderTrailingExtra}
      <button
        type="button"
        onClick={onToggleChat}
        className={`${DOCK_HEADER_ICON_BTN} text-gray-500 hover:text-white hover:bg-white/10 text-lg leading-none`}
        aria-label="Masquer le chat"
      >
        ×
      </button>
      </div>
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
  /** Actions juste avant « Masquer le chat » (ex. 📋 actions hôte live). */
  chatHeaderTrailingExtra?: ReactNode;
  /** Barre hôte sous le titre du chat bas (arrêter live, réglages, dons). */
  chatHostToolbar?: ReactNode;
  /** Contenu avant le titre (ex. onglets salon Chat / File). */
  chatHeaderLeading?: ReactNode;
  /** Bloc identité salon / salle, fusionné avec les onglets dans la barre pleine largeur. */
  topBarStart?: ReactNode;
  /** Actions salon à droite (quitter, partager…) dans la barre pleine largeur. */
  topBarEnd?: ReactNode;
  /**
   * dock — onglets dans l'en-tête du panneau chat (défaut).
   * full-width — une seule barre pleine largeur (salon + onglets).
   */
  headerLayout?: 'dock' | 'full-width';
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
  /** true — scène live avec chrome théâtre (cadre glass, barre statut, placeholder moderne). */
  liveTheaterChrome?: boolean;
  /** Live : chat épinglé en colonne gauche (vs flottant). */
  chatPinned?: boolean;
  /** Live : bascule épingler / détacher le chat. */
  onToggleChatPin?: () => void;
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
  chatHeaderTrailingExtra,
  chatHostToolbar,
  chatHeaderLeading,
  topBarStart,
  topBarEnd,
  headerLayout = 'dock',
  chatMinimized = false,
  onToggleMinimize,
  variant = 'theater',
  chatDock: chatDockProp = 'right',
  stageFooterMode = 'scroll',
  allowFloatingChat = true,
  stackBelowVideo = false,
  sideDockMatchHero = false,
  liveTheaterChrome = false,
  chatPinned = false,
  onToggleChatPin,
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

  const useFullWidthHeader = headerLayout === 'full-width' && Boolean(topBarStart || chatHeaderLeading);
  const dockHeaderIntegrated = useFullWidthHeader;

  const integratedTopBar = useFullWidthHeader ? (
    <IntegratedTheaterTopBar
      topBarStart={topBarStart}
      topBarEnd={topBarEnd}
      chatHeaderLeading={chatHeaderLeading}
      chatHeaderExtra={chatHeaderExtra}
      chatHeaderTrailingExtra={chatHeaderTrailingExtra}
      chatHidden={chatHidden}
      onToggleChat={onToggleChat}
      showDockToggle={allowFloatingChat && theaterDock !== 'bottom' && theaterDock !== 'left'}
      dockMode={theaterDock === 'floating' ? 'floating' : 'right'}
      onToggleDock={toggleDockMode}
    />
  ) : null;

  const dockedChatHeaderProps = {
    chatTitle,
    chatTitleIcon,
    chatHeaderLeading: useFullWidthHeader ? undefined : chatHeaderLeading,
    chatHeaderExtra: useFullWidthHeader ? undefined : chatHeaderExtra,
    chatHeaderTrailingExtra: useFullWidthHeader ? undefined : chatHeaderTrailingExtra,
    integratedFullWidth: dockHeaderIntegrated,
    onToggleChat,
    onToggleMinimize,
    chatMinimized,
  };

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
        {integratedTopBar}
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
                {...dockedChatHeaderProps}
                dockMode="right"
                onToggleDock={() => {}}
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
  /** Réduit = masquer tout le panneau flottant (pas de bandeau header orphelin). */
  const showFloating = !chatHidden && !chatMinimized && theaterDock === 'floating';
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

  /** Live théâtre : pas de toggle bas-droite — le chrome vidéo 💬 + FloatingSalonChat suffisent. */
  const showVideoChatToggle = !liveTheaterChrome;
  const liveLeftPinned = liveTheaterChrome && showLeftDock;

  const chatHiddenButton = showVideoChatToggle ? (
    <button
      type="button"
      onClick={onToggleChat}
      className={`room-theater-video-chat-toggle absolute z-40 flex items-center gap-1.5 min-h-11 px-3 py-1.5 rounded-full bg-[#1a1a26]/90 border border-purple-500/40 text-[10px] font-bold text-purple-300 backdrop-blur hover:border-purple-400 transition pointer-events-auto touch-manipulation ${
        liveTheaterChrome ? 'bottom-2 right-2 room-theater-video-chat-toggle--live-theater' : 'top-2 right-2'
      }${!chatHidden ? ' sm:hidden' : ''}`}
      aria-label={chatHidden ? 'Afficher le chat' : 'Masquer le chat'}
      aria-pressed={!chatHidden}
    >
      <span aria-hidden>💬</span>
      {chatHidden ? 'Chat' : 'Masquer'}
    </button>
  ) : null;

  const bottomChatDock = showBottomDock ? (
    <div
      className={`room-theater-bottom-chat-dock shrink-0 flex flex-col border-t border-[#1e1e2f] bg-[#0b0b0f]/95 backdrop-blur-sm${
        useVideoStack ? ' room-theater-bottom-chat-dock--stacked' : ''
      }`}
    >
      {useVideoStack ? (
        <DockedChatHeader
          {...dockedChatHeaderProps}
          dockMode="right"
          onToggleDock={() => {}}
          showDockToggle={false}
        />
      ) : (
        <div className="shrink-0 flex items-center gap-1.5 min-w-0 overflow-hidden px-3 py-2 border-b border-[#1e1e2f] bg-[#14141c]/80">
          <span className="shrink-0 text-purple-400 text-[10px]" aria-hidden>
            {chatTitleIcon ?? '💬'}
          </span>
          <p className="min-w-0 flex-1 truncate text-[10px] font-bold text-purple-400 uppercase tracking-widest">
            {chatTitle}
          </p>
          <div className="shrink-0 flex items-center gap-0.5">
            {chatHeaderExtra}
            {chatHeaderTrailingExtra}
            <button
              type="button"
              onClick={onToggleChat}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/10 transition text-lg leading-none"
              aria-label="Masquer le chat"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {chatHostToolbar ? (
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-b border-[#1e1e2f] bg-[#0f0f14]/95 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chatHostToolbar}
        </div>
      ) : null}
      {(!useVideoStack || !chatMinimized) && (
        <DockChatBody chat={chat} chatInput={chatInput ? <div className="pointer-events-auto">{chatInput}</div> : undefined} />
      )}
    </div>
  ) : null;

  const stageFooterBlock = stageFooter ? (
    <div
      className={
        stageFooterMode === 'drawer'
          ? 'shrink-0 salon-youtube-host-drawer-wrap'
          : 'shrink-0 max-h-[38dvh] overflow-y-auto border-t border-[#1e1e2f] bg-[#0b0b0f]/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]'
      }
    >
      {stageFooter}
    </div>
  ) : null;

  const floatingChatWindow =
    showFloating ? (
      <FloatingSalonChat
        title={chatTitle}
        compactHeader={liveTheaterChrome}
        headerTrailingExtra={chatHeaderTrailingExtra}
        onTogglePin={liveTheaterChrome ? onToggleChatPin : undefined}
        headerExtra={
          liveTheaterChrome ? (
            chatHeaderExtra ?? undefined
          ) : (
            <>
              {chatHeaderExtra}
              {layoutToggleExtra}
            </>
          )
        }
        minimized={chatMinimized}
        onToggleMinimize={onToggleMinimize}
        onHide={onToggleChat}
      >
        <DockChatBody chat={chat} chatInput={chatInput} />
      </FloatingSalonChat>
    ) : null;

  const mountFloatingInVideoContainer = liveTheaterChrome && !!floatingChatWindow;
  const stageNode =
    mountFloatingInVideoContainer && isValidElement(stage)
      ? cloneElement(stage, { floatingChat: floatingChatWindow } as Record<string, unknown>)
      : stage;

  const videoStage = (
    <div
      className={`room-theater-video-stage relative flex flex-col ${
        useVideoStack ? 'shrink-0' : 'flex-1'
      } min-w-0 min-h-0 overflow-hidden bg-black${useMatchHero ? ' room-theater-video-stage--match-hero' : ''}${
        liveTheaterChrome ? ' room-theater-video-stage--live-theater' : ''
      }`}
    >
      {stageNode}

      {!mountFloatingInVideoContainer && floatingChatWindow}

      {chatHiddenButton}
    </div>
  );

  if (useVideoStack) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {integratedTopBar}
        <div
          className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-[#0b0b0f]${
            liveTheaterChrome ? ' room-theater-layout--live-theater' : ''
          }`}
        >
          <div className={`room-theater-stack-column flex flex-col flex-1 min-h-0${liveTheaterChrome ? ' room-theater-stack-column--live-theater' : ''}`}>
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
      {integratedTopBar}
      <div
        className={`flex-1 min-w-0 flex flex-col min-h-0${showBottomDock ? ' room-theater-layout--bottom-chat' : ''}${
          useMatchHero ? ' room-theater-match-hero-shell' : ''
        }${liveTheaterChrome ? ' room-theater-layout--live-theater room-theater-layout--live-theater-fill' : ''}`}
      >
        <div
          className={`${sideRowFlex} min-h-0 flex overflow-hidden${
            liveLeftPinned ? ' flex-row' : ' flex-col'
          }${sideRowClass || ' sm:flex-row'}`}
          style={sideRowStyle}
        >
          {showLeftDock && (
            <TheaterChatDockAside
              dockEdge="left"
              {...chatDockAsideProps}
              onDraggingChange={setChatDockResizing}
              className={`room-theater-chat-dock room-theater-chat-dock--theater room-theater-chat-dock--left ${
                liveTheaterChrome
                  ? 'room-theater-chat-dock--live-left flex'
                  : 'room-theater-chat-dock--match-hero hidden sm:flex'
              } flex-col min-h-0 min-w-0`}
            >
              <DockedChatHeader
                {...dockedChatHeaderProps}
                dockMode="right"
                onToggleDock={() => {}}
                showDockToggle={false}
                pinned={chatPinned}
                onTogglePin={liveTheaterChrome ? onToggleChatPin : undefined}
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
              className="room-theater-chat-dock room-theater-chat-dock--theater room-theater-chat-dock--match-hero hidden sm:flex flex-col min-h-0 min-w-0"
            >
              <DockedChatHeader
                {...dockedChatHeaderProps}
                dockMode="right"
                onToggleDock={allowFloatingChat ? toggleDockMode : () => {}}
                showDockToggle={allowFloatingChat && !useFullWidthHeader}
              />
              {!chatMinimized && <DockChatBody chat={chat} chatInput={chatInput} />}
            </TheaterChatDockAside>
          )}
        </div>

        {showSideDock && !liveLeftPinned && (
          <div className="room-theater-mobile-chat-sheet sm:hidden shrink-0 flex flex-col border-t border-[#1e1e2f] bg-[#101018] pb-[env(safe-area-inset-bottom)]">
            <DockedChatHeader
              {...dockedChatHeaderProps}
              dockMode="right"
              onToggleDock={allowFloatingChat ? toggleDockMode : () => {}}
              showDockToggle={allowFloatingChat && !showLeftDock && !useFullWidthHeader}
            />
            {!chatMinimized && <DockChatBody chat={chat} chatInput={chatInput} />}
          </div>
        )}

        {bottomChatDock}

        {stageFooterBlock}
      </div>
    </div>
  );
}
