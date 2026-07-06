/**
 * Chat read-only en overlay sur la vidéo — style OBS/Twitch (plein écran uniquement).
 * Fond transparent, pseudo coloré + message blanc, ombre portée, colonne gauche scrollable.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useOptionalChatRoomFeed } from './ChatPanel';
import { UsernameDisplay } from './UsernameDisplay';

const MAX_MESSAGES = 40;

interface OverlayLine {
  id: string;
  senderName: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  content: string;
}

export function LiveChatVideoOverlay({ active }: { active: boolean }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const chatRoom = useOptionalChatRoomFeed();

  const messages = useMemo<OverlayLine[]>(() => {
    if (!chatRoom) return [];
    const out: OverlayLine[] = [];
    for (const item of chatRoom.feed) {
      if (item.kind !== 'message') continue;
      const m = item.data;
      out.push({
        id: m.id,
        senderName: m.senderName,
        usernameColor: m.senderUsernameColor,
        usernameWaveFrom: m.senderUsernameWaveFrom,
        usernameWaveTo: m.senderUsernameWaveTo,
        content: m.content || (m.attachmentUrl ? '📎 Pièce jointe' : ''),
      });
    }
    return out.slice(-MAX_MESSAGES);
  }, [chatRoom]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  if (!active || !chatRoom) return null;

  return (
    <div
      className="live-chat-video-overlay live-chat-video-overlay--fullscreen absolute inset-y-0 left-0 z-[25] pointer-events-none flex flex-col"
      aria-live="polite"
      aria-label="Chat du live"
    >
      <div
        ref={feedRef}
        className="live-chat-video-overlay__feed flex-1 min-h-0 overflow-y-auto flex flex-col justify-end gap-1 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {messages.map((m) => (
          <p
            key={m.id}
            className="live-chat-video-overlay__line text-[13px] sm:text-sm leading-snug break-words text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_8px_rgba(0,0,0,0.75)]"
          >
            <UsernameDisplay
              username={m.senderName}
              usernameColor={m.usernameColor}
              usernameWaveFrom={m.usernameWaveFrom}
              usernameWaveTo={m.usernameWaveTo}
              className="font-bold"
            />
            {m.content ? <span className="ml-1.5">{m.content}</span> : null}
          </p>
        ))}
      </div>
    </div>
  );
}
