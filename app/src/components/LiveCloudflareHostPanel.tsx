import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

export type CloudflareIngestCredentials = {
  rtmpsUrl: string;
  rtmpUrl?: string;
  streamKey: string;
  playbackUrl: string;
  whipUrl?: string;
  liveInputId: string;
  persistent?: boolean;
  streamQuotaOk?: boolean;
  streamQuotaLimitMinutes?: number;
};

type IngestState = 'idle' | 'loading' | 'ready' | 'error';

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="shrink-0 px-2 py-1 rounded-md text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition"
      aria-label={`Copier ${label}`}
    >
      {copied ? '✓ Copié' : 'Copier'}
    </button>
  );
}

export function CredentialRow({
  label,
  value,
  copyLabel,
  tone = 'emerald',
}: {
  label: string;
  value: string;
  copyLabel: string;
  tone?: 'emerald' | 'amber' | 'sky';
}) {
  const toneClass =
    tone === 'amber' ? 'text-amber-200' : tone === 'sky' ? 'text-sky-200' : 'text-emerald-200';
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-300 mb-1">{label}</p>
      <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
        <code className={`flex-1 text-[10px] ${toneClass} break-all font-mono`}>{value}</code>
        <CopyButton value={value} label={copyLabel} />
      </div>
    </div>
  );
}

