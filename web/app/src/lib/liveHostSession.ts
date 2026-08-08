import type { LiveGoal, LiveReward, RewardQueueItem, TriggerRule } from './liveHostTypes';
import { DEFAULT_LIVE_REWARDS, DEFAULT_LIVE_TRIGGERS } from './liveHostTypes';
import { syncLiveDonationOptions } from './liveDonationOptions';
import {
  DEFAULT_LIVE_GOAL_OVERLAY,
  normalizeGoalOverlay,
  type LiveDonationGoalOverlay,
} from './liveGoalOverlay';

export { DEFAULT_LIVE_REWARDS } from './liveHostTypes';

export interface LiveHostSession {
  goals: LiveGoal[];
  rewards: LiveReward[];
  rewardQueue: RewardQueueItem[];
  goalOverlay: LiveDonationGoalOverlay;
  /** Règles de déclenchement automatique sur dons (onglet Don → Auto). */
  triggers: TriggerRule[];
}

const DEFAULT_SESSION: LiveHostSession = {
  goals: [],
  rewards: DEFAULT_LIVE_REWARDS,
  rewardQueue: [],
  goalOverlay: { ...DEFAULT_LIVE_GOAL_OVERLAY },
  triggers: DEFAULT_LIVE_TRIGGERS,
};

function sessionKey(liveId: string): string {
  return `onscen:live-host:${liveId}`;
}

function sessionEventName(liveId: string): string {
  return `onscen-live-host-session:${liveId}`;
}

function readRaw(liveId: string): LiveHostSession {
  if (typeof sessionStorage === 'undefined') return { ...DEFAULT_SESSION };
  try {
    const raw = sessionStorage.getItem(sessionKey(liveId));
    if (!raw) return { ...DEFAULT_SESSION, rewards: [...DEFAULT_LIVE_REWARDS], triggers: [...DEFAULT_LIVE_TRIGGERS] };
    const parsed = JSON.parse(raw) as Partial<LiveHostSession>;
    return {
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      rewards:
        Array.isArray(parsed.rewards) && parsed.rewards.length > 0
          ? parsed.rewards
          : [...DEFAULT_LIVE_REWARDS],
      rewardQueue: Array.isArray(parsed.rewardQueue) ? parsed.rewardQueue : [],
      goalOverlay: normalizeGoalOverlay(parsed.goalOverlay as LiveDonationGoalOverlay | undefined),
      triggers:
        Array.isArray(parsed.triggers) && parsed.triggers.length > 0
          ? parsed.triggers
          : [...DEFAULT_LIVE_TRIGGERS],
    };
  } catch {
    return { ...DEFAULT_SESSION, rewards: [...DEFAULT_LIVE_REWARDS], triggers: [...DEFAULT_LIVE_TRIGGERS] };
  }
}

export function getLiveHostSession(liveId: string): LiveHostSession {
  return readRaw(liveId);
}

export function setLiveHostSession(liveId: string, session: LiveHostSession): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(sessionKey(liveId), JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(sessionEventName(liveId)));
  }
}

export function patchLiveHostSession(
  liveId: string,
  patch: Partial<LiveHostSession> | ((prev: LiveHostSession) => Partial<LiveHostSession>),
): LiveHostSession {
  const prev = readRaw(liveId);
  const delta = typeof patch === 'function' ? patch(prev) : patch;
  const next: LiveHostSession = {
    goals: delta.goals ?? prev.goals,
    rewards: delta.rewards ?? prev.rewards,
    rewardQueue: delta.rewardQueue ?? prev.rewardQueue,
    goalOverlay: delta.goalOverlay ?? prev.goalOverlay,
    triggers: delta.triggers ?? prev.triggers,
  };
  setLiveHostSession(liveId, next);
  if (delta.rewards) {
    syncLiveDonationOptions(liveId, next.rewards);
  }
  return next;
}

export function subscribeLiveHostSession(liveId: string, listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const name = sessionEventName(liveId);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}

export function matchGiftToReward(rewards: LiveReward[], amount: number): LiveReward | undefined {
  const matches = rewards.filter((r) => r.enabled && r.price <= amount);
  if (matches.length === 0) return undefined;
  return matches.sort((a, b) => b.price - a.price)[0];
}

export interface GiftForRewardQueue {
  liveId: string;
  senderName: string;
  senderId?: string;
  amount?: number;
  note?: string;
}

export function enqueueRewardFromGift(liveId: string, gift: GiftForRewardQueue): void {
  if (!gift.amount || gift.amount <= 0) return;
  patchLiveHostSession(liveId, (prev) => {
    const matching = matchGiftToReward(prev.rewards, gift.amount!);
    if (!matching) return prev;
    const item: RewardQueueItem = {
      id: `rq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      rewardId: matching.id,
      rewardLabel: matching.label,
      donorId: gift.senderId ?? 'unknown',
      donorName: gift.senderName,
      amount: gift.amount!,
      note: gift.note,
      requestedAt: Date.now(),
      status: 'pending',
    };
    return { rewardQueue: [item, ...prev.rewardQueue] };
  });
}
