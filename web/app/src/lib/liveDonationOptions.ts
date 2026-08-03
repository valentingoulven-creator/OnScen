import type { LiveDonationOption, LivePublicGoal } from '../types';
import { DEFAULT_LIVE_REWARDS } from './liveHostTypes';
import type { LiveGoal, LiveReward } from './liveHostTypes';
import { getSocket } from './socket';
import { normalizeGoalOverlay, type LiveDonationGoalOverlay } from './liveGoalOverlay';

export function rewardsToDonationOptions(rewards: LiveReward[]): LiveDonationOption[] {
  return rewards
    .filter((r) => r.enabled && Number.isFinite(r.price))
    .map((r) => ({
      id: r.id,
      label: r.label.trim(),
      amount: Math.round(r.price),
      rewardType: r.type,
    }))
    .filter((o) => o.label.length > 0 && o.amount >= 1 && o.amount <= 100);
}

export function goalsToPublicGoals(goals: LiveGoal[]): LivePublicGoal[] {
  return goals
    .filter((g) => g.label.trim() && g.target > 0 && !g.completedAt)
    .map(({ id, type, target, label, manualCurrent }) => ({
      id,
      type,
      target: Math.round(target),
      label: label.trim(),
      ...(manualCurrent != null && Number.isFinite(manualCurrent)
        ? { displayCurrent: Math.min(Math.round(target), Math.max(0, Math.round(manualCurrent))) }
        : {}),
    }));
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

/** Publie le menu dons / récompenses au live (spectateurs). */
export function syncLiveDonationOptions(liveId: string, rewards: LiveReward[]): void {
  const socket = getSocket();
  if (!socket) return;
  const options = rewardsToDonationOptions(rewards);
  socket.emit('live_update_donation_options', { liveId, options });
}

/** Publie les goals actifs au live (spectateurs). */
export function syncLiveDonationGoals(liveId: string, goals: LiveGoal[]): void {
  const socket = getSocket();
  if (!socket) return;
  const publicGoals = goalsToPublicGoals(goals);
  socket.emit('live_update_donation_goals', { liveId, goals: publicGoals });
}

/** Publie position et visibilité de la barre objectif sur le live. */
export function syncLiveDonationGoalOverlay(liveId: string, overlay: LiveDonationGoalOverlay): void {
  const socket = getSocket();
  if (!socket) return;
  socket.emit('live_update_donation_goal_overlay', {
    liveId,
    overlay: normalizeGoalOverlay(overlay),
  });
}
