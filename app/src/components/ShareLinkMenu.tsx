import {
  copyShareLink,
  nativeShareLink,
  openEmailShare,
  openMessengerShare,
  openSmsShare,
  openTwitterShare,
  openWhatsAppShare,
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

const SHARE_ITEMS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'E-mail' },
  { id: 'copy', label: 'Copier le lien' },
  { id: 'twitter', label: 'X' },
] as const;

const NATIVE_ITEM = { id: 'native', label: "Plus d'options..." } as const;

type ShareAction =
  | (typeof SHARE_ITEMS)[number]['id']
  | (typeof NATIVE_ITEM)['id'];

function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

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

  const menuItems = canNativeShare() ? [...SHARE_ITEMS, NATIVE_ITEM] : SHARE_ITEMS;

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
      case 'native': {
        const result = await nativeShareLink({ url, title, text });
        if (result === 'shared') {
          onToast('Partagé !');
          runShared();
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
      case 'whatsapp': {
        openWhatsAppShare(url, text);
        onToast('Partagé !');
        runShared();
        break;
      }
      case 'sms': {
        openSmsShare(url, text);
        onToast('Partagé !');
        runShared();
        break;
      }
      case 'twitter': {
        openTwitterShare(url, text);
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
          {menuItems.map((item) => (
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
