import { memo, type ReactNode } from 'react';

import { useTranslation } from 'react-i18next';

import { computeAgeFromBirthDate, formatBirthDate } from '../lib/profileAge';

import { UsernameDisplay } from './UsernameDisplay';

import { ProfileIdentityLines } from './ProfileIdentityLines';

import { UserAvatarOnline } from './UserAvatarOnline';

import type { RelationshipStatus } from '../types';

import {

  getRelationshipDisplayLabel,

  getRelationshipEmoji,

} from '../lib/relationshipStatus';



interface ProfileHeaderSectionProps {

  userId: string;

  username: string;

  usernameColor?: string;

  usernameWaveFrom?: string;

  usernameWaveTo?: string;

  avatarUrl?: string;

  profileType?: string;

  city?: string;

  birthDate?: string;

  age?: number | null;

  /** true = masquer la date complète, afficher l'âge (hideBirthDateOnProfile) */
  hideBirthDateOnProfile?: boolean;

  showAgeHiddenHint?: boolean;

  relationshipStatus?: RelationshipStatus;

  relationshipStatusCustom?: string;

  favoritesCount?: number | null;

  isLive?: boolean;

  liveViewersCount?: number;

  isSupporter?: boolean;

  supporterTier?: string;

  /** classic = bannière + avatar latéral ; compact = style TikTok centré */

  variant?: 'classic' | 'compact';

  /** En lecture : ouvre la photo principale en grand au clic sur l'avatar */

  onAvatarClick?: () => void;

  /** Ligne stats 3 colonnes (sous le pseudo) */

  statsRow?: ReactNode;

  /** Bio courte sous les stats */

  bio?: ReactNode;

  /** Bouton Modifier / Annuler */

  action?: ReactNode;

  extraMeta?: ReactNode;

  /** Badge note host (★ + moyenne) à côté du pseudo */
  hostRatingSlot?: ReactNode;

  /** Action en haut à droite (ex. engrenage paramètres) */
  topRightAction?: ReactNode;

}



