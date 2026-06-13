import type { ReactNode } from 'react';
import { FloatingSalonChat } from './FloatingSalonChat';

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
   * theater — scène vidéo plein cadre + chat flottant (YouTube, Live).
   * queue-chat — colonne file à gauche, chat ancré à droite (salon Spotify).
   */
  variant?: 'theater' | 'queue-chat';
  /**
   * floating — fenêtre flottante sur la vidéo (défaut).
   * bottom — messages dans le panneau bas sous la saisie.
   */
  chatDock?: 'floating' | 'bottom';
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
  chatDock = 'floating',
}: RoomTheaterLayoutProps) {
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
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{chat}</div>
              {chatInput ? <div className="shrink-0">{chatInput}</div> : null}
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

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="room-theater-video-stage relative flex flex-col flex-1 min-h-0 overflow-hidden bg-black">
          {stage}

          {!chatHidden && chatDock === 'floating' && (
            <FloatingSalonChat
              title={chatTitle}
              headerExtra={chatHeaderExtra}
              minimized={chatMinimized}
              onToggleMinimize={onToggleMinimize}
              onHide={onToggleChat}
            >
              {chat}
            </FloatingSalonChat>
          )}

          <button
            type="button"
            onClick={onToggleChat}
            className="room-theater-toggle"
            aria-expanded={!chatHidden}
            aria-label={chatHidden ? 'Afficher le chat' : 'Masquer le chat'}
          >
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden>
              {chatHidden ? (
                <polyline
                  points="6,1 2,7 6,13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <polyline
                  points="2,1 6,7 2,13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>

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

        {!chatHidden && chatDock === 'floating' && chatInput ? (
          <div className="shrink-0 pointer-events-auto">{chatInput}</div>
        ) : null}

        {!chatHidden && chatDock === 'bottom' ? (
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
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{chat}</div>
            {chatInput ? <div className="shrink-0 pointer-events-auto">{chatInput}</div> : null}
          </div>
        ) : null}

        {stageFooter ? (
          <div className="shrink-0 max-h-[38dvh] overflow-y-auto border-t border-[#1e1e2f] bg-[#0b0b0f]/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
            {stageFooter}
          </div>
        ) : null}
      </div>
    </div>
  );
}
