import { useTranslation } from 'react-i18next';
import { AdminEnvironmentStatusCard } from '../components/AdminEnvironmentStatusCard';

/**
 * Page dédiée à l'environnement DEV (local msdev, :4080/:5173).
 * Lecture seule — vérifiée en-process côté backend (pas de round-trip HTTP).
 */
export function AdminEnvironmentDevTab() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-white">{t('admin.environments.dev.title')}</h2>
        <p className="text-xs text-gray-500 mt-1">{t('admin.environments.dev.hint')}</p>
      </div>

      <AdminEnvironmentStatusCard env="dev" accentClassName="border-gray-500/25" />

      <div className="rounded-2xl border border-[#2a2a3a] bg-[#12121a] p-4 space-y-2">
        <p className="text-xs font-bold text-gray-300">{t('admin.environments.dev.howToTitle')}</p>
        <code className="block text-[11px] font-mono text-gray-400 bg-black/30 rounded-lg px-3 py-2 overflow-x-auto">
          npm run dev
        </code>
        <p className="text-[11px] text-gray-500">{t('admin.environments.dev.howToNote')}</p>
      </div>
    </div>
  );
}
