import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type CloudflareIngestCredentials = {
  rtmpsUrl: string;
  streamKey: string;
  playbackUrl: string;
  whipUrl?: string;
  liveInputId: string;
};

type IngestState = 'idle' | 'loading' | 'ready' | 'error';

function CopyButton({ value, label }: { value: string; label: string }) {
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

export function LiveCloudflareHostPanel({
  token,
  liveId,
  expanded = true,
  onToggle,
}: {
  token: string;
  liveId: string;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const [state, setState] = useState<IngestState>('idle');
  const [creds, setCreds] = useState<CloudflareIngestCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadIngest = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const res = await api.getCloudflareIngest(token, liveId);
      setCreds(res);
      setState('ready');
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Impossible de charger les identifiants RTMP.');
    }
  }, [token, liveId]);

  useEffect(() => {
    void loadIngest();
  }, [loadIngest]);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="absolute bottom-14 right-2 z-30 px-3 py-2 rounded-xl bg-orange-600/90 hover:bg-orange-500 text-white text-[11px] font-bold shadow-lg border border-orange-400/40 transition"
      >
        📡 Configurer OBS
      </button>
    );
  }

  return (
    <div className="absolute bottom-2 left-2 right-2 z-30 max-h-[45%] overflow-y-auto rounded-xl border border-orange-500/40 bg-black/85 backdrop-blur-md p-3 text-left shadow-xl">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-xs font-bold text-orange-300">Diffusion CDN (Cloudflare Stream)</p>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
            Connectez OBS pour que les spectateurs voient la vidéo. L’aperçu caméra du navigateur est local uniquement.
          </p>
        </div>
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 text-gray-400 hover:text-white text-lg leading-none px-1"
            aria-label="Réduire le panneau"
          >
            ×
          </button>
        ) : null}
      </div>

      {state === 'loading' && (
        <p className="text-[11px] text-gray-400 animate-pulse">Chargement des identifiants RTMP…</p>
      )}

      {state === 'error' && (
        <div className="space-y-2">
          <p className="text-[11px] text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadIngest()}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-orange-600 hover:bg-orange-500 text-white"
          >
            Réessayer
          </button>
        </div>
      )}

      {state === 'ready' && creds && (
        <div className="space-y-2.5">
          <div>
            <p className="text-[10px] font-bold text-gray-300 mb-1">URL serveur RTMPS (OBS)</p>
            <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
              <code className="flex-1 text-[10px] text-emerald-200 break-all font-mono">{creds.rtmpsUrl}</code>
              <CopyButton value={creds.rtmpsUrl} label="URL RTMPS" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-300 mb-1">Clé de stream</p>
            <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
              <code className="flex-1 text-[10px] text-amber-200 break-all font-mono">{creds.streamKey}</code>
              <CopyButton value={creds.streamKey} label="clé de stream" />
            </div>
          </div>
          <ol className="text-[10px] text-gray-400 space-y-1 list-decimal list-inside leading-relaxed">
            <li>Ouvrez OBS Studio (ou autre encodeur RTMP).</li>
            <li>Paramètres → Flux → Service « Personnalisé ».</li>
            <li>Collez l’URL et la clé ci-dessus, puis démarrez la diffusion.</li>
            <li>Profil recommandé : H.264 + AAC, GOP 2 s, bitrate &lt; 6 Mbps.</li>
          </ol>
          <p className="text-[9px] text-gray-500 border-t border-white/10 pt-2">
            L’aperçu caméra local ci-dessus est pour votre confort — seul OBS envoie le flux aux spectateurs.
            Publication navigateur (WHIP) : phase 2 — incompatible HLS pour l’instant chez Cloudflare.
          </p>
        </div>
      )}
    </div>
  );
}
