import { useTranslation } from 'react-i18next';

export interface LiveObsSetupValue {
  useObs: boolean;
}

export function liveObsFromDraft(draft: { useObs?: boolean } | null | undefined): LiveObsSetupValue {
  return { useObs: draft?.useObs === true };
}

type LiveObsSetupFieldsProps = {
  value: LiveObsSetupValue;
  onChange: (next: LiveObsSetupValue) => void;
  capsLoading: boolean;
  capsError?: boolean;
  obsAllowed: boolean;
  cloudflareAvailable: boolean;
  cloudflareConfigured?: boolean;
};

export function LiveObsSetupFields({
  value,
  onChange,
  capsLoading,
  capsError,
  obsAllowed,
  cloudflareAvailable,
  cloudflareConfigured,
}: LiveObsSetupFieldsProps) {
  const { t } = useTranslation();
  const canUseObs = obsAllowed && cloudflareAvailable;
  const serverHasCloudflare = cloudflareConfigured ?? cloudflareAvailable;

  const selectBrowser = () => onChange({ useObs: false });
  const selectObs = () => {
    if (!canUseObs) return;
    onChange({ useObs: true });
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={selectBrowser}
          className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-left transition ${
            !value.useObs
              ? 'border-red-500/50 bg-red-950/30 text-white'
              : 'border-[#2d2d3d] bg-[#0b0b0f] text-gray-300 hover:border-[#3d3d4d]'
          }`}
        >
          <p className="text-xs font-bold">{t('live.setupObsBrowserTitle')}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{t('live.setupObsBrowserHint')}</p>
        </button>

        <button
          type="button"
          onClick={selectObs}
          disabled={!canUseObs && !capsLoading}
          className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-left transition disabled:opacity-50 ${
            value.useObs
              ? 'border-orange-500/50 bg-orange-950/30 text-white'
              : 'border-[#2d2d3d] bg-[#0b0b0f] text-gray-300 hover:border-orange-500/30'
          }`}
        >
          <p className="text-xs font-bold">{t('live.setupObsTitle')}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{t('live.setupObsHint')}</p>
        </button>
      </div>

      {capsLoading ? (
        <p className="text-[11px] text-gray-500 animate-pulse">{t('live.setupObsCapsLoading')}</p>
      ) : null}

      {!capsLoading && capsError ? (
        <p className="text-[11px] text-red-300/90 leading-relaxed">{t('live.setupObsCapsError')}</p>
      ) : null}

      {!capsLoading && !capsError && !serverHasCloudflare ? (
        <p className="text-[11px] text-amber-400/80 leading-relaxed">{t('live.setupObsServerNotConfigured')}</p>
      ) : null}

      {!capsLoading && !capsError && serverHasCloudflare && !obsAllowed ? (
        <p className="text-[11px] text-gray-500 leading-relaxed">{t('live.obsUltraOnly')}</p>
      ) : null}

      {!capsLoading && !capsError && serverHasCloudflare && obsAllowed && !cloudflareAvailable ? (
        <p className="text-[11px] text-amber-400/80 leading-relaxed">{t('live.setupObsUnavailable')}</p>
      ) : null}

      {value.useObs && canUseObs ? (
        <div className="rounded-xl border border-orange-500/25 bg-orange-950/20 p-3 space-y-2">
          <p className="text-[11px] text-orange-100/90 leading-relaxed">{t('live.setupObsInstructions')}</p>
          <ol className="text-[10px] text-gray-400 space-y-1 list-decimal list-inside leading-relaxed">
            <li>{t('live.setupObsStep1')}</li>
            <li>{t('live.setupObsStep2')}</li>
            <li>{t('live.setupObsStep3')}</li>
            <li>{t('live.setupObsStep4')}</li>
          </ol>
        </div>
      ) : null}
    </div>
  );
}
