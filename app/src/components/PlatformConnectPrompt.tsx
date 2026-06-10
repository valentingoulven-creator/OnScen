import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PLATFORM_STATUS_REFRESH_EVENT } from '../lib/platformStatusEvents';
import { PlatformConnectCard } from './PlatformConnectCard';
import type { User } from '../types';

const DISMISS_KEY = 'soundly_platform_prompt_dismissed';

interface PlatformConnectPromptProps {
  token: string;
  user: User;
  onUserUpdated: (user: User) => void;
  onOpenProfile?: () => void;
}

export function PlatformConnectPrompt({
  token,
  user,
  onUserUpdated,
  onOpenProfile,
}: PlatformConnectPromptProps) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState(false);

  const evaluate = useCallback(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === '1') {
      setVisible(false);
      return;
    }
    api
      .getPlatformStatus(token)
      .then((s) => {
        const required = s.platformConnectionRequired ?? s.oauthConfigured ?? false;
        const connected = s.hasRealPlatformConnection ?? false;
        setOauthConfigured(required);
        setVisible(required && !connected);
      })
      .catch(() => setVisible(false));
  }, [token]);

  useEffect(() => {
    evaluate();
  }, [evaluate, user.connectedPlatforms]);

  useEffect(() => {
    const onRefresh = () => evaluate();
    window.addEventListener(PLATFORM_STATUS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(PLATFORM_STATUS_REFRESH_EVENT, onRefresh);
  }, [evaluate]);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="mx-3 mt-2 mb-1 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">Connecte Spotify et/ou YouTube</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
            Au moins une plateforme est requise pour héberger des salons avec ta bibliothèque.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-gray-500 hover:text-gray-300 text-xs shrink-0 px-1"
          aria-label="Masquer"
        >
          ×
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-500"
        >
          {expanded ? 'Masquer les boutons' : 'Connecter maintenant'}
        </button>
        {onOpenProfile ? (
          <button
            type="button"
            onClick={onOpenProfile}
            className="px-3 py-1.5 rounded-lg text-xs text-gray-300 border border-[#2d2d3d] hover:text-white"
          >
            Ouvrir mon profil
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className="mt-3 space-y-2">
          {(['spotify', 'youtube'] as const).map((p) => (
            <PlatformConnectCard
              key={p}
              token={token}
              platform={p}
              connectedPlatforms={user.connectedPlatforms}
              onUserUpdated={(u) => {
                onUserUpdated(u);
                if (oauthConfigured) evaluate();
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
