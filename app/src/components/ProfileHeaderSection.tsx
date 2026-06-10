import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBirthDate } from '../lib/profileAge';
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
  /** Anneau dégradé si plusieurs photos de profil */
  hasPhotoGallery?: boolean;
  /** Ligne stats 3 colonnes (sous le pseudo) */
  statsRow?: ReactNode;
  /** Bio courte sous les stats */
  bio?: ReactNode;
  /** Bouton Modifier / Annuler */
  action?: ReactNode;
  extraMeta?: ReactNode;
}

export function ProfileHeaderSection({
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
  showAgeHiddenHint = false,
  relationshipStatus,
  relationshipStatusCustom,
  favoritesCount: _favoritesCount,
  isLive,
  liveViewersCount,
  isSupporter,
  supporterTier,
  variant = 'compact',
  hasPhotoGallery = false,
  statsRow,
  bio,
  action,
  extraMeta,
}: ProfileHeaderSectionProps) {
  const { t, i18n } = useTranslation();

  const metaItems: ReactNode[] = [];

  if (city?.trim()) {
    metaItems.push(
      <span
        key="city"
        className="inline-flex items-center gap-0.5 text-gray-400 whitespace-nowrap text-[11px]"
      >
        📍 {city.trim()}
      </span>
    );
  }

  if (birthDate?.trim()) {
    const formatted = formatBirthDate(birthDate.trim(), i18n.language) ?? birthDate.trim();
    metaItems.push(
      <span
        key="birth"
        className="inline-flex items-center gap-0.5 text-gray-400 whitespace-nowrap text-[11px]"
      >
        🎂 {formatted}
        {showAgeHiddenHint && (
          <span className="text-gray-500"> {t('profile.ageHiddenHint')}</span>
        )}
      </span>
    );
  } else if (age != null) {
    metaItems.push(
      <span
        key="age"
        className="inline-flex items-center gap-0.5 text-gray-400 whitespace-nowrap text-[11px]"
      >
        🎂 {age} ans
      </span>
    );
  }

  if (relationshipStatus) {
    const relationshipLabels: Record<RelationshipStatus, string> = {
      celibataire: t('profile.relationshipSingle'),
      en_couple: t('profile.relationshipCouple'),
      autre: t('profile.relationshipOther'),
    };
    metaItems.push(
      <span
        key="rel"
        className="inline-flex items-center gap-0.5 text-pink-300/90 whitespace-nowrap text-[11px]"
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
      <div className="relative shrink-0 bg-[#0b0b0f]">
        <div className="px-4 pt-12 pb-3 flex flex-col items-center text-center">
          <div
            className={`shrink-0 rounded-full ${
              hasPhotoGallery
                ? 'p-[3px] bg-gradient-to-tr from-purple-500 via-pink-500 to-purple-400 shadow-lg shadow-purple-900/40'
                : 'ring-2 ring-[#1e1e2f]'
            }`}
          >
            <div className="rounded-full ring-2 ring-[#0b0b0f]">{avatarNode}</div>
          </div>

          <UsernameDisplay
            as="h1"
            username={username}
            usernameColor={usernameColor}
            usernameWaveFrom={usernameWaveFrom}
            usernameWaveTo={usernameWaveTo}
            className="mt-3 text-lg sm:text-xl font-extrabold leading-tight break-words max-w-full"
          />

          <ProfileIdentityLines profileType={profileType} className="mt-1" />

          {isSupporter && (
            <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-200 border border-amber-500/40">
              ⭐ Supporter{supporterTier ? ` · ${supporterTier}` : ''}
            </span>
          )}

          {metaItems.length > 0 && (
            <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-2 max-w-full">
              {metaItems}
            </div>
          )}

          {statsRow}

          {bio ? <div className="mt-2.5 w-full max-w-sm text-sm text-gray-300 leading-snug">{bio}</div> : null}

          {action ? <div className="mt-3 w-full max-w-xs">{action}</div> : null}

          {extraMeta}
        </div>
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <div className="h-24 sm:h-28 bg-gradient-to-br from-purple-900/80 via-[#1a1035] to-pink-900/40" />
      <div className="px-4 pb-4 -mt-12 sm:-mt-14">
        <div className="flex gap-3 sm:gap-4 items-start">
          <div className="shrink-0 rounded-full ring-4 ring-[#0b0b0f] shadow-lg shadow-purple-950/50 mt-1">
            {avatarNode}
          </div>
          <div className="min-w-0 flex-1 pt-1 sm:pt-2">
            <div className="flex items-start justify-between gap-2">
              <UsernameDisplay
                as="h1"
                username={username}
                usernameColor={usernameColor}
                usernameWaveFrom={usernameWaveFrom}
                usernameWaveTo={usernameWaveTo}
                className="text-xl sm:text-2xl font-extrabold leading-tight break-words min-w-0 flex-1"
              />
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
}
