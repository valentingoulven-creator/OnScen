/** Types pour le système Goals / Triggers / Rewards du host live */

export type GoalType = 'amount' | 'dons' | 'likes' | 'viewers' | 'duration';

export interface LiveGoal {
  id: string;
  type: GoalType;
  target: number;       // € pour amount, nb pour les autres, minutes pour duration
  current: number;
  label: string;        // ex: "Performance exclusive"
  liveId: string;
  createdAt: number;
  completedAt?: number;
}

export type TriggerAction =
  | 'hearts_animation'
  | 'voice_thanks'
  | 'fullscreen_donor'
  | 'confetti'
  | 'chat_pin'
  | 'custom_alert';

export interface TriggerRule {
  id: string;
  minAmount: number;    // seuil de don en €
  actions: TriggerAction[];
  enabled: boolean;
  label?: string;       // message vocal custom si action = voice_thanks
}

export type RewardType = 'music_request' | 'dedication' | 'dance' | 'backstage' | 'badge' | 'custom';

export interface LiveReward {
  id: string;
  type: RewardType;
  label: string;
  price: number;        // €
  enabled: boolean;
  limitPerLive?: number;
  remainingCount?: number;
}

export interface RewardQueueItem {
  id: string;
  rewardId: string;
  rewardLabel: string;
  donorId: string;
  donorName: string;
  amount: number;
  note?: string;        // ex: titre de la chanson demandée
  requestedAt: number;
  status: 'pending' | 'accepted' | 'refused' | 'done';
}

export interface LiveStats {
  viewers: number;
  newSubscribers: number;
  totalDonations: number;
  donationCount: number;
  startedAt: number;
  topDonors: { name: string; amount: number }[];
}
