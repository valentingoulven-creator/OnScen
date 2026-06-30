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
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-200/95 border border-purple-500/25"
        title={t('profile.identityAtSignupHint')}
      >
        <span aria-hidden>{identity.emoji}</span>
        {identity.label}
      </span>
    </div>
  );
}
