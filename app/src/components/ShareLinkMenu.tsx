import {
  copyShareLink,
  nativeShareLink,
  openEmailShare,
  openMessengerShare,
} from '../lib/shareLink';

export interface ShareLinkMenuProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  text?: string;
  onToast: (message: string) => void;
  onShared?: () => void | Promise<void>;
}

const MENU_ITEMS = [
  { id: 'copy', label: 'Copier le lien' },
  { id: 'share', label: 'Partager' },
  { id: 'email', label: 'Envoyer par mail' },
  { id: 'messenger', label: 'Envoyer sur Messenger' },
] as const;

type ShareAction = (typeof MENU_ITEMS)[number]['id'];

export function ShareLinkMenu({
  open,
  onClose,
  url,
  title,
  text,
  onToast,
  onShared,
}: ShareLinkMenuProps) {
  if (!open) return null;

  const runShared = () => {
    void onShared?.();
  };

  const handleAction = async (action: ShareAction) => {
    switch (action) {
      case 'copy': {
        const ok = await copyShareLink(url);
        onToast(ok ? 'Lien copié !' : 'Impossible de copier le lien');
        if (ok) runShared();
        break;
      }
      case 'share': {
        const result = await nativeShareLink({ url, title, text });
        if (result === 'shared') {
          onToast('Partagé !');
          runShared();
        } else if (result === 'unavailable') {
          const ok = await copyShareLink(url);
          onToast(ok ? 'Lien copié !' : 'Partage non disponible');
          if (ok) runShared();
        }
        break;
      }
      case 'email': {
        openEmailShare(url, title, text);
        onToast('Partagé !');
        runShared();
        break;
      }
      case 'messenger': {
        openMessengerShare(url);
        onToast('Partagé !');
        runShared();
        break;
      }
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-link-menu-title"
    >
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div className="relative w-full bg-[#12121a] border-t border-[#2d2d3d] rounded-t-2xl safe-area-pb">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2f]">
          <h2 id="share-link-menu-title" className="font-bold text-white text-sm">
            Partager
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white px-2" aria-label="Fermer">
            ✕
          </button>
        </div>
        <ul className="py-2">
          {MENU_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void handleAction(item.id)}
                className="w-full px-4 py-3.5 text-left text-sm font-medium text-white hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
