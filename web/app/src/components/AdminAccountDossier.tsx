import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getProfilePath } from '../lib/profileDeepLink';
import {
  BLOCK_DURATION_OPTIONS,
  PLATFORM_PLAN_OPTIONS,
  auditActionLabel,
  blockDaysRemaining,
  formatAuditAt,
  formatBlockedUntil,
  formatDate,
  formatDateTime,
  formatIsoDate,
  formatRelativeLastSeen,
  platformPlanBadgeClass,
  relationshipLabel,
  resolvePlatformPlanLabel,
  statusBadgeClass,
  statusLabel,
  type PlatformPlanId,
} from '../lib/adminAccountsUi';
import { AdminUserSnapshotsPanel } from './AdminUserSnapshotsPanel';
import type {
  AccessManagedUser,
  AdminUserAuditEntry,
  AdminUserSocialResponse,
  StaffRole,
} from '../types';

interface AdminAccountDossierProps {
  token: string;
  user: AccessManagedUser;
  social: AdminUserSocialResponse | null;
  socialLoading: boolean;
  audit: AdminUserAuditEntry[];
  auditAvailable: boolean;
  auditLoading: boolean;
  canGrantDev: boolean;
  busy: boolean;
  locale: string;
  onClose: () => void;
  onApprove: () => void;
  onBlock: (opts: { days?: number | null; reason?: string }) => void;
  onUnblock: () => void;
  onToggleStaff: (role: StaffRole | null) => void;
  onAssignPlan: (planId: PlatformPlanId) => void;
  onRevokeSessions: () => void;
  onResendVerification: () => void;
  onCopy: (text: string, label: string) => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-purple-300/90">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p className="text-xs text-gray-300">
      <span className="text-gray-500">{label} </span>
      {value}
    </p>
  );
}

