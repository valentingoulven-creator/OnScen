import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LEGAL, type LegalKey } from '../content/legal';
import { resetCookieConsent } from '../lib/cookieConsent';
import { LegalDocumentView } from '../components/LegalDocumentView';
import {
  getAppLanguage,
  setAppLanguage,
  type AppLanguage,
} from '../lib/settings';
import { getStoredAppTheme, setAppTheme, type AppTheme } from '../lib/appTheme';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { PasswordStrengthBar } from '../components/PasswordStrengthBar';
import { getPasswordStrengthAsync } from '../lib/passwordStrength';
import { BiometricSetup } from '../components/BiometricSetup';
import { ConfirmModal } from '../components/ConfirmModal';
import { CreatorStripeConnectCard } from '../components/CreatorStripeConnectCard';
import { DonationSheet } from '../components/DonationSheet';
import { PlatformConnectCard } from '../components/PlatformConnectCard';
import { SupportMeloSongTeaser } from '../components/SupportMeloSongSection';
import { ContactSoundyPage } from './ContactSoundyPage';
import { PlatformSubscriptionPage } from './PlatformSubscriptionPage';

// ─── 2FA setup modal states ───────────────────────────────────────────────────
type TwoFAModalState =
  | 'closed'
  | 'setup_qr'       // Affiche le QR code, attente du code de confirmation
  | 'setup_backup'   // Affiche les codes de secours après activation réussie
  | 'disable';       // Désactiver la 2FA (code TOTP requis)

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

type PushPermissionState = 'unsupported' | 'denied' | 'granted' | 'default' | 'loading';

async function requestAndSubscribePush(token: string): Promise<boolean> {
  try {
    const { publicKey } = await api.getPushVapidPublicKey(token);
    if (!publicKey) return false;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    await api.subscribePush(token, {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    return true;
  } catch {
    return false;
  }
}

async function unsubscribePush(token: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await api.unsubscribePush(token, endpoint);
  } catch {
    /* optionnel */
  }
}
interface SettingsPageProps {
  onBack: () => void;
  /** Ouvre Contacter Soundy à l’affichage (ex. notification support_reply). */
  openContactOnMount?: boolean;
  onContactMountHandled?: () => void;
  highlightSupportMessageId?: string;
}

export function SettingsGearButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('settings.title')}
      aria-label={t('settings.settingsAria')}
      className="w-11 h-11 rounded-full bg-black/45 border border-white/15 backdrop-blur-md flex items-center justify-center text-gray-200 hover:bg-black/65 hover:text-white transition-colors"
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        />
      </svg>
    </button>
  );
}

function SettingsSectionHeader({
  children,
  expanded,
  onToggle,
  toggleAriaLabel,
}: {
  children: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
  toggleAriaLabel?: string;
}) {
  if (!onToggle) {
    return (
      <p className="px-4 pt-5 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider first:pt-4">
        {children}
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={toggleAriaLabel}
      className="w-full flex items-center justify-between gap-2 px-4 pt-5 pb-2 min-h-[44px] text-left first:pt-4 hover:bg-[#12121a]/40 active:bg-[#12121a]/60 transition-colors"
    >
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{children}</span>
      <span
        className={`text-gray-500 shrink-0 text-base leading-none transition-transform ${expanded ? 'rotate-90' : ''}`}
        aria-hidden
      >
        ›
      </span>
    </button>
  );
}

function SettingsSubGroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-2 pb-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wide">
      {children}
    </p>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 rounded-xl border border-[#1e1e2f] bg-[#12121a]/60 overflow-hidden divide-y divide-[#1e1e2f]/70">
      {children}
    </div>
  );
}

function SettingsInfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-4 mt-2 mb-3 px-3 py-2.5 rounded-xl bg-[#12121a]/40 border border-[#1e1e2f]/80 text-[11px] text-gray-500 leading-relaxed">
      {children}
    </p>
  );
}

function SettingsRow({
  label,
  hint,
  onClick,
  children,
  destructive,
}: {
  label: string;
  hint?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  destructive?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 p-4 min-h-[44px] text-left ${
        onClick
          ? destructive
            ? 'hover:bg-red-500/5 active:bg-red-500/10'
            : 'hover:bg-[#1a1a26] active:bg-[#1a1a26]'
          : ''
      }`}
    >
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${destructive ? 'text-red-400' : 'text-white'}`}>{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {children ?? (onClick && (
        <span className={`shrink-0 ${destructive ? 'text-red-400/70' : 'text-gray-500'}`}>›</span>
      ))}
    </Tag>
  );
}

