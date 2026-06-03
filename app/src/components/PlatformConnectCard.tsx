import { useState } from 'react';
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
  const linked = isPlatformConnected(connectedPlatforms, platform);
  const meta = PLATFORM_LABELS[platform];

  const connect = async () => {
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
          <p className="text-[10px] text-gray-500 mt-0.5">
            {linked ? 'Compte lié (msdev)' : 'Requis pour héberger un salon sur cette plateforme'}
          </p>
        </div>
        {linked ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#12121a] border border-[#2d2d3d] text-green-400">
            Connecté
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex gap-2">
        {linked ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="flex-1 py-2 rounded-lg border border-[#2d2d3d] text-xs text-gray-400 hover:text-white disabled:opacity-50"
          >
            Déconnecter
          </button>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 ${
              platform === 'spotify' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {busy ? 'Connexion…' : meta.connect}
          </button>
        )}
      </div>
      {error && <p className="text-[10px] text-red-400 mt-2">{error}</p>}
    </div>
  );
}
