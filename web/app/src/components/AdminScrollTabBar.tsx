import { type ReactNode } from 'react';

export interface AdminScrollTabBarProps {
  children: ReactNode;
  className?: string;
  variant?: 'pills' | 'underline';
  'aria-label': string;
}

/** Barre d'onglets admin — pills (wrap) ou underline (scroll horizontal). */
export function AdminScrollTabBar({
  children,
  className = '',
  variant = 'pills',
  'aria-label': ariaLabel,
}: AdminScrollTabBarProps) {
  const wrapClass = [
    'ms-admin-tab-bar-wrap',
    variant === 'underline' ? 'ms-admin-tab-bar-wrap--underline' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClass}>
      <nav
        className={`ms-admin-tab-bar${variant === 'underline' ? ' ms-admin-tab-bar--underline' : ''}`}
        aria-label={ariaLabel}
        role="tablist"
      >
        <div className="ms-admin-tab-bar__inner">{children}</div>
      </nav>
    </div>
  );
}
