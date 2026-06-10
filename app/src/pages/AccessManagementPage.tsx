import { AdminPage } from './AdminPage';

/** @deprecated Préférer AdminPage (onglet Accès). */
export function AccessManagementPage({ onBack }: { onBack?: () => void }) {
  return <AdminPage onBack={onBack} initialTab="access" />;
}
