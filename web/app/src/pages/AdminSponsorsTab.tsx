import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SponsorAdminFormFields } from '../components/SponsorAdminFormFields';
import { formatSponsorAudienceEstimateLabel } from '../components/SponsorAudienceEstimatePanel';
import { AdminSponsorsPricingTab } from '../components/AdminSponsorsPricingTab';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { resolveSponsorLogoSrc } from '../lib/sponsorLogoUpload';
import {
  countsForSponsors,
  defaultPlacementForTab,
  isSponsorActiveAt,
  placementTabToApiPlacement,
  reorderSponsorIdsWithinPlacement,
  SPONSOR_PLACEMENT_TABS,
  type SponsorPlacementTab,
} from '../lib/sponsorAdminPlacement';
import {
  buildSponsorPayloadFromAdminForm,
  computeDisplayDays,
  emptySponsorAdminForm,
  sponsorToAdminForm,
  validateSponsorAdminForm,
  type SponsorAdminFormState,
} from '../lib/sponsorAdminForm';
import type { Sponsor, SponsorFilter, SponsorPlacement, SponsorPlatformConfig } from '../types';

const FILTER_OPTIONS: SponsorFilter[] = ['all', 'active', 'inactive'];

const PLACE_META: Record<
  SponsorPlacementTab,
  { icon: string; titleKey: string; hintKey: string }
> = {
  all: { icon: '⊞', titleKey: 'admin.sponsors.placeAll', hintKey: 'admin.sponsors.placeAllHint' },
  map_banner: { icon: '🗺️', titleKey: 'admin.sponsors.subTabMap', hintKey: 'admin.sponsors.placeMapHint' },
  map_sidebar_events: {
    icon: '📅',
    titleKey: 'admin.sponsors.subTabMapSidebarEvents',
    hintKey: 'admin.sponsors.placeMapSponsoHint',
  },
  feed_inline: { icon: '📰', titleKey: 'admin.sponsors.subTabFeed', hintKey: 'admin.sponsors.placeFeedHint' },
  stories_banner: {
    icon: '◯',
    titleKey: 'admin.sponsors.subTabStories',
    hintKey: 'admin.sponsors.placeStoriesHint',
  },
  stories_sponsored: {
    icon: '▶',
    titleKey: 'admin.sponsors.subTabStoriesViewer',
    hintKey: 'admin.sponsors.placeStoriesViewerHint',
  },
  reels_sponsored: { icon: '🎬', titleKey: 'admin.sponsors.subTabReels', hintKey: 'admin.sponsors.placeReelsHint' },
  salon_theater: { icon: '🎵', titleKey: 'admin.sponsors.subTabSalonTheater', hintKey: 'admin.sponsors.placeSalonHint' },
  pricing: { icon: '€', titleKey: 'admin.sponsors.subTabPricing', hintKey: 'admin.sponsors.placePricingHint' },
};

function formatSponsorAdminDate(ts: number | undefined, locale: string): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MetaTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#1a1a26] border border-[#2d2d3d] px-2 py-0.5 text-[10px] text-gray-400">
      {children}
    </span>
  );
}

