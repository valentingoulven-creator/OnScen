import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  acquireLiveCameraStream,
  attachLiveCameraStream,
  canBypassLiveMediaSetup,
  ensureMediaDevices,
  getLiveCameraContextHints,
  mapLiveCameraError,
} from '../lib/liveCameraSupport';
import {
  getLiveMediaDraft,
  setLiveMediaDraft,
  setLiveMediaPrefs,
  setPendingLiveCameraStart,
  type LiveMediaPrefs,
} from '../lib/liveMediaPrefs';
import { stashLiveCameraStream } from '../lib/liveCameraHandoff';
import { getLivesGeo, type LivesGeoPrefs } from '../lib/livesGeo';
import type { LiveChatConfigValue } from './LiveChatConfigFields';
import {
  LiveDonationsSetupFields,
  hostSessionDraftFromPrefs,
  type LiveHostSessionDraft,
} from './LiveDonationsSetupFields';
import { LiveMicTestPanel } from './LiveMicTestPanel';
import { LiveObsIngestChatPanel } from './LiveCloudflareHostPanel';
import { liveObsFromDraft, type LiveObsSetupValue } from './LiveObsSetupFields';
import { SessionLocationPicker } from './SessionLocationPicker';
import { api } from '../lib/api';
import {
  applySavedSetupToDraft,
  getVisibleSetupExchange,
  nextChatMessageId,
  prefsFromParts,
  SETUP_PHASE_BOT_QUESTION,
  STANDARD_CHAT_CONFIG,
  summarizeSetup,
  type SetupChangeTarget,
  type SetupChatMessage,
  type SetupChatPhase,
} from '../lib/liveSetupChatFlow';
import type { StartLiveMediaSetupModalProps } from './StartLiveMediaSetupModal.types';

type MediaStatus = 'loading' | 'ready' | 'error';

interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

const DEFAULT_CHAT: LiveChatConfigValue = STANDARD_CHAT_CONFIG;

