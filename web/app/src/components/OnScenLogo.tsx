import type { ButtonHTMLAttributes, ImgHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

const LOGO_SRC = '/onscen-logo.png';

type OnScenLogoProps = {
  className?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>;

/** Logo OnScen — silhouette PNG + wave cyan → violet → rose (tokens --onscen-logo-wave-*). */
export function OnScenLogo({ className = 'h-7 sm:h-8 w-auto shrink-0', ...props }: OnScenLogoProps) {
  const { t } = useTranslation();
  const alt = t('app.name', { defaultValue: 'OnScen' });
  const { draggable, decoding } = props;

  return (
    <span className={`ms-onscen-logo ${className}`} role="img" aria-label={alt}>
      <img
        src={LOGO_SRC}
        alt=""
        aria-hidden
        className="ms-onscen-logo__sizer"
        draggable={draggable ?? false}
        decoding={decoding ?? 'async'}
      />
      <span className="ms-onscen-logo__wave" aria-hidden />
    </span>
  );
}

type OnScenLogoButtonProps = {
  className?: string;
  logoClassName?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

/** Bouton logo (ex. header → Accueil). */
export function OnScenLogoButton({
  className = 'shrink-0 cursor-pointer hover:opacity-85 active:scale-95 transition',
  logoClassName,
  ...props
}: OnScenLogoButtonProps) {
  const { t } = useTranslation();
  return (
    <button type="button" className={className} title={t('nav.home')} aria-label={t('nav.home')} {...props}>
      <OnScenLogo className={logoClassName ?? 'h-7 sm:h-8 w-auto block'} />
    </button>
  );
}
