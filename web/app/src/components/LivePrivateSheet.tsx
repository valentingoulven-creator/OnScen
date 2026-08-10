import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { UsernameDisplay } from './UsernameDisplay';
import type { DirectMessage, DmContact } from '../types';

interface LivePrivateSheetProps {
  target: DmContact;
  onClose: () => void;
  onOpenProfile?: (userId: string) => void;
}

export function LivePrivateSheet({ target, onClose, onOpenProfile }: LivePrivateSheetProps) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    api.getDmThread(token, target.id).then((r) => setMessages(r.messages));
  }, [token, target.id]);

  useEffect(() => {
    if (!token || !user) return;
    const socket = getSocket();
    if (!socket) return;
    const onDm = (msg: DirectMessage) => {
      if (
        (msg.senderId === user.id && msg.receiverId === target.id) ||
        (msg.senderId === target.id && msg.receiverId === user.id)
      ) {
        setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
      }
    };
    socket.on('dm', onDm);
    return () => {
      socket.off('dm', onDm);
    };
  }, [token, user, target.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    try {
      const { message } = await api.sendDm(token, target.id, text);
      setMessages((m) => [...m, message]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur envoi');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center ms-modal-overlay bg-black/60" onClick={onClose}>
      <div
        className="flex flex-col w-full max-w-md max-h-[70dvh] bg-[#12121a] rounded-2xl border border-[#2d2d3d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center gap-3 p-4 border-b border-[#1e1e2f]">
          <img
            src={target.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${target.id}`}
            alt=""
            className="w-10 h-10 rounded-full"
          />
          <div className="flex-1 min-w-0">
            {onOpenProfile ? (
              <button
                type="button"
                onClick={() => onOpenProfile(target.id)}
                className="font-bold text-white truncate text-left max-w-full hover:text-purple-300 transition-colors"
                title="Voir le profil"
              >
                <UsernameDisplay
                  username={target.username}
                  usernameColor={target.usernameColor}
                  usernameWaveFrom={target.usernameWaveFrom}
                  usernameWaveTo={target.usernameWaveTo}
                  className="truncate inline"
                />
              </button>
            ) : (
              <p className="font-bold text-white truncate">{target.username}</p>
            )}
            <p className="text-xs text-purple-400">Message privé (hors du chat public)</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2">
            ✕
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 max-h-[40dvh]">
          {messages.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-6">Premier message privé avec {target.username}</p>
          )}
          {messages.map((m) => {
            const isMe = m.senderId === user?.id;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    isMe ? 'bg-purple-600/80 text-white' : 'bg-[#1a1a26] border border-[#2d2d3d] text-gray-100'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="shrink-0 flex gap-2 p-3 border-t border-[#1e1e2f]">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message privé..."
            className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-full px-4 py-2.5 text-sm text-white"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="px-4 py-2.5 bg-purple-600 disabled:opacity-40 rounded-full font-bold text-white text-sm"
          >
            Envoyer
          </button>
        </form>
      </div>
    </div>
  );
}
