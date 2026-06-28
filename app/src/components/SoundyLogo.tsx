import type { ButtonHTMLAttributes, ImgHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

const LOGO_SRC = '/soundy-logo.png';

type SoundyLogoProps = {
  className?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>;

/** Logo Soundy (PNG fond transparent). */
export function SoundyLogo({ className = 'h-7 sm:h-8 w-auto shrink-0', ...props }: SoundyLogoProps) {
  const { t } = useTranslation();

  return (
    <img
      src={LOGO_SRC}
      alt={t('app.name', { defaultValue: 'Soundy' })}
      className={className}
      draggable={false}
      decoding="async"
      {...props}
    />
  );
}

type SoundyLogoButtonProps = {
  className?: string;
  logoClassName?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

/** Bouton logo (ex. header → Accueil). */
export function SoundyLogoButton({
  className = 'shrink-0 cursor-pointer hover:opacity-85 active:scale-95 transition',
  logoClassName,
  ...props
}: SoundyLogoButtonProps) {
  const { t } = useTranslation();
  return (
    <button type="button" className={className} title={t('nav.home')} aria-label={t('nav.home')} {...props}>
      <SoundyLogo className={logoClassName ?? 'h-7 sm:h-8 w-auto block'} />
    </button>
  );
}