/** Identifiants RTMP/OBS — affiché dans Réglages live (⚙). */
export function LiveObsIngestSettings({
  token,
  liveId,
  obsIngestLive,
  className = '',
}: {
  token: string;
  liveId: string;
  obsIngestLive?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<IngestState>('idle');
  const [creds, setCreds] = useState<CloudflareIngestCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useRtmpFallback, setUseRtmpFallback] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const loadIngest = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const res = await api.getObsIngest(token);
      setCreds(res);
      setState('ready');
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : t('live.obsIngestLoadError'));
    }
  }, [token, t]);

  const repairStreamInput = useCallback(async () => {
    if (obsIngestLive) {
      setError(t('live.obsRepairStopObsFirst'));
      return;
    }
    if (!window.confirm(t('live.obsRepairConfirm'))) return;
    setRepairing(true);
    setError(null);
    try {
      const res = await api.repairObsStreamInput(token);
      setCreds(res);
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('live.obsRepairError'));
    } finally {
      setRepairing(false);
    }
  }, [token, t, obsIngestLive]);

  const rotateStreamKey = useCallback(async () => {
    if (obsIngestLive && !window.confirm(t('live.obsRotateKeyWhileLiveConfirm'))) return;
    if (!window.confirm(t('live.obsRotateKeyConfirm'))) return;
    setRotating(true);
    setError(null);
    try {
      const res = await api.rotateObsStreamKey(token);
      setCreds(res);
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('live.obsRotateKeyError'));
    } finally {
      setRotating(false);
    }
  }, [token, t, obsIngestLive]);

  useEffect(() => {
    void loadIngest();
    // Charge une fois par live — pas de re-fetch si `t` (i18n) change (évite GET ingest en boucle).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token, liveId
  }, [token, liveId]);

  const serverUrl =
    useRtmpFallback && creds?.rtmpUrl ? creds.rtmpUrl : creds?.rtmpsUrl ?? '';

  return (
    <section
      className={`rounded-xl border border-orange-500/30 bg-orange-950/15 p-3 space-y-2.5 text-left ${className}`}
    >
      <div>
        <p className="text-xs font-bold text-orange-300">{t('live.obsPanelTitle')}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{t('live.obsPanelHint')}</p>
        <p className="text-[10px] text-gray-500 mt-1 leading-snug">{t('live.obsLatencyHint')}</p>
        {obsIngestLive !== undefined ? (
          <p
            className={`text-[10px] font-bold mt-1.5 ${
              obsIngestLive ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
            {obsIngestLive ? t('live.obsIngestConnected') : t('live.obsIngestDisconnected')}
          </p>
        ) : null}
        {creds?.streamQuotaOk === false ? (
          <p className="text-[10px] font-bold mt-2 text-red-300 leading-relaxed border border-red-500/30 rounded-lg bg-red-950/30 px-2.5 py-2">
            {t('live.obsStreamQuotaZero')}
          </p>
        ) : null}
      </div>

      {state === 'loading' && (
        <p className="text-[11px] text-gray-400 animate-pulse">{t('live.obsIngestLoading')}</p>
      )}

      {state === 'error' && (
        <div className="space-y-2">
          <p className="text-[11px] text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadIngest()}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-orange-600 hover:bg-orange-500 text-white"
          >
            {t('live.obsIngestRetry')}
          </button>
        </div>
      )}

      {state === 'ready' && creds && (
        <div className="space-y-2.5">
          <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-2.5 py-2 space-y-1">
            <p className="text-[10px] font-bold text-amber-200">{t('live.obsObsSetupTitle')}</p>
            <p className="text-[10px] text-gray-400 leading-relaxed">{t('live.obsObsSetupFields')}</p>
          </div>

          <div className="rounded-lg border border-sky-500/20 bg-sky-950/20 px-2.5 py-2 space-y-1">
            <p className="text-[10px] font-bold text-sky-200">{t('live.obsOutputTitle')}</p>
            <p className="text-[10px] text-gray-400 leading-relaxed">{t('live.obsOutputFields')}</p>
          </div>

          <CredentialRow
            label={useRtmpFallback ? t('live.obsServerRtmp') : t('live.obsServerRtmps')}
            value={serverUrl}
            copyLabel="URL serveur"
            tone={useRtmpFallback ? 'sky' : 'emerald'}
          />
          <CredentialRow
            label={t('live.obsStreamKey')}
            value={creds.streamKey}
            copyLabel="clé de stream"
            tone="amber"
          />
          <p className="text-[10px] text-sky-300/90 font-mono break-all leading-snug">
            {t('live.obsKeySuffixHint', { suffix: `k${creds.liveInputId}` })}
          </p>

          <p className="text-[10px] text-gray-400 leading-snug">{t('live.obsStreamKeyPersistent')}</p>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-0.5">
            {!obsIngestLive ? (
              <button
                type="button"
                disabled={repairing || rotating}
                onClick={() => void repairStreamInput()}
                className="shrink-0 min-h-[44px] px-3 py-2 rounded-lg text-[10px] font-bold bg-emerald-700/80 hover:bg-emerald-600 text-white disabled:opacity-50 transition"
              >
                {repairing ? t('live.obsRepairLoading') : t('live.obsRepair')}
              </button>
            ) : null}
            <button
              type="button"
              disabled={rotating || repairing}
              onClick={() => void rotateStreamKey()}
              className="shrink-0 min-h-[44px] px-3 py-2 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/15 text-amber-200 border border-amber-500/30 disabled:opacity-50 transition"
            >
              {rotating ? t('live.obsRotateKeyLoading') : t('live.obsRotateKey')}
            </button>
          </div>

          {creds.rtmpUrl ? (
            <label className="flex items-start gap-2 text-[10px] text-gray-400 leading-snug cursor-pointer">
              <input
                type="checkbox"
                checked={useRtmpFallback}
                onChange={(e) => setUseRtmpFallback(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>{t('live.obsRtmpFallbackHint')}</span>
            </label>
          ) : null}

          <ol className="text-[10px] text-gray-400 space-y-1 list-decimal list-inside leading-relaxed">
            <li>{t('live.obsStep1')}</li>
            <li>{t('live.obsStep2')}</li>
            <li>{t('live.obsStep3')}</li>
            <li>{t('live.obsStep4')}</li>
          </ol>

          <p className="text-[10px] text-red-300/90 leading-relaxed border-t border-white/10 pt-2">
            {t('live.obsConnectTrouble')}
          </p>
        </div>
      )}
    </section>
  );
}

/** Serveur RTMP + clé stream — compact pour le chat Lya (setup live OBS). */
export function LiveObsIngestChatPanel({
  token,
  className = '',
}: {
  token: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<IngestState>('idle');
  const [creds, setCreds] = useState<CloudflareIngestCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useRtmpFallback, setUseRtmpFallback] = useState(true);

  const loadIngest = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const res = await api.getObsIngest(token);
      setCreds(res);
      setState('ready');
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : t('live.obsIngestLoadError'));
    }
  }, [token, t]);

  useEffect(() => {
    void loadIngest();
  }, [loadIngest]);

  const serverUrl =
    useRtmpFallback && creds?.rtmpUrl ? creds.rtmpUrl : creds?.rtmpsUrl ?? '';

  return (
    <div
      className={`rounded-xl border border-orange-500/30 bg-orange-950/15 p-2.5 space-y-2 text-left ${className}`}
    >
      {state === 'loading' && (
        <p className="text-[11px] text-gray-400 animate-pulse">{t('live.obsIngestLoading')}</p>
      )}

      {state === 'error' && (
        <div className="space-y-2">
          <p className="text-[11px] text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadIngest()}
            className="min-h-[44px] px-3 py-2 rounded-lg text-[11px] font-bold bg-orange-600 hover:bg-orange-500 text-white"
          >
            {t('live.obsIngestRetry')}
          </button>
        </div>
      )}

      {state === 'ready' && creds && (
        <div className="space-y-2">
          {creds.streamQuotaOk === false ? (
            <p className="text-[10px] font-bold text-red-300 leading-snug border border-red-500/30 rounded-lg bg-red-950/30 px-2 py-1.5">
              {t('live.obsStreamQuotaZero')}
            </p>
          ) : null}

          <CredentialRow
            label={useRtmpFallback ? t('live.obsServerRtmp') : t('live.obsServerRtmps')}
            value={serverUrl}
            copyLabel="URL serveur"
            tone={useRtmpFallback ? 'sky' : 'emerald'}
          />
          <CredentialRow
            label={t('live.obsStreamKey')}
            value={creds.streamKey}
            copyLabel="clé de stream"
            tone="amber"
          />
          <p className="text-[10px] text-gray-500 leading-snug">{t('live.obsStreamKeyPersistent')}</p>

          {creds.rtmpUrl ? (
            <label className="flex items-start gap-2 text-[10px] text-gray-400 leading-snug cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={useRtmpFallback}
                onChange={(e) => setUseRtmpFallback(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>{t('live.obsRtmpFallbackHint')}</span>
            </label>
          ) : null}

          <p className="text-[10px] text-gray-400 leading-snug">{t('live.setupObsStep4')}</p>
        </div>
      )}
    </div>
  );
}

/** @deprecated Overlay vidéo — préférer LiveObsIngestSettings dans Réglages live. */
export function LiveCloudflareHostPanel(props: {
  token: string;
  liveId: string;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  if (props.expanded === false && props.onToggle) {
    return (
      <button
        type="button"
        onClick={props.onToggle}
        className="absolute bottom-14 right-2 z-30 px-3 py-2 rounded-xl bg-orange-600/90 hover:bg-orange-500 text-white text-[11px] font-bold shadow-lg border border-orange-400/40 transition"
      >
        📡 OBS
      </button>
    );
  }
  return (
    <div className="absolute bottom-2 left-2 right-2 z-30 max-h-[45%] overflow-y-auto">
      <LiveObsIngestSettings token={props.token} liveId={props.liveId} />
    </div>
  );
}
