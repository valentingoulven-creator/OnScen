import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { SponsorRegionAutocomplete } from './SponsorRegionAutocomplete';
import { SponsorBannerUploadField } from './SponsorBannerUploadField';
import { SponsorLogoUploadField } from './SponsorLogoUploadField';
import { SponsorAdPreview } from './SponsorAdPreview';
import { SponsorAudienceEstimatePanel } from './SponsorAudienceEstimatePanel';
import { MAP_REGION_MIN_ZOOM } from '../lib/sponsorAds';
import {
  DEFAULT_DISPLAY_DURATION_SEC,
  SPONSOR_DISPLAY_DURATION_MAX_SEC,
  SPONSOR_DISPLAY_DURATION_MIN_SEC,
  SPONSOR_IMAGE_SPECS,
  normalizeDisplayDurationSec,
} from '../lib/sponsorDisplaySpec';
import {
  computeDisplayDaysFromForm,
  type SponsorAdminFormState,
} from '../lib/sponsorAdminForm';
import { resolveSponsorLogoSrc } from '../lib/sponsorLogoUpload';
import type { SponsorBannerDisplayMode, SponsorPlacement } from '../types';

const PLACEMENT_OPTIONS: SponsorPlacement[] = [
  'map_banner',
  'map_sidebar_events',
  'feed_inline',
  'stories_banner',
  'stories_sponsored',
  'reels_sponsored',
  'salon_theater',
];

export function sponsorFormPreviewProps(form: SponsorAdminFormState) {
  const isMap = form.placement === 'map_banner';
  const name = form.name.trim();
  const description = form.description.trim();
  const bannerDisplayMode: SponsorBannerDisplayMode = isMap ? 'image_only' : 'full';
  return {
    placement: form.placement,
    name,
    title: name || 'Titre du bandeau',
    subtitle: description || name || 'Sous-titre descriptif',
    cta: isMap ? 'Voir' : 'En savoir plus',
    kind: 'sponsored' as const,
    bannerDisplayMode,
    logoUrl: form.logoUrl.trim() ? resolveSponsorLogoSrc(form.logoUrl) : undefined,
    bannerImageUrl: form.bannerImageUrl.trim() || undefined,
    videoUrl: form.videoUrl.trim() || undefined,
    posterUrl: form.posterUrl.trim() || undefined,
    displayDurationSec: normalizeDisplayDurationSec(form.displayDurationSec),
  };
}

export interface SponsorAdminFormFieldsProps {
  formId: string;
  form: SponsorAdminFormState;
  setForm: Dispatch<SetStateAction<SponsorAdminFormState>>;
  formError?: string;
  isSubmitBusy?: boolean;
  submitLabel: string;
  onSubmit: () => void | Promise<void>;
  lockPlacement?: SponsorPlacement;
  linkedEventPostIdReadOnly?: boolean;
  linkedReelIdReadOnly?: boolean;
  secondaryAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
  };
}

