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
  /** Chat réduit au bandeau d'en-tête uniquement (contenu masqué). */
  chatMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export function RoomTheaterLayout({
  stage,
  chat,
  chatInput,
  chatHidden,
  onToggleChat,
  stageFooter,
  chatTitle = 'Chat',
  chatMinimized = false,
  onToggleMinimize,
}: RoomTheaterLayoutProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
          {stage}

          {!chatHidden && (
            <FloatingSalonChat
              title={chatTitle}
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

        {!chatHidden && chatInput ? (
          <div className="shrink-0 pointer-events-auto">{chatInput}</div>
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
