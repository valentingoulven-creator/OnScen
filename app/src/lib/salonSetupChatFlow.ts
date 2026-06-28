import type { SetupChatMessage } from './liveSetupChatFlow';

export type SalonSetupChatPhase =
  | 'youtube'
  | 'title'
  | 'access'
  | 'invite'
  | 'location'
  | 'genres'
  | 'queue'
  | 'playlist'
  | 'confirm';

/** Clé i18n (salon.create.*) posée par Lya à l'entrée de chaque phase interactive. */
export const SALON_SETUP_PHASE_BOT_QUESTION: Partial<Record<SalonSetupChatPhase, string>> = {
  youtube: 'setupChatAskYoutube',
  title: 'setupChatAskTitle',
  access: 'setupChatAskAccess',
  invite: 'setupChatAskInvite',
  location: 'setupChatAskLocation',
  genres: 'setupChatAskGenres',
  queue: 'setupChatAskQueue',
  playlist: 'setupChatAskPlaylist',
  confirm: 'setupChatConfirm',
};

let msgSeq = 0;
export function nextSalonChatMessageId(): string {
  msgSeq += 1;
  return `salon-setup-msg-${msgSeq}`;
}

function splitSalonSetupChatMessages(messages: SetupChatMessage[]): {
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
export function getVisibleSalonSetupExchange(
  messages: SetupChatMessage[],
  phase: SalonSetupChatPhase
): SetupChatMessage[] {
  const { historyMessages, activeMessages } = splitSalonSetupChatMessages(messages);
  if (activeMessages.length === 0) {
    return messages.slice(-2);
  }
  if ((phase === 'title' || phase === 'youtube') && historyMessages.length > 0) {
    const activeIds = new Set(activeMessages.map((m) => m.id));
    const hello = historyMessages.find((m) => m.role === 'bot');
    const intro = hello && !activeIds.has(hello.id) ? [hello] : [];
    return [...intro, ...activeMessages];
  }
  return activeMessages;
}

export function summarizeSalonSetup(
  parts: {
    title: string;
    accessMode: 'public' | 'invite';
    locationLabel?: string;
    genres: string[];
    allowQueue: boolean;
    playlistTitle?: string | null;
  },
  labels: {
    public: string;
    invite: string;
    allGenres: string;
    queueOn: string;
    queueOff: string;
    noPlaylist: string;
  }
): string {
  const title = parts.title.trim() || 'Salon';
  const access = parts.accessMode === 'invite' ? labels.invite : labels.public;
  const place =
    parts.accessMode === 'public' && parts.locationLabel?.trim()
      ? parts.locationLabel.trim()
      : parts.accessMode === 'public'
        ? labels.public
        : '';
  const genres =
    parts.genres.length > 0 ? parts.genres.slice(0, 3).join(', ') : labels.allGenres;
  const queue = parts.allowQueue ? labels.queueOn : labels.queueOff;
  const playlist = parts.playlistTitle?.trim()
    ? ` · ${parts.playlistTitle.trim()}`
    : ` · ${labels.noPlaylist}`;
  const placePart = place ? `, ${place}` : '';
  return `« ${title} », ${access}${placePart}, ${genres}, ${queue}${playlist}.`;
}

export function nextPhaseAfterTitle(
  accessMode: 'public' | 'invite',
  skipAccessSection: boolean
): SalonSetupChatPhase {
  if (skipAccessSection && accessMode === 'invite') return 'invite';
  if (!skipAccessSection) return 'access';
  return accessMode === 'public' ? 'location' : 'invite';
}
