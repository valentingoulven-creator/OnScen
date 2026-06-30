import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { CredentialRow } from './LiveCloudflareHostPanel';

type ObsCredentials = {
  rtmpsUrl: string;
  rtmpUrl?: string;
  streamKey: string;
};

type LiveKitCdnEgressSettingsProps = {
  liveId: string;
  token: string;
};

/** Diffusion OBS depuis le panneau hôte Config (mode LiveKit). */
export function LiveKitCdnEgressSettings({ liveId, token }: LiveKitCdnEgressSettingsProps) {
  const { t } = useTranslation();
  const [obsSetupOpen, setObsSetupOpen] = useState(false);
  const [obsConnected, setObsConnected] = useState(false);
  const [credsLoading, setCredsLoading] = useState(false);
  const [creds, setCreds] = useState<ObsCredentials | null>(null);
  const [credsError, setCredsError] = useState<string | null>(null);
  const [useRtmpFallback, setUseRtmpFallback] = useState(true);
  const [rotating, setRotating] = useState(false);

  const loadIngest = useCallback(async () => {
    setCredsLoading(true);
    setCredsError(null);
    try {
      const res = await api.getObsIngest(token);
      setCreds({
        rtmpsUrl: res.rtmpsUrl,
        rtmpUrl: res.rtmpUrl,
        streamKey: res.streamKey,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('live.livekitObsError');
      setCredsError(msg.toLowerCase().includes('bad gateway') ? t('live.livekitObsError') : msg);
    } finally {
      setCredsLoading(false);
    }
  }, [t, token]);

  const pollObsStatus = useCallback(async () => {
    try {
      const status = await api.getCloudflareStreamStatus(token, liveId);
      setObsConnected(status.live);
    } catch {
      setObsConnected(false);
    }
  }, [liveId, token]);

  const openObsSetup = useCallback(async () => {
    setObsSetupOpen(true);
    if (!creds && !credsLoading) {
      await loadIngest();
    }
  }, [creds, credsLoading, loadIngest]);

  const rotateStreamKey = useCallback(async () => {
    if (obsConnected && !window.confirm(t('live.obsRotateKeyWhileLiveConfirm'))) return;
    if (!window.confirm(t('live.obsRotateKeyConfirm'))) return;
    setRotating(true);
    setCredsError(null);
    try {
      const res = await api.rotateObsStreamKey(token);
      setCreds({
        rtmpsUrl: res.rtmpsUrl,
        rtmpUrl: res.rtmpUrl,
        streamKey: res.streamKey,
      });
    } catch (err) {
      setCredsError(err instanceof Error ? err.message : t('live.obsRotateKeyError'));
    } finally {
      setRotating(false);
    }
  }, [obsConnected, t, token]);

  useEffect(() => {
    if (!obsSetupOpen) return;
    void pollObsStatus();
    const id = window.setInterval(() => void pollObsStatus(), 5000);
    return () => window.clearInterval(id);
  }, [obsSetupOpen, pollObsStatus]);

  const serverUrl =
    useRtmpFallback && creds?.rtmpUrl ? creds.rtmpUrl : creds?.rtmpsUrl ?? '';

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold text-white">{t('live.livekitObsTitle')}</p>
        <p className="text-[11px] text-gray-400 mt-1 leading-snug">
          {obsSetupOpen ? t('live.livekitObsHintOpen') : t('live.livekitObsHint')}
        </p>
        {obsSetupOpen ? (
          <p
            className={`text-[11px] font-medium mt-2 ${
              obsConnected ? 'text-emerald-400' : 'text-gray-500'
            }`}
          >
            {obsConnected ? t('live.livekitObsStatusLive') : t('live.livekitObsStatusIdle')}
          </p>
        ) : null}
      </div>

      {!obsSetupOpen ? (
        <button
          type="button"
          onClick={() => void openObsSetup()}
          className="min-h-11 px-4 py-2 rounded-full text-xs font-bold transition active:scale-95 touch-manipulation bg-[#1a1a26] border border-white/20 text-gray-200 hover:text-white hover:border-white/40"
        >
          {t('live.livekitObsStart')}
        </button>
      ) : null}

      {obsSetupOpen && credsLoading ? (
        <p className="text-[11px] text-gray-400 animate-pulse">{t('live.obsIngestLoading')}</p>
      ) : null}

      {obsSetupOpen && credsError ? (
        <div className="space-y-2">
          <p className="text-[11px] text-red-300">{credsError}</p>
          <button
            type="button"
            onClick={() => void loadIngest()}
            className="min-h-11 px-3 py-2 rounded-lg text-[11px] font-bold bg-[#1a1a26] border border-white/20 text-gray-200 hover:text-white"
          >
            {t('live.obsIngestRetry')}
          </button>
        </div>
      ) : null}

      {obsSetupOpen && !credsLoading && creds ? (
        <div className="space-y-2.5 pt-1 border-t border-[#1e1e2f]">
          <CredentialRow
            label={t('live.livekitObsServer')}
            value={serverUrl}
            copyLabel="serveur"
            tone="emerald"
          />
          <CredentialRow
            label={t('live.livekitObsKey')}
            value={creds.streamKey}
            copyLabel="clé"
            tone="amber"
          />

          <p className="text-[10px] text-gray-400 leading-snug">{t('live.obsStreamKeyPersistent')}</p>

          <button
            type="button"
            disabled={rotating}
            onClick={() => void rotateStreamKey()}
            className="min-h-11 px-3 py-2 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/15 text-amber-200 border border-amber-500/30 disabled:opacity-50 transition"
          >
            {rotating ? t('live.obsRotateKeyLoading') : t('live.obsRotateKey')}
          </button>

          {creds.rtmpUrl ? (
            <label className="flex items-start gap-2 text-[10px] text-gray-400 leading-snug cursor-pointer min-h-11">
              <input
                type="checkbox"
                checked={useRtmpFallback}
                onChange={(e) => setUseRtmpFallback(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>{t('live.livekitObsFallback')}</span>
            </label>
          ) : null}

          <ol className="text-[10px] text-gray-400 space-y-1 list-decimal list-inside leading-relaxed">
            <li>{t('live.livekitObsStep1')}</li>
            <li>{t('live.livekitObsStep2')}</li>
            <li>{t('live.livekitObsStep3')}</li>
          </ol>
        </div>
      ) : null}
    </div>
  );
}
