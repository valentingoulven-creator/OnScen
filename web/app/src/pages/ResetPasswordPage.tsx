import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appLoginHref } from '../lib/forgotPasswordRoute';
import { API_BASE } from '../lib/api/core';

function getToken(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') ?? '';
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [token] = useState(getToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError(t('auth.resetPasswordInvalidLink'));
    }
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError(t('auth.resetPasswordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.resetPasswordMismatch'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? t('auth.resetPasswordError'));
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[#0b0b0f]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 items-center justify-center text-2xl mb-4">
            🔐
          </div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {t('auth.resetPasswordTitle')}
          </h1>
        </div>

        <div className="space-y-4 bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-6">
          {done ? (
            <div className="text-center space-y-4">
              <p className="text-3xl">✅</p>
              <p className="text-sm font-semibold text-white">{t('auth.resetPasswordDoneTitle')}</p>
              <p className="text-sm text-gray-400">{t('auth.resetPasswordDoneBody')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && !token ? (
                <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-3 text-center">{error}</p>
              ) : (
                <>
                  <p className="text-sm text-gray-400 leading-relaxed">{t('auth.resetPasswordIntro')}</p>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('auth.resetPasswordNew')}
                    required
                    autoComplete="new-password"
                    autoFocus
                    className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.resetPasswordConfirm')}
                    required
                    autoComplete="new-password"
                    className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-400">{t('auth.resetPasswordMismatch')}</p>
                  )}
                  {error && (
                    <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !token}
                    className="block w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 font-bold text-white text-center transition"
                  >
                    {loading ? '…' : t('auth.resetPasswordSubmit')}
                  </button>
                </>
              )}
            </form>
          )}

          <a
            href={appLoginHref()}
            className="block w-full py-2.5 rounded-xl border border-purple-500/60 bg-purple-950/30 text-sm text-purple-300 font-medium text-center hover:bg-purple-900/40 hover:border-purple-400 transition"
          >
            ← {t('auth.forgotPasswordBack')}
          </a>
        </div>
      </div>
    </div>
  );
}