export function AdminSponsorsTab() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const [placementTab, setPlacementTab] = useState<SponsorPlacementTab>('map_banner');
  const [filter, setFilter] = useState<SponsorFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<Sponsor[]>([]);
  const [counts, setCounts] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<SponsorAdminFormState>(() => emptySponsorAdminForm('map_banner'));
  const [formError, setFormError] = useState('');
  const [platformConfig, setPlatformConfig] = useState<SponsorPlatformConfig>({
    reelsSponsorEnabled: true,
    reelsSponsorEveryN: 5,
    storiesSponsorEnabled: true,
    storiesSponsorEveryN: 4,
  });
  const [configBusy, setConfigBusy] = useState(false);

  useEffect(() => {
    const tmr = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(tmr);
  }, [search]);

  useEffect(() => {
    setFormError('');
  }, [form]);

  const reload = useCallback(async () => {
    if (!token || placementTab === 'pricing') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminSponsors(token, {
        filter,
        placement: placementTabToApiPlacement(placementTab),
        q: debouncedSearch || undefined,
      });
      setItems(res.items);
      setCounts(placementTab === 'all' ? res.counts : countsForSponsors(res.items));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.network'));
    } finally {
      setLoading(false);
    }
  }, [token, filter, placementTab, debouncedSearch, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!token || (placementTab !== 'reels_sponsored' && placementTab !== 'stories_sponsored')) return;
    api
      .getAdminSponsorsConfig(token)
      .then((r) => setPlatformConfig(r.config))
      .catch(() => undefined);
  }, [token, placementTab]);

  const savePlatformConfig = async (patch: Partial<SponsorPlatformConfig>) => {
    if (!token) return;
    setConfigBusy(true);
    try {
      const res = await api.patchAdminSponsorsConfig(token, patch);
      setPlatformConfig(res.config);
    } catch (e) {
      alert(e instanceof Error ? e.message : t('admin.sponsors.actionError'));
    } finally {
      setConfigBusy(false);
    }
  };

  const handlePlacementTabChange = (tab: SponsorPlacementTab) => {
    setPlacementTab(tab);
    setEditingId(null);
    if (showCreate) {
      setForm((f) => ({ ...f, placement: defaultPlacementForTab(tab) }));
    }
  };

  const openCreateForm = () => {
    setShowCreate((v) => {
      const next = !v;
      if (next) {
        setEditingId(null);
        setFormError('');
        setForm(emptySponsorAdminForm(defaultPlacementForTab(placementTab)));
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!token) {
      setFormError(t('errors.sessionExpired'));
      return;
    }
    const validationError = validateSponsorAdminForm(form, t);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError('');
    setBusyId('create');
    try {
      await api.createAdminSponsor(token, buildSponsorPayloadFromAdminForm(form));
      setForm(emptySponsorAdminForm(defaultPlacementForTab(placementTab)));
      setShowCreate(false);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('admin.sponsors.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSave = async (id: string) => {
    if (!token) {
      setFormError(t('errors.sessionExpired'));
      return;
    }
    const validationError = validateSponsorAdminForm(form, t);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError('');
    setBusyId(id);
    try {
      await api.updateAdminSponsor(token, id, buildSponsorPayloadFromAdminForm(form));
      setEditingId(null);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('admin.sponsors.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      await api.toggleAdminSponsor(token, id);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('admin.sponsors.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!window.confirm(t('admin.sponsors.deleteConfirm'))) return;
    setBusyId(id);
    try {
      await api.deleteAdminSponsor(token, id);
      if (editingId === id) setEditingId(null);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('admin.sponsors.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  const moveSponsor = async (id: string, direction: 'up' | 'down') => {
    if (!token || placementTab === 'pricing') return;
    const idx = items.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    setBusyId(id);
    try {
      let ids: string[];
      if (placementTab === 'all') {
        ids = items.map((s) => s.id);
        [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
      } else {
        const allRes = await api.getAdminSponsors(token, {
          filter,
          q: debouncedSearch || undefined,
        });
        const placement = placementTabToApiPlacement(placementTab);
        if (!placement) return;
        const reordered = reorderSponsorIdsWithinPlacement(allRes.items, placement, id, direction);
        if (!reordered) return;
        ids = reordered;
      }
      const res = await api.reorderAdminSponsors(token, ids);
      setItems(placementTab === 'all' ? res.items : res.items.filter((s) => s.placement === placementTab));
    } catch (e) {
      alert(e instanceof Error ? e.message : t('admin.sponsors.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  const placementLabel = (placement: SponsorPlacement) => t(`admin.sponsors.placement.${placement}`);
  const filterLabel = (f: SponsorFilter) => {
    if (f === 'active') return t('admin.sponsors.filterActive');
    if (f === 'inactive') return t('admin.sponsors.filterInactive');
    return t('admin.sponsors.filterAll');
  };

  const renderFormFields = (
    formId: string,
    opts: { mode: 'create' } | { mode: 'edit'; editId: string }
  ) => {
    const isSubmitBusy = opts.mode === 'create' ? busyId === 'create' : busyId === opts.editId;
    return (
      <SponsorAdminFormFields
        formId={formId}
        form={form}
        setForm={setForm}
        formError={formError}
        isSubmitBusy={isSubmitBusy}
        submitLabel={opts.mode === 'edit' ? t('admin.sponsors.save') : t('admin.sponsors.create')}
        onSubmit={() => {
          if (opts.mode === 'create') void handleCreate();
          else void handleSave(opts.editId);
        }}
      />
    );
  };

  const selectedPlace = PLACE_META[placementTab];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-white">{t('admin.sponsors.title')}</h2>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{t('admin.sponsors.pageLead')}</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {t('admin.sponsors.whereTitle')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="tablist" aria-label={t('admin.sponsors.subTabsAria')}>
          {SPONSOR_PLACEMENT_TABS.map((tab) => {
            const meta = PLACE_META[tab];
            const selected = placementTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => handlePlacementTabChange(tab)}
                className={`min-h-[72px] text-left rounded-2xl border px-3 py-2.5 transition ${
                  selected
                    ? 'border-purple-500 bg-purple-600/15'
                    : 'border-[#2a2a3a] bg-[#12121a] hover:border-purple-500/35'
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {meta.icon}
                </span>
                <p className={`text-xs font-bold mt-1.5 ${selected ? 'text-white' : 'text-gray-200'}`}>
                  {t(meta.titleKey)}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{t(meta.hintKey)}</p>
              </button>
            );
          })}
        </div>
      </section>

      {placementTab === 'pricing' ? (
        <AdminSponsorsPricingTab />
      ) : (
        <>
          <div className="rounded-2xl border border-[#2a2a3a] bg-[#12121a] px-4 py-3">
            <p className="text-sm font-semibold text-white">{t(selectedPlace.hintKey)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {t('admin.sponsors.contextCount', { active: counts.active, total: counts.total })}
            </p>
          </div>

          {placementTab === 'stories_sponsored' && (
            <div className="rounded-2xl border border-[#2a2a3a] bg-[#0f0f17] p-4 space-y-3">
              <p className="text-xs font-bold text-gray-300">{t('admin.sponsors.storiesViewerConfigTitle')}</p>
              <label className="flex items-center gap-3 min-h-[44px] text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={platformConfig.storiesSponsorEnabled}
                  disabled={configBusy}
                  onChange={(e) => void savePlatformConfig({ storiesSponsorEnabled: e.target.checked })}
                  className="rounded border-[#2d2d3d] w-4 h-4"
                />
                {t('admin.sponsors.storiesViewerConfigEnabled')}
              </label>
              <label className="block text-xs text-gray-400">
                {t('admin.sponsors.storiesViewerConfigEveryN')}
                <input
                  type="number"
                  min={1}
                  max={50}
                  disabled={configBusy || !platformConfig.storiesSponsorEnabled}
                  className="mt-1 w-full max-w-[8rem] min-h-[44px] bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
                  value={platformConfig.storiesSponsorEveryN}
                  onChange={(e) =>
                    setPlatformConfig((c) => ({
                      ...c,
                      storiesSponsorEveryN: Number(e.target.value) || c.storiesSponsorEveryN,
                    }))
                  }
                  onBlur={() => void savePlatformConfig({ storiesSponsorEveryN: platformConfig.storiesSponsorEveryN })}
                />
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  {t('admin.sponsors.storiesViewerConfigEveryNHint')}
                </span>
              </label>
            </div>
          )}

          {placementTab === 'reels_sponsored' && (
            <div className="rounded-2xl border border-[#2a2a3a] bg-[#0f0f17] p-4 space-y-3">
              <p className="text-xs font-bold text-gray-300">{t('admin.sponsors.reelsConfigTitle')}</p>
              <label className="flex items-center gap-3 min-h-[44px] text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={platformConfig.reelsSponsorEnabled}
                  disabled={configBusy}
                  onChange={(e) => void savePlatformConfig({ reelsSponsorEnabled: e.target.checked })}
                  className="rounded border-[#2d2d3d] w-4 h-4"
                />
                {t('admin.sponsors.reelsConfigEnabled')}
              </label>
              <label className="block text-xs text-gray-400">
                {t('admin.sponsors.reelsConfigEveryN')}
                <input
                  type="number"
                  min={1}
                  max={50}
                  disabled={configBusy || !platformConfig.reelsSponsorEnabled}
                  className="mt-1 w-full max-w-[8rem] min-h-[44px] bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
                  value={platformConfig.reelsSponsorEveryN}
                  onChange={(e) =>
                    setPlatformConfig((c) => ({
                      ...c,
                      reelsSponsorEveryN: Number(e.target.value) || c.reelsSponsorEveryN,
                    }))
                  }
                  onBlur={() => void savePlatformConfig({ reelsSponsorEveryN: platformConfig.reelsSponsorEveryN })}
                />
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  {t('admin.sponsors.reelsConfigEveryNHint')}
                </span>
              </label>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 min-w-0 min-h-[44px] bg-[#12121a] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600"
              placeholder={t('admin.sponsors.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              onClick={openCreateForm}
              className={`shrink-0 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold border transition ${
                showCreate
                  ? 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300'
                  : 'bg-purple-600 hover:bg-purple-500 border-purple-500 text-white'
              }`}
            >
              {showCreate ? t('admin.sponsors.cancelCreate') : t('admin.sponsors.addShort')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label={t('admin.sponsors.statusSectionLabel')}>
            {FILTER_OPTIONS.map((f) => {
              const value = f === 'all' ? counts.total : f === 'active' ? counts.active : counts.inactive;
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={active}
                  className={`min-h-[36px] px-3 rounded-full text-[11px] font-semibold border transition ${
                    active
                      ? 'border-purple-500 bg-purple-600/20 text-white'
                      : 'border-[#2d2d3d] bg-[#12121a] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {filterLabel(f)} · {value}
                </button>
              );
            })}
          </div>

          {showCreate && (
            <section className="bg-[#12121a] border border-purple-500/25 rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3 text-white">{t('admin.sponsors.newSponsor')}</h3>
              {renderFormFields('create-sponsor-form', { mode: 'create' })}
            </section>
          )}

          {loading && items.length === 0 ? (
            <p className="text-gray-400 text-sm">{t('app.loading')}</p>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2d2d3d] px-4 py-10 text-center">
              <p className="text-sm font-semibold text-gray-300">{t('admin.sponsors.emptyTitle')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('admin.sponsors.emptyHint')}</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {items.map((sponsor, index) => {
                const isEditing = editingId === sponsor.id;
                const busy = busyId === sponsor.id;
                const live = isSponsorActiveAt(sponsor);
                return (
                  <li key={sponsor.id} className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-start gap-3">
                      {sponsor.logoUrl ? (
                        <img
                          src={resolveSponsorLogoSrc(sponsor.logoUrl)}
                          alt=""
                          className="w-14 h-14 rounded-xl object-cover bg-[#1a1a26] shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-[#1a1a26] shrink-0 flex items-center justify-center text-[10px] text-gray-500 font-bold">
                          AD
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white truncate">{sponsor.name}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              live
                                ? 'bg-green-600/20 text-green-300 border border-green-500/30'
                                : 'bg-gray-600/20 text-gray-400 border border-gray-500/30'
                            }`}
                          >
                            {live ? t('admin.sponsors.statusActive') : t('admin.sponsors.statusInactive')}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1 truncate">
                          {placementLabel(sponsor.placement)}
                          {sponsor.endsAt
                            ? ` · ${t('admin.sponsors.listEndsAt', {
                                date: formatSponsorAdminDate(sponsor.endsAt, i18n.language),
                              })}`
                            : ` · ${t('admin.sponsors.listNoEndDate')}`}
                        </p>
                        {sponsor.title && (
                          <p className="text-sm text-white/90 mt-0.5 truncate">{sponsor.title}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <MetaTag>#{sponsor.priority + 1}</MetaTag>
                          {sponsor.audienceEstimate ? (
                            <MetaTag>{formatSponsorAudienceEstimateLabel(sponsor.audienceEstimate, t)}</MetaTag>
                          ) : null}
                          {sponsor.endsAt && (
                            <MetaTag>
                              {t('admin.sponsors.listDisplayDays', {
                                days: computeDisplayDays(sponsor.startsAt, sponsor.endsAt),
                              })}
                            </MetaTag>
                          )}
                          {sponsor.placement === 'map_banner' && (
                            <MetaTag>
                              {sponsor.mapVisibilityScope === 'region'
                                ? t('admin.sponsors.mapScopeRegionBadge', {
                                    region: sponsor.mapTargetRegionName ?? '—',
                                  })
                                : t('admin.sponsors.mapScopeFranceBadge')}
                            </MetaTag>
                          )}
                        </div>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="border-t border-[#1e1e2f] pt-3">
                        {renderFormFields(`edit-${sponsor.id}`, { mode: 'edit', editId: sponsor.id })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(sponsor.id);
                            setShowCreate(false);
                            setForm(sponsorToAdminForm(sponsor));
                          }}
                          className="min-h-[44px] px-3.5 rounded-xl text-xs font-bold bg-purple-600/20 text-purple-200 border border-purple-500/30"
                        >
                          {t('admin.sponsors.edit')}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleToggle(sponsor.id)}
                          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold border ${
                            sponsor.active
                              ? 'bg-amber-600/15 text-amber-200 border-amber-500/30'
                              : 'bg-green-600/15 text-green-200 border-green-500/30'
                          }`}
                        >
                          {sponsor.active ? t('admin.sponsors.deactivate') : t('admin.sponsors.activate')}
                        </button>
                        <div className="flex gap-1 ml-auto">
                          <button
                            type="button"
                            disabled={busy || index === 0}
                            onClick={() => void moveSponsor(sponsor.id, 'up')}
                            className="min-h-[44px] min-w-[44px] rounded-xl text-sm font-bold bg-[#1a1a26] text-gray-300 border border-[#2d2d3d] disabled:opacity-40"
                            aria-label={t('admin.sponsors.moveUp')}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={busy || index === items.length - 1}
                            onClick={() => void moveSponsor(sponsor.id, 'down')}
                            className="min-h-[44px] min-w-[44px] rounded-xl text-sm font-bold bg-[#1a1a26] text-gray-300 border border-[#2d2d3d] disabled:opacity-40"
                            aria-label={t('admin.sponsors.moveDown')}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDelete(sponsor.id)}
                            className="min-h-[44px] px-3 rounded-xl text-xs font-bold bg-red-600/15 text-red-300 border border-red-500/30"
                          >
                            {t('admin.sponsors.delete')}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
