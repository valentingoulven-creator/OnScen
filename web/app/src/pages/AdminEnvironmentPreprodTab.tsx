import { useTranslation } from 'react-i18next';
import { AdminEnvironmentStatusCard } from '../components/AdminEnvironmentStatusCard';

/**
 * Page dédiée à l'environnement PREPROD (staging.getsoundy.com).
 * Lecture seule (ping /health public) — pas de déclenchement de déploiement
 * depuis le web par choix de sécurité (voir audit CTO), même si le workflow
 * GitHub `deploy-preprod.yml` supporte déjà `workflow_dispatch` manuellement
 * depuis l'interface GitHub Actions.
 */
export function AdminEnvironmentPreprodTab() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-white">{t('admin.environments.preprod.title')}</h2>
        <p className="text-xs text-gray-500 mt-1">{t('admin.environments.preprod.hint')}</p>
      </div>

      <AdminEnvironmentStatusCard env="preprod" accentClassName="border-amber-500/25" />

      <div className="rounded-2xl border border-[#2a2a3a] bg-[#12121a] p-4 space-y-2">
        <p className="text-xs font-bold text-amber-300">{t('admin.environments.preprod.howToTitle')}</p>
        <code className="block text-[11px] font-mono text-gray-400 bg-black/30 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
          powershell -ExecutionPolicy Bypass -File commun/scripts/deploy-preprod.ps1
        </code>
        <p className="text-[11px] text-gray-500">{t('admin.environments.preprod.howToNote')}</p>
      </div>
    </div>
  );
}
