import { useTranslation } from 'react-i18next';
import type { IntegrationAccount } from '../types';

function hasDetails(account: IntegrationAccount | null | undefined): account is IntegrationAccount {
  return Boolean(account && (account.email || account.name || account.project));
}

export function AdminIntegrationAccount({ account }: { account: IntegrationAccount | null | undefined }) {
  const { t } = useTranslation();

  if (!hasDetails(account)) {
    return (
      <div className="rounded-xl border border-[#2a2a3a] bg-[#0f0f17] px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
          {t('admin.integrations.account.title')}
        </p>
        <p className="text-[11px] text-gray-500 mt-0.5">{t('admin.integrations.account.none')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-cyan-300/80 font-semibold">
        {t('admin.integrations.account.title')}
      </p>
      {account.email && <p className="text-sm text-white font-medium mt-0.5 break-all">{account.email}</p>}
      {(account.name || account.project) && (
        <p className="text-[11px] text-gray-400 mt-0.5 break-all">
          {[account.name, account.project].filter(Boolean).join(' · ')}
        </p>
      )}
      <p className="text-[10px] text-gray-600 mt-1">
        {t(`admin.integrations.account.source.${account.source}`)}
      </p>
    </div>
  );
}
