import type { LiveMediaPrefs } from '../lib/liveMediaPrefs';
import type { LivesGeoPrefs } from '../lib/livesGeo';
import type { LiveChatConfigValue } from '../components/LiveChatConfigFields';
import type { LiveHostSessionDraft } from '../lib/liveMediaPrefs';
import type { LiveObsSetupValue } from '../components/LiveObsSetupFields';

export type SetupChatPhase =
  | 'loading'
  | 'return_ask'
  | 'return_pick'
  | 'stripe'
  | 'title'
  | 'broadcast'
  | 'obs_ingest'
  | 'devices'
  | 'location'
  | 'goals'
  | 'rewards'
  | 'confirm';

export type SetupChangeTarget =
  | 'stripe'
  | 'title'
  | 'broadcast'
  | 'devices'
  | 'location'
  | 'goals'
  | 'rewards';

export type SetupChatMessage = {
  id: string;
  role: 'bot' | 'user';
  text: string;
};

/** Clé i18n (live.*) posée par l'assistant à l'entrée de chaque phase interactive. */
export const SETUP_PHASE_BOT_QUESTION: Partial<Record<SetupChatPhase, string>> = {
  stripe: 'setupChatAskStripe',
  title: 'setupChatAskTitle',
  broadcast: 'setupChatAskBroadcast',
  obs_ingest: 'setupChatAskObsIngest',
  devices: 'setupChatAskDevices',
  location: 'setupChatAskLocation',
  goals: 'setupChatAskGoals',
  rewards: 'setupChatAskRewards',
  confirm: 'setupChatConfirm',
  return_pick: 'setupChatPickChange',
};

let msgSeq = 0;
export function nextChatMessageId(): string {
  msgSeq += 1;
  return `setup-msg-${msgSeq}`;
}

/** Sépare l'historique scrollable de l'échange actif (réponse précédente + question courante). */
export function splitSetupChatMessages(messages: SetupChatMessage[]): {
  historyMessages: SetupChatMessage[];
  activeMessages: SetupChatMessage[];
} {
  const lastBotIndex = messages.findLastIndex((m) => m.role === 'bot');
  if (lastBotIndex < 0) {
    return { historyMessages: [], activeMessages: messages };
  }

  const currentQuestion = messages[lastBotIndex];
  const priorMessages = messages.slice(0, lastBotIndex);
  const previousUserAnswer = [...priorMessages].reverse().find((m) => m.role === 'user');

  if (!previousUserAnswer) {
    return {
      historyMessages: priorMessages,
      activeMessages: [currentQuestion],
    };
  }

  const answerIndex = priorMessages.findIndex((m) => m.id === previousUserAnswer.id);
  return {
    historyMessages: priorMessages.slice(0, answerIndex),
    activeMessages: [previousUserAnswer, currentQuestion],
  };
}

/** Messages affichés : échange en cours (+ intro Lya à la 1re étape). */
export function getVisibleSetupExchange(
  messages: SetupChatMessage[],
  phase: SetupChatPhase
): SetupChatMessage[] {
  const { historyMessages, activeMessages } = splitSetupChatMessages(messages);
  if (activeMessages.length === 0) {
    return messages.slice(-2);
  }
  if ((phase === 'title' || phase === 'stripe') && historyMessages.length > 0) {
    const activeIds = new Set(activeMessages.map((m) => m.id));
    const hello = historyMessages.find((m) => m.role === 'bot');
    const intro = hello && !activeIds.has(hello.id) ? [hello] : [];
    return [...intro, ...activeMessages];
  }
  return activeMessages;
}

export function prefsFromParts(
  parts: {
    videoDeviceId: string;
    audioDeviceId: string;
    liveTitle: string;
    liveLocation: LivesGeoPrefs;
    chatConfig: LiveChatConfigValue;
    hostSession: LiveHostSessionDraft;
    obsSetup: LiveObsSetupValue;
  },
  extra?: Partial<LiveMediaPrefs>
): LiveMediaPrefs {
  return {
    videoDeviceId: parts.videoDeviceId || undefined,
    audioDeviceId: parts.audioDeviceId || undefined,
    liveTitle: parts.liveTitle.trim() || undefined,
    startLatitude: parts.liveLocation.latitude,
    startLongitude: parts.liveLocation.longitude,
    startLocationLabel: parts.liveLocation.label,
    startLocationSource: parts.liveLocation.source,
    chatConfig: parts.chatConfig,
    hostSessionDraft: parts.hostSession,
    useObs: parts.obsSetup.useObs || undefined,
    ...extra,
  };
}