/** Champs du formulaire admin sponsor (création / édition). */
export function SponsorAdminFormFields({
  formId,
  form,
  setForm,
  formError,
  isSubmitBusy = false,
  submitLabel,
  onSubmit,
  lockPlacement,
  linkedEventPostIdReadOnly = false,
  linkedReelIdReadOnly = false,
  secondaryAction,
}: SponsorAdminFormFieldsProps) {
  const { t } = useTranslation();
  const placement = lockPlacement ?? form.placement;
  const showMapBanner = placement === 'map_banner';
  const showMapSidebarEvents = placement === 'map_sidebar_events';
  const showReelsSponsored = placement === 'reels_sponsored';
  const showStoriesBanner = placement === 'stories_banner';
  const imageSpec = SPONSOR_IMAGE_SPECS[placement];

  const placementLabel = (p: SponsorPlacement) => t(`admin.sponsors.placement.${p}`);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit();
  };

  return (
    <form id={formId} noValidate onSubmit={handleSubmit} className="space-y-4">
      {formError ? (
        <p
          role="alert"
          className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2"
        >
          {formError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs text-gray-400">
          {t('admin.sponsors.fieldName')}
          <input
            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        {lockPlacement ? (
          <div className="block text-xs text-gray-400">
            {t('admin.sponsors.fieldPlacement')}
            <p className="mt-1 rounded-xl border border-purple-500/25 bg-purple-950/20 px-3 py-2 text-sm text-purple-100">
              {placementLabel(lockPlacement)}
            </p>
          </div>
        ) : (
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
        )}
      </div>

      {showMapBanner && (
        <fieldset className="rounded-xl border border-[#1e1e2f] bg-[#0b0b0f] px-3 py-3 space-y-2">
          <legend className="text-xs font-semibold text-gray-300 px-1">
            {t('admin.sponsors.mapVisibilityTitle')}
          </legend>
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
              <span className="text-gray-500">
                {t('admin.sponsors.mapScopeRegionHint', { minZoom: MAP_REGION_MIN_ZOOM })}
              </span>
            </span>
          </label>
          {form.mapVisibilityScope === 'region' && (
            <label className="block text-xs text-gray-400 pt-1">
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
          )}
        </fieldset>
      )}

      {showMapSidebarEvents &&
        (linkedEventPostIdReadOnly ? (
          <div className="block text-xs text-gray-400">
            {t('admin.sponsors.fieldLinkedEventPostId')}
            <p className="mt-1 rounded-xl border border-[#2d2d3d] bg-[#1a1a26] px-3 py-2 text-sm text-white font-mono break-all">
              {form.linkedEventPostId}
            </p>
          </div>
        ) : (
          <label className="block text-xs text-gray-400">
            {t('admin.sponsors.fieldLinkedEventPostId')}
            <span className="text-amber-400/90"> *</span>
            <input
              className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white font-mono"
              value={form.linkedEventPostId}
              onChange={(e) => setForm((f) => ({ ...f, linkedEventPostId: e.target.value }))}
              placeholder={t('admin.sponsors.fieldLinkedEventPostIdPlaceholder')}
            />
            <p className="text-[10px] text-gray-500 mt-1">{t('admin.sponsors.helpLinkedEventPostId')}</p>
          </label>
        ))}

      {showReelsSponsored &&
        (linkedReelIdReadOnly ? (
          <div className="block text-xs text-gray-400">
            {t('admin.sponsors.fieldLinkedReelId')}
            <p className="mt-1 rounded-xl border border-[#2d2d3d] bg-[#1a1a26] px-3 py-2 text-sm text-white font-mono break-all">
              {form.linkedReelId}
            </p>
          </div>
        ) : (
          <label className="block text-xs text-gray-400">
            {t('admin.sponsors.fieldLinkedReelId')}
            <input
              className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white font-mono"
              value={form.linkedReelId}
              onChange={(e) => setForm((f) => ({ ...f, linkedReelId: e.target.value }))}
              placeholder={t('admin.sponsors.fieldLinkedReelIdPlaceholder')}
            />
          </label>
        ))}

      {placement !== 'map_sidebar_events' && (
        <SponsorLogoUploadField
          logoUrl={form.logoUrl}
          onLogoUrlChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
          inputId={`${formId}-logo`}
        />
      )}

      {(showMapBanner || showStoriesBanner) && (
        <div className="space-y-1">
          <SponsorBannerUploadField
            bannerImageUrl={form.bannerImageUrl}
            onBannerImageUrlChange={(url) => setForm((f) => ({ ...f, bannerImageUrl: url }))}
            inputId={`${formId}-banner`}
          />
          <p className="text-[10px] text-gray-500 px-1">
            {imageSpec.bannerPx && (
              <>
                {t('admin.sponsors.imageHelpBanner')}: {imageSpec.bannerPx}
                {imageSpec.ratio ? ` · ${imageSpec.ratio}` : ''}
              </>
            )}
          </p>
        </div>
      )}

      {(placement === 'reels_sponsored' || placement === 'stories_sponsored') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <p className="text-[10px] text-gray-500 sm:col-span-2">{t(imageSpec.noteKey)}</p>
        </div>
      )}

      <label className="block text-xs text-gray-400">
        {t('admin.sponsors.fieldDescription')}
        <textarea
          className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white min-h-[4.5rem] resize-y"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder={t('admin.sponsors.fieldDescriptionPlaceholder')}
        />
      </label>

      <label className="block text-xs text-gray-400">
        {t('admin.sponsors.fieldLinkUrl')}
        {!showMapSidebarEvents ? <span className="text-amber-400/90"> *</span> : null}
        <input
          className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
          value={form.linkUrl}
          onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
          placeholder="https://…"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs text-gray-400">
          {t('admin.sponsors.fieldStartsAt')}
          <input
            type="datetime-local"
            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
            value={form.startsAt}
            onChange={(e) => {
              const startsAt = e.target.value;
              setForm((f) => ({
                ...f,
                startsAt,
                displayDays: computeDisplayDaysFromForm(startsAt, f.endsAt),
              }));
            }}
          />
        </label>

        <label className="block text-xs text-gray-400">
          {t('admin.sponsors.fieldEndsAt')}
          <input
            type="datetime-local"
            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
            value={form.endsAt}
            onChange={(e) => {
              const endsAt = e.target.value;
              setForm((f) => ({
                ...f,
                endsAt,
                displayDays: computeDisplayDaysFromForm(f.startsAt, endsAt),
              }));
            }}
          />
        </label>
      </div>

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
          {t('admin.sponsors.fieldDisplayDurationRotationHint', {
            min: SPONSOR_DISPLAY_DURATION_MIN_SEC,
            max: SPONSOR_DISPLAY_DURATION_MAX_SEC,
            default: DEFAULT_DISPLAY_DURATION_SEC,
          })}
        </span>
      </label>

      <SponsorAudienceEstimatePanel form={form} />

      <section className="rounded-xl border border-[#1e1e2f] bg-[#0b0b0f] p-3 space-y-3">
        <p className="text-xs font-semibold text-purple-300">{t('admin.sponsors.previewTitle')}</p>
        {placement === 'map_sidebar_events' ? (
          <div className="rounded-xl border border-dashed border-purple-500/30 bg-[#12121a] p-4 text-center space-y-2">
            <p className="text-sm font-semibold text-white">
              {form.name.trim() || t('admin.sponsors.newSponsor')}
            </p>
            <p className="text-xs text-gray-400">
              {form.linkedEventPostId.trim()
                ? t('admin.sponsors.previewMapSidebarEvent', {
                    id: form.linkedEventPostId.trim(),
                  })
                : t('admin.sponsors.previewMapSidebarEventEmpty')}
            </p>
          </div>
        ) : (
          <SponsorAdPreview {...sponsorFormPreviewProps(form)} />
        )}
      </section>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="submit"
          disabled={isSubmitBusy}
          className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-medium disabled:opacity-50 min-h-[44px]"
        >
          {submitLabel}
        </button>
        {secondaryAction ? (
          <button
            type="button"
            disabled={isSubmitBusy || secondaryAction.disabled}
            onClick={() => void secondaryAction.onClick()}
            className="py-2.5 px-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-sm font-medium disabled:opacity-50 min-h-[44px]"
          >
            {secondaryAction.label}
          </button>
        ) : null}
      </div>
    </form>
  );
}