export function AdminAccountDossier({
  token,
  user,
  social,
  socialLoading,
  audit,
  auditAvailable,
  auditLoading,
  canGrantDev,
  busy,
  locale,
  onClose,
  onApprove,
  onBlock,
  onUnblock,
  onToggleStaff,
  onAssignPlan,
  onRevokeSessions,
  onResendVerification,
  onCopy,
}: AdminAccountDossierProps) {
  const { t } = useTranslation();
  const [blockDays, setBlockDays] = useState<number | null>(7);
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const planId = (user.platformPlanId ?? 'free') as PlatformPlanId;
  const planLabel = resolvePlatformPlanLabel(user, t);
  const rel = relationshipLabel(user, t);
  const isBlocked = user.accountStatus === 'blocked';
  const blockDaysLeft = blockDaysRemaining(user.blockedUntil);

  const panel = (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center ms-modal-overlay bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-account-dossier-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg lg:max-w-2xl max-h-[90dvh] rounded-t-2xl sm:rounded-2xl bg-[#0b0b0f] border border-[#1e1e2f] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-[#1e1e2f] px-4 py-3 flex gap-3 items-start">
          <div className="shrink-0 w-12 h-12 rounded-full bg-[#1a1a26] border border-[#2d2d3d] overflow-hidden flex items-center justify-center text-lg">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{user.profileType ? '🎵' : '👤'}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400/90">
              {t('admin.accounts.dossierKicker')}
            </p>
            <h2 id="admin-account-dossier-title" className="text-base font-bold truncate">
              @{user.username}
            </h2>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadgeClass(user.accountStatus)}`}>
                {statusLabel(user.accountStatus, t)}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${platformPlanBadgeClass(planId)}`}>
                {planLabel}
              </span>
              {user.staffRole === 'dev' ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 font-bold">
                  DEV
                </span>
              ) : user.staffRole === 'admin' || user.isAdmin ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-200 font-bold">
                  ADMIN
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-[#14141c] border border-[#2a2a3a] text-gray-300 hover:text-white"
            aria-label={t('admin.accounts.closeDossier')}
          >
            ×
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Section title={t('admin.accounts.sectionIdentity')}>
            <Field label={t('admin.accounts.fieldId')} value={<span className="font-mono break-all">{user.id}</span>} />
            {user.city ? <Field label={t('admin.accounts.fieldCity')} value={user.city} /> : null}
            {user.profileType ? <Field label={t('admin.accounts.fieldType')} value={user.profileType} /> : null}
            {rel ? <Field label={t('admin.accounts.fieldRelation')} value={rel} /> : null}
            {user.birthDate ? (
              <Field
                label={t('admin.accounts.fieldBirth')}
                value={
                  <>
                    {formatIsoDate(user.birthDate, locale)}
                    {user.age != null ? ` · ${t('admin.accounts.age', { age: user.age })}` : ''}
                    {user.hideBirthDateOnProfile ? ` · ${t('admin.accounts.birthDateHidden')}` : ''}
                  </>
                }
              />
            ) : null}
            {user.bioPreview ? <p className="text-xs text-gray-400">{user.bioPreview}</p> : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-[#1a1a26] border border-[#2d2d3d]"
                onClick={() => window.open(getProfilePath(user.id), '_blank', 'noopener,noreferrer')}
              >
                {t('admin.accounts.openProfile')}
              </button>
              <button
                type="button"
                className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-[#1a1a26] border border-[#2d2d3d]"
                onClick={() => void onCopy(user.id, t('admin.accounts.copiedId'))}
              >
                {t('admin.accounts.copyId')}
              </button>
              <button
                type="button"
                className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-[#1a1a26] border border-[#2d2d3d]"
                onClick={() => void onCopy(user.email, t('admin.accounts.copiedEmail'))}
              >
                {t('admin.accounts.copyEmail')}
              </button>
            </div>
          </Section>

          <Section title={t('admin.accounts.sectionAccess')}>
            <p className="text-xs text-gray-400">
              {user.emailVerified ? t('admin.accounts.emailVerified') : t('admin.accounts.emailNotVerified')}
            </p>
            {user.stripeConnectReady ? (
              <p className="text-xs text-green-400/90">{t('admin.accounts.stripeReady')}</p>
            ) : null}
            {(user.connectedPlatformsCount ?? 0) > 0 ? (
              <p className="text-xs text-gray-400">
                {t('admin.accounts.connectedPlatforms', { count: user.connectedPlatformsCount })}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-amber-600/70 disabled:opacity-50"
                onClick={() => {
                  if (!window.confirm(t('admin.accounts.revokeSessionsConfirm'))) return;
                  onRevokeSessions();
                }}
              >
                {t('admin.accounts.revokeSessions')}
              </button>
              {!user.emailVerified ? (
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-purple-600/80 disabled:opacity-50"
                  onClick={onResendVerification}
                >
                  {t('admin.accounts.resendVerification')}
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {user.adminFlag ? (
                <button
                  type="button"
                  disabled={busy || (user.staffRole === 'dev' && !canGrantDev)}
                  className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-purple-600/40 border border-purple-500/40 disabled:opacity-50"
                  onClick={() => onToggleStaff(null)}
                >
                  {user.staffRole === 'dev' ? t('admin.accounts.demoteDev') : t('admin.accounts.demoteAdmin')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-purple-600/80 disabled:opacity-50"
                    onClick={() => onToggleStaff('admin')}
                  >
                    {t('admin.accounts.promoteStaffAdmin')}
                  </button>
                  {canGrantDev ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-amber-600/80 disabled:opacity-50"
                      onClick={() => onToggleStaff('dev')}
                    >
                      {t('admin.accounts.promoteStaffDev')}
                    </button>
                  ) : null}
                </>
              )}
              {user.staffRole === 'admin' && canGrantDev ? (
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-amber-600/50 border border-amber-500/40 disabled:opacity-50"
                  onClick={() => onToggleStaff('dev')}
                >
                  {t('admin.accounts.upgradeToDev')}
                </button>
              ) : null}
            </div>
          </Section>

          <Section title={t('admin.accounts.sectionModeration')}>
            {isBlocked && user.blockedUntil ? (
              <p className="text-xs text-red-300/90">
                {t('admin.accounts.blockedUntil', { date: formatBlockedUntil(user.blockedUntil, locale) })}
                {blockDaysLeft != null && blockDaysLeft > 0
                  ? ` · ${t('admin.accounts.blockDaysLeft', { days: blockDaysLeft })}`
                  : ''}
              </p>
            ) : null}
            {isBlocked && !user.blockedUntil ? (
              <p className="text-xs text-red-300/90">{t('admin.accounts.blockedPermanent')}</p>
            ) : null}
            {user.blockedReason ? (
              <p className="text-xs text-gray-400">{t('admin.accounts.blockReason', { reason: user.blockedReason })}</p>
            ) : null}
            {!user.isAdmin && user.accountStatus === 'pending' ? (
              <button
                type="button"
                disabled={busy}
                className="w-full min-h-11 rounded-xl text-xs font-semibold bg-green-600/80 disabled:opacity-50"
                onClick={onApprove}
              >
                {t('admin.accounts.approve')}
              </button>
            ) : null}
            {isBlocked && !user.isAdmin ? (
              <button
                type="button"
                disabled={busy}
                className="w-full min-h-11 rounded-xl text-xs font-semibold bg-green-600/70 border border-green-500/40 disabled:opacity-50"
                onClick={() => {
                  if (!window.confirm(t('admin.accounts.liftSuspensionConfirm'))) return;
                  onUnblock();
                }}
              >
                {t('admin.accounts.unblock')}
              </button>
            ) : null}
            {!isBlocked && !user.isAdmin && user.accountStatus !== 'pending' ? (
              <div className="space-y-2">
                <p className="text-[10px] text-gray-500">{t('admin.accounts.blockHint')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {BLOCK_DURATION_OPTIONS.map((opt) => (
                    <button
                      key={String(opt.days)}
                      type="button"
                      className={`min-h-11 px-3 rounded-xl text-xs font-semibold border ${
                        blockDays === opt.days
                          ? 'bg-red-600/70 border-red-400/50 text-white'
                          : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300'
                      }`}
                      onClick={() => setBlockDays(opt.days)}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder={t('admin.accounts.blockReasonPlaceholder')}
                  className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-gray-600"
                />
                <button
                  type="button"
                  disabled={busy}
                  className="w-full min-h-11 rounded-xl text-xs font-semibold bg-red-600/70 disabled:opacity-50"
                  onClick={() =>
                    onBlock({
                      days: blockDays,
                      reason: blockReason.trim() || undefined,
                    })
                  }
                >
                  {t('admin.accounts.blockConfirmAction')}
                </button>
              </div>
            ) : null}
          </Section>

          <Section title={t('admin.accounts.platformPlanSection')}>
            <p className="text-[10px] text-gray-500">{t('admin.accounts.platformPlanManageHint')}</p>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_PLAN_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={busy || planId === opt.id}
                  className={`min-h-11 px-3 rounded-xl text-xs font-semibold border disabled:opacity-50 ${
                    planId === opt.id
                      ? `${platformPlanBadgeClass(opt.id)} border-transparent`
                      : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300'
                  }`}
                  onClick={() => onAssignPlan(opt.id)}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </Section>

          <Section title={t('admin.accounts.sectionActivity')}>
            <p className="text-xs text-gray-300">
              {t('admin.accounts.memberSince', { date: formatDate(user.memberSince, locale) })}
            </p>
            <p className="text-xs text-gray-300">
              {t('admin.accounts.lastSeen', { date: formatDateTime(user.lastSeenAt, locale) })}
              <span className="text-gray-500"> · {formatRelativeLastSeen(user.lastSeenAt, locale)}</span>
            </p>
            {user.listeningRole ? (
              <p className="text-xs text-gray-400">{t('admin.accounts.listeningRole', { role: user.listeningRole })}</p>
            ) : null}
            <p className="text-xs text-gray-400">
              {t('admin.accounts.hostStats', {
                salons: user.salonsHosted ?? 0,
                lives: user.totalLivesHosted ?? 0,
                active: user.activeLivesHosted ?? 0,
              })}
            </p>
            {user.meloCoins != null ? (
              <p className="text-xs text-gray-400">{t('admin.accounts.meloCoins', { count: user.meloCoins })}</p>
            ) : null}
          </Section>

          <Section title={t('admin.accounts.sectionSocial')}>
            <p className="text-xs text-gray-400">
              {t('admin.accounts.socialCounts', {
                followers: user.followersCount ?? 0,
                following: user.followingCount ?? 0,
              })}
            </p>
            {socialLoading ? <p className="text-xs text-gray-500">{t('app.loading')}</p> : null}
            {social ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">{t('admin.accounts.followersListTitle')}</p>
                  <ul className="space-y-1">
                    {social.followers.slice(0, 8).map((f) => (
                      <li key={f.id} className="text-xs text-gray-300 truncate">
                        @{f.username}
                      </li>
                    ))}
                    {social.followers.length === 0 ? (
                      <li className="text-xs text-gray-600">—</li>
                    ) : null}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">{t('admin.accounts.followingListTitle')}</p>
                  <ul className="space-y-1">
                    {social.following.slice(0, 8).map((f) => (
                      <li key={f.id} className="text-xs text-gray-300 truncate">
                        @{f.username}
                      </li>
                    ))}
                    {social.following.length === 0 ? (
                      <li className="text-xs text-gray-600">—</li>
                    ) : null}
                  </ul>
                </div>
              </div>
            ) : null}
          </Section>

          <Section title={t('admin.accounts.sectionJournal')}>
            {auditLoading ? <p className="text-xs text-gray-500">{t('app.loading')}</p> : null}
            {!auditLoading && !auditAvailable ? (
              <p className="text-xs text-gray-500">{t('admin.accounts.auditUnavailable')}</p>
            ) : null}
            {!auditLoading && auditAvailable && audit.length === 0 ? (
              <p className="text-xs text-gray-500">{t('admin.accounts.auditEmpty')}</p>
            ) : null}
            <ul className="space-y-2">
              {audit.map((entry) => (
                <li key={entry.id} className="text-xs border-b border-[#1e1e2f] pb-2 last:border-0">
                  <p className="text-gray-200 font-medium">{auditActionLabel(entry.action, t)}</p>
                  <p className="text-gray-500">{formatAuditAt(entry.createdAt, locale)}</p>
                </li>
              ))}
            </ul>
          </Section>

          {!user.isAdmin ? (
            <AdminUserSnapshotsPanel token={token} userId={user.id} username={user.username} />
          ) : null}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(panel, document.body) : panel;
}
