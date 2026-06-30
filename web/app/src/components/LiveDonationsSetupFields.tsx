import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_LIVE_REWARDS,
  type GoalType,
  type RewardType,
} from '../lib/liveHostTypes';
import type { LiveHostSessionDraft } from '../lib/liveMediaPrefs';

export type { LiveHostSessionDraft };

function goalTypeLabel(t: GoalType): string {
  switch (t) {
    case 'amount':
      return 'Montant (€)';
    case 'dons':
      return 'Nombre de dons';
    case 'likes':
      return 'Likes';
    case 'viewers':
      return 'Spectateurs';
    case 'duration':
      return 'Durée (min)';
  }
}

function goalUnit(t: GoalType): string {
  switch (t) {
    case 'amount':
      return '€';
    case 'dons':
      return 'dons';
    case 'likes':
      return 'likes';
    case 'viewers':
      return 'spec.';
    case 'duration':
      return 'min';
  }
}

function rewardTypeLabel(r: RewardType): string {
  switch (r) {
    case 'music_request':
      return 'Demande de musique';
    case 'dedication':
      return 'Dédicace';
    case 'dance':
      return 'Danse spécifique';
    case 'backstage':
      return 'Accès backstage';
    case 'badge':
      return 'Badge fan';
    case 'custom':
      return 'Récompense perso';
  }
}

export function defaultHostSessionDraft(): LiveHostSessionDraft {
  return {
    goals: [],
    rewards: DEFAULT_LIVE_REWARDS.map((r) => ({ ...r })),
  };
}

export function hostSessionDraftFromPrefs(
  draft: { hostSessionDraft?: LiveHostSessionDraft } | null | undefined
): LiveHostSessionDraft {
  if (draft?.hostSessionDraft?.rewards?.length) {
    return {
      goals: draft.hostSessionDraft.goals ?? [],
      rewards: draft.hostSessionDraft.rewards.map((r) => ({ ...r })),
    };
  }
  return defaultHostSessionDraft();
}

const GOAL_TYPES: GoalType[] = ['amount', 'dons', 'likes', 'viewers', 'duration'];
const REWARD_TYPES: RewardType[] = [
  'music_request',
  'dedication',
  'dance',
  'backstage',
  'badge',
  'custom',
];

type LiveDonationsSetupFieldsProps = {
  value: LiveHostSessionDraft;
  onChange: (next: LiveHostSessionDraft) => void;
  donationsEnabled?: boolean;
  donationsSimulation?: boolean;
  section?: 'goals' | 'rewards' | 'all';
  compact?: boolean;
};

