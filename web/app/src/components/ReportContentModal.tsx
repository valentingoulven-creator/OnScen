import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const CATEGORIES = [
  { id: 'harassment', label: 'Harcèlement / menaces' },
  { id: 'illegal', label: 'Contenu illicite' },
  { id: 'spam', label: 'Spam / arnaque' },
  { id: 'copyright', label: 'Droits d’auteur' },
  { id: 'privacy', label: 'Atteinte à la vie privée' },
  { id: 'other', label: 'Autre' },
] as const;

export interface ReportContentContext {
  targetUserId?: string;
  targetUsername?: string;
  roomType?: 'salon' | 'live' | 'dm' | 'reel' | 'profile';
  roomId?: string;
  messageId?: string;
}

interface ReportContentModalProps {
  context: ReportContentContext;
  onClose: () => void;
  /** Appelé après signalement réussi quand un utilisateur a été bloqué. */
  onUserBlocked?: (userId: string) => void;
}

export function ReportContentModal({ context, onClose, onUserBlocked }: ReportContentModalProps) {
  const { token } = useAuth();
  const [category, setCategory] = useState<string>('illegal');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [userBlocked, setUserBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!token) return;
    const targetLabel = context.targetUsername ?? 'cet utilisateur';
    const confirmText = context.targetUserId
      ? `Signaler ${targetLabel} ?\n\nCette personne sera bloquée automatiquement. Elle ne sera pas avertie et vous ne verrez plus ses messages ni son contenu.`
      : 'Envoyer ce signalement ?';
    if (!window.confirm(confirmText)) return;

    setSending(true);
    setError(null);
    try {
      const result = await api.submitContentReport(token, {
        category,
        details,
        targetUserId: context.targetUserId,
        roomType: context.roomType,
        roomId: context.roomId,
        messageId: context.messageId,
      });
      if (result.blocked && context.targetUserId) {
        setUserBlocked(true);
        onUserBlocked?.(context.targetUserId);
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
    >
      <div className="w-full max-w-md bg-[#12121a] border border-[#2d2d3d] rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-[#1e1e2f] flex items-center justify-between">
          <h2 id="report-title" className="font-bold text-white">
            Signaler un contenu
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl" aria-label="Fermer">
            ×
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-green-400 font-semibold">Signalement enregistré</p>
            {userBlocked && (
              <p className="text-sm text-gray-300">
                {context.targetUsername ?? 'Cet utilisateur'} a été bloqué. Vous ne verrez plus son contenu.
              </p>
            )}
            <p className="text-sm text-gray-400">Merci. Nous examinerons votre signalement dans un délai raisonnable.</p>
            <button type="button" onClick={onClose} className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold">
              Fermer
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {context.targetUsername && (
              <p className="text-xs text-gray-500">
                Concernant : <span className="text-gray-300">{context.targetUsername}</span>
              </p>
            )}
            <label className="block">
              <span className="text-xs text-gray-400">Motif</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-white text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Description</span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Décrivez le problème (message, comportement, lien…)"
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-white text-sm"
                required
              />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={sending || details.trim().length < 10}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold disabled:opacity-50"
            >
              {sending ? 'Envoi…' : 'Envoyer le signalement'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReportContentButton({
  context,
  className = '',
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  context: ReportContentContext;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const { t } = useTranslation();
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenInternal(next);
    onOpenChange?.(next);
  };
  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`text-xs text-red-400/90 hover:text-red-300 font-semibold ${className}`}
        >
          {t('profile.report')}
        </button>
      )}
      {open && <ReportContentModal context={context} onClose={() => setOpen(false)} />}
    </>
  );
}