function ChatBubble({ message, compact }: { message: SetupChatMessage; compact?: boolean }) {
  const isBot = message.role === 'bot';
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[min(100%,13.5rem)] px-2.5 rounded-2xl leading-snug ${
          compact ? 'py-1.5 text-[12px]' : 'py-2 text-[13px]'
        } ${
          isBot
            ? 'bg-[#1e1e2f] text-gray-100 rounded-bl-md border border-[#2d2d3d]'
            : 'bg-red-600/90 text-white rounded-br-md'
        }`}
      >
        {isBot ? <span className="mr-1" aria-hidden>🎙️</span> : null}
        {message.text}
      </div>
    </div>
  );
}

function ActionChip({
  children,
  onClick,
  variant = 'default',
  disabled,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'ghost';
  disabled?: boolean;
  className?: string;
}) {
  const base =
    'min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-[0.98] disabled:opacity-40';
  const styles =
    variant === 'primary'
      ? 'bg-red-600 hover:bg-red-500 text-white'
      : variant === 'ghost'
        ? 'bg-transparent border border-[#2d2d3d] text-gray-400 hover:text-white'
        : 'bg-[#2d2d3d] hover:bg-[#3d3d4d] text-white';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${styles}${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  );
}

function LiveStripeSetupChatPanel({
  token,
  stripePending,
  onSkip,
  onRefresh,
}: {
  token: string;
  stripePending?: boolean;
  onSkip?: () => void;
  onRefresh?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOnboard = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.startStripeConnectOnboard(token);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('profile.stripeConnect.onboardError'));
      setBusy(false);
    }
  };

  return (
    <div className="pt-0.5 space-y-2 rounded-xl border border-purple-500/30 bg-purple-500/5 p-2.5">
      {!stripePending && (
        <ul className="space-y-1.5">
          {[t('live.stripeGateItem1'), t('live.stripeGateItem2'), t('live.stripeGateItem3')].map(
            (item) => (
              <li key={item} className="flex items-start gap-2 text-[10px] text-gray-300 leading-snug">
                <span className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[8px] text-purple-400 font-bold">
                  ✓
                </span>
                {item}
              </li>
            )
          )}
        </ul>
      )}

      {stripePending && (
        <p className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2 leading-snug">
          {t('live.stripeGateNotReady')}
        </p>
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      <button
        type="button"
        onClick={() => void handleOnboard()}
        disabled={busy}
        className="w-full min-h-[44px] py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-50 transition"
      >
        {busy
          ? t('profile.stripeConnect.onboarding')
          : stripePending
            ? t('live.stripeGateNotReadyCta')
            : t('live.stripeGateCta')}
      </button>

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="w-full min-h-[44px] py-2 text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50 transition"
        >
          {t('live.stripeGateSkip')}
        </button>
      )}

      {onRefresh && (
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={busy}
          className="w-full text-[10px] text-gray-500 hover:text-gray-300 underline min-h-[44px]"
        >
          {t('profile.stripeConnect.refresh')}
        </button>
      )}

      <p className="text-[9px] text-gray-600 text-center leading-snug">{t('live.stripeGateProfileHint')}</p>
    </div>
  );
}

export function StartLiveSetupChatModal({
  open,
  onClose,
  onReady,
  confirmLabel,
  defaultLiveTitle = 'Live',
  donationsEnabled = false,
  donationsSimulation = false,
  initialGeo,
  token,
  profileCity,
  stripeStepRequired = false,
  stripeStatusReady = true,
  stripePending = false,
  stripeReady = false,
  onStripeSkip,
  onStripeRefresh,
}: StartLiveMediaSetupModalProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [messages, setMessages] = useState<SetupChatMessage[]>([]);
  const [phase, setPhase] = useState<SetupChatPhase>('loading');
  const [chatReady, setChatReady] = useState(false);
  const [savedConfigured, setSavedConfigured] = useState(false);
  const [editReturn, setEditReturn] = useState(false);

  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [mediaStatus, setMediaStatus] = useState<MediaStatus>('loading');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [mics, setMics] = useState<MediaDeviceOption[]>([]);

  const [liveTitle, setLiveTitle] = useState(defaultLiveTitle);
  const [titleDraft, setTitleDraft] = useState(defaultLiveTitle);
  const [chatConfig, setChatConfig] = useState<LiveChatConfigValue>(DEFAULT_CHAT);
  const [hostSession, setHostSession] = useState<LiveHostSessionDraft>(() =>
    hostSessionDraftFromPrefs(getLiveMediaDraft())
  );
  const [liveLocation, setLiveLocation] = useState<LivesGeoPrefs>(() =>
    initialGeo ?? getLivesGeo()
  );
  const [obsSetup, setObsSetup] = useState<LiveObsSetupValue>(() => liveObsFromDraft(getLiveMediaDraft()));
  const [videoDeviceId, setVideoDeviceId] = useState('');
  const [audioDeviceId, setAudioDeviceId] = useState('');

  const [obsCapsLoading, setObsCapsLoading] = useState(false);
  const [obsAllowed, setObsAllowed] = useState(false);
  const [cloudflareAvailable, setCloudflareAvailable] = useState(false);

  const resolvedConfirmLabel = confirmLabel ?? t('live.setupStart');
  const username = defaultLiveTitle.replace(/^Live — /, '') || 'Live';

  const pushBot = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextChatMessageId(), role: 'bot', text }]);
  }, []);

  const pushUser = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextChatMessageId(), role: 'user', text }]);
  }, []);

  const exchangeMessages = getVisibleSetupExchange(messages, phase);

  useEffect(() => {
    if (!open || !chatReady || phase === 'loading' || phase === 'return_ask') return;
    const questionKey = SETUP_PHASE_BOT_QUESTION[phase];
    if (!questionKey) return;
    const text = t(`live.${questionKey}`);
    setMessages((prev) => {
      if (prev.some((m) => m.role === 'bot' && m.text === text)) return prev;
      return [...prev, { id: nextChatMessageId(), role: 'bot', text }];
    });
  }, [open, chatReady, phase, t]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setPreviewStream(null);
    const el = videoRef.current;
    if (el) el.srcObject = null;
  }, []);

  const refreshDeviceLists = useCallback(async () => {
    const md = ensureMediaDevices();
    if (!md?.enumerateDevices) return;
    const all = await md.enumerateDevices();
    setCameras(
      all
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Caméra ${i + 1}` }))
    );
    setMics(
      all
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Micro ${i + 1}` }))
    );
  }, []);

  const openStream = useCallback(async (videoId?: string, audioId?: string) => {
    const md = ensureMediaDevices();
    if (!md?.getUserMedia) throw new DOMException('', 'NotSupportedError');
    return acquireLiveCameraStream((c) => md.getUserMedia(c), {
      videoDeviceId: videoId,
      audioDeviceId: audioId,
    });
  }, []);

  const initMedia = useCallback(async () => {
    setMediaStatus('loading');
    setMediaError(null);
    try {
      const stream = await openStream(videoDeviceId || undefined, audioDeviceId || undefined);
      streamRef.current = stream;
      setPreviewStream(stream);
      const el = videoRef.current;
      if (el) await attachLiveCameraStream(el, stream);
      await refreshDeviceLists();
      setMediaStatus('ready');
    } catch (e) {
      setMediaError(mapLiveCameraError(e));
      setHints(getLiveCameraContextHints());
      setMediaStatus('error');
    }
  }, [audioDeviceId, openStream, refreshDeviceLists, videoDeviceId]);

  useEffect(() => {
    if (!open || !token) return;
    if (!stripeStatusReady) {
      setPhase('loading');
      setMessages([]);
      setChatReady(false);
      return;
    }
    let cancelled = false;
    setPhase('loading');
    setMessages([]);
    setChatReady(false);
    setEditReturn(false);

    const geo = initialGeo ?? getLivesGeo();
    const draft = getLiveMediaDraft();

    setObsCapsLoading(true);

    void (async () => {
      let saved: LiveMediaPrefs | null = null;
      let configured = false;
      try {
        const res = await api.getLiveSetup(token);
        saved = res.setup;
        configured = res.configured;
      } catch {
        /* session / offline — brouillon local */
      }
      if (cancelled) return;

      const applied = applySavedSetupToDraft(configured ? saved : draft, {
        defaultLiveTitle,
        initialGeo: geo,
        hostSession: hostSessionDraftFromPrefs(draft),
      });

      setSavedConfigured(configured);
      setLiveTitle(applied.liveTitle);
      setTitleDraft(applied.liveTitle);
      setLiveLocation(applied.liveLocation);
      setChatConfig(configured ? applied.chatConfig : STANDARD_CHAT_CONFIG);
      setHostSession(applied.hostSession);
      setObsSetup(applied.obsSetup);
      setVideoDeviceId(applied.videoDeviceId);
      setAudioDeviceId(applied.audioDeviceId);

      setMessages(
        configured
          ? [
              {
                id: nextChatMessageId(),
                role: 'bot',
                text: t('live.setupChatReturnHello', {
                  summary: summarizeSetup(
                    prefsFromParts({
                      ...applied,
                      liveTitle: applied.liveTitle,
                      chatConfig: applied.chatConfig,
                      hostSession: applied.hostSession,
                      obsSetup: applied.obsSetup,
                      liveLocation: applied.liveLocation,
                      videoDeviceId: applied.videoDeviceId,
                      audioDeviceId: applied.audioDeviceId,
                    }),
                    username
                  ),
                }),
              },
            ]
          : [{ id: nextChatMessageId(), role: 'bot', text: t('live.setupChatHello') }]
      );

      setPhase(configured ? 'return_ask' : stripeStepRequired ? 'stripe' : 'title');
      setChatReady(true);
    })();

    api
      .getLiveStreamCapabilities(token)
      .then((caps) => {
        if (cancelled) return;
        setObsAllowed(caps.obsAllowed ?? false);
        setCloudflareAvailable(caps.cloudflareStreamAvailable ?? false);
      })
      .catch(() => {
        if (!cancelled) setObsAllowed(false);
      })
      .finally(() => {
        if (!cancelled) setObsCapsLoading(false);
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, token, stripeStatusReady, stripeStepRequired, defaultLiveTitle, initialGeo, t, username, stopStream]);

  useEffect(() => {
    if (!open || obsSetup.useObs) return;
    if (phase !== 'devices' && phase !== 'broadcast') return;
    void initMedia();
  }, [open, obsSetup.useObs, phase, initMedia]);

  const buildCurrentPrefs = useCallback(
    (extra?: Partial<LiveMediaPrefs>): LiveMediaPrefs =>
      prefsFromParts(
        {
          videoDeviceId,
          audioDeviceId,
          liveTitle,
          liveLocation,
          chatConfig,
          hostSession,
          obsSetup,
        },
        extra
      ),
    [audioDeviceId, chatConfig, hostSession, liveLocation, liveTitle, obsSetup, videoDeviceId]
  );

  const persistDraft = useCallback(() => {
    setLiveMediaDraft(buildCurrentPrefs());
  }, [buildCurrentPrefs]);

  const finishAfterEdit = useCallback(() => {
    if (editReturn || savedConfigured) {
      pushBot(t('live.setupChatUpdated', { summary: summarizeSetup(buildCurrentPrefs(), username) }));
      setPhase('return_ask');
      setEditReturn(false);
    } else {
      setPhase('confirm');
    }
  }, [buildCurrentPrefs, editReturn, pushBot, savedConfigured, t, username]);

  const launchLive = useCallback(async () => {
    const prefs = buildCurrentPrefs();
    if (token) {
      try {
        await api.putLiveSetup(token, prefs);
      } catch {
        /* best effort — session prefs restent */
      }
    }
    setLiveMediaPrefs(prefs);
    if (!obsSetup.useObs) {
      setPendingLiveCameraStart();
      if (streamRef.current) {
        stashLiveCameraStream(streamRef.current);
        streamRef.current = null;
      } else {
        stopStream();
      }
    } else {
      stopStream();
    }
    onReady(prefs);
  }, [buildCurrentPrefs, obsSetup.useObs, onReady, stopStream, token]);

  const handleUseSaved = () => {
    pushUser(t('live.setupChatUseSaved'));
    pushBot(t('live.setupChatLaunching'));
    void launchLive();
  };

  const handlePickChange = (target: SetupChangeTarget) => {
    const labels: Record<SetupChangeTarget, string> = {
      stripe: t('live.setupChatChangeStripe'),
      title: t('live.setupChatChangeTitle'),
      broadcast: t('live.setupChatChangeBroadcast'),
      devices: t('live.setupChatChangeDevices'),
      location: t('live.setupChatChangeLocation'),
      goals: t('live.setupChatChangeGoals'),
      rewards: t('live.setupChatChangeRewards'),
    };
    pushUser(labels[target]);
    setEditReturn(true);
    if (target === 'devices' && obsSetup.useObs) {
      setPhase('broadcast');
      return;
    }
    if (target === 'stripe') {
      setPhase('stripe');
      return;
    }
    setPhase(target === 'broadcast' ? 'broadcast' : target);
    if (target === 'title') setTitleDraft(liveTitle);
  };

  const canStart =
    liveTitle.trim().length > 0 &&
    (!obsSetup.useObs || (obsAllowed && cloudflareAvailable)) &&
    (obsSetup.useObs || mediaStatus === 'ready' || phase === 'confirm' || phase === 'return_ask');

  const handleStripeSkipInChat = () => {
    onStripeSkip?.();
    pushUser(t('live.stripeGateSkip'));
    setPhase('title');
  };

  const showStepFooter =
    phase === 'stripe' ||
    phase === 'title' ||
    phase === 'obs_ingest' ||
    phase === 'location' ||
    phase === 'goals' ||
    phase === 'rewards' ||
    phase === 'confirm' ||
    (phase === 'devices' && !obsSetup.useObs);

  const renderStepPrimaryAction = () => {
    switch (phase) {
      case 'stripe':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            disabled={!stripeReady}
            onClick={() => {
              pushUser(t('live.setupChatStripeOk'));
              setPhase('title');
            }}
          >
            {t('live.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'title':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            disabled={!titleDraft.trim()}
            onClick={() => {
              setLiveTitle(titleDraft.trim());
              pushUser(titleDraft.trim());
              persistDraft();
              if (editReturn) {
                finishAfterEdit();
                return;
              }
              setPhase('broadcast');
            }}
          >
            {t('live.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'obs_ingest':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            onClick={() => {
              pushUser(t('live.setupChatObsIngestOk'));
              persistDraft();
              if (editReturn) {
                finishAfterEdit();
                return;
              }
              setPhase('location');
            }}
          >
            {t('live.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'devices':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            disabled={mediaStatus !== 'ready'}
            onClick={() => {
              pushUser(t('live.setupChatDevicesOk'));
              persistDraft();
              if (editReturn) {
                finishAfterEdit();
                return;
              }
              setPhase('location');
            }}
          >
            {t('live.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'location':
        return (
          <ActionChip variant="primary" className="w-full" onClick={() => {
              pushUser(liveLocation.label || t('live.setupChatLocationOk'));
              if (editReturn) {
                finishAfterEdit();
                return;
              }
              if (donationsEnabled) {
                setPhase('goals');
              } else {
                setPhase('confirm');
              }
            }}
          >
            {t('live.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'goals':
        return (
          <ActionChip variant="primary" className="w-full" onClick={() => {
              pushUser(t('live.setupChatGoalsOk'));
              if (editReturn) {
                finishAfterEdit();
                return;
              }
              setPhase('rewards');
            }}
          >
            {t('live.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'rewards':
        return (
          <ActionChip variant="primary" className="w-full" onClick={() => {
              pushUser(t('live.setupChatRewardsOk'));
              if (editReturn) {
                finishAfterEdit();
                return;
              }
              setPhase('confirm');
            }}
          >
            {t('live.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'confirm':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            disabled={!canStart}
            onClick={() => void launchLive()}
          >
            {resolvedConfirmLabel}
          </ActionChip>
        );
      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-setup-chat-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[min(100%,19rem)] sm:max-w-[21rem] bg-[#12121a] border border-[#2d2d3d] rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-0 max-h-[min(88dvh,calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 shrink-0" />

        <div className="shrink-0 border-b border-[#1e1e2f] px-3 sm:px-4 pt-2.5 pb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p id="live-setup-chat-title" className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
              <span className="text-red-400" aria-hidden>●</span>
              {t('live.setupChatTitle')}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{t('live.setupChatSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/5 transition text-xl"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {exchangeMessages.length > 0 && (
            <div className="shrink-0 px-3 pt-2.5 pb-2 space-y-2 border-b border-[#1e1e2f]/50">
              {exchangeMessages.map((m) => (
                <ChatBubble key={m.id} message={m} compact />
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2 space-y-2">
          {phase === 'loading' && !stripeStatusReady && (
            <p className="text-[11px] text-gray-500 animate-pulse pt-1">
              {t('live.setupChatStripeChecking')}
            </p>
          )}
          {phase === 'return_ask' && (
            <div className="flex flex-wrap gap-2 pt-1">
              <ActionChip variant="primary" onClick={handleUseSaved}>
                {t('live.setupChatBtnUseSaved')}
              </ActionChip>
              <ActionChip
                onClick={() => {
                  pushUser(t('live.setupChatBtnModify'));
                  setPhase('return_pick');
                }}
              >
                {t('live.setupChatBtnModify')}
              </ActionChip>
            </div>
          )}

          {phase === 'return_pick' && (
            <div className="flex flex-wrap gap-2 pt-1">
              {(
                [
                  ...(!stripeReady && !donationsSimulation
                    ? ([['stripe', t('live.setupChatChipStripe')]] as const)
                    : []),
                  ['title', t('live.setupChatChipTitle')],
                  ['broadcast', t('live.setupChatChipBroadcast')],
                  ['devices', t('live.setupChatChipDevices')],
                  ['location', t('live.setupChatChipLocation')],
                  ...(donationsEnabled
                    ? ([
                        ['goals', t('live.setupChatChipGoals')],
                        ['rewards', t('live.setupChatChipRewards')],
                      ] as const)
                    : []),
                ] as const
              ).map(([target, label]) => (
                <ActionChip key={target} onClick={() => handlePickChange(target)}>
                  {label}
                </ActionChip>
              ))}
              <ActionChip
                variant="ghost"
                onClick={() => {
                  setPhase('return_ask');
                  pushBot(t('live.setupChatReturnHello', { summary: summarizeSetup(buildCurrentPrefs(), username) }));
                }}
              >
                {t('live.setupChatBtnBack')}
              </ActionChip>
            </div>
          )}

          {phase === 'stripe' && token && (
            <LiveStripeSetupChatPanel
              token={token}
              stripePending={stripePending}
              onSkip={handleStripeSkipInChat}
              onRefresh={onStripeRefresh}
            />
          )}

          {phase === 'title' && (
            <div className="pt-0.5">
              <input
                type="text"
                value={titleDraft}
                maxLength={120}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="w-full px-3 py-2.5 min-h-[44px] rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] text-sm text-white"
                placeholder={defaultLiveTitle}
              />
            </div>
          )}

          {phase === 'broadcast' && (
            <div className="flex flex-wrap gap-2 pt-1">
              <ActionChip
                onClick={() => {
                  setObsSetup({ useObs: false });
                  pushUser(t('live.setupChatModeCamera'));
                  persistDraft();
                  if (editReturn) {
                    finishAfterEdit();
                    return;
                  }
                  setPhase('devices');
                }}
              >
                {t('live.setupChatModeCamera')}
              </ActionChip>
              <ActionChip
                disabled={!obsAllowed || !cloudflareAvailable || obsCapsLoading}
                onClick={() => {
                  setObsSetup({ useObs: true });
                  pushUser(t('live.setupChatModeObs'));
                  persistDraft();
                  stopStream();
                  setPhase('obs_ingest');
                }}
              >
                {t('live.setupChatModeObs')}
              </ActionChip>
            </div>
          )}

          {phase === 'obs_ingest' && token && (
            <LiveObsIngestChatPanel token={token} />
          )}

          {phase === 'devices' && !obsSetup.useObs && (
            <div className="space-y-2 pt-0.5 rounded-xl border border-[#2d2d3d] p-2 bg-[#0b0b0f]/80">
              {mediaStatus === 'error' && (
                <p className="text-[11px] text-red-300">{mediaError}</p>
              )}
              <div className="relative aspect-[4/3] max-h-[4.75rem] rounded-lg overflow-hidden bg-black border border-[#2d2d3d]">
                {mediaStatus === 'loading' && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                    {t('live.setupMediaLoading')}
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)] ${
                    mediaStatus !== 'ready' ? 'opacity-0' : ''
                  }`}
                />
              </div>
              {cameras.length > 1 && (
                <select
                  value={videoDeviceId}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#12121a] border border-[#2d2d3d] text-xs text-white"
                  onChange={(e) => {
                    setVideoDeviceId(e.target.value);
                    void initMedia();
                  }}
                >
                  {cameras.map((c) => (
                    <option key={c.deviceId} value={c.deviceId}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
              {mics.length >= 1 && (
                <select
                  value={audioDeviceId}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#12121a] border border-[#2d2d3d] text-xs text-white"
                  onChange={(e) => {
                    setAudioDeviceId(e.target.value);
                    void initMedia();
                  }}
                >
                  {mics.map((m) => (
                    <option key={m.deviceId} value={m.deviceId}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
              <LiveMicTestPanel stream={previewStream} active={mediaStatus === 'ready'} compact />
              {hints.map((h) => (
                <p key={h} className="text-[10px] text-gray-500 leading-snug">
                  {h}
                </p>
              ))}
            </div>
          )}

          {phase === 'location' && (
            <div className="pt-0.5">
              <SessionLocationPicker
                value={liveLocation}
                onChange={(next) => {
                  setLiveLocation(next);
                  persistDraft();
                }}
                variant="live"
                profileCity={profileCity}
                anchorLatitude={initialGeo?.latitude}
                anchorLongitude={initialGeo?.longitude}
                token={token}
              />
            </div>
          )}

          {phase === 'goals' && (
            <div className="pt-0.5 rounded-xl border border-[#2d2d3d] p-2">
              <LiveDonationsSetupFields
                section="goals"
                compact
                value={hostSession}
                onChange={(next) => {
                  setHostSession(next);
                  persistDraft();
                }}
                donationsEnabled={donationsEnabled}
                donationsSimulation={donationsSimulation}
              />
            </div>
          )}

          {phase === 'rewards' && (
            <div className="pt-0.5 rounded-xl border border-[#2d2d3d] p-2">
              <LiveDonationsSetupFields
                section="rewards"
                compact
                value={hostSession}
                onChange={(next) => {
                  setHostSession(next);
                  persistDraft();
                }}
                donationsEnabled={donationsEnabled}
                donationsSimulation={donationsSimulation}
              />
            </div>
          )}
          </div>

          {showStepFooter && (
            <div className="shrink-0 px-3 py-2 border-t border-[#1e1e2f]/60 bg-[#12121a]">
              {renderStepPrimaryAction()}
            </div>
          )}
        </div>

        <div className="shrink-0 px-3 py-2 border-t border-[#1e1e2f] bg-[#0b0b0f]/50 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {canBypassLiveMediaSetup() && (
            <button
              type="button"
              className="w-full mb-2 min-h-[44px] text-xs text-amber-400/80 border border-amber-500/30 rounded-xl"
              onClick={() => void launchLive()}
            >
              {t('live.setupDemoMode')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-300"
          >
            {t('live.setupChatBtnCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
