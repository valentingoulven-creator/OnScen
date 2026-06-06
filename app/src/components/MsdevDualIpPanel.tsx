import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { MsdevDualIpConfig } from '../types';

interface MsdevDualIpPanelProps {
  onAutoLogin: (token: string, user: import('../types').User) => void;
  hasToken: boolean;
}

export function MsdevDualIpPanel({ onAutoLogin, hasToken }: MsdevDualIpPanelProps) {
  const [dual, setDual] = useState<MsdevDualIpConfig | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMsdevDualIp()
      .then(setDual)
      .catch(() => setDual(null));
  }, []);

  useEffect(() => {
    if (!dual?.enabled || hasToken || dual.matchedSlot == null) return;
    let cancelled = false;
    setAutoLoading(true);
    setAutoError(null);
    api
      .msdevLoginByIp()
      .then((r) => {
        if (!cancelled) onAutoLogin(r.token, r.user);
      })
      .catch((e) => {
        if (!cancelled) setAutoError(e instanceof Error ? e.message : 'Connexion auto impossible');
      })
      .finally(() => {
        if (!cancelled) setAutoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dual, hasToken, onAutoLogin]);

  if (!dual?.enabled || dual.users.length < 2) return null;

  const current = dual.matchedSlot ? dual.users.find((u) => u.slot === dual.matchedSlot) : null;

  return (
    <div className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
      <p className="text-xs font-bold text-purple-300 uppercase tracking-wide">msdev — 2 utilisateurs / 2 IP</p>
      {autoLoading && (
        <p className="text-xs text-gray-400 text-center">Connexion automatique selon votre IP…</p>
      )}
      {autoError && <p className="text-[10px] text-red-400 text-center">{autoError}</p>}
      {current && !hasToken && !autoLoading && (
        <p className="text-xs text-gray-300 text-center">
          Vous êtes sur <strong className="text-white">{current.label}</strong>
          <br />
          <span className="text-gray-500">IP détectée : {dual.clientIp || '—'}</span>
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {dual.users.map((u) => (
          <a
            key={u.slot}
            href={u.url}
            className={`block rounded-xl border p-3 text-left transition ${
              dual.matchedSlot === u.slot
                ? 'border-purple-500 bg-purple-500/15'
                : 'border-[#2d2d3d] bg-[#1a1a26] hover:border-purple-500/50'
            }`}
          >
            <p className="text-[10px] font-bold text-purple-300">Utilisateur {u.slot}</p>
            <p className="text-xs text-white font-medium mt-1">{u.username}</p>
            <p className="text-[10px] text-gray-500 mt-1 break-all">{u.url}</p>
            <p className="text-[10px] text-gray-400 mt-1">{u.email}</p>
          </a>
        ))}
      </div>
      <p className="text-[10px] text-gray-500 text-center leading-snug">
        Ouvrez chaque URL dans un navigateur ou un appareil différent — sessions séparées (hôte + auditeur).
        Mot de passe : msdev123
      </p>
    </div>
  );
}
