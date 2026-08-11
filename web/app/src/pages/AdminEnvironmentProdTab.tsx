import { useTranslation } from 'react-i18next';
import { AdminEnvironmentStatusCard } from '../components/AdminEnvironmentStatusCard';

/**
 * Page dédiée à l'environnement PROD (onscen.com).
 * Lecture seule uniquement — AUCUN bouton de déploiement/action ici, par
 * choix de sécurité explicite (voir audit CTO) : un déploiement prod doit
 * rester un geste manuel délibéré (`.cursor/rules/deploy-prod.mdc`), jamais
 * un clic dans l'admin web. Ne pas ajouter d'action d'écriture sur cette
 * page sans validation fondateur + revue sécurité dédiée.
 */
export function AdminEnvironmentProdTab() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-white">{t('admin.environments.prod.title')}</h2>
        <p className="text-xs text-gray-500 mt-1">{t('admin.environments.prod.hint')}</p>
      </div>

      <div className="rounded-xl border border-red-500/25 bg-red-950/15 px-3 py-2">
        <p className="text-[11px] text-red-300 font-semibold">{t('admin.environments.prod.warning')}</p>
      </div>

      <AdminEnvironmentStatusCard env="prod" accentClassName="border-red-500/25" />

      <div className="rounded-2xl border border-[#2a2a3a] bg-[#12121a] p-4 space-y-2">
        <p className="text-xs font-bold text-red-300">{t('admin.environments.prod.howToTitle')}</p>
        <code className="block text-[11px] font-mono text-gray-400 bg-black/30 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
          powershell -ExecutionPolicy Bypass -File commun/scripts/deploy-prod.ps1
        </code>
        <p className="text-[11px] text-gray-500">{t('admin.environments.prod.howToNote')}</p>
      </div>
    </div>
  );
}
