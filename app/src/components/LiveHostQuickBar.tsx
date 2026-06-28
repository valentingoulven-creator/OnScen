/**
 * LiveHostQuickBar — Barre de contrôle rapide hôte
 * Header : MIC · CAM · STOP · BOARD (menu config)
 * Footer : barre complète legacy
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmModal } from './ConfirmModal';

interface LiveHostQuickBarProps {
  // Caméra
  cameraActive: boolean;
  cameraToggling: boolean;
  videoFileLoading: boolean;
  onToggleCamera: () => void;
  onPickVideo: () => void;
  // Micro
  micMuted: boolean;
  onToggleMic: () => void;
  // OBS
  showObs: boolean;
  cfProvisioning: boolean;
  onConfigureObs: () => void;
  obsUltraOnly?: boolean;
  // File récompenses
  queueCount: number;
  onOpenRewards: () => void;
  // Goals
  goalPercent: number | null; // null = pas de goal actif
  onOpenGoals: () => void;
  // Stop
  onStop: () => void | Promise<void>;
  // Dashboard ⚙
  onOpenDashboard: () => void;
  // Sélecteur micro / caméra (menu Board)
  micSelectSlot?: ReactNode;
  /** Rafraîchit la liste des périphériques à l'ouverture du menu Board. */
  onBoardMenuOpen?: () => void;
  /** header = icônes compactes dans la top bar ; footer = barre complète en bas */
  variant?: 'footer' | 'header';
  /** Affiche uniquement micro/OBS (sans les boutons rapides) */
  extrasOnly?: boolean;
}

