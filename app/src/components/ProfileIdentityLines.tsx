import { useTranslation } from 'react-i18next';

import { getProfileTypeOption } from '../lib/profileTypes';

interface ProfileIdentityLinesProps {
  profileType?: string;
  className?: string;
}

/** Identité choisie à l'inscription (bar, mélomane, DJ…). */
export function ProfileIdentityLines({
  profileType,
  className = '',
}: ProfileIdentityLinesProps) {
  const { t } = useTranslation();
  const identity = getProfileTypeOption(profileType);

  if (!identity) return null;

  return (
    <div className={className}>
      <p
        className="text-sm text-purple-200/95 font-medium leading-snug"
        title={t('profile.identityAtSignupHint')}
      >
        {identity.emoji} {identity.label}
      </p>
    </div>
  );
}
