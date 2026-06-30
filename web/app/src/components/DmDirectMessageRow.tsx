import type { TouchEvent } from 'react';
import { LinkifiedText } from './LinkifiedText';
import type { DirectMessage } from '../types';
import type { InternalLinkTarget } from '../lib/linkifyText';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function isImageMime(mimeType?: string): boolean {
  return Boolean(mimeType?.startsWith('image/'));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export type DmDirectMessageRowProps = {
  message: DirectMessage;
  isMe: boolean;
  menuOpen: boolean;
  heartCount: number;
  listSpacer?: boolean;
  onDoubleTap: (messageId: string) => void;
  onTouchEnd: (messageId: string, e: TouchEvent) => void;
  onToggleMenu: (messageId: string) => void;
  onDelete: (messageId: string, isMe: boolean) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenSalon?: (salonId: string) => void;
  onOpenFeedPost?: (postId: string) => void;
  onBeforeInternalLink?: (target: InternalLinkTarget) => boolean | Promise<boolean>;
};

export function DmDirectMessageRow({
  message: m,
  isMe,
  menuOpen,
  heartCount,
  listSpacer = false,
  onDoubleTap,
  onTouchEnd,
  onToggleMenu,
  onDelete,
  onOpenProfile,
  onOpenSalon,
  onOpenFeedPost,
  onBeforeInternalLink,
}: DmDirectMessageRowProps) {
  return (
    <div
      data-dm-msg-menu
      className={`flex items-end gap-1 ${listSpacer ? 'pb-3' : ''} ${isMe ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`relative max-w-[80%] ${isMe ? 'order-1' : ''}`}>
        <div
          className={`rounded-2xl px-3 py-2 cursor-pointer select-none ${
            isMe
              ? 'bg-purple-600/80 text-white rounded-br-sm'
              : 'bg-[#1a1a26] border border-[#2d2d3d] text-gray-100 rounded-bl-sm'
          }`}
          onDoubleClick={() => onDoubleTap(m.id)}
          onTouchEnd={(e) => onTouchEnd(m.id, e)}
        >
          {m.content && (
            <LinkifiedText
              text={m.content}
              className="text-sm whitespace-pre-wrap break-words"
              onOpenProfile={onOpenProfile}
              onOpenSalon={onOpenSalon}
              onOpenFeedPost={onOpenFeedPost}
              onBeforeInternalLink={onBeforeInternalLink}
            />
          )}
          {m.attachmentUrl && (
            <div className={m.content ? 'mt-1.5' : ''}>
              {isImageMime(m.attachmentMimeType) ? (
                <img
                  src={m.attachmentUrl}
                  alt={m.attachmentName ?? 'Image'}
                  className="max-w-full rounded-xl max-h-52 object-cover"
                />
              ) : (
                <a
                  href={m.attachmentUrl}
                  download={m.attachmentName ?? 'fichier'}
                  onClick={(e) => e.stopPropagation()}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-xl border ${
                    isMe
                      ? 'bg-purple-700/50 border-purple-400/30 hover:bg-purple-700/70'
                      : 'bg-[#12121a] border-[#2d2d3d] hover:border-purple-500/40'
                  }`}
                >
                  <span className="text-lg shrink-0">📎</span>
                  <div className="min-w-0">
                    <p className="text-xs text-white truncate max-w-[140px]">{m.attachmentName ?? 'Fichier'}</p>
                    {m.attachmentSize != null && (
                      <p className={`text-[10px] ${isMe ? 'text-purple-200' : 'text-gray-500'}`}>
                        {formatFileSize(m.attachmentSize)}
                      </p>
                    )}
                  </div>
                  <span className={`ml-auto text-sm shrink-0 ${isMe ? 'text-purple-200' : 'text-gray-400'}`}>⬇</span>
                </a>
              )}
            </div>
          )}
          <p className={`text-[10px] mt-1 ${isMe ? 'text-purple-200' : 'text-gray-500'}`}>
            {formatTime(m.timestamp)}
          </p>
        </div>
        {heartCount > 0 && (
          <div
            className={`flex items-center gap-0.5 mt-1 w-fit rounded-full bg-[#12121a] border border-[#2d2d3d] px-1.5 py-0.5 ${isMe ? 'ml-auto' : ''}`}
          >
            <span className="text-[13px] leading-none" role="img" aria-label="réaction coeur">
              ❤️
            </span>
            {heartCount > 1 && <span className="text-[10px] text-gray-300 font-medium">{heartCount}</span>}
          </div>
        )}
        {menuOpen && (
          <div
            className={`absolute z-20 mt-1 min-w-[10rem] rounded-xl border border-[#2d2d3d] bg-[#1a1a26] shadow-xl overflow-hidden ${
              isMe ? 'right-0' : 'left-0'
            }`}
          >
            <button
              type="button"
              onClick={() => onDelete(m.id, isMe)}
              className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10"
            >
              {isMe ? 'Supprimer pour tous' : 'Masquer pour moi'}
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onToggleMenu(m.id)}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-[#1a1a26] text-sm"
        aria-label="Options du message"
      >
        ⋮
      </button>
    </div>
  );
}
