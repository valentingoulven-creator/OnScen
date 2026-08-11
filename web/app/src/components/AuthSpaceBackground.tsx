/** Full-viewport space background for login / signup flows. */
import type { ReactNode } from 'react';

/**
 * `import.meta.env.BASE_URL` (pas un chemin absolu codé en dur) : le web
 * tourne à la racine ('/') mais apptel tourne sous '/tel/' (PWA + Capacitor)
 * — chaque projet Vite ne sert son `public/` que sous son propre `base` en
 * dev. `auth-space-bg.png` est dupliqué dans web/app/public/ ET
 * ios/apptel/public/ (comme les icônes PWA) pour que les deux dev servers
 * le trouvent localement ; en prod le backend sert aussi une copie à la
 * racine du domaine, mais cette résolution reste correcte dans tous les cas.
 */
const AUTH_BG_IMAGE = `url('${import.meta.env.BASE_URL}auth-space-bg.png')`;

type AuthPageShellProps = {
  children: ReactNode;
  className?: string;
  /** Bloque la hauteur au viewport et désactive le scroll (écran de connexion). */
  fitViewport?: boolean;
};

/**
 * Auth layout with space background. Background layers use absolute positioning
 * inside this shell — fixed + negative z-index would paint behind #root and stay invisible.
 */
export function AuthPageShell({ children, className = '', fitViewport = false }: AuthPageShellProps) {
  return (
    <div
      className={`relative isolate w-full flex-1 overflow-x-hidden bg-[#0b0b0f] ${
        fitViewport ? 'h-dvh max-h-dvh min-h-0' : 'min-h-dvh min-h-full'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat bg-[center_45%] sm:bg-[65%_center]"
        style={{ backgroundImage: AUTH_BG_IMAGE }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b0b0f]/72 via-[#0b0b0f]/45 to-[#0b0b0f]/78"
        aria-hidden
      />
      <div
        className={`relative z-[1] flex w-full flex-1 flex-col ${
          fitViewport
            ? 'h-full max-h-dvh min-h-0 overflow-hidden'
            : 'min-h-dvh min-h-full overflow-y-auto overscroll-contain'
        } ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/** @deprecated Use AuthPageShell — kept for any direct imports. */
export function AuthSpaceBackground() {
  return null;
}
