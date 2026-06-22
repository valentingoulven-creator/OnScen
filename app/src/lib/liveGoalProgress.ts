import type { LiveGoal } from './liveHostTypes';

export interface GoalProgressStats {
  totalDonations: number;
  donationCount: number;
  viewers: number;
  startedAt: number;
  /** Timestamp courant pour goals de type duration (ms). */
  now?: number;
}

export function getGoalCurrent(goal: LiveGoal, stats: GoalProgressStats): number {
  const now = stats.now ?? Date.now();
  switch (goal.type) {
    case 'amount':
      return stats.totalDonations;
    case 'dons':
      return stats.donationCount;
    case 'viewers':
      return stats.viewers;
    case 'duration':
      return Math.max(0, Math.floor((now - stats.startedAt) / 60_000));
    case 'likes':
      return goal.current;
  }
}

export function withGoalProgress(goal: LiveGoal, stats: GoalProgressStats): LiveGoal {
  const current = getGoalCurrent(goal, stats);
  const completedAt =
    !goal.completedAt && current >= goal.target ? Date.now() : goal.completedAt;
  return { ...goal, current, completedAt };
}

export function withGoalsProgress(goals: LiveGoal[], stats: GoalProgressStats): LiveGoal[] {
  return goals.map((g) => withGoalProgress(g, stats));
}

export function firstActiveGoal(
  goals: LiveGoal[],
  stats: GoalProgressStats,
  liveId?: string,
): LiveGoal | null {
  const withProgress = withGoalsProgress(goals, stats);
  return withProgress.find((g) => !g.completedAt && (!liveId || g.liveId === liveId)) ?? null;
}
