import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { canJoinSalonAsParticipant, salonParticipantAccessMessageKey } from '../lib/platformConnect';
import { PlatformConnectCard } from './PlatformConnectCard';
import { SpotifySalonDeprecatedNotice } from './SpotifySalonDeprecatedNotice';
import type { MusicPlatform } from '../lib/salonPlayback';
import type { User } from '../types';

interface SalonPlatformAccessGateProps {
  salonPlatform: MusicPlatform;
  connectedPlatforms?: User['connectedPlatforms'];
  platformLinks?: User['platformLinks'];
  token: string | null;
  onUserUpdated?: (user: User) => void;
  /** Ne pas bloquer l'hôte du salon. */
  isHost?: boolean;
  /** Plein écran (SalonPage) vs compact (fiche carte). */
  variant?: 'full' | 'compact';
  children: ReactNode;
}

export function SalonPlatformAccessGate({
  salonPlatform,
  connectedPlatforms,
  platformLinks,
  token,
  onUserUpdated,
  isHost = false,
  variant = 'full',
  children,
}: SalonPlatformAccessGateProps) {
  const { t } = useTranslation();

  if (salonPlatform === 'spotify') {
    return <SpotifySalonDeprecatedNotice variant={variant} />;
  }

  if (canJoinSalonAsParticipant(salonPlatform, connectedPlatforms, isHost)) {
    return <>{children}</>;
  }

  const compact = variant === 'compact';
  const messageKey = salonParticipantAccessMessageKey(salonPlatform);
  const hintKey = 'salon.accessYoutubeRequiredHint';

  return (
    <div
      className={
        compact
          ? 'rounded-xl border border-red-500/25 bg-red-500/5 p-3 space-y-2'
          : 'flex flex-col items-center justify-center gap-4 px-6 py-10 text-center'
      }
    >
      <p className={compact ? 'text-xs text-amber-400/90 leading-snug' : 'text-amber-300 text-sm max-w-sm'}>
        {t(messageKey)}
      </p>
      {!compact && (
        <p className="text-[11px] text-gray-500 max-w-sm leading-snug">
          {t(hintKey)}
        </p>
      )}
      {token ? (
        <PlatformConnectCard
          token={token}
          platform="youtube"
          connectedPlatforms={connectedPlatforms}
          platformLinks={platformLinks}
          compact={compact}
          onUserUpdated={onUserUpdated}
        />
      ) : (
        <p className="text-xs text-gray-500">{t('auth.loginRequired', { defaultValue: 'Connectez-vous pour continuer.' })}</p>
      )}
    </div>
  );
}