function QuickBtn({
  label,
  active,
  disabled,
  danger,
  badge,
  onClick,
  onLongPress,
  children,
  compact,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  badge?: string | number;
  onClick: () => void;
  onLongPress?: () => void;
  children: ReactNode;
  compact?: boolean;
}) {
  const timerRef = useRef<number | null>(null);

  const handlePointerDown = useCallback(() => {
    if (!onLongPress) return;
    timerRef.current = window.setTimeout(onLongPress, 500);
  }, [onLongPress]);

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-2xl border transition select-none ${
        compact ? 'w-9 h-9 rounded-full' : 'w-14 h-14'
      } ${
        danger
          ? 'border-red-500/60 bg-red-950/50 text-red-400 hover:bg-red-950/80 active:scale-95'
          : active
          ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-400 active:scale-95'
          : 'border-[#232330] bg-[#131318] text-gray-400 hover:border-white/15 hover:text-white active:scale-95'
      } disabled:opacity-40`}
    >
      {children}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center leading-none">
          {badge}
        </span>
      )}
    </button>
  );
}

function MicIcon({ muted, compact }: { muted: boolean; compact?: boolean }) {
  const cn = compact ? 'w-4 h-4' : 'w-5 h-5';
  return muted ? (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
      <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ) : (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CamIcon({ active, compact }: { active: boolean; compact?: boolean }) {
  const cn = compact ? 'w-4 h-4' : 'w-5 h-5';
  return active ? (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ) : (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h3a2 2 0 012 2v9.34m-7.72-2.06A3 3 0 119.88 9.88" />
    </svg>
  );
}

function ListIcon({ compact }: { compact?: boolean }) {
  return (
    <svg className={compact ? 'w-4 h-4' : 'w-5 h-5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3" cy="6" r="1" fill="currentColor" />
      <circle cx="3" cy="12" r="1" fill="currentColor" />
      <circle cx="3" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

function GoalIcon({ percent, compact }: { percent: number | null; compact?: boolean }) {
  if (percent === null) {
    return (
      <svg className={compact ? 'w-4 h-4' : 'w-5 h-5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }
  const r = 9;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  if (compact) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2" />
        <circle
          cx="12" cy="12" r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg className="w-10 h-10 -m-2" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
      <circle
        cx="12" cy="12" r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <text x="12" y="15.5" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor">{percent}%</text>
    </svg>
  );
}

function StopIcon({ compact }: { compact?: boolean }) {
  return (
    <svg className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function videoStageControlClass(active: boolean, danger?: boolean, disabled?: boolean): string {
  return `flex items-center justify-center w-11 h-11 rounded-lg border backdrop-blur transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
    danger
      ? 'border-red-500/50 bg-red-950/60 text-red-300 hover:bg-red-950/80'
      : active
        ? 'border-emerald-500/40 bg-black/70 text-emerald-400 hover:bg-black/85'
        : 'border-white/20 bg-black/70 text-gray-300 hover:text-white hover:bg-black/85'
  }${disabled ? '' : ''}`;
}

export function LiveHostMicToggleButton({
  muted,
  disabled,
  onToggle,
}: {
  muted: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={videoStageControlClass(!muted, muted, disabled)}
      aria-label={muted ? 'Activer le micro' : 'Couper le micro'}
      title={muted ? 'Activer le micro' : 'Couper le micro'}
    >
      <MicIcon muted={muted} compact />
    </button>
  );
}

export function LiveHostCamToggleButton({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={videoStageControlClass(active, false, disabled)}
      aria-label={active ? 'Couper la caméra' : 'Activer la caméra'}
      title={active ? 'Couper la caméra' : 'Activer la caméra'}
    >
      <CamIcon active={active} compact />
    </button>
  );
}

export function StopLiveButton({
  compact,
  onStop,
}: {
  compact?: boolean;
  onStop: () => void | Promise<void>;
}) {
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [stopping, setStopping] = useState(false);

  const handleConfirmStop = async () => {
    setStopping(true);
    try {
      await onStop();
      setShowStopConfirm(false);
    } finally {
      setStopping(false);
    }
  };

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setShowStopConfirm(true)}
          className="shrink-0 h-9 px-3 rounded-full border border-red-500/60 bg-red-950/50 text-red-300 text-[11px] font-bold hover:bg-red-950/80 active:scale-95 transition whitespace-nowrap"
          aria-label="Arrêter le live"
        >
          Arrêter le live
        </button>
      ) : (
        <QuickBtn
          label="Arrêter le live"
          danger
          onClick={() => setShowStopConfirm(true)}
        >
          <StopIcon />
          <span className="text-[8px] font-bold uppercase tracking-wide leading-none">Arrêter</span>
        </QuickBtn>
      )}

      <ConfirmModal
        open={showStopConfirm}
        title="Arrêter le live ?"
        description="Le live sera coupé pour tous les spectateurs. Cette action est définitive."
        confirmLabel="Arrêter le live"
        cancelLabel="Annuler"
        loading={stopping}
        loadingLabel="Arrêt…"
        onCancel={() => {
          if (!stopping) setShowStopConfirm(false);
        }}
        onConfirm={() => void handleConfirmStop()}
      />
    </>
  );
}

function BoardIcon({ compact }: { compact?: boolean }) {
  return (
    <svg
      className={compact ? 'w-4 h-4' : 'w-5 h-5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
    </svg>
  );
}

function BoardMenuButton({
  compact,
  open,
  onToggle,
  onClose,
  onOpenDashboard,
  onPickVideo,
  onConfigureObs,
  showObs,
  cfProvisioning,
  obsUltraOnly,
  micSelectSlot,
}: {
  compact?: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onOpenDashboard: () => void;
  onPickVideo: () => void;
  onConfigureObs: () => void;
  showObs: boolean;
  cfProvisioning: boolean;
  obsUltraOnly?: boolean;
  micSelectSlot?: ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const menuWidth = menuRef.current?.offsetWidth ?? 272;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );
      setMenuPos({ top: rect.bottom + 6, left });
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, showObs, obsUltraOnly, micSelectSlot]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onClose]);

  const menuPanel = open ? (
    <div
      ref={menuRef}
      className="fixed z-[100] w-[min(17rem,calc(100vw-2rem))] rounded-xl border border-[#2a2a3a] bg-[#12121a] shadow-2xl overflow-hidden"
      style={
        menuPos
          ? ({ top: menuPos.top, left: menuPos.left } satisfies CSSProperties)
          : { top: -9999, left: -9999, visibility: 'hidden' as const }
      }
      role="menu"
    >
      <div className="px-3 py-2 border-b border-[#1e1e2f] bg-[#14141c]/90">
        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
          Paramètres live
        </p>
      </div>

      <div className="p-2 space-y-1 max-h-[min(70dvh,420px)] overflow-y-auto">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onOpenDashboard();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm font-medium text-white hover:bg-white/5 transition"
        >
          <span className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0">
            <BoardIcon compact />
          </span>
          Dashboard host
        </button>

        <div className="rounded-lg border border-[#1e1e2f] bg-[#0f0f16] p-2.5 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Micro &amp; caméra
          </p>
          {micSelectSlot ?? (
            <p className="text-[11px] text-gray-500 px-1">Activez la caméra pour choisir un micro.</p>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onPickVideo();
              onClose();
            }}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold border border-[#2a2a3a] bg-[#1a1a26] text-gray-200 hover:border-purple-500/40 hover:text-white transition"
          >
            Choisir une vidéo fichier
          </button>
        </div>

        {(showObs || obsUltraOnly) && (
          <div className="rounded-lg border border-[#1e1e2f] bg-[#0f0f16] p-2.5 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Diffusion OBS
            </p>
            {showObs ? (
              <button
                type="button"
                role="menuitem"
                disabled={cfProvisioning}
                onClick={() => {
                  onConfigureObs();
                  onClose();
                }}
                className="w-full px-3 py-2 rounded-lg text-xs font-bold border border-orange-500/40 bg-orange-950/60 text-orange-200 hover:bg-orange-900/70 transition disabled:opacity-50"
              >
                {cfProvisioning ? 'Configuration…' : 'Configurer OBS'}
              </button>
            ) : (
              <p className="text-[11px] text-gray-500 text-center py-1">
                OBS · Cloudflare requis
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={anchorRef} className="relative shrink-0">
      <QuickBtn
        label="Paramètres et dashboard"
        compact={compact}
        active={open}
        onClick={onToggle}
      >
        <BoardIcon compact={compact} />
        {!compact && (
          <span className="text-[8px] font-bold uppercase tracking-wide leading-none">Board</span>
        )}
      </QuickBtn>

      {typeof document !== 'undefined' && menuPanel
        ? createPortal(menuPanel, document.body)
        : null}
    </div>
  );
}

export function LiveHostQuickBar({
  cameraActive,
  cameraToggling,
  videoFileLoading,
  onToggleCamera,
  onPickVideo,
  micMuted,
  onToggleMic,
  showObs,
  cfProvisioning,
  onConfigureObs,
  obsUltraOnly,
  queueCount,
  onOpenRewards,
  goalPercent,
  onOpenGoals,
  onStop,
  onOpenDashboard,
  micSelectSlot,
  onBoardMenuOpen,
  variant = 'footer',
  extrasOnly = false,
}: LiveHostQuickBarProps) {
  const compact = variant === 'header';
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);

  useEffect(() => {
    if (boardMenuOpen) onBoardMenuOpen?.();
  }, [boardMenuOpen, onBoardMenuOpen]);

  const micCamStopButtons = (
    <>
      <QuickBtn
        label={micMuted ? 'Activer le micro' : 'Couper le micro'}
        active={!micMuted}
        danger={micMuted}
        compact={compact}
        onClick={onToggleMic}
      >
        <MicIcon muted={micMuted} compact={compact} />
        {!compact && (
          <span className="text-[8px] font-bold uppercase tracking-wide leading-none">
            {micMuted ? 'Muet' : 'Micro'}
          </span>
        )}
      </QuickBtn>

      <QuickBtn
        label={cameraActive ? 'Couper la caméra' : 'Activer la caméra'}
        active={cameraActive}
        disabled={cameraToggling || videoFileLoading}
        compact={compact}
        onClick={onToggleCamera}
        onLongPress={onPickVideo}
      >
        <CamIcon active={cameraActive} compact={compact} />
        {!compact && (
          <span className="text-[8px] font-bold uppercase tracking-wide leading-none">
            {cameraToggling ? '…' : 'Cam'}
          </span>
        )}
      </QuickBtn>

      {!compact && <StopLiveButton onStop={onStop} />}
    </>
  );

  const fileGoalsButtons = (
    <>
      <QuickBtn
        label="File de récompenses"
        badge={queueCount > 0 ? queueCount : undefined}
        compact={compact}
        onClick={onOpenRewards}
      >
        <ListIcon compact={compact} />
        {!compact && (
          <span className="text-[8px] font-bold uppercase tracking-wide leading-none">File</span>
        )}
      </QuickBtn>

      <QuickBtn
        label="Goals artistiques"
        active={goalPercent !== null && goalPercent > 0}
        compact={compact}
        onClick={onOpenGoals}
      >
        <GoalIcon percent={goalPercent} compact={compact} />
        {!compact && (
          <span className="text-[8px] font-bold uppercase tracking-wide leading-none">Goals</span>
        )}
      </QuickBtn>
    </>
  );

  const boardButton = compact ? (
    <BoardMenuButton
      compact
      open={boardMenuOpen}
      onToggle={() => setBoardMenuOpen((v) => !v)}
      onClose={() => setBoardMenuOpen(false)}
      onOpenDashboard={onOpenDashboard}
      onPickVideo={onPickVideo}
      onConfigureObs={onConfigureObs}
      showObs={showObs}
      cfProvisioning={cfProvisioning}
      obsUltraOnly={obsUltraOnly}
      micSelectSlot={micSelectSlot}
    />
  ) : (
    <QuickBtn
      label="Dashboard host"
      compact={compact}
      onClick={onOpenDashboard}
    >
      <BoardIcon compact={compact} />
      {!compact && (
        <span className="text-[8px] font-bold uppercase tracking-wide leading-none">Board</span>
      )}
    </QuickBtn>
  );

  const headerButtons = (
    <>
      {micCamStopButtons}
      {boardButton}
    </>
  );

  const footerButtons = (
    <>
      <QuickBtn
        label={micMuted ? 'Activer le micro' : 'Couper le micro'}
        active={!micMuted}
        danger={micMuted}
        onClick={onToggleMic}
      >
        <MicIcon muted={micMuted} />
        <span className="text-[8px] font-bold uppercase tracking-wide leading-none">
          {micMuted ? 'Muet' : 'Micro'}
        </span>
      </QuickBtn>

      <QuickBtn
        label={cameraActive ? 'Couper la caméra' : 'Activer la caméra'}
        active={cameraActive}
        disabled={cameraToggling || videoFileLoading}
        onClick={onToggleCamera}
        onLongPress={onPickVideo}
      >
        <CamIcon active={cameraActive} />
        <span className="text-[8px] font-bold uppercase tracking-wide leading-none">
          {cameraToggling ? '…' : 'Cam'}
        </span>
      </QuickBtn>

      {fileGoalsButtons}

      <StopLiveButton onStop={onStop} />

      <QuickBtn label="Dashboard host" onClick={onOpenDashboard}>
        <BoardIcon />
        <span className="text-[8px] font-bold uppercase tracking-wide leading-none">Board</span>
      </QuickBtn>
    </>
  );

  if (extrasOnly) {
    if (!micSelectSlot && !showObs && !obsUltraOnly) return null;
    return (
      <div className="shrink-0 bg-[#0b0b0f] border-t border-[#1e1e2f] pb-[env(safe-area-inset-bottom)]">
        {micSelectSlot && <div className="px-3 pt-2 pb-2">{micSelectSlot}</div>}
        {showObs && (
          <div className="px-3 pb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onConfigureObs}
              disabled={cfProvisioning}
              className="flex-1 py-1.5 rounded-xl text-[10px] font-bold border border-orange-500/40 bg-orange-950/60 text-orange-200 hover:bg-orange-900/70 transition disabled:opacity-50"
            >
              {cfProvisioning ? '…' : 'Configurer OBS'}
            </button>
          </div>
        )}
        {obsUltraOnly && (
          <div className="px-3 pb-2">
            <p className="text-[9px] text-gray-600 text-center">OBS · Cloudflare requis</p>
          </div>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 overflow-x-auto max-w-[min(100%,14rem)] sm:max-w-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {headerButtons}
      </div>
    );
  }

  return (
    <div className="shrink-0 bg-[#0b0b0f] border-t border-[#1e1e2f] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around gap-1 px-3 py-2">
        {footerButtons}
      </div>

      {/* Sélecteur micro (si caméra active + micro select disponible) */}
      {micSelectSlot && (
        <div className="px-3 pb-2">{micSelectSlot}</div>
      )}

      {/* OBS button (si disponible) */}
      {showObs && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onConfigureObs}
            disabled={cfProvisioning}
            className="flex-1 py-1.5 rounded-xl text-[10px] font-bold border border-orange-500/40 bg-orange-950/60 text-orange-200 hover:bg-orange-900/70 transition disabled:opacity-50"
          >
            {cfProvisioning ? '…' : 'Configurer OBS'}
          </button>
        </div>
      )}
      {obsUltraOnly && (
        <div className="px-3 pb-2">
          <p className="text-[9px] text-gray-600 text-center">OBS · Cloudflare requis</p>
        </div>
      )}
    </div>
  );
}
