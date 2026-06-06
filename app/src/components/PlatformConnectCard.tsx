import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { isPlatformConnected, PLATFORM_LABELS, type MusicPlatform } from '../lib/platformConnect';
import type { User } from '../types';

interface PlatformConnectCardProps {
  token: string;
  platform: MusicPlatform;
  connectedPlatforms?: MusicPlatform[];
  compact?: boolean;
  onUserUpdated?: (user: User) => void;
}

export function PlatformConnectCard({
  token,
  platform,
  connectedPlatforms,
  compact,
  onUserUpdated,
}: PlatformConnectCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [youtubeOAuthAvailable, setYoutubeOAuthAvailable] = useState(false);
  const linked = isPlatformConnected(connectedPlatforms, platform);
  const meta = PLATFORM_LABELS[platform];

  useEffect(() => {
    if (platform !== 'youtube' || linked) return;
    api
      .getYoutubeOAuthUrl(token)
      .then(() => setYoutubeOAuthAvailable(true))
      .catch(() => setYoutubeOAuthAvailable(false));
  }, [platform, token, linked]);

  const connectMock = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.connectPlatform(token, platform);
      onUserUpdated?.(r.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  };

  const connectGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.getYoutubeOAuthUrl(token);
      window.location.href = r.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OAuth Google indisponible');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm(`Déconnecter ${meta.label} ? Vous ne pourrez plus héberger de salon ${meta.label}.`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.disconnectPlatform(token, platform);
      onUserUpdated?.(r.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Déconnexion impossible');
    } finally {
      setBusy(false);
    }
  };

  const displayName =
    platform === 'youtube' && linked
      ? 'Compte YouTube lié'
      : linked
        ? 'Compte lié (msdev)'
        : 'Requis pour héberger un salon sur cette plateforme';

  if (compact && linked) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
          platform === 'spotify'
            ? 'text-green-400 border-green-500/40 bg-green-500/10'
            : 'text-red-400 border-red-500/40 bg-red-500/10'
        }`}
      >
        {meta.emoji} {meta.label} connecté
      </span>
    );
  }

  return (
    <div
      className={`rounded-xl border p-3 ${
        linked
          ? platform === 'spotify'
            ? 'border-green-500/40 bg-green-500/5'
            : 'border-red-500/40 bg-red-500/5'
          : 'border-[#2d2d3d] bg-[#1a1a26]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">
            {meta.emoji} {meta.label}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">{displayName}</p>
        </div>
        {linked ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#12121a] border border-[#2d2d3d] text-green-400">
            Connecté
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {linked ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="w-full py-2 rounded-lg border border-[#2d2d3d] text-xs text-gray-400 hover:text-white disabled:opacity-50"
          >
            Déconnecter
          </button>
        ) : platform === 'youtube' && youtubeOAuthAvailable ? (
          <>
            <button
              type="button"
              onClick={connectGoogle}
              disabled={busy}
              className="w-full py-2.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50"
            >
              {busy ? 'Redirection…' : 'Connecter avec Google (YouTube)'}
            </button>
            <button
              type="button"
              onClick={connectMock}
              disabled={busy}
              className="w-full py-2 rounded-lg border border-[#2d2d3d] text-xs text-gray-400 hover:text-white disabled:opacity-50"
            >
              Connexion démo (sans Google)
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={connectMock}
            disabled={busy}
            className={`w-full py-2.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 ${
              platform === 'spotify' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {busy ? 'Connexion…' : meta.connect}
          </button>
        )}
      </div>
      {error && <p className="text-[10px] text-red-400 mt-2">{error}</p>}
      {platform === 'youtube' && !linked && !youtubeOAuthAvailable && (
        <p className="text-[10px] text-gray-500 mt-2 leading-snug">
          La connexion démo permet d&apos;héberger et d&apos;utiliser des playlists publiques. Pour vos playlists
          personnelles, configurez OAuth Google sur le serveur.
        </p>
      )}
    </div>
  );
}
