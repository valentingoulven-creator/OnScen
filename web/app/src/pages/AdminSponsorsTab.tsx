import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { useTranslation } from 'react-i18next';

import { AdminScrollTabBar } from '../components/AdminScrollTabBar';
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

/** Petit badge de métadonnée pour les cartes sponsor (liste). */
function MetaTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#1a1a26] border border-[#2d2d3d] px-2 py-0.5 text-[10px] text-gray-400">
      {children}
    </span>
  );
}

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

function SponsorsSubTabBar({
  subTab,
  onChange,
  t,
}: {
  subTab: SponsorPlacementTab;
  onChange: (tab: SponsorPlacementTab) => void;
  t: (key: string) => string;
}) {
  const labelFor = (tab: SponsorPlacementTab) => {
    switch (tab) {
      case 'all':
        return t('admin.sponsors.subTabAll');
      case 'map_banner':
        return t('admin.sponsors.subTabMap');
      case 'map_sidebar_events':
        return t('admin.sponsors.subTabMapSidebarEvents');
      case 'feed_inline':
        return t('admin.sponsors.subTabFeed');
      case 'stories_banner':
        return t('admin.sponsors.subTabStories');
      case 'stories_sponsored':
        return t('admin.sponsors.subTabStoriesViewer');
      case 'reels_sponsored':
        return t('admin.sponsors.subTabReels');
      case 'salon_theater':
        return t('admin.sponsors.subTabSalonTheater');
      case 'pricing':
        return t('admin.sponsors.subTabPricing');
    }
  };

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5 px-0.5">
        {t('admin.sponsors.placementSectionLabel')}
      </p>
      <AdminScrollTabBar
        className="-mx-1 px-1 border-b border-[#1e1e2f]"
        aria-label={t('admin.sponsors.subTabsAria')}
      >
        {SPONSOR_PLACEMENT_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            aria-current={subTab === tab ? 'true' : undefined}
            className={`shrink-0 px-2 py-1.5 min-h-8 sm:px-3 sm:py-2 sm:min-h-0 text-[11px] sm:text-xs font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
              subTab === tab
                ? 'border-purple-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {labelFor(tab)}
          </button>
        ))}
      </AdminScrollTabBar>
    </div>
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

      setCounts(

        placementTab === 'all' ? res.counts : countsForSponsors(res.items)

      );

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

        const reordered = reorderSponsorIdsWithinPlacement(

          allRes.items,

          placement,

          id,

          direction

        );

        if (!reordered) return;

        ids = reordered;

      }

      const res = await api.reorderAdminSponsors(token, ids);

      setItems(

        placementTab === 'all'

          ? res.items

          : res.items.filter((s) => s.placement === placementTab)

      );

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
    const isSubmitBusy =
      opts.mode === 'create' ? busyId === 'create' : busyId === opts.editId;

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



  return (

    <div className="space-y-4">

      <div>

        <h2 className="font-semibold text-purple-300">{t('admin.sponsors.title')}</h2>

        <p className="text-xs text-gray-400 mt-1">{t('admin.sponsors.subtitle')}</p>

      </div>



      <SponsorsSubTabBar subTab={placementTab} onChange={handlePlacementTabChange} t={t} />

      {placementTab === 'pricing' ? (
        <AdminSponsorsPricingTab />
      ) : (
        <>

      {placementTab === 'stories_sponsored' && (

        <div className="rounded-xl border border-purple-500/30 bg-[#12121a] p-4 space-y-3">

          <p className="text-sm font-semibold text-purple-300">{t('admin.sponsors.storiesViewerConfigTitle')}</p>

          <label className="flex items-center gap-3 text-sm text-gray-300">

            <input

              type="checkbox"

              checked={platformConfig.storiesSponsorEnabled}

              disabled={configBusy}

              onChange={(e) => void savePlatformConfig({ storiesSponsorEnabled: e.target.checked })}

              className="rounded border-[#2d2d3d]"

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

              className="mt-1 w-full max-w-[8rem] bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

              value={platformConfig.storiesSponsorEveryN}

              onChange={(e) =>

                setPlatformConfig((c) => ({

                  ...c,

                  storiesSponsorEveryN: Number(e.target.value) || c.storiesSponsorEveryN,

                }))

              }

              onBlur={() =>

                void savePlatformConfig({ storiesSponsorEveryN: platformConfig.storiesSponsorEveryN })

              }

            />

            <span className="text-[10px] text-gray-500 mt-0.5 block">

              {t('admin.sponsors.storiesViewerConfigEveryNHint')}

            </span>

          </label>

        </div>

      )}



      {placementTab === 'reels_sponsored' && (

        <div className="rounded-xl border border-purple-500/30 bg-[#12121a] p-4 space-y-3">

          <p className="text-sm font-semibold text-purple-300">{t('admin.sponsors.reelsConfigTitle')}</p>

          <label className="flex items-center gap-3 text-sm text-gray-300">

            <input

              type="checkbox"

              checked={platformConfig.reelsSponsorEnabled}

              disabled={configBusy}

              onChange={(e) => void savePlatformConfig({ reelsSponsorEnabled: e.target.checked })}

              className="rounded border-[#2d2d3d]"

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

              className="mt-1 w-full max-w-[8rem] bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

              value={platformConfig.reelsSponsorEveryN}

              onChange={(e) =>

                setPlatformConfig((c) => ({

                  ...c,

                  reelsSponsorEveryN: Number(e.target.value) || c.reelsSponsorEveryN,

                }))

              }

              onBlur={() =>

                void savePlatformConfig({ reelsSponsorEveryN: platformConfig.reelsSponsorEveryN })

              }

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



      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5 px-0.5">
          {t('admin.sponsors.statusSectionLabel')}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {FILTER_OPTIONS.map((f) => {
            const value = f === 'all' ? counts.total : f === 'active' ? counts.active : counts.inactive;
            const active = filter === f;
            const valueClass =
              f === 'active' ? 'text-green-400' : f === 'inactive' ? 'text-gray-400' : 'text-white';
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={active}
                className={`rounded-xl border p-3 transition ${
                  active
                    ? 'border-purple-500 bg-purple-600/15'
                    : 'border-[#1e1e2f] bg-[#12121a] hover:border-purple-500/30'
                }`}
              >
                <div className={`text-xl font-bold ${valueClass}`}>{value}</div>
                <div className="text-gray-500 mt-0.5">{filterLabel(f)}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 min-w-0 bg-[#12121a] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm"
          placeholder={t('admin.sponsors.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          onClick={openCreateForm}
          className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition ${
            showCreate
              ? 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300'
              : 'bg-purple-600/15 border-purple-500/40 text-purple-300 hover:bg-purple-600/25'
          }`}
        >
          {showCreate ? t('admin.sponsors.cancelCreate') : `+ ${t('admin.sponsors.add')}`}
        </button>
      </div>



      {showCreate && (

        <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4">

          <h3 className="font-semibold text-sm mb-3">{t('admin.sponsors.newSponsor')}</h3>

          {renderFormFields('create-sponsor-form', { mode: 'create' })}

        </section>

      )}



      {loading && items.length === 0 ? (

        <p className="text-gray-400 text-sm">{t('app.loading')}</p>

      ) : items.length === 0 ? (

        <p className="text-gray-500 text-sm">{t('admin.sponsors.noResults')}</p>

      ) : (

        <ul className="space-y-3">

          {items.map((sponsor, index) => {

            const isEditing = editingId === sponsor.id;

            const busy = busyId === sponsor.id;

            return (

              <li

                key={sponsor.id}

                className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3"

              >

                <div className="flex items-start gap-3">

                  {sponsor.logoUrl ? (

                    <img

                      src={resolveSponsorLogoSrc(sponsor.logoUrl)}

                      alt=""

                      className="w-20 h-20 rounded-lg object-cover bg-[#1a1a26] shrink-0"

                    />

                  ) : (

                    <div className="w-20 h-20 rounded-lg bg-[#1a1a26] shrink-0 flex items-center justify-center text-xs text-gray-500">

                      AD

                    </div>

                  )}

                  <div className="flex-1 min-w-0">

                    <div className="flex items-center gap-2 flex-wrap">

                      <span className="font-semibold text-white truncate">{sponsor.name}</span>

                      <span

                        className={`text-[10px] px-2 py-0.5 rounded-full ${

                          isSponsorActiveAt(sponsor)

                            ? 'bg-green-600/20 text-green-300 border border-green-500/30'

                            : 'bg-gray-600/20 text-gray-400 border border-gray-500/30'

                        }`}

                      >

                        {isSponsorActiveAt(sponsor) ? t('admin.sponsors.statusActive') : t('admin.sponsors.statusInactive')}

                      </span>

                      {placementTab === 'all' && (

                        <span className="text-[10px] text-purple-300 bg-purple-600/15 px-2 py-0.5 rounded-full">

                          {placementLabel(sponsor.placement)}

                        </span>

                      )}

                    </div>

                    <p className="text-[10px] text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>
                        {t('admin.sponsors.listCreatedAt', {
                          date: formatSponsorAdminDate(sponsor.createdAt, i18n.language),
                        })}
                      </span>
                      <span>
                        {sponsor.endsAt
                          ? t('admin.sponsors.listEndsAt', {
                              date: formatSponsorAdminDate(sponsor.endsAt, i18n.language),
                            })
                          : t('admin.sponsors.listNoEndDate')}
                      </span>
                    </p>

                    <p className="text-sm text-white mt-1 truncate">{sponsor.title}</p>

                    {sponsor.subtitle && sponsor.subtitle !== sponsor.title && (
                      <p className="text-xs text-gray-400 line-clamp-2">{sponsor.subtitle}</p>
                    )}

                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <MetaTag>#{sponsor.priority + 1}</MetaTag>
                      <MetaTag>{placementLabel(sponsor.placement)}</MetaTag>
                      {sponsor.audienceEstimate ? (
                        <MetaTag>
                          {formatSponsorAudienceEstimateLabel(sponsor.audienceEstimate, t)}
                        </MetaTag>
                      ) : null}
                      {sponsor.endsAt && (
                        <MetaTag>
                          {t('admin.sponsors.listDisplayDays', {
                            days: computeDisplayDays(sponsor.startsAt, sponsor.endsAt),
                          })}
                        </MetaTag>
                      )}
                      {sponsor.displayDurationSec != null && (
                        <MetaTag>
                          {t('admin.sponsors.listDisplayDuration', { sec: sponsor.displayDurationSec })}
                        </MetaTag>
                      )}
                      {sponsor.linkUrl && <MetaTag>{t('admin.sponsors.listHasLink')}</MetaTag>}
                      {sponsor.linkedEventPostId && (
                        <MetaTag>
                          {t('admin.sponsors.listLinkedEvent', { id: sponsor.linkedEventPostId })}
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

                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">

                    <button

                      type="button"

                      disabled={busy || index === 0}

                      onClick={() => void moveSponsor(sponsor.id, 'up')}

                      className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-[#1a1a26] text-gray-300 border border-[#2d2d3d] disabled:opacity-40"

                    >

                      ↑ {t('admin.sponsors.moveUp')}

                    </button>

                    <button

                      type="button"

                      disabled={busy || index === items.length - 1}

                      onClick={() => void moveSponsor(sponsor.id, 'down')}

                      className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-[#1a1a26] text-gray-300 border border-[#2d2d3d] disabled:opacity-40"

                    >

                      ↓ {t('admin.sponsors.moveDown')}

                    </button>

                    <button

                      type="button"

                      disabled={busy}

                      onClick={() => {

                        setEditingId(sponsor.id);

                        setShowCreate(false);

                        setForm(sponsorToAdminForm(sponsor));

                      }}

                      className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-[#1a1a26] text-purple-300 border border-purple-500/30"

                    >

                      {t('admin.sponsors.edit')}

                    </button>

                    <button

                      type="button"

                      disabled={busy}

                      onClick={() => void handleToggle(sponsor.id)}

                      className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30"

                    >

                      {sponsor.active ? t('admin.sponsors.deactivate') : t('admin.sponsors.activate')}

                    </button>

                    <button

                      type="button"

                      disabled={busy}

                      onClick={() => void handleDelete(sponsor.id)}

                      className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-red-600/20 text-red-300 border border-red-500/30"

                    >

                      {t('admin.sponsors.delete')}

                    </button>

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


