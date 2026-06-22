import type { LiveDonationOption } from '../types';
import { DEFAULT_LIVE_REWARDS } from './liveHostTypes';
import type { LiveReward } from './liveHostTypes';
import { getSocket } from './socket';

export function rewardsToDonationOptions(rewards: LiveReward[]): LiveDonationOption[] {
  return rewards
    .filter((r) => r.enabled && Number.isFinite(r.price))
    .map((r) => ({
      id: r.id,
      label: r.label.trim(),
      amount: Math.round(r.price),
    }))
    .filter((o) => o.label.length > 0 && o.amount >= 1 && o.amount <= 100);
}

/** True si le catalogue hôte diffère des récompenses par défaut (personnalisation). */
export function rewardsMenuIsCustomized(rewards: LiveReward[]): boolean {
  if (rewards.length !== DEFAULT_LIVE_REWARDS.length) return true;
  return rewards.some((r, i) => {
    const d = DEFAULT_LIVE_REWARDS[i];
    if (!d) return true;
    return (
      r.type !== d.type ||
      r.label !== d.label ||
      r.price !== d.price ||
      r.enabled !== d.enabled ||
      (r.limitPerLive ?? 0) !== (d.limitPerLive ?? 0)
    );
  });
}

/** Publie le menu dons au live (spectateurs) ou le retire si catalogue par défaut / vide. */
export function syncLiveDonationOptions(liveId: string, rewards: LiveReward[]): void {
  const socket = getSocket();
  if (!socket) return;
  if (!rewardsMenuIsCustomized(rewards)) {
    socket.emit('live_update_donation_options', { liveId, options: [] });
    return;
  }
  const options = rewardsToDonationOptions(rewards);
  socket.emit('live_update_donation_options', { liveId, options });
}
