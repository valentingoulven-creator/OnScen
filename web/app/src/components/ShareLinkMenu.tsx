import { useTranslation } from 'react-i18next';
import {
  copyShareLink,
  nativeShareLink,
  openEmailShare,
  openFacebookShare,
  openInstagramShare,
  openLinkedInShare,
  openMessengerShare,
  openSmsShare,
  openTikTokShare,
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
  /** Ouvre le sélecteur d'utilisateur OnScen (DM). */
  onSendToUser?: () => void;
  /** Classe z-index pour l'overlay (ex. z-[120] au-dessus d'un modal). */
  overlayZClass?: string;
}

type ShareAction =
  | 'native'
  | 'whatsapp'
  | 'twitter'
  | 'facebook'
  | 'linkedin'
  | 'instagram'
  | 'tiktok'
  | 'messenger'
  | 'sms'
  | 'email'
  | 'copy';

interface ShareItem {
  id: ShareAction;
  labelKey: string;
  hintKey?: string;
  brand?: boolean;
}

const SOCIAL_ITEMS: ShareItem[] = [
  { id: 'whatsapp', labelKey: 'share.whatsapp', brand: true },
  { id: 'twitter', labelKey: 'share.twitter', brand: true },
  { id: 'facebook', labelKey: 'share.facebook', brand: true },
  { id: 'linkedin', labelKey: 'share.linkedin', brand: true },
  { id: 'instagram', labelKey: 'share.instagram', hintKey: 'share.instagramHint', brand: true },
  { id: 'tiktok', labelKey: 'share.tiktok', hintKey: 'share.tiktokHint', brand: true },
  { id: 'messenger', labelKey: 'share.messenger', brand: true },
];

const MORE_ITEMS: ShareItem[] = [
  { id: 'sms', labelKey: 'share.sms' },
  { id: 'email', labelKey: 'share.email' },
  { id: 'copy', labelKey: 'share.copyLink' },
];

function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

function SharePlatformIcon({ id, className }: { id: ShareAction; className?: string }) {
  const cn = className ?? 'w-5 h-5';
  switch (id) {
    case 'native':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path strokeLinecap="round" d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="currentColor" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 0 0 .917.917l4.458-1.495A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.37l-.357-.212-2.642.886.886-2.577-.233-.375A9.818 9.818 0 1 1 12 21.818z" />
        </svg>
      );
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="currentColor" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="currentColor" aria-hidden>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 4.126 0 2.065 2.065 0 0 1-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="currentColor" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="currentColor" aria-hidden>
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
        </svg>
      );
    case 'messenger':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="currentColor" aria-hidden>
          <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z" />
        </svg>
      );
    case 'sms':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'email':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path strokeLinecap="round" d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'copy':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    default:
      return null;
  }
}

const BRAND_COLORS: Partial<Record<ShareAction, string>> = {
  whatsapp: 'text-[#25D366]',
  twitter: 'text-white',
  facebook: 'text-[#1877F2]',
  linkedin: 'text-[#0A66C2]',
  instagram: 'text-[#E4405F]',
  tiktok: 'text-white',
  messenger: 'text-[#0084FF]',
};

export function ShareLinkMenu({
  open,
  onClose,
  url,
  title,
  text,
  onToast,
  onShared,
  onSendToUser,
  overlayZClass = 'z-40',
}: ShareLinkMenuProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const runShared = () => {
    void onShared?.();
  };

  const handleAction = async (action: ShareAction, hintKey?: string) => {
    switch (action) {
      case 'copy': {
        const ok = await copyShareLink(url);
        onToast(ok ? t('share.copied') : t('share.copyFailed'));
        if (ok) runShared();
        break;
      }
      case 'native': {
        const result = await nativeShareLink({ url, title, text });
        if (result === 'shared') {
          onToast(t('share.shared'));
          runShared();
        }
        break;
      }
      case 'email': {
        openEmailShare(url, title, text);
        onToast(t('share.shared'));
        runShared();
        break;
      }
      case 'messenger': {
        openMessengerShare(url);
        onToast(t('share.shared'));
        runShared();
        break;
      }
      case 'whatsapp': {
        openWhatsAppShare(url, text);
        onToast(t('share.shared'));
        runShared();
        break;
      }
      case 'sms': {
        openSmsShare(url, text);
        onToast(t('share.shared'));
        runShared();
        break;
      }
      case 'twitter': {
        openTwitterShare(url, text);
        onToast(t('share.shared'));
        runShared();
        break;
      }
      case 'facebook': {
        openFacebookShare(url);
        onToast(t('share.shared'));
        runShared();
        break;
      }
      case 'linkedin': {
        openLinkedInShare(url, text);
        onToast(t('share.shared'));
        runShared();
        break;
      }
      case 'instagram': {
        const ok = await copyShareLink(url);
        if (ok) {
          onToast(hintKey ? t(hintKey) : t('share.instagramHint'));
          openInstagramShare();
          runShared();
        } else {
          onToast(t('share.copyFailed'));
        }
        break;
      }
      case 'tiktok': {
        const ok = await copyShareLink(url);
        if (ok) {
          onToast(hintKey ? t(hintKey) : t('share.tiktokHint'));
          openTikTokShare();
          runShared();
        } else {
          onToast(t('share.copyFailed'));
        }
        break;
      }
    }
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 ${overlayZClass} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-link-menu-title"
    >
      <button type="button" className="absolute inset-0" aria-label={t('common.close')} onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#12121a] border border-[#2d2d3d] rounded-2xl max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2f] sticky top-0 bg-[#12121a] z-10">
          <h2 id="share-link-menu-title" className="font-bold text-white text-sm">
            {t('share.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white px-2"
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        {onSendToUser ? (
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSendToUser();
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-blue-600/20 border border-blue-500/30 text-white hover:bg-blue-600/30 transition-colors"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500/25 text-blue-200">
                <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <span className="text-sm font-semibold">{t('share.sendToUser')}</span>
            </button>
          </div>
        ) : null}

        {canNativeShare() ? (
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => void handleAction('native')}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-white hover:bg-purple-600/30 transition-colors"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-500/25 text-purple-200">
                <SharePlatformIcon id="native" className="w-4.5 h-4.5" />
              </span>
              <span className="text-sm font-semibold">{t('share.native')}</span>
            </button>
          </div>
        ) : null}

        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 px-1 mb-2">
            {t('share.socialApps')}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SOCIAL_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleAction(item.id, item.hintKey)}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 transition-colors"
              >
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-full bg-[#1a1a28] ${BRAND_COLORS[item.id] ?? 'text-gray-300'}`}
                >
                  <SharePlatformIcon id={item.id} className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-medium text-gray-300 text-center leading-tight">
                  {t(item.labelKey)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <ul className="py-2 border-t border-[#1e1e2f] mt-3">
          {MORE_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void handleAction(item.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm font-medium text-white hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1a1a28] text-gray-400">
                  <SharePlatformIcon id={item.id} className="w-4 h-4" />
                </span>
                {t(item.labelKey)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
