import type { ReactNode } from 'react';
import { usePhoneWebViewport } from '../hooks/usePhoneWebViewport';

type Props = {
  children: ReactNode;
};

/** Coque téléphone pour getsoundy.com ouvert dans le navigateur mobile (pas apptel natif). */
export function PhoneWebShell({ children }: Props) {
  const phoneWeb = usePhoneWebViewport();
  if (!phoneWeb) return <>{children}</>;
  return <div className="ms-phone-shell">{children}</div>;
}