export const ProfileHeaderSection = memo(function ProfileHeaderSection({

  userId,

  username,

  usernameColor,

  usernameWaveFrom,

  usernameWaveTo,

  avatarUrl,

  profileType,

  city,

  birthDate,

  age,

  hideBirthDateOnProfile = false,

  showAgeHiddenHint = false,

  relationshipStatus,

  relationshipStatusCustom,

  favoritesCount: _favoritesCount,

  isLive,

  liveViewersCount,

  isSupporter,

  supporterTier,

  variant = 'compact',

  onAvatarClick,

  statsRow,

  bio,

  action,

  extraMeta,

  hostRatingSlot,

  topRightAction,

}: ProfileHeaderSectionProps) {

  const { t, i18n } = useTranslation();



  const metaItems: ReactNode[] = [];



  const metaChipClass =
    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1a1a26]/70 backdrop-blur-sm border border-white/[0.06] text-gray-400 text-[11px] font-medium';

  if (city?.trim()) {
    metaItems.push(
      <span key="city" className={metaChipClass}>
        <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.5 7-10a7 7 0 10-14 0c0 5.5 7 10 7 10z" />
        </svg>
        {city.trim()}
      </span>
    );
  }



  const birthDateTrimmed = birthDate?.trim() ?? '';
  const resolvedAge =
    age ?? (birthDateTrimmed ? computeAgeFromBirthDate(birthDateTrimmed) : null);
  const showFullBirthDate = Boolean(birthDateTrimmed) && !hideBirthDateOnProfile;

  if (showFullBirthDate) {
    const formatted =
      formatBirthDate(birthDateTrimmed, i18n.language) ?? birthDateTrimmed;

    metaItems.push(
      <span key="birth" className={metaChipClass}>
        <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
        </svg>
        {formatted}
      </span>
    );
  } else if (resolvedAge != null) {
    metaItems.push(
      <span key="age" className={metaChipClass}>
        <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
        </svg>
        {t('profile.ageYears', { count: resolvedAge })}
        {showAgeHiddenHint && (
          <span className="text-gray-500"> {t('profile.ageHiddenHint')}</span>
        )}
      </span>
    );
  }



  if (relationshipStatus && relationshipStatus !== 'autre') {

    const relationshipLabels = {

      celibataire: t('profile.relationshipSingle'),

      en_couple: t('profile.relationshipCouple'),

    } as const;

    metaItems.push(
      <span
        key="rel"
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/25 text-pink-200/90 text-[11px] font-medium whitespace-nowrap"
      >
        {getRelationshipEmoji(relationshipStatus)}{' '}
        {getRelationshipDisplayLabel(
          relationshipStatus,
          relationshipStatusCustom,
          relationshipLabels
        )}
      </span>
    );

  }



  const avatarNode = (

    <UserAvatarOnline

      userId={userId}

      username={username}

      avatarUrl={avatarUrl}

      size={variant === 'compact' ? 'hero' : 'profile'}

      isLive={isLive}

      liveViewersCount={liveViewersCount}

    />

  );



  if (variant === 'compact') {
    return (
      <div className="relative shrink-0 overflow-visible">
        <div className="relative h-24 sm:h-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/85 via-[#150d2b] to-pink-900/45" />
          <div
            className="absolute -top-10 left-[18%] w-36 h-36 rounded-full bg-purple-500/25 blur-3xl"
            aria-hidden
          />
          <div
            className="absolute -top-6 right-[15%] w-28 h-28 rounded-full bg-pink-500/20 blur-3xl"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0b0b0f] to-transparent" />
        </div>

        {topRightAction ? (
          <div className="absolute right-3 top-3 z-30">{topRightAction}</div>
        ) : null}

        <div className="relative px-4 pb-4 -mt-[3.25rem] sm:-mt-14 flex flex-col items-center text-center overflow-visible">
          {action ? (
            <div className="absolute right-4 top-0 z-20">{action}</div>
          ) : null}

          {onAvatarClick ? (
            <button
              type="button"
              onClick={onAvatarClick}
              className="shrink-0 rounded-full ring-2 ring-[#1e1e2f] cursor-pointer transition hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              aria-label="Voir la photo de profil"
            >
              <div className="rounded-full ring-[3px] ring-[#0b0b0f]">{avatarNode}</div>
            </button>
          ) : (
            <div className="shrink-0 rounded-full ring-2 ring-[#1e1e2f]">
              <div className="rounded-full ring-[3px] ring-[#0b0b0f]">{avatarNode}</div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-center gap-1.5 max-w-full flex-wrap">
            <UsernameDisplay
              as="h1"
              username={username}
              usernameColor={usernameColor}
              usernameWaveFrom={usernameWaveFrom}
              usernameWaveTo={usernameWaveTo}
              className="text-xl sm:text-2xl font-extrabold leading-tight tracking-tight break-words"
            />
            {hostRatingSlot}
          </div>

          {(profileType || isSupporter) && (
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
              <ProfileIdentityLines profileType={profileType} />
              {isSupporter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-200 border border-amber-500/40">
                  <span aria-hidden>⭐</span>
                  Supporter{supporterTier ? ` · ${supporterTier}` : ''}
                </span>
              )}
            </div>
          )}

          {metaItems.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-2.5 max-w-full">
              {metaItems}
            </div>
          )}

          {statsRow}

          {bio ? (
            <div className="mt-3 w-full max-w-sm rounded-2xl border border-[#1e1e2f] bg-[#12121a]/55 px-4 py-3 text-left">
              <div className="text-sm text-gray-300 leading-relaxed line-clamp-4">{bio}</div>
            </div>
          ) : null}

          {extraMeta}
        </div>
      </div>
    );
  }



  return (

    <div className="relative shrink-0 overflow-visible">

      {topRightAction ? (
        <div
          className="absolute right-3 z-30"
          style={{ top: 'max(0.75rem, calc(var(--app-header-total-h, 3.5rem) + 0.5rem))' }}
        >
          {topRightAction}
        </div>
      ) : null}

      <div className="h-24 sm:h-28 bg-gradient-to-br from-purple-900/80 via-[#1a1035] to-pink-900/40" />

      <div className="px-4 pb-4 -mt-12 sm:-mt-14">

        <div className="flex gap-3 sm:gap-4 items-start">

          <div className="shrink-0 rounded-full ring-4 ring-[#0b0b0f] shadow-lg shadow-purple-950/50 mt-1">

            {avatarNode}

          </div>

          <div className="min-w-0 flex-1 pt-1 sm:pt-2">

            <div className="flex items-start justify-between gap-2">

              <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">

                <UsernameDisplay

                  as="h1"

                  username={username}

                  usernameColor={usernameColor}

                  usernameWaveFrom={usernameWaveFrom}

                  usernameWaveTo={usernameWaveTo}

                  className="text-xl sm:text-2xl font-extrabold leading-tight break-words"

                />

                {hostRatingSlot}

              </div>

              {action && <div className="shrink-0 pt-0.5">{action}</div>}

            </div>

            <ProfileIdentityLines profileType={profileType} className="mt-1.5" />

            {isSupporter && (

              <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-200 border border-amber-500/40">

                ⭐ Supporter{supporterTier ? ` · ${supporterTier}` : ''}

              </span>

            )}

            {metaItems.length > 0 && (

              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs leading-relaxed">

                {metaItems}

              </div>

            )}

            {extraMeta}

          </div>

        </div>

      </div>

    </div>

  );

});