export function summarizeSetup(prefs: LiveMediaPrefs, username: string): string {
  const title = prefs.liveTitle?.trim() || `Live — ${username}`;
  const mode = prefs.useObs ? 'OBS (Cloudflare)' : 'Caméra navigateur';
  const place = prefs.startLocationLabel?.trim() || 'Position carte';
  const slow = prefs.chatConfig?.slowModeSeconds ?? 0;
  const chat =
    prefs.chatConfig?.subscribersOnly === true
      ? 'abonnés uniquement'
      : slow > 0
        ? `slow mode ${slow}s`
        : prefs.chatConfig?.noLinksForParticipants
          ? 'sans liens'
          : 'standard';
  return `« ${title} », ${mode}, ${place}, chat ${chat}.`;
}

export const STANDARD_CHAT_CONFIG: LiveChatConfigValue = {
  noLinksForParticipants: true,
  slowModeSeconds: 0,
  subscribersOnly: false,
};

export const CHAT_MOD_PRESETS: Array<{
  id: string;
  label: string;
  config: LiveChatConfigValue;
}> = [
  {
    id: 'open',
    label: 'Ouvert',
    config: { noLinksForParticipants: false, slowModeSeconds: 0, subscribersOnly: false },
  },
  {
    id: 'standard',
    label: 'Standard',
    config: { noLinksForParticipants: true, slowModeSeconds: 0, subscribersOnly: false },
  },
  {
    id: 'slow',
    label: 'Modéré (5 s)',
    config: { noLinksForParticipants: true, slowModeSeconds: 5, subscribersOnly: false },
  },
  {
    id: 'subs',
    label: 'Abonnés only',
    config: { noLinksForParticipants: true, slowModeSeconds: 0, subscribersOnly: true },
  },
];

export function applySavedSetupToDraft(
  saved: LiveMediaPrefs | null,
  defaults: {
    defaultLiveTitle: string;
    initialGeo: LivesGeoPrefs;
    hostSession: LiveHostSessionDraft;
  }
): {
  liveTitle: string;
  liveLocation: LivesGeoPrefs;
  chatConfig: LiveChatConfigValue;
  hostSession: LiveHostSessionDraft;
  obsSetup: LiveObsSetupValue;
  videoDeviceId: string;
  audioDeviceId: string;
} {
  const lat = saved?.startLatitude;
  const lon = saved?.startLongitude;
  const liveLocation: LivesGeoPrefs =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? {
          ...defaults.initialGeo,
          latitude: lat!,
          longitude: lon!,
          label: saved?.startLocationLabel ?? defaults.initialGeo.label,
          source:
            saved?.startLocationSource === 'city'
              ? 'city'
              : saved?.startLocationSource === 'address'
                ? 'address'
                : saved?.startLocationSource === 'my_position'
                  ? 'my_position'
                  : defaults.initialGeo.source,
        }
      : { ...defaults.initialGeo };

  return {
    liveTitle: saved?.liveTitle?.trim() || defaults.defaultLiveTitle,
    liveLocation,
    chatConfig: {
      noLinksForParticipants:
        saved?.chatConfig?.noLinksForParticipants ?? STANDARD_CHAT_CONFIG.noLinksForParticipants,
      slowModeSeconds: saved?.chatConfig?.slowModeSeconds ?? STANDARD_CHAT_CONFIG.slowModeSeconds,
      subscribersOnly: saved?.chatConfig?.subscribersOnly ?? STANDARD_CHAT_CONFIG.subscribersOnly,
    },
    hostSession:
      saved?.hostSessionDraft?.rewards?.length
        ? {
            goals: saved.hostSessionDraft.goals ?? [],
            rewards: saved.hostSessionDraft.rewards.map((r) => ({ ...r })),
          }
        : defaults.hostSession,
    obsSetup: { useObs: saved?.useObs === true },
    videoDeviceId: saved?.videoDeviceId ?? '',
    audioDeviceId: saved?.audioDeviceId ?? '',
  };
}
