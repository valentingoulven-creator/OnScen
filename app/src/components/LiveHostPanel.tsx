import { useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import { useLiveHostSession } from '../hooks/useLiveHostSession';
import { withGoalsProgress, type GoalProgressStats } from '../lib/liveGoalProgress';
import type {
  LiveGoal,
  LiveStats,
  RewardQueueItem,
  TriggerRule,
  GoalType,
  TriggerAction,
  RewardType,
} from '../lib/liveHostTypes';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function goalTypeLabel(t: GoalType): string {
  switch (t) {
    case 'amount': return 'Montant (€)';
    case 'dons': return 'Nombre de dons';
    case 'likes': return 'Likes';
    case 'viewers': return 'Spectateurs';
    case 'duration': return 'Durée (min)';
  }
}

function goalUnit(t: GoalType): string {
  switch (t) {
    case 'amount': return '€';
    case 'dons': return 'dons';
    case 'likes': return 'likes';
    case 'viewers': return 'spec.';
    case 'duration': return 'min';
  }
}

function actionLabel(a: TriggerAction): string {
  switch (a) {
    case 'hearts_animation': return 'Animation cœurs';
    case 'voice_thanks': return 'Message vocal';
    case 'fullscreen_donor': return 'Nom plein écran';
    case 'confetti': return 'Confettis';
    case 'chat_pin': return 'Pin dans le chat';
    case 'custom_alert': return 'Alerte personnalisée';
  }
}

function rewardTypeLabel(r: RewardType): string {
  switch (r) {
    case 'music_request': return 'Demande de musique';
    case 'dedication': return 'Dédicace';
    case 'dance': return 'Danse spécifique';
    case 'backstage': return 'Accès backstage';
    case 'badge': return 'Badge fan';
    case 'custom': return 'Récompense perso';
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Defaults                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const DEFAULT_TRIGGERS: TriggerRule[] = [
  { id: 't1', minAmount: 1,  actions: ['hearts_animation'],                  enabled: true },
  { id: 't2', minAmount: 5,  actions: ['voice_thanks'],                      enabled: true },
  { id: 't3', minAmount: 10, actions: ['fullscreen_donor', 'confetti'],      enabled: true },
  { id: 't4', minAmount: 20, actions: ['confetti', 'chat_pin'],              enabled: true },
  { id: 't5', minAmount: 50, actions: ['custom_alert', 'chat_pin'],         enabled: true },
];

const ALL_ACTIONS: TriggerAction[] = [
  'hearts_animation', 'voice_thanks', 'fullscreen_donor', 'confetti', 'chat_pin', 'custom_alert',
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function GoalProgressBar({ goal }: { goal: LiveGoal }) {
  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
  const done = pct >= 100;
  return (
    <div
      className={`rounded-xl border p-3 ${done ? 'border-emerald-500/40 bg-emerald-950/30' : 'border-[#2a2a3a] bg-[#12121a]'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className={`text-xs font-bold truncate ${done ? 'text-emerald-300' : 'text-white'}`}>
            {done && '✓ '}{goal.label}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {goalTypeLabel(goal.type)} · {goal.target} {goalUnit(goal.type)}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-black tabular-nums ${done ? 'text-emerald-400' : 'text-purple-400'}`}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#1e1e2f] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : 'bg-purple-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-[10px] mt-1.5 tabular-nums ${done ? 'text-emerald-400' : 'text-gray-400'}`}>
        {goal.current} / {goal.target} {goalUnit(goal.type)}
      </p>
    </div>
  );
}

/* ── Dashboard tab ── */
function DashboardTab({ stats, goals, liveId }: { stats: LiveStats; goals: LiveGoal[]; liveId: string }) {
  const [elapsed, setElapsed] = useState(Date.now() - stats.startedAt);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - stats.startedAt), 1000);
    return () => clearInterval(id);
  }, [stats.startedAt]);
  const activeGoals = goals.filter((g) => !g.completedAt && g.liveId === liveId);

  return (
    <div className="flex flex-col gap-4 overflow-y-auto pb-4">
      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { value: stats.viewers, label: 'Spec.' },
          { value: stats.newSubscribers, label: 'Nouveaux abo' },
          { value: `${stats.totalDonations.toFixed(0)}€`, label: 'Dons' },
          { value: formatElapsed(elapsed), label: 'Durée' },
        ].map(({ value, label }) => (
          <div key={label} className="rounded-xl bg-[#12121a] border border-[#1e1e2f] p-2.5 text-center">
            <p className="text-base font-black text-white tabular-nums leading-tight">{value}</p>
            <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Goals actifs */}
      {activeGoals.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Goals en cours</p>
          <div className="flex flex-col gap-2">
            {activeGoals.map((g) => <GoalProgressBar key={g.id} goal={g} />)}
          </div>
        </div>
      )}

      {/* Top donateurs */}
      {stats.topDonors.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Top donateurs</p>
          <div className="flex flex-col gap-1">
            {stats.topDonors.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#12121a] border border-[#1e1e2f]">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-amber-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : 'bg-[#2d2d3d] text-gray-300'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-xs text-white truncate">{d.name}</span>
                <span className="text-xs font-bold text-amber-300 tabular-nums shrink-0">{d.amount}€</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Goals tab ── */
function GoalsTab({
  liveId,
  goalStats,
}: {
  liveId: string;
  goalStats: GoalProgressStats;
}) {
  const { session, update } = useLiveHostSession(liveId);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ type: GoalType; target: string; label: string }>({
    type: 'amount', target: '100', label: '',
  });

  const goals = useMemo(
    () => withGoalsProgress(session.goals, goalStats),
    [session.goals, goalStats],
  );
  const activeGoals = goals.filter((g) => !g.completedAt);
  const doneGoals = goals.filter((g) => !!g.completedAt);

  const addGoal = () => {
    const target = parseFloat(form.target);
    if (!form.label.trim() || isNaN(target) || target <= 0) return;
    const g: LiveGoal = {
      id: `g_${Date.now()}`,
      type: form.type,
      target,
      current: 0,
      label: form.label.trim(),
      liveId,
      createdAt: Date.now(),
    };
    update((prev) => ({ goals: [...prev.goals, g] }));
    setForm({ type: 'amount', target: '100', label: '' });
    setCreating(false);
  };

  const removeGoal = (id: string) =>
    update((prev) => ({ goals: prev.goals.filter((g) => g.id !== id) }));
  const completeGoal = (id: string) =>
    update((prev) => ({
      goals: prev.goals.map((g) => (g.id === id ? { ...g, completedAt: Date.now() } : g)),
    }));

  const GOAL_TYPES: GoalType[] = ['amount', 'dons', 'likes', 'viewers', 'duration'];

  return (
    <div className="flex flex-col gap-4 overflow-y-auto pb-4">
      {/* Active goals */}
      {activeGoals.length === 0 && !creating && (
        <div className="py-8 text-center">
          <p className="text-gray-400 text-sm">Aucun goal actif</p>
          <p className="text-gray-500 text-xs mt-1">Crée un objectif de performance pour ton public</p>
        </div>
      )}
      {activeGoals.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">En cours</p>
          {activeGoals.map((g) => (
            <div key={g.id} className="relative">
              <GoalProgressBar goal={g} />
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => completeGoal(g.id)}
                  className="w-6 h-6 rounded-lg bg-emerald-900/60 border border-emerald-500/40 text-emerald-400 text-[10px] hover:bg-emerald-900 transition"
                  title="Marquer accompli"
                >✓</button>
                <button
                  type="button"
                  onClick={() => removeGoal(g.id)}
                  className="w-6 h-6 rounded-lg bg-[#1a1a26] border border-[#232330] text-gray-500 text-[10px] hover:text-red-400 transition"
                  title="Supprimer"
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 flex flex-col gap-3">
          <p className="text-xs font-bold text-purple-300">Nouveau goal</p>
          {/* Type */}
          <div>
            <p className="text-[10px] text-gray-400 mb-1.5">Type</p>
            <div className="flex flex-wrap gap-1">
              {GOAL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition ${form.type === t ? 'border-purple-500/50 bg-purple-900/40 text-purple-200' : 'border-[#232330] text-gray-500 hover:text-gray-300'}`}
                >
                  {goalTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>
          {/* Target + label */}
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] text-gray-400 mb-1">Valeur cible</p>
              <input
                type="number"
                min="1"
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#1a1a26] border border-[#232330] text-white text-xs focus:border-purple-500/50 outline-none"
                placeholder="100"
              />
            </div>
            <div className="shrink-0 w-8 flex items-end pb-1.5">
              <span className="text-xs text-gray-500">{goalUnit(form.type)}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-1">Ce que tu feras (affiché au public)</p>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#1a1a26] border border-[#232330] text-white text-xs focus:border-purple-500/50 outline-none"
              placeholder="ex: Performance exclusive · Joue une demande…"
              maxLength={60}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addGoal} className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition">
              Créer
            </button>
            <button type="button" onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg bg-[#1a1a26] border border-[#232330] text-gray-400 text-xs transition">
              Annuler
            </button>
          </div>
        </div>
      )}

      {!creating && (
        <button type="button" onClick={() => setCreating(true)} className="w-full py-2.5 rounded-xl border border-dashed border-[#2a2a3a] text-gray-500 text-xs hover:border-purple-500/40 hover:text-purple-300 transition">
          + Créer un goal artistique
        </button>
      )}

      {/* Done goals */}
      {doneGoals.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Accomplis</p>
          <div className="flex flex-col gap-1">
            {doneGoals.map((g) => (
              <div key={g.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                <span className="text-emerald-400 text-xs">✓</span>
                <span className="flex-1 text-xs text-emerald-300 truncate">{g.label}</span>
                <span className="text-[10px] text-emerald-500 shrink-0">{g.target}{goalUnit(g.type)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Rewards tab ── */
function RewardsTab({ liveId }: { liveId: string }) {
  const { session, update } = useLiveHostSession(liveId);
  const rewards = session.rewards;
  const queue = session.rewardQueue;
  const [tab, setTab] = useState<'queue' | 'catalog'>('queue');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ type: RewardType; label: string; price: string }>({
    type: 'custom', label: '', price: '10',
  });

  const updateQueue = (id: string, status: RewardQueueItem['status']) =>
    update((prev) => ({
      rewardQueue: prev.rewardQueue.map((i) => (i.id === id ? { ...i, status } : i)),
    }));

  const toggleReward = (id: string) =>
    update((prev) => ({
      rewards: prev.rewards.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    }));

  const addReward = () => {
    const price = parseFloat(form.price);
    if (!form.label.trim() || isNaN(price) || price <= 0) return;
    update((prev) => ({
      rewards: [
        ...prev.rewards,
        { id: `r_${Date.now()}`, type: form.type, label: form.label.trim(), price, enabled: true },
      ],
    }));
    setForm({ type: 'custom', label: '', price: '10' });
    setCreating(false);
  };

  const REWARD_TYPES: RewardType[] = ['music_request', 'dedication', 'dance', 'backstage', 'badge', 'custom'];
  const pending = queue.filter((i) => i.status === 'pending');

  return (
    <div className="flex flex-col gap-3 overflow-y-auto pb-4">
      {/* Tabs */}
      <div className="flex gap-1">
        {(['queue', 'catalog'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${tab === t ? 'bg-purple-600 text-white' : 'bg-[#12121a] text-gray-400 hover:text-white'}`}
          >
            {t === 'queue' ? `File d'attente${pending.length > 0 ? ` (${pending.length})` : ''}` : 'Catalogue'}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <>
          {queue.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-gray-400 text-sm">Aucune récompense en attente</p>
              <p className="text-gray-500 text-xs mt-1">Annonce tes récompenses dans le chat</p>
            </div>
          )}
          {queue.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-3 ${item.status === 'pending' ? 'border-[#2a2a3a] bg-[#12121a]' : item.status === 'accepted' ? 'border-emerald-500/30 bg-emerald-950/20' : item.status === 'done' ? 'border-[#1e1e2f] bg-[#0e0e16] opacity-60' : 'border-red-500/20 bg-red-950/10 opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{item.rewardLabel}</p>
                  <p className="text-[10px] text-gray-500">{item.donorName} · {item.amount}€</p>
                  {item.note && <p className="text-[10px] text-purple-300 mt-0.5 italic">"{item.note}"</p>}
                </div>
                <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${item.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : item.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-300' : item.status === 'done' ? 'bg-[#2d2d3d] text-gray-400' : 'bg-red-500/20 text-red-300'}`}>
                  {item.status === 'pending' ? 'En attente' : item.status === 'accepted' ? 'Acceptée' : item.status === 'done' ? 'Faite' : 'Refusée'}
                </span>
              </div>
              {item.status === 'pending' && (
                <div className="flex gap-1.5 mt-2">
                  <button type="button" onClick={() => updateQueue(item.id, 'accepted')} className="flex-1 py-1.5 rounded-lg bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold hover:bg-emerald-900 transition">Accepter</button>
                  <button type="button" onClick={() => updateQueue(item.id, 'done')}     className="flex-1 py-1.5 rounded-lg bg-purple-900/40 border border-purple-500/30 text-purple-300 text-[10px] font-bold hover:bg-purple-900/60 transition">Fait ✓</button>
                  <button type="button" onClick={() => updateQueue(item.id, 'refused')} className="flex-1 py-1.5 rounded-lg bg-[#1a1a26] border border-[#232330] text-gray-500 text-[10px] hover:text-red-400 transition">Refuser</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {tab === 'catalog' && (
        <>
          {rewards.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#1e1e2f] bg-[#12121a]">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{r.label}</p>
                <p className="text-[10px] text-gray-500">{rewardTypeLabel(r.type)} · {r.price}€{r.limitPerLive ? ` · max ${r.remainingCount}/${r.limitPerLive}` : ''}</p>
              </div>
              <button type="button" onClick={() => toggleReward(r.id)} className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${r.enabled ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400' : 'border-[#232330] bg-[#1a1a26] text-gray-500'}`}>
                {r.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}

          {creating && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 flex flex-col gap-3">
              <p className="text-xs font-bold text-purple-300">Nouvelle récompense</p>
              <div className="flex flex-wrap gap-1">
                {REWARD_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition ${form.type === t ? 'border-purple-500/50 bg-purple-900/40 text-purple-200' : 'border-[#232330] text-gray-500 hover:text-gray-300'}`}>
                    {rewardTypeLabel(t)}
                  </button>
                ))}
              </div>
              <input type="text" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#1a1a26] border border-[#232330] text-white text-xs focus:border-purple-500/50 outline-none" placeholder="Nom de la récompense" />
              <div className="flex gap-2 items-center">
                <input type="number" min="1" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-24 px-2.5 py-1.5 rounded-lg bg-[#1a1a26] border border-[#232330] text-white text-xs focus:border-purple-500/50 outline-none" />
                <span className="text-xs text-gray-500">€ minimum</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={addReward} className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition">Ajouter</button>
                <button type="button" onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg bg-[#1a1a26] border border-[#232330] text-gray-400 text-xs transition">Annuler</button>
              </div>
            </div>
          )}
          {!creating && (
            <button type="button" onClick={() => setCreating(true)} className="w-full py-2.5 rounded-xl border border-dashed border-[#2a2a3a] text-gray-500 text-xs hover:border-purple-500/40 hover:text-purple-300 transition">
              + Créer une récompense
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ── Triggers tab ── */
function TriggersTab() {
  const [rules, setRules] = useState<TriggerRule[]>(DEFAULT_TRIGGERS);
  const [editId, setEditId] = useState<string | null>(null);

  const toggleRule = (id: string) =>
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));

  const toggleAction = (ruleId: string, action: TriggerAction) =>
    setRules((prev) => prev.map((r) => {
      if (r.id !== ruleId) return r;
      const actions = r.actions.includes(action)
        ? r.actions.filter((a) => a !== action)
        : [...r.actions, action];
      return { ...r, actions };
    }));

  return (
    <div className="flex flex-col gap-3 overflow-y-auto pb-4">
      <p className="text-[10px] text-gray-500 leading-relaxed">
        Ces règles se déclenchent automatiquement à chaque don reçu.
      </p>
      {rules.map((rule) => (
        <div key={rule.id} className={`rounded-xl border p-3 ${rule.enabled ? 'border-[#2a2a3a] bg-[#12121a]' : 'border-[#1a1a26] bg-[#0e0e16] opacity-60'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="flex-1 text-xs font-bold text-white">Si don ≥ <span className="text-purple-300">{rule.minAmount}€</span></span>
            <button type="button" onClick={() => setEditId(editId === rule.id ? null : rule.id)}
              className="px-2 py-0.5 rounded-full text-[10px] border border-[#232330] text-gray-400 hover:text-white transition">
              {editId === rule.id ? '▲' : 'Éditer'}
            </button>
            <button type="button" onClick={() => toggleRule(rule.id)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${rule.enabled ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400' : 'border-[#232330] bg-[#1a1a26] text-gray-500'}`}>
              {rule.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {/* Actions courantes */}
          <div className="flex flex-wrap gap-1">
            {rule.actions.map((a) => (
              <span key={a} className="px-2 py-0.5 rounded-full bg-purple-900/40 border border-purple-500/30 text-purple-200 text-[10px] font-medium">
                → {actionLabel(a)}
              </span>
            ))}
          </div>
          {/* Edit actions */}
          {editId === rule.id && (
            <div className="mt-3 pt-3 border-t border-[#1e1e2f]">
              <p className="text-[10px] text-gray-400 mb-2">Actions déclenchées</p>
              <div className="flex flex-wrap gap-1">
                {ALL_ACTIONS.map((a) => (
                  <button key={a} type="button" onClick={() => toggleAction(rule.id, a)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition ${rule.actions.includes(a) ? 'border-purple-500/50 bg-purple-900/40 text-purple-200' : 'border-[#232330] text-gray-500 hover:text-gray-300'}`}>
                    {actionLabel(a)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main LiveHostPanel                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

type PanelTab = 'dashboard' | 'goals' | 'rewards' | 'triggers' | 'config';
export type LiveHostPanelTab = PanelTab;

interface LiveHostPanelProps {
  liveId: string;
  viewers: number;
  totalDonations: number;
  donationCount: number;
  liveStartedAt: number;
  initialTab?: LiveHostPanelTab;
  chatConfig?: { noLinksForParticipants?: boolean; slowModeSeconds?: number; subscribersOnly?: boolean };
  onClose: () => void;
}

export function LiveHostPanel({
  liveId,
  viewers,
  totalDonations,
  donationCount,
  liveStartedAt,
  initialTab = 'dashboard',
  chatConfig: initialChatConfig,
  onClose,
}: LiveHostPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>(initialTab);
  const [newSubscribers, setNewSubscribers] = useState(0);
  const [topDonors, setTopDonors] = useState<{ name: string; amount: number }[]>([]);
  const startedAtRef = useRef(liveStartedAt);
  const [chatConfig, setChatConfig] = useState({
    noLinksForParticipants: initialChatConfig?.noLinksForParticipants ?? false,
    slowModeSeconds: initialChatConfig?.slowModeSeconds ?? 0,
    subscribersOnly: initialChatConfig?.subscribersOnly ?? false,
  });

  const emitConfigUpdate = (patch: Partial<typeof chatConfig>) => {
    const next = { ...chatConfig, ...patch };
    setChatConfig(next);
    const socket = getSocket();
    socket?.emit('live_update_config', { liveId, config: next });
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!initialChatConfig) return;
    setChatConfig({
      noLinksForParticipants: initialChatConfig.noLinksForParticipants ?? false,
      slowModeSeconds: initialChatConfig.slowModeSeconds ?? 0,
      subscribersOnly: initialChatConfig.subscribersOnly ?? false,
    });
  }, [
    initialChatConfig?.noLinksForParticipants,
    initialChatConfig?.slowModeSeconds,
    initialChatConfig?.subscribersOnly,
  ]);

  const goalStats: GoalProgressStats = {
    totalDonations,
    donationCount,
    viewers,
    startedAt: startedAtRef.current,
  };

  const { session: hostSession } = useLiveHostSession(liveId);
  const goalsWithProgress = useMemo(
    () => withGoalsProgress(hostSession.goals, goalStats),
    [hostSession.goals, goalStats],
  );

  // Écoute les dons pour le classement top donateurs
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onGift = (gift: { liveId: string; senderName: string; amount?: number }) => {
      if (gift.liveId !== liveId || !gift.amount) return;
      setTopDonors((prev) => {
        const existing = prev.find((d) => d.name === gift.senderName);
        const updated = existing
          ? prev.map((d) => d.name === gift.senderName ? { ...d, amount: d.amount + gift.amount! } : d)
          : [...prev, { name: gift.senderName, amount: gift.amount! }];
        return updated.sort((a, b) => b.amount - a.amount).slice(0, 5);
      });
    };
    const onSub = (data: { liveId: string }) => {
      if (data.liveId === liveId) setNewSubscribers((n) => n + 1);
    };
    socket.on('gift_animation', onGift);
    socket.on('live_subscription', onSub);
    return () => {
      socket.off('gift_animation', onGift);
      socket.off('live_subscription', onSub);
    };
  }, [liveId]);

  const stats: LiveStats = {
    viewers,
    newSubscribers,
    totalDonations,
    donationCount,
    startedAt: startedAtRef.current,
    topDonors,
  };

  const TABS: { id: PanelTab; label: string }[] = [
    { id: 'dashboard', label: 'Live' },
    { id: 'goals', label: 'Goals' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'triggers', label: 'Auto' },
    { id: 'config', label: '⚙ Config' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
        aria-hidden
      />

      {/* Popup centré */}
      <div
        className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-lg bg-[#0f0f1a] border border-[#1e1e2f] rounded-2xl flex flex-col"
          style={{ maxHeight: 'min(86dvh, 680px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
              <p className="text-sm font-bold text-white">Dashboard Host</p>
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-[#1a1a26] text-gray-400 hover:text-white text-sm transition"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pb-3 shrink-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${activeTab === t.id ? 'bg-purple-600 text-white' : 'bg-[#1a1a26] text-gray-400 hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
            {activeTab === 'dashboard' && (
              <DashboardTab stats={stats} goals={goalsWithProgress} liveId={liveId} />
            )}
            {activeTab === 'goals' && <GoalsTab liveId={liveId} goalStats={goalStats} />}
            {activeTab === 'rewards' && <RewardsTab liveId={liveId} />}
            {activeTab === 'triggers' && <TriggersTab />}
            {activeTab === 'config' && (
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Modération du chat
                </p>

                {/* Liens interdits */}
                <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">Liens interdits</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Supprime automatiquement les liens (http, www…) des messages des participants non modérateurs.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={chatConfig.noLinksForParticipants}
                    onClick={() => emitConfigUpdate({ noLinksForParticipants: !chatConfig.noLinksForParticipants })}
                    className={`shrink-0 w-11 h-6 rounded-full border transition-colors ${
                      chatConfig.noLinksForParticipants
                        ? 'bg-purple-600 border-purple-500'
                        : 'bg-[#1e1e2f] border-[#2a2a3a]'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${
                        chatConfig.noLinksForParticipants ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>

                {/* Mode lent */}
                <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">Mode lent</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                        Délai minimum entre deux messages d&apos;un même participant (0 = désactivé).
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={120}
                        step={5}
                        value={chatConfig.slowModeSeconds}
                        onChange={(e) => emitConfigUpdate({ slowModeSeconds: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })}
                        className="w-16 px-2 py-1 rounded-lg bg-[#0b0b0f] border border-[#2a2a3a] text-white text-sm text-center focus:border-purple-500/60 focus:outline-none"
                      />
                      <span className="text-[11px] text-gray-500">s</span>
                    </div>
                  </div>
                  {chatConfig.slowModeSeconds > 0 && (
                    <p className="text-[11px] text-purple-400">
                      ⏱ Mode lent actif : {chatConfig.slowModeSeconds}s entre chaque message
                    </p>
                  )}
                </div>

                {/* Abonnés uniquement */}
                <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">Abonnés uniquement</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Réserve le chat aux abonnés de votre profil.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={chatConfig.subscribersOnly}
                    onClick={() => emitConfigUpdate({ subscribersOnly: !chatConfig.subscribersOnly })}
                    className={`shrink-0 w-11 h-6 rounded-full border transition-colors ${
                      chatConfig.subscribersOnly
                        ? 'bg-purple-600 border-purple-500'
                        : 'bg-[#1e1e2f] border-[#2a2a3a]'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${
                        chatConfig.subscribersOnly ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
