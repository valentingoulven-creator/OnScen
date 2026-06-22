import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { AdminScrollTabBar } from '../components/AdminScrollTabBar';
import { SponsorRegionAutocomplete } from '../components/SponsorRegionAutocomplete';
import { SponsorAdPreview } from '../components/SponsorAdPreview';
import { SponsorBannerUploadField } from '../components/SponsorBannerUploadField';
import { SponsorLogoUploadField } from '../components/SponsorLogoUploadField';

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

  DEFAULT_DISPLAY_DURATION_SEC,

  normalizeDisplayDurationSec,

  SPONSOR_DISPLAY_DURATION_MAX_SEC,

  SPONSOR_DISPLAY_DURATION_MIN_SEC,

  SPONSOR_IMAGE_SPECS,

} from '../lib/sponsorDisplaySpec';

import { MAP_REGION_MIN_ZOOM } from '../lib/sponsorAds';

import { validateSponsorAdminForm } from '../lib/sponsorAdminForm';

import type { Sponsor, SponsorAccent, SponsorBannerDisplayMode, SponsorFilter, SponsorKind, SponsorMapVisibilityScope, SponsorPlacement, SponsorPlatformConfig } from '../types';



const FILTER_OPTIONS: SponsorFilter[] = ['all', 'active', 'inactive'];

const PLACEMENT_OPTIONS: SponsorPlacement[] = ['map_banner', 'feed_inline', 'stories_banner', 'reels_sponsored'];

const ACCENT_OPTIONS: SponsorAccent[] = ['purple', 'pink', 'amber', 'cyan', 'rose'];

const KIND_OPTIONS: SponsorKind[] = ['promo', 'sponsored'];



type FormState = {

  name: string;

  logoUrl: string;

  bannerImageUrl: string;

  linkUrl: string;

  placement: SponsorPlacement;

  title: string;

  subtitle: string;

  cta: string;

  accent: SponsorAccent | '';

  bannerDisplayMode: SponsorBannerDisplayMode;

  kind: SponsorKind;

  actionId: '' | 'salon' | 'live';

  startsAt: string;

  endsAt: string;

  displayDurationSec: string;

  videoUrl: string;

  posterUrl: string;

  mapVisibilityScope: SponsorMapVisibilityScope;

  mapTargetRegionName: string;

  mapTargetLat: string;

  mapTargetLng: string;

};



function emptyForm(placement: SponsorPlacement): FormState {

  return {

    name: '',

    logoUrl: '',

    bannerImageUrl: '',

    linkUrl: '',

    placement,

    title: '',

    subtitle: '',

    cta: '',

    accent: 'purple',

    bannerDisplayMode: 'full',

    kind: 'promo',

    actionId: '',

    startsAt: nowDatetimeLocal(),

    endsAt: '',

    displayDurationSec: String(DEFAULT_DISPLAY_DURATION_SEC),

    videoUrl: '',

    posterUrl: '',

    mapVisibilityScope: 'france',

    mapTargetRegionName: '',

    mapTargetLat: '',

    mapTargetLng: '',

  };

}



function formatDateTime(ts: number | undefined, locale: string): string {

  if (!ts) return '—';

  return new Date(ts).toLocaleString(locale, {

    day: 'numeric',

    month: 'short',

    year: 'numeric',

    hour: '2-digit',

    minute: '2-digit',

  });

}



function toDatetimeLocal(ts: number | undefined): string {

  if (!ts) return '';

  const d = new Date(ts);

  const pad = (n: number) => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

}



function nowDatetimeLocal(): string {

  return toDatetimeLocal(Date.now());

}



function parseDatetimeLocal(value: string): number | undefined {

  if (!value.trim()) return undefined;

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : undefined;

}