export function SettingsPage({
  onBack,
  openContactOnMount = false,
  onContactMountHandled,
  highlightSupportMessageId,
}: SettingsPageProps) {
  const { t } = useTranslation();
  const { token, logout, user, setUserFromProfile, refreshUser } = useAuth();
  const [language, setLanguage] = useState<AppLanguage>(getAppLanguage);
  const [theme, setTheme] = useState<AppTheme>(getStoredAppTheme);
  const [legal, setLegal] = useState<LegalKey | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showDonationSheet, setShowDonationSheet] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [streamingExpanded, setStreamingExpanded] = useState(false);
  const [notificationsExpanded, setNotificationsExpanded] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [dmDisabled, setDmDisabled] = useState(() => user?.allowPrivateMessages === false);
  const [dmSaving, setDmSaving] = useState(false);
  const [externalEventTagsDisabled, setExternalEventTagsDisabled] = useState(
    () => user?.allowExternalEventTags === false
  );
  const [externalEventTagsSaving, setExternalEventTagsSaving] = useState(false);
  const [legalIncomplete, setLegalIncomplete] = useState(false);

  useEffect(() => {
    void api.getLegalPublisher().then((r) => setLegalIncomplete(!r.complete)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!openContactOnMount) return;
    setShowContact(true);
    onContactMountHandled?.();
  }, [openContactOnMount, onContactMountHandled]);

  const pushSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(() => {
    if (!pushSupported) return 'unsupported';
    return (Notification.permission as PushPermissionState) ?? 'default';
  });
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!pushSupported) return;
    setPushPermission(Notification.permission as PushPermissionState);
  }, [pushSupported]);

  useEffect(() => {
    setDmDisabled(user?.allowPrivateMessages === false);
  }, [user?.allowPrivateMessages]);

  useEffect(() => {
    setExternalEventTagsDisabled(user?.allowExternalEventTags === false);
  }, [user?.allowExternalEventTags]);

  const handleTogglePush = async () => {
    if (!token || pushLoading) return;
    setPushLoading(true);
    try {
      if (pushPermission === 'granted') {
        await unsubscribePush(token);
        setPushPermission('default');
        flash(t('settings.pushDisabled'));
      } else {
        const ok = await requestAndSubscribePush(token);
        const newPerm = Notification.permission as PushPermissionState;
        setPushPermission(newPerm);
        if (ok && newPerm === 'granted') {
          flash(t('settings.pushEnabled'));
        } else if (newPerm === 'denied') {
          flash(t('settings.pushDenied'));
        }
      }
    } finally {
      setPushLoading(false);
    }
  };

  // Password change state
  const [pwSection, setPwSection] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(user?.twoFactorEnabled === true);
  const [twoFAModal, setTwoFAModal] = useState<TwoFAModalState>('closed');
  const [twoFAQrCode, setTwoFAQrCode] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFABackupCodes, setTwoFABackupCodes] = useState<string[]>([]);
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFADisableCode, setTwoFADisableCode] = useState('');

  const openTwoFASetup = async () => {
    if (!token || twoFALoading) return;
    setTwoFAError('');
    setTwoFACode('');
    setTwoFALoading(true);
    try {
      const r = await api.setup2FA(token);
      setTwoFAQrCode(r.qrCode);
      setTwoFAModal('setup_qr');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Erreur lors de la configuration 2FA');
    } finally {
      setTwoFALoading(false);
    }
  };

  const confirmTwoFACode = async () => {
    if (!token || !twoFACode || twoFALoading) return;
    setTwoFAError('');
    setTwoFALoading(true);
    try {
      const r = await api.verify2FA(token, twoFACode);
      setTwoFABackupCodes(r.backupCodes);
      setTwoFAEnabled(true);
      setTwoFAModal('setup_backup');
    } catch (err) {
      setTwoFAError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setTwoFALoading(false);
    }
  };

  const disableTwoFA = async () => {
    if (!token || !twoFADisableCode || twoFALoading) return;
    setTwoFAError('');
    setTwoFALoading(true);
    try {
      await api.disable2FA(token, twoFADisableCode);
      setTwoFAEnabled(false);
      setTwoFAModal('closed');
      setTwoFADisableCode('');
      flash('Double authentification désactivée');
    } catch (err) {
      setTwoFAError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setTwoFALoading(false);
    }
  };

  const closeTwoFAModal = () => {
    setTwoFAModal('closed');
    setTwoFACode('');
    setTwoFADisableCode('');
    setTwoFAError('');
    setTwoFAQrCode('');
    setTwoFABackupCodes([]);
  };

  // Delete account state
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePwd, setDeletePwd] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPwd.length < 8) {
      setPwError(t('settings.passwordTooShort'));
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwError(t('settings.passwordMismatch'));
      return;
    }
    if ((await getPasswordStrengthAsync(newPwd)) === 'faible') {
      setPwError(t('settings.passwordTooWeak'));
      return;
    }
    setPwLoading(true);
    try {
      await api.changePassword(token!, currentPwd, newPwd);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setPwSection(false);
      flash(t('settings.passwordUpdated'));
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    if (deleteConfirmText !== 'SUPPRIMER') {
      setDeleteError(t('settings.deleteAccountConfirmError'));
      return;
    }
    const oauthOnly = user?.isOAuthAccount === true;
    if (!oauthOnly && !deletePwd) {
      setDeleteError(t('settings.deleteAccountPasswordRequired'));
      return;
    }
    setDeleteLoading(true);
    try {
      await api.deleteAccount(
        token!,
        oauthOnly ? { confirmation: 'SUPPRIMER' } : { password: deletePwd, confirmation: 'SUPPRIMER' }
      );
      logout();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeleteLoading(false);
    }
  };

  const flash = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2000);
  };

  const applyTheme = (next: AppTheme) => {
    setTheme(next);
    setAppTheme(next);
  };

  const applyLanguage = (lang: AppLanguage) => {
    setLanguage(lang);
    setAppLanguage(lang);
    flash(lang === 'fr' ? t('settings.languageSavedFr') : t('settings.languageSavedEn'));
  };

  const handleTogglePrivateMessages = async () => {
    if (!token || dmSaving) return;
    const nextDisabled = !dmDisabled;
    setDmSaving(true);
    try {
      const { user: updated } = await api.updatePrivacySettings(token, {
        allowPrivateMessages: !nextDisabled,
      });
      setDmDisabled(nextDisabled);
      setUserFromProfile(updated);
      flash(t('settings.prefsSaved'));
    } catch (err) {
      flash(err instanceof Error ? err.message : t('settings.exportError'));
    } finally {
      setDmSaving(false);
    }
  };

  const handleToggleExternalEventTags = async () => {
    if (!token || externalEventTagsSaving) return;
    const nextDisabled = !externalEventTagsDisabled;
    setExternalEventTagsSaving(true);
    try {
      const { user: updated } = await api.updatePrivacySettings(token, {
        allowExternalEventTags: !nextDisabled,
      });
      setExternalEventTagsDisabled(nextDisabled);
      setUserFromProfile(updated);
      flash(t('settings.prefsSaved'));
    } catch (err) {
      flash(err instanceof Error ? err.message : t('settings.exportError'));
    } finally {
      setExternalEventTagsSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!token || exportLoading) return;
    setExportLoading(true);
    try {
      const res = await api.exportMyData(token);
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soundy-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash(t('settings.exportDone'));
    } catch {
      flash(t('settings.exportError'));
    } finally {
      setExportLoading(false);
    }
  };

  const handleHeaderBack = () => {
    if (showContact) {
      setShowContact(false);
      return;
    }
    if (legal) {
      setLegal(null);
      return;
    }
    onBack();
  };

  const headerTitle = showContact
    ? t('support.title')
    : legal
      ? LEGAL[legal].title
      : t('settings.title');

  if (showSubscription) {
    return <PlatformSubscriptionPage onBack={() => setShowSubscription(false)} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f]">
      <header className="sticky top-0 z-10 shrink-0 bg-[#0b0b0f]/95 backdrop-blur border-b border-[#1e1e2f] px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleHeaderBack}
          className="text-purple-400 hover:text-purple-300 text-sm font-medium shrink-0"
          aria-label={t('common.back')}
        >
          ← {t('common.back')}
        </button>
        <h1 className="flex-1 min-w-0 text-center text-sm font-semibold text-white truncate">
          {headerTitle}
        </h1>
        {saved ? (
          <span className="shrink-0 text-[10px] text-green-400 bg-green-500/10 px-2 py-1 rounded-full">{saved}</span>
        ) : (
          <span className="shrink-0 w-[4.5rem]" aria-hidden />
        )}
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {showContact ? (
          <ContactSoundyPage
            embedded
            onBack={() => setShowContact(false)}
            highlightMessageId={highlightSupportMessageId}
          />
        ) : legal ? (
          <LegalDocumentView docKey={legal} embedded />
        ) : (
          <div className="flex flex-col flex-1 min-h-full pb-[max(2rem,env(safe-area-inset-bottom))]">
        {/* ── 1. Plateformes connectées ── */}
        <section>
          <SettingsSectionHeader>{t('settings.platformsSection')}</SettingsSectionHeader>
          <p className="px-4 pb-2 text-[11px] text-gray-500">{t('settings.platformsSectionHint')}</p>
          <SettingsGroup>
            <SettingsRow
              label={t('profile.connectedAccounts')}
              onClick={() => setStreamingExpanded((v) => !v)}
            >
              <span
                className={`text-gray-500 shrink-0 transition-transform ${streamingExpanded ? 'rotate-90' : ''}`}
                aria-hidden
              >
                ›
              </span>
            </SettingsRow>
          </SettingsGroup>
          {streamingExpanded && token && user && (
            <div className="px-4 pb-2 pt-3 space-y-2">
              {(['youtube'] as const).map((p) => (
                <PlatformConnectCard
                  key={p}
                  token={token}
                  platform={p}
                  connectedPlatforms={user.connectedPlatforms}
                  platformLinks={user.platformLinks}
                  onUserUpdated={setUserFromProfile}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── 2. Abonnement & créateur ── */}
        <section>
          <SettingsSectionHeader>{t('settings.monetizationSection')}</SettingsSectionHeader>
          <SettingsGroup>
            <SettingsRow
              label={t('profile.subscription')}
              onClick={() => setShowSubscription(true)}
            />
          </SettingsGroup>

          {token && user && (
            <div className="px-4 py-3">
              <CreatorStripeConnectCard
                token={token}
                user={user}
                onUserUpdated={() => void refreshUser()}
              />
            </div>
          )}

          <div className="px-4 pb-2">
            <SupportMeloSongTeaser onOpen={() => setShowDonationSheet(true)} />
          </div>
        </section>

        {/* ── 3. Confidentialité ── */}
        <section>
          <SettingsSectionHeader>{t('settings.privacySection')}</SettingsSectionHeader>
          <p className="px-4 pb-2 text-[11px] text-gray-500">{t('settings.privacySectionHint')}</p>
          <SettingsGroup>
            <label className="flex items-center justify-between gap-3 p-4 cursor-pointer">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{t('settings.disablePrivateMessages')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('settings.disablePrivateMessagesHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleTogglePrivateMessages()}
                disabled={dmSaving || !token}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${dmDisabled ? 'bg-purple-600' : 'bg-gray-600'}`}
                aria-label={t('settings.disablePrivateMessagesToggleAria')}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${dmDisabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </label>

            <label className="flex items-center justify-between gap-3 p-4 cursor-pointer">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{t('settings.disableExternalEventTags')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('settings.disableExternalEventTagsHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleToggleExternalEventTags()}
                disabled={externalEventTagsSaving || !token}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${externalEventTagsDisabled ? 'bg-purple-600' : 'bg-gray-600'}`}
                aria-label={t('settings.disableExternalEventTagsToggleAria')}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${externalEventTagsDisabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </label>
          </SettingsGroup>
          <SettingsInfoCallout>{t('settings.privacyMapCallout')}</SettingsInfoCallout>
        </section>

        {/* ── 4. Notifications ── */}
        {pushSupported && (
          <section>
            <SettingsSectionHeader
              expanded={notificationsExpanded}
              onToggle={() => setNotificationsExpanded((v) => !v)}
              toggleAriaLabel={
                notificationsExpanded
                  ? t('settings.notificationsSectionCollapse')
                  : t('settings.notificationsSectionExpand')
              }
            >
              {t('settings.notificationsSection')}
            </SettingsSectionHeader>
            {notificationsExpanded && (
              <SettingsGroup>
                <label className="flex items-center justify-between gap-3 p-4 cursor-pointer">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{t('settings.pushNotifications')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {pushPermission === 'granted'
                        ? t('settings.pushEnabledHint')
                        : pushPermission === 'denied'
                          ? t('settings.pushDeniedHint')
                          : t('settings.pushDefaultHint')}
                    </p>
                  </div>
                  {pushPermission === 'denied' ? (
                    <span className="text-xs text-gray-600 shrink-0">{t('settings.pushBlocked')}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleTogglePush}
                      disabled={pushLoading}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${pushPermission === 'granted' ? 'bg-purple-600' : 'bg-gray-600'}`}
                      aria-label={t('settings.pushToggleAria')}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${pushPermission === 'granted' ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  )}
                </label>
              </SettingsGroup>
            )}
          </section>
        )}

        {/* ── 5. Sécurité et accès ── */}
        <section>
          <SettingsSectionHeader>{t('settings.securityAccessSection')}</SettingsSectionHeader>
          <SettingsGroup>
            <SettingsRow
              label={t('settings.changePassword')}
              hint={t('settings.currentPasswordHint')}
              onClick={() => { setPwSection((s) => !s); setPwError(''); }}
            />
          </SettingsGroup>

          {pwSection && (
            <form onSubmit={handleChangePassword} className="px-4 pb-4 pt-3 space-y-3">
              <input
                type="password"
                placeholder={t('settings.currentPassword')}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
              />
              <div className="space-y-1.5">
                <input
                  type="password"
                  placeholder={t('settings.newPassword')}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
                />
                <PasswordStrengthBar password={newPwd} />
              </div>
              <input
                type="password"
                placeholder={t('settings.confirmNewPassword')}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
              />
              {confirmPwd && newPwd !== confirmPwd && (
                <p className="text-[11px] text-red-400">{t('settings.passwordMismatch')}</p>
              )}
              {pwError && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{pwError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPwSection(false); setPwError(''); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); }}
                  className="flex-1 py-2 rounded-xl text-sm text-gray-400 bg-[#1a1a26] hover:bg-[#22222f] transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
                >
                  {pwLoading ? '…' : t('common.save')}
                </button>
              </div>
            </form>
          )}

          <SettingsGroup>
            <SettingsRow
              label="Double authentification (2FA)"
              hint={twoFAEnabled
                ? 'Activée — votre compte est protégé par TOTP'
                : 'Ajoutez une couche de sécurité avec Google Authenticator'}
              onClick={twoFAEnabled
                ? () => { setTwoFAModal('disable'); setTwoFAError(''); setTwoFADisableCode(''); }
                : () => void openTwoFASetup()}
            >
              {twoFALoading && twoFAModal === 'closed'
                ? <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin shrink-0" />
                : (
                  <span className={`text-xs font-semibold shrink-0 ${twoFAEnabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {twoFAEnabled ? 'Activée' : 'Désactivée'}
                  </span>
                )}
            </SettingsRow>
          </SettingsGroup>

          <div className="px-4 py-3">
            <BiometricSetup />
          </div>

          <SettingsGroup>
            <SettingsRow
              label={t('settings.deleteAccount')}
              hint={t('settings.deleteAccountHint')}
              onClick={() => { setDeleteModal(true); setDeleteError(''); setDeletePwd(''); setDeleteConfirmText(''); }}
              destructive
            />
          </SettingsGroup>
        </section>

        {/* ── Modals 2FA / suppression (overlays) ── */}
        {twoFAModal === 'setup_qr' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
              <div className="text-center space-y-1">
                <p className="text-2xl">🔐</p>
                <h2 className="text-lg font-bold text-white">Activer la 2FA</h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Scannez le QR code avec Google Authenticator ou Authy,<br />puis entrez le code à 6 chiffres.
                </p>
              </div>
              {twoFAQrCode && (
                <div className="flex justify-center">
                  <img src={twoFAQrCode} alt="QR code 2FA" className="w-44 h-44 rounded-xl border border-[#2d2d3d]" />
                </div>
              )}
              <input
                type="text"
                inputMode="numeric"
                placeholder="Code à 6 chiffres"
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                autoComplete="one-time-code"
                className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white font-mono tracking-widest text-center"
              />
              {twoFAError && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{twoFAError}</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={closeTwoFAModal} className="flex-1 py-2 rounded-xl text-sm text-gray-400 bg-[#1a1a26] hover:bg-[#22222f] transition">
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={twoFALoading || twoFACode.length !== 6}
                  onClick={() => void confirmTwoFACode()}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
                >
                  {twoFALoading ? '…' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal 2FA : codes de secours ── */}
        {twoFAModal === 'setup_backup' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-[#12121a] border border-green-500/30 rounded-2xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
              <div className="text-center space-y-1">
                <p className="text-2xl">✅</p>
                <h2 className="text-lg font-bold text-white">2FA activée !</h2>
                <p className="text-xs text-amber-300/90 leading-relaxed">
                  Conservez ces codes de secours en lieu sûr.<br />
                  Chaque code n'est utilisable qu'une seule fois.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {twoFABackupCodes.map((code) => (
                  <span key={code} className="font-mono text-xs text-center bg-[#1a1a26] border border-[#2d2d3d] rounded-lg py-2 px-3 text-white tracking-wider">
                    {code}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={closeTwoFAModal}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 transition"
              >
                J'ai sauvegardé mes codes
              </button>
            </div>
          </div>
        )}

        {/* ── Modal 2FA : désactiver ── */}
        {twoFAModal === 'disable' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
              <div className="text-center space-y-1">
                <p className="text-2xl">🔓</p>
                <h2 className="text-lg font-bold text-white">Désactiver la 2FA</h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Entrez le code de votre application d'authentification<br />ou un code de secours.
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Code TOTP ou code de secours"
                value={twoFADisableCode}
                onChange={(e) => setTwoFADisableCode(e.target.value)}
                autoComplete="one-time-code"
                className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white font-mono tracking-widest text-center"
              />
              {twoFAError && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{twoFAError}</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={closeTwoFAModal} className="flex-1 py-2 rounded-xl text-sm text-gray-400 bg-[#1a1a26] hover:bg-[#22222f] transition">
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={twoFALoading || !twoFADisableCode}
                  onClick={() => void disableTwoFA()}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition"
                >
                  {twoFALoading ? '…' : 'Désactiver'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal suppression de compte ── */}
        {deleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <form
              onSubmit={handleDeleteAccount}
              className="w-full max-w-sm bg-[#12121a] border border-red-500/30 rounded-2xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto"
            >
              <div className="text-center space-y-1">
                <p className="text-2xl">⚠️</p>
                <h2 className="text-lg font-bold text-white">{t('settings.deleteAccountTitle')}</h2>
                <p className="text-xs text-gray-400 leading-relaxed">{t('settings.deleteAccountIrreversible')}</p>
              </div>
              {user?.isOAuthAccount !== true ? (
                <input
                  type="password"
                  placeholder={t('settings.deleteAccountPassword')}
                  value={deletePwd}
                  onChange={(e) => setDeletePwd(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
                />
              ) : (
                <p className="text-xs text-gray-500">
                  Compte connecté via Google — confirmez avec SUPPRIMER ci-dessous.
                </p>
              )}
              <div className="space-y-1">
                <p className="text-xs text-gray-400">{t('settings.deleteAccountConfirmLabel')}</p>
                <input
                  type="text"
                  placeholder={t('settings.deleteAccountConfirmWord')}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  required
                  className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                />
              </div>
              {deleteError && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 bg-[#1a1a26] hover:bg-[#22222f] transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || deleteConfirmText !== 'SUPPRIMER'}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition"
                >
                  {deleteLoading ? '…' : t('common.delete')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── 6. Application ── */}
        <section>
          <SettingsSectionHeader>{t('settings.applicationSection')}</SettingsSectionHeader>
          <SettingsGroup>
            <SettingsRow label={t('settings.language')}>
              <select
                value={language}
                onChange={(e) => applyLanguage(e.target.value as AppLanguage)}
                className="bg-[#1a1a26] border border-[#2d2d3d] rounded-lg px-2 py-1 text-sm text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </SettingsRow>
            <SettingsRow label={t('settings.theme')}>
              <select
                value={theme}
                onChange={(e) => applyTheme(e.target.value as AppTheme)}
                className="bg-[#1a1a26] border border-[#2d2d3d] rounded-lg px-2 py-1 text-sm text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="dark">{t('settings.themeDark')}</option>
                <option value="light">{t('settings.themeLight')}</option>
                <option value="system">{t('settings.themeSystem')}</option>
              </select>
            </SettingsRow>
          </SettingsGroup>
        </section>

        {/* ── 7. Assistance ── */}
        <section>
          <SettingsSectionHeader>{t('settings.assistanceSection')}</SettingsSectionHeader>
          <SettingsGroup>
            <SettingsRow
              label={t('profile.contactSoundy')}
              onClick={() => setShowContact(true)}
            />
            <SettingsRow
              label={t('settings.dsaReportContent')}
              hint={t('settings.dsaReportContentHint')}
              onClick={() => setShowContact(true)}
            />
          </SettingsGroup>
        </section>

        {/* ── 8. Légal & données ── */}
        <section>
          <SettingsSectionHeader>{t('settings.legalSection')}</SettingsSectionHeader>
          {legalIncomplete && (
            <div className="mx-4 mb-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5">
              <span className="text-amber-400 text-sm shrink-0 mt-px">⚠</span>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Les <span className="font-semibold text-amber-300">Mentions légales</span> contiennent des champs non renseignés.{' '}
                Complétez <code className="text-amber-200 bg-amber-500/10 rounded px-0.5">msdev/legal-publisher.json</code> avant mise en production (LCEN).
              </p>
            </div>
          )}
          <SettingsSubGroupHeader>{t('settings.legalDocumentsGroup')}</SettingsSubGroupHeader>
          <SettingsGroup>
            <SettingsRow
              label={t('settings.legalMentions')}
              onClick={() => setLegal('mentions')}
            >
              {legalIncomplete ? (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-0.5 shrink-0">
                  À compléter
                </span>
              ) : (
                <span className="text-gray-500 shrink-0">›</span>
              )}
            </SettingsRow>
            <SettingsRow label={t('settings.legalTerms')} onClick={() => setLegal('terms')} />
            <SettingsRow label={t('settings.legalPrivacy')} onClick={() => setLegal('privacy')} />
            <SettingsRow label={t('settings.legalCookies')} onClick={() => setLegal('cookies')} />
            <SettingsRow label={t('settings.legalRgpd')} onClick={() => setLegal('rgpd')} />
            <SettingsRow
              label={t('settings.legalApiPlatforms')}
              hint={t('settings.legalApiPlatformsHint')}
              onClick={() => setLegal('apiPlatforms')}
            />
            <SettingsRow
              label={t('settings.legalMonetization')}
              onClick={() => setLegal('creatorMonetization')}
            />
            <SettingsRow label={t('settings.legalLicenses')} onClick={() => setLegal('licenses')} />
          </SettingsGroup>

          <SettingsSubGroupHeader>{t('settings.legalDataGroup')}</SettingsSubGroupHeader>
          <SettingsGroup>
            <SettingsRow
              label={t('settings.legalCookiePrefs')}
              hint={t('settings.legalCookiePrefsHint')}
              onClick={() => resetCookieConsent()}
            />
            <SettingsRow
              label={t('settings.exportData')}
              hint={t('settings.exportDataHint')}
              onClick={handleExportData}
            >
              <span className="text-xs text-purple-400 shrink-0 font-medium">
                {exportLoading ? '…' : t('settings.exportJson')}
              </span>
            </SettingsRow>
          </SettingsGroup>
          <div className="mx-4 mt-3 mb-2 px-3 py-3 rounded-xl bg-[#12121a]/40 border border-[#1e1e2f]/80">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('settings.dataRightsSection')}</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              {t('settings.dataRightsHint')} :{' '}
              <a
                href="mailto:privacy@getsoundy.com"
                className="text-purple-400 underline"
              >
                privacy@getsoundy.com
              </a>
            </p>
          </div>
        </section>

        <div className="flex-1 min-h-6" aria-hidden />

        {/* ── 9. Session (déconnexion en bas) ── */}
        <section>
          <SettingsSectionHeader>{t('settings.sessionSection')}</SettingsSectionHeader>
          <SettingsGroup>
            <SettingsRow
              label={t('profile.logout')}
              onClick={() => setShowLogoutConfirm(true)}
              destructive
            />
          </SettingsGroup>
        </section>

        <p className="px-4 pt-6 text-center text-[10px] text-gray-600">
          {t('app.versionFooter', { version: '2.0.0' })}
        </p>
          </div>
        )}
      </div>

      {showDonationSheet && (
        <DonationSheet onClose={() => setShowDonationSheet(false)} />
      )}

      {showLogoutConfirm && (
        <ConfirmModal
          open
          title={t('profile.logoutConfirmTitle')}
          cancelLabel={t('common.cancel')}
          confirmLabel={t('profile.logout')}
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={() => {
            setShowLogoutConfirm(false);
            logout();
          }}
        />
      )}
    </div>
  );
}
