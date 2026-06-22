import { type ReactNode } from 'react';

export interface AdminScrollTabBarProps {
  children: ReactNode;
  className?: string;
  'aria-label': string;
}

/** Barre d'onglets admin : retour à la ligne si besoin (tous les onglets visibles, sans scroll). */
export function AdminScrollTabBar({
  children,
  className = '',
  'aria-label': ariaLabel,
}: AdminScrollTabBarProps) {
  const wrapClass = ['ms-admin-tab-bar-wrap', className].filter(Boolean).join(' ');

  return (
    <div className={wrapClass}>
      <nav className="ms-admin-tab-bar" aria-label={ariaLabel}>
        <div className="ms-admin-tab-bar__inner">{children}</div>
      </nav>
    </div>
  );
}
