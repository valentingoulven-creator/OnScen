import { useCallback, useState } from 'react';
import { LivesBrowseGrid } from '../components/LivesBrowseGrid';
import type { Live } from '../types';
import { StartLiveFlowModals } from '../components/StartLiveFlowModals';
import { useStartLiveFlow } from '../hooks/useStartLiveFlow';

interface LivesTabPageProps {
  onOpenLive: (liveId: string) => void;
  isActive?: boolean;
  hasActiveSalon?: boolean;
}

export function LivesTabPage({ onOpenLive, isActive = true, hasActiveSalon = false }: LivesTabPageProps) {
  const [liveCount, setLiveCount] = useState(0);
  const flow = useStartLiveFlow({ onOpenLive, hasActiveSalon, isActive });
  const { starting, startError, dismissStartError, startLive, mediaSetupOpen } = flow;

  const handleLivesChange = useCallback((lives: Live[]) => {
    setLiveCount(lives.length);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f]">
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#1e1e2f]">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
          <h2 className="text-xl font-bold ms-username-wave leading-tight">Lives</h2>
          {liveCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] font-semibold text-purple-300 tabular-nums">
              {liveCount} en cours
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 mb-3 leading-snug">
          Sessions en direct avec chat et réactions
        </p>

        <button
          type="button"
          onClick={startLive}
          disabled={starting || mediaSetupOpen}
          className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl ms-wave-gradient-bg disabled:opacity-50 text-sm font-bold text-white transition-[background-image,opacity] duration-200"
        >
          {starting ? (
            <span>Démarrage…</span>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4 shrink-0"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Démarrer mon Live</span>
            </>
          )}
        </button>

        {startError && (
          <p
            className="mt-3 rounded-lg bg-red-950/60 border border-red-500/30 text-red-200 text-xs px-3 py-2"
            role="alert"
          >
            {startError}
            <button
              type="button"
              onClick={dismissStartError}
              className="ml-2 text-red-400 hover:text-white bg-transparent border-0 p-0 cursor-pointer"
              aria-label="Fermer"
            >
              ×
            </button>
          </p>
        )}
      </div>

      <LivesBrowseGrid
        className="flex-1 min-h-0"
        onOpenLive={onOpenLive}
        isActive={isActive}
        onLivesChange={handleLivesChange}
      />

      <StartLiveFlowModals flow={flow} />
    </div>
  );
}