function sponsorToForm(sponsor: Sponsor): FormState {

  return {

    name: sponsor.name,

    logoUrl: sponsor.logoUrl ?? '',

    bannerImageUrl: sponsor.bannerImageUrl ?? '',

    linkUrl: sponsor.linkUrl ?? '',

    placement: sponsor.placement,

    title: sponsor.title,

    subtitle: sponsor.subtitle,

    cta: sponsor.cta,

    accent: sponsor.accent ?? '',

    bannerDisplayMode: sponsor.bannerDisplayMode ?? 'full',

    kind: sponsor.kind,

    actionId: sponsor.actionId ?? '',

    startsAt: toDatetimeLocal(sponsor.startsAt),

    endsAt: toDatetimeLocal(sponsor.endsAt),

    displayDurationSec: String(

      normalizeDisplayDurationSec(sponsor.displayDurationSec, DEFAULT_DISPLAY_DURATION_SEC)

    ),

    videoUrl: sponsor.videoUrl ?? '',

    posterUrl: sponsor.posterUrl ?? '',

    mapVisibilityScope: sponsor.mapVisibilityScope ?? 'france',

    mapTargetRegionName: sponsor.mapTargetRegionName ?? '',

    mapTargetLat: sponsor.mapTargetLat != null ? String(sponsor.mapTargetLat) : '',

    mapTargetLng: sponsor.mapTargetLng != null ? String(sponsor.mapTargetLng) : '',

  };

}



function parseOptionalCoordField(value: string): number | undefined {

  const trimmed = value.trim();

  if (!trimmed) return undefined;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : undefined;

}



