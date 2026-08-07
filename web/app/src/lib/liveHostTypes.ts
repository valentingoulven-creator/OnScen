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
  /** Valeur affichée fixée par l'hôte (prioritaire sur le calcul auto). */
  manualCurrent?: number;
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

export const DEFAULT_LIVE_TRIGGERS: TriggerRule[] = [
  { id: 't1', minAmount: 1,  actions: ['hearts_animation'],                  enabled: true },
  { id: 't2', minAmount: 5,  actions: ['voice_thanks'],                      enabled: true },
  { id: 't3', minAmount: 10, actions: ['fullscreen_donor', 'confetti'],      enabled: true },
  { id: 't4', minAmount: 20, actions: ['confetti', 'chat_pin'],              enabled: true },
  { id: 't5', minAmount: 50, actions: ['custom_alert', 'chat_pin'],          enabled: true },
];

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

export const DEFAULT_LIVE_REWARDS: LiveReward[] = [
  { id: 'r1', type: 'music_request', label: 'Demande de musique', price: 10, enabled: true },
  { id: 'r2', type: 'dedication', label: 'Dédicace', price: 5, enabled: true },
  { id: 'r3', type: 'dance', label: 'Danse spécifique', price: 15, enabled: true },
  {
    id: 'r4',
    type: 'backstage',
    label: 'Accès backstage',
    price: 20,
    enabled: true,
    limitPerLive: 3,
    remainingCount: 3,
  },
];

export interface LiveStats {
  viewers: number;
  newSubscribers: number;
  totalDonations: number;
  donationCount: number;
  startedAt: number;
  topDonors: { name: string; amount: number }[];
}
