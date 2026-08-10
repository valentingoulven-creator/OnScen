import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/useFocusTrap';

export function AdminChatModerationPolicySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const focusTrapRef = useFocusTrap(open, onClose);

  if (!open) return null;

  const categoryKeys = [
    'admin.content.chatPolicy.cat1',
    'admin.content.chatPolicy.cat2',
    'admin.content.chatPolicy.cat3',
    'admin.content.chatPolicy.cat4',
    'admin.content.chatPolicy.cat5',
  ] as const;

  const layerKeys = [
    'admin.content.chatPolicy.layerPlatform',
    'admin.content.chatPolicy.layerNormalize',
    'admin.content.chatPolicy.layerHost',
    'admin.content.chatPolicy.layerEnv',
    'admin.content.chatPolicy.layerHuman',
    'admin.content.chatPolicy.layerMedia',
    'admin.content.chatPolicy.layerRate',
  ] as const;

  const behaviorKeys = [
    'admin.content.chatPolicy.behaviorMask',
    'admin.content.chatPolicy.behaviorBlock',
    'admin.content.chatPolicy.behaviorSocket',
    'admin.content.chatPolicy.behaviorHttp',
  ] as const;

  const titleId = 'admin-chat-policy-title';

  const sheet = (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center ms-modal-overlay bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        ref={focusTrapRef}
        tabIndex={-1}
        className="w-full max-w-lg sm:max-w-xl bg-[#12121a] border border-[#2d2d3d] rounded-2xl ms-modal-panel shadow-2xl flex flex-col max-h-[90dvh] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 px-4 pt-4 pb-3 border-b border-[#1e1e2f]">
          <h2 id={titleId} className="text-lg font-bold text-white pr-8">
            {t('admin.content.chatPolicy.title')}
          </h2>
          <p className="text-xs text-gray-500 mt-1">{t('admin.content.chatPolicy.subtitle')}</p>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-5 text-sm text-gray-300">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {t('admin.content.chatPolicy.layersTitle')}
            </h3>
            <ul className="space-y-1.5 list-disc pl-4 text-xs text-gray-400">
              {layerKeys.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {t('admin.content.chatPolicy.categoriesTitle')}
            </h3>
            <ol className="space-y-2 list-decimal pl-4 text-xs text-gray-400">
              {categoryKeys.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ol>
            <p className="mt-2 text-[10px] text-gray-600">{t('admin.content.chatPolicy.noPublicWordList')}</p>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {t('admin.content.chatPolicy.behaviorTitle')}
            </h3>
            <ul className="space-y-1.5 list-disc pl-4 text-xs text-gray-400">
              {behaviorKeys.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </section>

          <section className="bg-[#0f0f17] border border-[#1e1e2f] rounded-xl px-3 py-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-purple-300/90 mb-1.5">
              {t('admin.content.chatPolicy.opsTitle')}
            </h3>
            <p className="text-xs text-gray-400">{t('admin.content.chatPolicy.opsEnvHint')}</p>
            <p className="mt-2 text-[10px] text-gray-600 font-mono break-all">
              {t('admin.content.chatPolicy.docReference')}
            </p>
          </section>
        </div>

        <footer className="shrink-0 p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/50 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-11 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500"
          >
            {t('admin.content.chatPolicy.close')}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
