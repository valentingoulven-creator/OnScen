import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { PasswordStrengthBar } from './PasswordStrengthBar';
import { getPasswordStrengthAsync } from '../lib/passwordStrength';

interface RequiredPasswordChangeModalProps {
  token: string;
  onChanged: () => void;
  onLogout: () => void;
}

export function RequiredPasswordChangeModal({
  token,
  onChanged,
  onLogout,
}: RequiredPasswordChangeModalProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError(t('settings.passwordTooShort', 'Le mot de passe doit contenir au moins 8 caractères'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('settings.passwordMismatch', 'Les mots de passe ne correspondent pas'));
      return;
    }
    if (newPassword === currentPassword) {
      setError(
        t(
          'auth.passwordChangeMustDiffer',
          'Le nouveau mot de passe doit être différent du mot de passe temporaire'
        )
      );
      return;
    }
    if ((await getPasswordStrengthAsync(newPassword)) === 'faible') {
      setError(t('settings.passwordTooWeak', 'Mot de passe trop faible — ajoutez des chiffres ou symboles'));
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(token, currentPassword, newPassword);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error', 'Erreur'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-black/70">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-[#2d2d3d] bg-[#12121a] p-5 shadow-xl space-y-4"
        role="dialog"
        aria-labelledby="password-change-required-title"
      >
        <h2 id="password-change-required-title" className="text-base font-semibold text-white">
          {t('auth.passwordChangeRequiredTitle', 'Changez votre mot de passe')}
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          {t(
            'auth.passwordChangeRequiredBody',
            'Pour des raisons de sécurité, vous devez définir un nouveau mot de passe avant de continuer.'
          )}
        </p>
        <label className="block space-y-1">
          <span className="text-xs text-gray-400">
            {t('settings.currentPassword', 'Mot de passe actuel')}
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full min-h-[44px] rounded-xl border border-[#2d2d3d] bg-[#0b0b0f] px-3 text-sm text-white"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-gray-400">
            {t('settings.newPassword', 'Nouveau mot de passe')}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full min-h-[44px] rounded-xl border border-[#2d2d3d] bg-[#0b0b0f] px-3 text-sm text-white"
          />
          {newPassword ? <PasswordStrengthBar password={newPassword} /> : null}
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-gray-400">
            {t('settings.confirmPassword', 'Confirmer le mot de passe')}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full min-h-[44px] rounded-xl border border-[#2d2d3d] bg-[#0b0b0f] px-3 text-sm text-white"
          />
        </label>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 min-h-[44px] rounded-xl border border-[#2d2d3d] text-sm text-gray-300 hover:bg-[#1a1a26]"
          >
            {t('auth.logout', 'Se déconnecter')}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 min-h-[44px] rounded-xl bg-purple-600 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {busy
              ? t('common.loading', 'Chargement…')
              : t('auth.passwordChangeContinue', 'Enregistrer et continuer')}
          </button>
        </div>
      </form>
    </div>
  );
}