export function LiveDonationsSetupFields({
  value,
  onChange,
  donationsEnabled = false,
  donationsSimulation = false,
  section = 'all',
  compact = false,
}: LiveDonationsSetupFieldsProps) {
  const { t } = useTranslation();
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [creatingReward, setCreatingReward] = useState(false);
  const [goalForm, setGoalForm] = useState<{ type: GoalType; target: string; label: string }>({
    type: 'amount',
    target: '100',
    label: '',
  });
  const [rewardForm, setRewardForm] = useState<{ type: RewardType; label: string; price: string }>({
    type: 'custom',
    label: '',
    price: '10',
  });

  const addGoal = () => {
    const target = parseFloat(goalForm.target);
    if (!goalForm.label.trim() || Number.isNaN(target) || target <= 0) return;
    onChange({
      ...value,
      goals: [
        ...value.goals,
        {
          id: `g_${Date.now()}`,
          type: goalForm.type,
          target,
          label: goalForm.label.trim(),
        },
      ],
    });
    setGoalForm({ type: 'amount', target: '100', label: '' });
    setCreatingGoal(false);
  };

  const removeGoal = (id: string) => {
    onChange({ ...value, goals: value.goals.filter((g) => g.id !== id) });
  };

  const toggleReward = (id: string) => {
    onChange({
      ...value,
      rewards: value.rewards.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    });
  };

  const addReward = () => {
    const price = parseFloat(rewardForm.price);
    if (!rewardForm.label.trim() || Number.isNaN(price) || price <= 0) return;
    onChange({
      ...value,
      rewards: [
        ...value.rewards,
        {
          id: `r_${Date.now()}`,
          type: rewardForm.type,
          label: rewardForm.label.trim(),
          price,
          enabled: true,
        },
      ],
    });
    setRewardForm({ type: 'custom', label: '', price: '10' });
    setCreatingReward(false);
  };

  const statusHint = donationsSimulation
    ? t('live.setupDonationsSimulation')
    : donationsEnabled
      ? t('live.setupDonationsEnabled')
      : t('live.setupDonationsDisabled');

  const showGoals = section === 'all' || section === 'goals';
  const showRewards = section === 'all' || section === 'rewards';
  const showStatusHint = (section === 'all' || section === 'goals') && !(compact && creatingGoal);
  const gapClass = compact ? 'gap-2' : 'gap-4';
  const sectionGap = compact ? 'space-y-1' : 'space-y-2';
  const cardPad = compact ? 'p-2' : 'p-3';
  const formShellClass = compact
    ? 'rounded-lg border border-purple-500/30 bg-purple-950/20 p-2 flex flex-col gap-1.5'
    : 'rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 flex flex-col gap-3';
  const formTitleClass = compact
    ? 'text-[10px] font-bold text-purple-300'
    : 'text-xs font-bold text-purple-300';
  const fieldInputClass = compact
    ? 'w-full px-2 py-1 rounded-md bg-[#1a1a26] border border-[#232330] text-white text-[11px] focus:border-purple-500/50 outline-none'
    : 'w-full px-2.5 py-1.5 rounded-lg bg-[#1a1a26] border border-[#232330] text-white text-xs focus:border-purple-500/50 outline-none';
  const formBtnClass = compact
    ? 'flex-1 min-h-[36px] py-1 rounded-md text-[10px] font-bold transition'
    : 'flex-1 min-h-[44px] py-2 rounded-lg text-xs font-bold transition';

  return (
    <div className={`flex flex-col ${gapClass}`}>
      {showStatusHint && (
        <div className={`rounded-xl border border-[#1e1e2f] bg-[#12121a] ${cardPad}`}>
          <p className={`text-gray-400 leading-snug ${compact ? 'text-[10px]' : 'text-xs'}`}>{statusHint}</p>
        </div>
      )}

      {showGoals && (
      <div className={sectionGap}>
        {!(compact && creatingGoal) && (
          <p className={`font-bold text-red-400 uppercase tracking-widest ${compact ? 'text-[9px] mb-0.5' : 'text-[10px] mb-2'}`}>
            {t('live.setupGoalsSection')}
          </p>
        )}
        {value.goals.length === 0 && !creatingGoal && (
          <p className={`text-gray-500 ${compact ? 'text-[10px] leading-snug' : 'text-xs'}`}>
            {t('live.setupGoalsEmpty')}
          </p>
        )}
        {value.goals.map((goal) => (
          <div
            key={goal.id}
            className={`flex items-start gap-2 rounded-xl border border-[#1e1e2f] bg-[#12121a] ${compact ? 'p-2' : 'p-3'}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{goal.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {goalTypeLabel(goal.type)} · {goal.target} {goalUnit(goal.type)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeGoal(goal.id)}
              className="shrink-0 w-8 h-8 rounded-lg bg-[#1a1a26] border border-[#232330] text-gray-500 text-sm hover:text-red-400 transition"
              aria-label={t('live.setupRemoveGoal')}
            >
              ×
            </button>
          </div>
        ))}

        {creatingGoal && (
          <div className={formShellClass}>
            <p className={formTitleClass}>{t('live.setupNewGoal')}</p>
            {compact ? (
              <>
                <select
                  value={goalForm.type}
                  onChange={(e) => setGoalForm((f) => ({ ...f, type: e.target.value as GoalType }))}
                  className={fieldInputClass}
                >
                  {GOAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {goalTypeLabel(type)}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-[minmax(4.75rem,5.25rem)_minmax(0,1fr)] gap-1.5 items-center">
                  <div className="flex items-center gap-0.5 min-w-0">
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={goalForm.target}
                      onChange={(e) => setGoalForm((f) => ({ ...f, target: e.target.value }))}
                      className="w-full min-w-[4.25rem] px-1 py-1 rounded-md bg-[#1a1a26] border border-[#232330] text-white text-[11px] tabular-nums text-center focus:border-purple-500/50 outline-none"
                      aria-label={t('live.setupGoalTarget')}
                    />
                    <span className="text-[9px] text-gray-500 shrink-0">{goalUnit(goalForm.type)}</span>
                  </div>
                  <input
                    type="text"
                    value={goalForm.label}
                    maxLength={60}
                    onChange={(e) => setGoalForm((f) => ({ ...f, label: e.target.value }))}
                    className={fieldInputClass}
                    placeholder={t('live.setupGoalLabelPlaceholder')}
                    aria-label={t('live.setupGoalLabel')}
                  />
                </div>
              </>
            ) : (
              <>
            <div className="flex flex-wrap gap-1">
              {GOAL_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setGoalForm((f) => ({ ...f, type }))}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition ${
                    goalForm.type === type
                      ? 'border-purple-500/50 bg-purple-900/40 text-purple-200'
                      : 'border-[#232330] text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {goalTypeLabel(type)}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <p className="text-[10px] text-gray-400 mb-1">{t('live.setupGoalTarget')}</p>
                <input
                  type="number"
                  min="1"
                  value={goalForm.target}
                  onChange={(e) => setGoalForm((f) => ({ ...f, target: e.target.value }))}
                  className={fieldInputClass}
                />
              </div>
              <span className="text-xs text-gray-500 pb-1.5">{goalUnit(goalForm.type)}</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-1">{t('live.setupGoalLabel')}</p>
              <input
                type="text"
                value={goalForm.label}
                maxLength={60}
                onChange={(e) => setGoalForm((f) => ({ ...f, label: e.target.value }))}
                className={fieldInputClass}
                placeholder={t('live.setupGoalLabelPlaceholder')}
              />
            </div>
              </>
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={addGoal}
                className={`${formBtnClass} bg-purple-600 hover:bg-purple-500 text-white`}
              >
                {t('live.setupCreateGoal')}
              </button>
              <button
                type="button"
                onClick={() => setCreatingGoal(false)}
                className={`${formBtnClass} bg-[#1a1a26] border border-[#232330] text-gray-400`}
              >
                {t('live.setupCancel')}
              </button>
            </div>
          </div>
        )}

        {!creatingGoal && (
          <button
            type="button"
            onClick={() => setCreatingGoal(true)}
            className="w-full min-h-[44px] py-2.5 rounded-xl border border-dashed border-[#2a2a3a] text-gray-500 text-xs hover:border-purple-500/40 hover:text-purple-300 transition"
          >
            {t('live.setupAddGoal')}
          </button>
        )}
      </div>
      )}

      {showRewards && (
      <div className={sectionGap}>
        <p className={`font-bold text-gray-400 uppercase tracking-widest ${compact ? 'text-[9px] mb-0.5' : 'text-[10px] mb-2'}`}>
          {t('live.setupRewardsSection')}
        </p>
        {!compact && (
        <p className="text-[11px] text-gray-500 leading-relaxed">{t('live.setupRewardsHint')}</p>
        )}

        {value.rewards.map((reward) => (
          <div
            key={reward.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#1e1e2f] bg-[#12121a]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{reward.label}</p>
              <p className="text-[10px] text-gray-500">
                {rewardTypeLabel(reward.type)} · {reward.price}€
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleReward(reward.id)}
              className={`shrink-0 min-h-[32px] px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                reward.enabled
                  ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400'
                  : 'border-[#232330] bg-[#1a1a26] text-gray-500'
              }`}
            >
              {reward.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
        ))}

        {creatingReward && (
          <div className={formShellClass}>
            <p className={formTitleClass}>{t('live.setupNewReward')}</p>
            {compact ? (
              <>
                <select
                  value={rewardForm.type}
                  onChange={(e) => setRewardForm((f) => ({ ...f, type: e.target.value as RewardType }))}
                  className={fieldInputClass}
                >
                  {REWARD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {rewardTypeLabel(type)}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] gap-1.5 items-center">
                  <input
                    type="text"
                    value={rewardForm.label}
                    onChange={(e) => setRewardForm((f) => ({ ...f, label: e.target.value }))}
                    className={fieldInputClass}
                    placeholder={t('live.setupRewardLabelPlaceholder')}
                  />
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={rewardForm.price}
                    onChange={(e) => setRewardForm((f) => ({ ...f, price: e.target.value }))}
                    className={`${fieldInputClass} px-1.5 text-center`}
                    aria-label={t('live.setupRewardMin')}
                  />
                </div>
              </>
            ) : (
              <>
            <div className="flex flex-wrap gap-1">
              {REWARD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRewardForm((f) => ({ ...f, type }))}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition ${
                    rewardForm.type === type
                      ? 'border-purple-500/50 bg-purple-900/40 text-purple-200'
                      : 'border-[#232330] text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {rewardTypeLabel(type)}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={rewardForm.label}
              onChange={(e) => setRewardForm((f) => ({ ...f, label: e.target.value }))}
              className={fieldInputClass}
              placeholder={t('live.setupRewardLabelPlaceholder')}
            />
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="1"
                max="100"
                value={rewardForm.price}
                onChange={(e) => setRewardForm((f) => ({ ...f, price: e.target.value }))}
                className="w-24 px-2.5 py-1.5 rounded-lg bg-[#1a1a26] border border-[#232330] text-white text-xs focus:border-purple-500/50 outline-none"
              />
              <span className="text-xs text-gray-500">€ {t('live.setupRewardMin')}</span>
            </div>
              </>
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={addReward}
                className={`${formBtnClass} bg-purple-600 hover:bg-purple-500 text-white`}
              >
                {t('live.setupAddReward')}
              </button>
              <button
                type="button"
                onClick={() => setCreatingReward(false)}
                className={`${formBtnClass} bg-[#1a1a26] border border-[#232330] text-gray-400`}
              >
                {t('live.setupCancel')}
              </button>
            </div>
          </div>
        )}

        {!creatingReward && (
          <button
            type="button"
            onClick={() => setCreatingReward(true)}
            className="w-full min-h-[44px] py-2.5 rounded-xl border border-dashed border-[#2a2a3a] text-gray-500 text-xs hover:border-purple-500/40 hover:text-purple-300 transition"
          >
            {t('live.setupCreateReward')}
          </button>
        )}
      </div>
      )}
    </div>
  );
}