function formToPayload(form: FormState): Partial<Sponsor> {

  const payload: Partial<Sponsor> = {

    name: form.name.trim(),

    logoUrl: form.logoUrl.trim() || undefined,

    linkUrl: form.linkUrl.trim() || undefined,

    placement: form.placement,

    title: form.title.trim(),

    subtitle: form.subtitle.trim(),

    cta: form.cta.trim(),

    accent:
      form.accent === ''
        ? (null as unknown as Sponsor['accent'])
        : form.accent || undefined,

    kind: form.kind,

    actionId: form.actionId === 'salon' || form.actionId === 'live' ? form.actionId : undefined,

    startsAt: parseDatetimeLocal(form.startsAt),

    endsAt: parseDatetimeLocal(form.endsAt),

    displayDurationSec: normalizeDisplayDurationSec(form.displayDurationSec),

    videoUrl: form.videoUrl.trim() || undefined,

    posterUrl: form.posterUrl.trim() || undefined,

  };

  if (form.placement === 'map_banner') {
    payload.mapVisibilityScope = form.mapVisibilityScope;
    payload.bannerImageUrl = form.bannerImageUrl.trim() || undefined;
    payload.bannerDisplayMode = form.bannerDisplayMode;
    if (form.mapVisibilityScope === 'region') {
      payload.mapTargetRegionName = form.mapTargetRegionName.trim() || undefined;
      payload.mapTargetLat = parseOptionalCoordField(form.mapTargetLat);
      payload.mapTargetLng = parseOptionalCoordField(form.mapTargetLng);
    } else {
      payload.mapTargetRegionName = undefined;
      payload.mapTargetLat = undefined;
      payload.mapTargetLng = undefined;
    }
  }

  return payload;

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

    if (tab === 'all') return t('admin.sponsors.subTabAll');

    if (tab === 'map_banner') return t('admin.sponsors.subTabMap');

    if (tab === 'feed_inline') return t('admin.sponsors.subTabFeed');

    if (tab === 'stories_banner') return t('admin.sponsors.subTabStories');

    if (tab === 'reels_sponsored') return t('admin.sponsors.subTabReels');

    return t('admin.sponsors.subTabStories');

  };



  return (

    <AdminScrollTabBar

      className="-mx-1 px-1 border-b border-[#1e1e2f]"

      aria-label={t('admin.sponsors.subTabsAria')}

    >

      {SPONSOR_PLACEMENT_TABS.map((tab) => (

        <button

          key={tab}

          type="button"

          onClick={() => onChange(tab)}

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

  );

}



export function AdminSponsorsTab() {

  const { token } = useAuth();

  const { t, i18n } = useTranslation();

  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR';



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

  const [form, setForm] = useState<FormState>(() => emptyForm('map_banner'));

  const [formError, setFormError] = useState('');

  const [platformConfig, setPlatformConfig] = useState<SponsorPlatformConfig>({
    reelsSponsorEnabled: true,
    reelsSponsorEveryN: 5,
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

    if (!token) return;

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

    if (!token || placementTab !== 'reels_sponsored') return;

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

        setForm(emptyForm(defaultPlacementForTab(placementTab)));

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

      await api.createAdminSponsor(token, formToPayload(form));

      setForm(emptyForm(defaultPlacementForTab(placementTab)));

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

      await api.updateAdminSponsor(token, id, formToPayload(form));

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

    if (!token) return;

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

        const reordered = reorderSponsorIdsWithinPlacement(

          allRes.items,

          placementTab,

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



  const imageSpec = SPONSOR_IMAGE_SPECS[form.placement];

  const displayDurationSec = normalizeDisplayDurationSec(form.displayDurationSec);

  const isMapImageOnly =
    form.placement === 'map_banner' && form.bannerDisplayMode === 'image_only';



  const renderFormFields = (

    formId: string,

    opts: { mode: 'create' } | { mode: 'edit'; editId: string }

  ) => {

    const isSubmitBusy =

      opts.mode === 'create' ? busyId === 'create' : busyId === opts.editId;



    return (

    <form

      id={formId}

      noValidate

      onSubmit={(e) => {

        e.preventDefault();

        if (opts.mode === 'create') void handleCreate();

        else void handleSave(opts.editId);

      }}

      className="space-y-3"

    >

      {formError ? (

        <p

          role="alert"

          className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2"

        >

          {formError}

        </p>

      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

        <label className="block text-xs text-gray-400">

          {t('admin.sponsors.fieldName')}

          <input

            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

            value={form.name}

            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}

          />

        </label>

        <label className="block text-xs text-gray-400">

          {t('admin.sponsors.fieldPlacement')}

          <select

            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

            value={form.placement}

            onChange={(e) =>

              setForm((f) => ({ ...f, placement: e.target.value as SponsorPlacement }))

            }

          >

            {PLACEMENT_OPTIONS.map((p) => (

              <option key={p} value={p}>

                {placementLabel(p)}

              </option>

            ))}

          </select>

        </label>

      </div>



      {form.placement === 'map_banner' && (

        <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a] px-3 py-3 space-y-3">

          <p className="text-xs font-semibold text-gray-300">{t('admin.sponsors.mapVisibilityTitle')}</p>

          <fieldset className="space-y-2">

            <legend className="sr-only">{t('admin.sponsors.mapVisibilityTitle')}</legend>

            <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer">

              <input

                type="radio"

                name={`${formId}-map-scope`}

                checked={form.mapVisibilityScope === 'france'}

                onChange={() => setForm((f) => ({ ...f, mapVisibilityScope: 'france' }))}

                className="mt-0.5"

              />

              <span>

                <span className="font-semibold text-white block">{t('admin.sponsors.mapScopeFrance')}</span>

                <span className="text-gray-500">{t('admin.sponsors.mapScopeFranceHint')}</span>

              </span>

            </label>

            <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer">

              <input

                type="radio"

                name={`${formId}-map-scope`}

                checked={form.mapVisibilityScope === 'region'}

                onChange={() => setForm((f) => ({ ...f, mapVisibilityScope: 'region' }))}

                className="mt-0.5"

              />

              <span>

                <span className="font-semibold text-white block">{t('admin.sponsors.mapScopeRegion')}</span>

                <span className="text-gray-500">{t('admin.sponsors.mapScopeRegionHint', { minZoom: MAP_REGION_MIN_ZOOM })}</span>

              </span>

            </label>

          </fieldset>



          {form.mapVisibilityScope === 'region' && (

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">

              <label className="block text-xs text-gray-400 sm:col-span-3">

                {t('admin.sponsors.fieldMapTargetRegion')}

                <SponsorRegionAutocomplete

                  value={form.mapTargetRegionName}

                  onChange={(name) => setForm((f) => ({ ...f, mapTargetRegionName: name }))}

                  onSelect={(suggestion) =>
                    setForm((f) => ({
                      ...f,
                      mapTargetRegionName: suggestion.value,
                      mapTargetLat:
                        suggestion.latitude != null ? String(suggestion.latitude) : f.mapTargetLat,
                      mapTargetLng:
                        suggestion.longitude != null ? String(suggestion.longitude) : f.mapTargetLng,
                    }))
                  }

                  placeholder={t('admin.sponsors.fieldMapTargetRegionPlaceholder')}

                />

              </label>

              <label className="block text-xs text-gray-400">

                {t('admin.sponsors.fieldMapTargetLat')}

                <input

                  type="number"

                  step="any"

                  className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

                  value={form.mapTargetLat}

                  onChange={(e) => setForm((f) => ({ ...f, mapTargetLat: e.target.value }))}

                  placeholder="43.6489"

                />

              </label>

              <label className="block text-xs text-gray-400">

                {t('admin.sponsors.fieldMapTargetLng')}

                <input

                  type="number"

                  step="any"

                  className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

                  value={form.mapTargetLng}

                  onChange={(e) => setForm((f) => ({ ...f, mapTargetLng: e.target.value }))}

                  placeholder="3.8567"

                />

              </label>

              <p className="text-[11px] text-gray-500 sm:col-span-3">
                {t('admin.sponsors.mapScopeRegionCoordsHint', {
                  minZoom: MAP_REGION_MIN_ZOOM,
                })}
              </p>

            </div>

          )}

          <SponsorBannerUploadField
            token={token}
            bannerImageUrl={form.bannerImageUrl}
            onBannerImageUrlChange={(url) => setForm((f) => ({ ...f, bannerImageUrl: url }))}
            inputId={`${formId}-banner`}
          />

          <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.bannerDisplayMode === 'image_only'}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  bannerDisplayMode: e.target.checked ? 'image_only' : 'full',
                }))
              }
              className="mt-0.5 rounded border-[#2d2d3d]"
            />
            <span>
              <span className="font-semibold text-white block">{t('admin.sponsors.fieldBannerImageOnly')}</span>
              <span className="text-gray-500">{t('admin.sponsors.fieldBannerImageOnlyHint')}</span>
            </span>
          </label>

          <label className="block text-xs text-gray-400">
            {t('admin.sponsors.fieldLinkUrl')}
            {isMapImageOnly && <span className="text-amber-400/90"> *</span>}
            <input
              className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
              value={form.linkUrl}
              onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
              placeholder="https://…"
            />
            {isMapImageOnly && (
              <span className="text-[10px] text-gray-500 mt-0.5 block">
                {t('admin.sponsors.fieldLinkUrlImageOnlyHint')}
              </span>
            )}
          </label>

        </div>

      )}



      <div className="rounded-xl border border-[#2d2d3d] bg-[#0b0b0f] p-3 space-y-2">

        <p className="text-xs font-semibold text-purple-300">{t('admin.sponsors.previewTitle')}</p>

        <SponsorAdPreview

          placement={form.placement}

          name={form.name}

          title={form.title}

          subtitle={form.subtitle}

          cta={form.cta}

          accent={form.accent || undefined}

          bannerDisplayMode={form.bannerDisplayMode}

          kind={form.kind}

          logoUrl={form.logoUrl || undefined}

          bannerImageUrl={form.bannerImageUrl || undefined}

          videoUrl={form.videoUrl || undefined}

          posterUrl={form.posterUrl || undefined}

          displayDurationSec={displayDurationSec}

        />

      </div>



      <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a] px-3 py-2.5 text-[11px] text-gray-400 space-y-1">

        <p className="font-semibold text-gray-300">{t('admin.sponsors.imageHelpTitle')}</p>

        <p>

          {t('admin.sponsors.imageHelpLogo')}: <span className="text-gray-300">{imageSpec.logoPx}</span>

        </p>

        {imageSpec.bannerPx && (

          <p>

            {t('admin.sponsors.imageHelpBanner')}:{' '}

            <span className="text-gray-300">{imageSpec.bannerPx}</span>

          </p>

        )}

        {imageSpec.ratio && (

          <p>

            {t('admin.sponsors.imageHelpRatio')}:{' '}

            <span className="text-gray-300">{imageSpec.ratio}</span>

          </p>

        )}

        <p className="text-gray-500">{t(imageSpec.noteKey)}</p>

      </div>



      <label className="block text-xs text-gray-400">

        {t('admin.sponsors.fieldTitle')}

        {isMapImageOnly && <span className="text-gray-500"> ({t('admin.sponsors.fieldAdminOnly')})</span>}

        <input

          className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

          value={form.title}

          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}

        />

      </label>

      {!isMapImageOnly && (
      <label className="block text-xs text-gray-400">

        {t('admin.sponsors.fieldSubtitle')}

        <textarea

          className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white min-h-[4rem]"

          value={form.subtitle}

          onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}

        />

      </label>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

        {!isMapImageOnly && (
        <label className="block text-xs text-gray-400">

          {t('admin.sponsors.fieldCta')}

          <input

            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

            value={form.cta}

            onChange={(e) => setForm((f) => ({ ...f, cta: e.target.value }))}

          />

        </label>
        )}

        <label className="block text-xs text-gray-400">

          {t('admin.sponsors.fieldKind')}

          <select

            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

            value={form.kind}

            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as SponsorKind }))}

          >

            {KIND_OPTIONS.map((k) => (

              <option key={k} value={k}>

                {t(`admin.sponsors.kind.${k}`)}

              </option>

            ))}

          </select>

        </label>

      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

        <SponsorLogoUploadField

          token={token}

          logoUrl={form.logoUrl}

          onLogoUrlChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}

          inputId={`${formId}-logo`}

        />

        {form.placement !== 'map_banner' && (
        <label className="block text-xs text-gray-400">

          {t('admin.sponsors.fieldLinkUrl')}

          <input

            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

            value={form.linkUrl}

            onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}

            placeholder="https://…"

          />

        </label>
        )}

      </div>

      {form.placement === 'reels_sponsored' && (

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

          <label className="block text-xs text-gray-400">

            {t('admin.sponsors.fieldVideoUrl')}

            <input

              className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

              value={form.videoUrl}

              onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}

              placeholder="https://…/video.mp4"

            />

          </label>

          <label className="block text-xs text-gray-400">

            {t('admin.sponsors.fieldPosterUrl')}

            <input

              className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

              value={form.posterUrl}

              onChange={(e) => setForm((f) => ({ ...f, posterUrl: e.target.value }))}

              placeholder="https://…/poster.jpg"

            />

          </label>

        </div>

      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

        <label className="block text-xs text-gray-400">

          {t('admin.sponsors.fieldAccent')}

          {form.placement === 'map_banner' && (
            <span className="text-gray-500 font-normal"> ({t('admin.sponsors.fieldAccentOptional')})</span>
          )}

          <select

            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

            value={form.placement === 'map_banner' ? form.accent : form.accent || 'purple'}

            onChange={(e) => setForm((f) => ({ ...f, accent: e.target.value as FormState['accent'] }))}

          >

            {form.placement === 'map_banner' && (
              <option value="">{t('admin.sponsors.fieldAccentNone')}</option>
            )}

            {ACCENT_OPTIONS.map((a) => (

              <option key={a} value={a}>

                {a}

              </option>

            ))}

          </select>

          {form.placement === 'map_banner' && isMapImageOnly && (
            <span className="text-[10px] text-gray-500 mt-0.5 block">
              {t('admin.sponsors.fieldAccentImageOnlyHint')}
            </span>
          )}

        </label>

        <label className="block text-xs text-gray-400">

          {t('admin.sponsors.fieldDisplayDuration')}

          <input

            type="number"

            min={SPONSOR_DISPLAY_DURATION_MIN_SEC}

            max={SPONSOR_DISPLAY_DURATION_MAX_SEC}

            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

            value={form.displayDurationSec}

            onChange={(e) => setForm((f) => ({ ...f, displayDurationSec: e.target.value }))}

          />

          <span className="text-[10px] text-gray-500 mt-0.5 block">

            {t('admin.sponsors.fieldDisplayDurationHint', {

              min: SPONSOR_DISPLAY_DURATION_MIN_SEC,

              max: SPONSOR_DISPLAY_DURATION_MAX_SEC,

              default: DEFAULT_DISPLAY_DURATION_SEC,

            })}

          </span>

        </label>

        <label className="block text-xs text-gray-400">

          {t('admin.sponsors.fieldAction')}

          <select

            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

            value={form.actionId}

            onChange={(e) =>

              setForm((f) => ({ ...f, actionId: e.target.value as FormState['actionId'] }))

            }

          >

            <option value="">{t('admin.sponsors.actionNone')}</option>

            <option value="salon">{t('admin.sponsors.actionSalon')}</option>

            <option value="live">{t('admin.sponsors.actionLive')}</option>

          </select>

        </label>

      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

        <label className="block text-xs text-gray-400">

          {t('admin.sponsors.fieldStartsAt')}

          <input

            type="datetime-local"

            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

            value={form.startsAt}

            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}

          />

        </label>

        <label className="block text-xs text-gray-400">

          {t('admin.sponsors.fieldEndsAt')}

          <input

            type="datetime-local"

            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"

            value={form.endsAt}

            onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}

          />

        </label>

      </div>

      <button

        type="submit"

        disabled={isSubmitBusy}

        className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-medium disabled:opacity-50"

      >

        {opts.mode === 'edit' ? t('admin.sponsors.save') : t('admin.sponsors.create')}

      </button>

    </form>

    );

  };



  return (

    <div className="space-y-4">

      <div>

        <h2 className="font-semibold text-purple-300">{t('admin.sponsors.title')}</h2>

        <p className="text-xs text-gray-400 mt-1">{t('admin.sponsors.subtitle')}</p>

      </div>



      <SponsorsSubTabBar subTab={placementTab} onChange={handlePlacementTabChange} t={t} />



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



      <div className="grid grid-cols-3 gap-2 text-center text-xs">

        <div className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-3">

          <div className="text-xl font-bold text-white">{counts.total}</div>

          <div className="text-gray-500">{t('admin.sponsors.statsTotal')}</div>

        </div>

        <div className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-3">

          <div className="text-xl font-bold text-green-400">{counts.active}</div>

          <div className="text-gray-500">{t('admin.sponsors.statsActive')}</div>

        </div>

        <div className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-3">

          <div className="text-xl font-bold text-gray-400">{counts.inactive}</div>

          <div className="text-gray-500">{t('admin.sponsors.statsInactive')}</div>

        </div>

      </div>



      <div className="flex flex-wrap gap-2">

        {FILTER_OPTIONS.map((f) => (

          <button

            key={f}

            type="button"

            onClick={() => setFilter(f)}

            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${

              filter === f ? 'bg-purple-600 text-white' : 'bg-[#1a1a26] text-gray-400'

            }`}

          >

            {filterLabel(f)}

          </button>

        ))}

      </div>



      <input

        className="w-full bg-[#12121a] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm"

        placeholder={t('admin.sponsors.searchPlaceholder')}

        value={search}

        onChange={(e) => setSearch(e.target.value)}

      />



      <button

        type="button"

        onClick={openCreateForm}

        className="w-full py-2.5 rounded-xl bg-[#1a1a26] border border-purple-500/40 text-purple-300 text-sm font-medium"

      >

        {showCreate ? t('admin.sponsors.cancelCreate') : t('admin.sponsors.add')}

      </button>



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

                    <p className="text-sm text-white mt-1 truncate">{sponsor.title}</p>

                    <p className="text-xs text-gray-400 line-clamp-2">{sponsor.subtitle}</p>

                    <p className="text-[10px] text-gray-600 mt-1">

                      #{sponsor.priority + 1} · {t(`admin.sponsors.kind.${sponsor.kind}`)}

                      {sponsor.displayDurationSec != null

                        ? ` · ${sponsor.displayDurationSec} s`

                        : ''}

                      {sponsor.startsAt || sponsor.endsAt

                        ? ` · ${formatDateTime(sponsor.startsAt, locale)} → ${formatDateTime(sponsor.endsAt, locale)}`

                        : ''}

                      {sponsor.placement === 'map_banner' && sponsor.bannerDisplayMode === 'image_only'

                        ? ` · ${t('admin.sponsors.bannerModeImageOnlyBadge')}`

                        : ''}

                      {sponsor.placement === 'map_banner'

                        ? sponsor.mapVisibilityScope === 'region'

                          ? ` · ${t('admin.sponsors.mapScopeRegionBadge', { region: sponsor.mapTargetRegionName ?? '—' })}`

                          : ` · ${t('admin.sponsors.mapScopeFranceBadge')}`

                        : ''}

                    </p>

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

                        setForm(sponsorToForm(sponsor));

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

    </div>

  );

}


