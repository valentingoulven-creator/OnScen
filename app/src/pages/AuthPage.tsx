import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { MsdevDualIpPanel } from '../components/MsdevDualIpPanel';
import { LegalDocumentView } from '../components/LegalDocumentView';
import { CURRENT_TERMS_VERSION, type LegalKey } from '../content/legal';
import { peekPendingSalonJoin } from '../lib/salonDeepLink';
import { forgotPasswordHref } from '../lib/forgotPasswordRoute';
import { api } from '../lib/api';
import { PasswordStrengthBar } from '../components/PasswordStrengthBar';
import { getPasswordStrength } from '../lib/passwordStrength';
import type { PublicAccessConfig, User } from '../types';

// ─── OAuth provider status ───────────────────────────────────────────────────

const OAUTH_ERROR_MESSAGES: Record<string, (provider: string) => string> = {
  not_configured: (p) => `La connexion via ${p} n'est pas encore activée.`,
  cancelled:      (p) => `Connexion ${p} annulée.`,
  invalid_state:  ()  => `Requête OAuth expirée. Veuillez réessayer.`,
  server_error:   (p) => `Erreur lors de la connexion ${p}. Veuillez réessayer.`,
  registration_denied: () => 'Inscription refusée. Les inscriptions sont peut-être fermées ou sur invitation.',
  account_pending: () => 'Votre compte est en attente de validation par un administrateur.',
  account_blocked: () => 'Votre compte a été suspendu. Contactez l’administrateur.',
};

function oauthErrorMessage(code: string, provider: string): string {
  const label = provider === 'google' ? 'Google' : provider === 'facebook' ? 'Facebook' : provider;
  const fn = OAUTH_ERROR_MESSAGES[code];
  return fn ? fn(label) : `Erreur de connexion ${label}.`;
}

// ─── Password strength ────────────────────────────────────────────────────────
// See src/components/PasswordStrengthBar.tsx and src/lib/passwordStrength.ts

export function AuthPage() {
  const { t } = useTranslation();
  const { login, register, setSession, token } = useAuth();
  const handleAutoLogin = useCallback(
    (t: string, u: User) => { setSession(t, u); },
    [setSession]
  );
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const isMsdev = import.meta.env.VITE_APP_ENV === 'msdev';
  const [email, setEmail] = useState(isMsdev ? 'listener@msdev.local' : '');
  const [password, setPassword] = useState(isMsdev ? 'msdev123' : '');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [accessConfig, setAccessConfig] = useState<PublicAccessConfig | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [legalPreview, setLegalPreview] = useState<LegalKey | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pendingSalonId = peekPendingSalonJoin();

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // OAuth provider availability (fetched from backend at mount)
  const [oauthProviders, setOauthProviders] = useState<{ google: boolean; facebook: boolean }>({
    google: false,
    facebook: false,
  });
  // True while processing the OAuth callback code from the URL
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthTermsCode, setOauthTermsCode] = useState<string | null>(null);
  const [oauthAcceptTerms, setOauthAcceptTerms] = useState(false);
  const [oauthTermsBusy, setOauthTermsBusy] = useState(false);

  const checkUsername = useCallback((value: string) => {
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (!value || value.length < 2) {
      setUsernameStatus('idle');
      setUsernameMessage('');
      return;
    }
    setUsernameStatus('checking');
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await api.checkUsername(value);
        if (res.available) {
          setUsernameStatus('available');
          setUsernameMessage('Pseudo disponible');
        } else {
          setUsernameStatus('taken');
          setUsernameMessage(res.reason ?? 'Pseudo non disponible');
        }
      } catch {
        setUsernameStatus('idle');
        setUsernameMessage('');
      }
    }, 400);
  }, []);

  useEffect(() => {
    api.getAccessConfig().then(setAccessConfig).catch(() => {});
    api.getOAuthProviders().then(setOauthProviders).catch(() => {});
  }, []);

  // Handle OAuth callback: backend redirects to /?oauth_code=… after Google/Facebook auth.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthCode = params.get('oauth_code');
    const isNewUser    = params.get('new_user') === '1';
    const oauthErrCode = params.get('oauth_error');
    const provider     = params.get('provider') ?? '';
    const oauthPending = params.get('oauth_pending') === '1';
    const needsTerms   = params.get('needs_terms') === '1';

    const stripOAuthParams = () => {
      params.delete('oauth_code');
      params.delete('new_user');
      params.delete('oauth_error');
      params.delete('provider');
      params.delete('oauth_pending');
      params.delete('needs_terms');
      const q = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
    };

    if (oauthPending) {
      setRegisterSuccess(
        'Inscription enregistrée. Un administrateur doit valider votre compte avant la première connexion.'
      );
      setMode('login');
      stripOAuthParams();
      return;
    }

    if (oauthErrCode) {
      setError(oauthErrorMessage(oauthErrCode, provider));
      stripOAuthParams();
      return;
    }

    if (!oauthCode) return;

    if (needsTerms) {
      setOauthTermsCode(oauthCode);
      stripOAuthParams();
      return;
    }

    stripOAuthParams();
    setOauthLoading(true);
    api.exchangeOAuthCode(oauthCode)
      .then((r) => {
        if (r.pending) {
          setRegisterSuccess(
            r.message ||
              'Inscription enregistrée. Un administrateur doit valider votre compte avant la première connexion.'
          );
          setMode('login');
          setOauthLoading(false);
          return;
        }
        if (!r.token || !r.user) {
          throw new Error('Réponse OAuth invalide');
        }
        setSession(r.token, r.user, true, isNewUser || r.isNew);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Connexion sociale échouée.';
        if (msg.includes('CGU') || msg.includes('Politique')) {
          setOauthTermsCode(oauthCode);
          setOauthLoading(false);
          return;
        }
        setError(msg.includes('expiré') || msg.includes('invalide') ? 'Connexion sociale échouée. Le code est invalide ou expiré.' : msg);
        setOauthLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const completeOAuthTerms = async () => {
    if (!oauthTermsCode || !oauthAcceptTerms) {
      setError('Vous devez accepter les CGU et la Politique de confidentialité');
      return;
    }
    setOauthTermsBusy(true);
    setError('');
    try {
      const r = await api.exchangeOAuthCode(oauthTermsCode, {
        acceptTerms: true,
        termsVersion: CURRENT_TERMS_VERSION,
      });
      if (r.pending) {
        setRegisterSuccess(
          r.message ||
            'Inscription enregistrée. Un administrateur doit valider votre compte avant la première connexion.'
        );
        setOauthTermsCode(null);
        setMode('login');
        return;
      }
      if (!r.token || !r.user) throw new Error('Réponse OAuth invalide');
      setSession(r.token, r.user, true, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion sociale échouée.');
    } finally {
      setOauthTermsBusy(false);
    }
  };

  useEffect(() => {
    return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRegisterSuccess('');

    if (mode === 'register') {
      if (accessConfig?.registrationClosed && accessConfig.registrationMode === 'closed') {
        setError('Les inscriptions sont fermées. Demandez une invitation à l’administrateur.');
        return;
      }
      if (!acceptTerms) {
        setError('Vous devez accepter les CGU et la Politique de confidentialité');
        return;
      }
      if (username.trim().length < 2) {
        setError('Le pseudo doit faire au moins 2 caractères');
        return;
      }
      if (usernameStatus === 'taken') {
        setError(usernameMessage || 'Ce pseudo est déjà pris');
        return;
      }
      if (!email.includes('@') || !email.includes('.')) {
        setError('Adresse e-mail invalide');
        return;
      }
      if (password.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères');
        return;
      }
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas');
        return;
      }
      if (getPasswordStrength(password) === 'faible') {
        setError('Mot de passe trop faible. Ajoutez des chiffres, majuscules ou symboles');
        return;
      }
      if (accessConfig?.inviteRequired && !inviteCode.trim()) {
        setError('Code d’invitation requis pour créer un compte.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password, rememberMe);
      } else {
        await register(username.trim(), email, password, true, CURRENT_TERMS_VERSION, inviteCode.trim());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      if (mode === 'register' && msg.includes('validation')) {
        setRegisterSuccess(msg);
        setMode('login');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (oauthLoading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-[#0b0b0f] text-gray-400">
        <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
        <p className="text-sm">Connexion en cours…</p>
      </div>
    );
  }

  if (legalPreview) {
    return (
      <div className="min-h-dvh bg-[#0b0b0f]">
        <LegalDocumentView docKey={legalPreview} onBack={() => setLegalPreview(null)} />
      </div>
    );
  }

  if (oauthTermsCode) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[#0b0b0f]">
        <div className="w-full max-w-sm bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white text-center">Finaliser votre inscription</h2>
          <p className="text-sm text-gray-400 text-center">
            Acceptez les conditions pour activer votre compte créé via Google ou Facebook.
          </p>
          <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-400 leading-snug">
            <input
              type="checkbox"
              checked={oauthAcceptTerms}
              onChange={(e) => setOauthAcceptTerms(e.target.checked)}
              className="melosong-checkbox mt-0.5 shrink-0"
            />
            <span>
              {t('auth.acceptTermsPrefix')}{' '}
              <button type="button" className="text-purple-400 underline" onClick={() => setLegalPreview('terms')}>
                {t('auth.termsLink')}
              </button>{' '}
              {t('auth.acceptTermsAnd')}{' '}
              <button type="button" className="text-purple-400 underline" onClick={() => setLegalPreview('privacy')}>
                {t('auth.privacyLink')}
              </button>{' '}
              (v.{CURRENT_TERMS_VERSION})
            </span>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="button"
            disabled={oauthTermsBusy || !oauthAcceptTerms}
            onClick={() => void completeOAuthTerms()}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white disabled:opacity-50 transition"
          >
            {oauthTermsBusy ? 'Validation…' : 'Continuer'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[#0b0b0f]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 items-center justify-center text-2xl mb-4">
            ♪
          </div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {t('app.name')}
          </h1>
          <p className="text-gray-400 text-sm mt-2">{t('app.tagline')}</p>
        </div>

        {pendingSalonId && (
          <p className="mb-4 text-center text-xs text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-3">
            {t('auth.pendingSalon')}
          </p>
        )}

        {accessConfig?.enabled && (
          <p className="mb-4 text-center text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            {t('auth.secureAccess')}
            {accessConfig.adminApprovalRequired && t('auth.adminApproval')}
          </p>
        )}

        {registerSuccess && (
          <p className="mb-4 text-center text-xs text-green-300 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
            {registerSuccess}
          </p>
        )}

        <form onSubmit={submit} className="space-y-4 bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-6">
          {mode === 'register' && (
            <div className="space-y-1">
              <div className="relative">
                <input
                  className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white pr-9"
                  placeholder={t('auth.username')}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    checkUsername(e.target.value);
                  }}
                  required
                  autoComplete="username"
                />
                {usernameStatus === 'checking' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
                )}
                {usernameStatus === 'available' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">✓</span>
                )}
                {usernameStatus === 'taken' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 text-sm">✗</span>
                )}
              </div>
              {usernameMessage && (
                <p className={`text-[11px] ${usernameStatus === 'available' ? 'text-green-400' : 'text-red-400'}`}>
                  {usernameMessage}
                </p>
              )}
            </div>
          )}

          {mode === 'register' && accessConfig?.inviteRequired && (
            <input
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white font-mono uppercase"
              placeholder="Code d’invitation"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              autoComplete="off"
            />
          )}

          <input
            className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
            type="email"
            placeholder={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <div className="space-y-2">
            <input
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
              type="password"
              placeholder={t('auth.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'login' && (
              <div className="flex justify-end">
                <a
                  href={forgotPasswordHref()}
                  className="text-xs text-purple-400 hover:text-purple-300 underline transition"
                >
                  {t('auth.forgotPassword')}
                </a>
              </div>
            )}
            {mode === 'register' && <PasswordStrengthBar password={password} />}
          </div>

          {mode === 'register' && (
            <input
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
              type="password"
              placeholder={t('auth.confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          )}

          {mode === 'register' && confirmPassword && password !== confirmPassword && (
            <p className="text-[11px] text-red-400">{t('auth.passwordMismatch')}</p>
          )}

          {mode === 'register' && accessConfig?.inviteRequired && (
            <input
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
              type="text"
              placeholder={t('auth.inviteCode')}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoComplete="off"
            />
          )}

          {mode === 'login' && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="melosong-checkbox mt-0.5 shrink-0"
              />
              <span className="text-xs text-gray-400 leading-snug">
                {t('auth.rememberMe')}
                <span className="block text-[10px] text-gray-500 mt-0.5">
                  {t('auth.rememberMeHint')}
                </span>
              </span>
            </label>
          )}

          {mode === 'register' && (
            <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-400 leading-snug">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="melosong-checkbox mt-0.5 shrink-0"
                required
              />
              <span>
                {t('auth.acceptTermsPrefix')}{' '}
                <button type="button" className="text-purple-400 underline" onClick={() => setLegalPreview('terms')}>
                  {t('auth.termsLink')}
                </button>{' '}
                {t('auth.acceptTermsAnd')}{' '}
                <button type="button" className="text-purple-400 underline" onClick={() => setLegalPreview('privacy')}>
                  {t('auth.privacyLink')}
                </button>{' '}
                (v.{CURRENT_TERMS_VERSION})
              </span>
            </label>
          )}

          {mode === 'register' && (
            <p className="text-[10px] text-gray-500 leading-snug">{t('auth.minAgeNotice')}</p>
          )}

          {mode === 'register' && (
            <p className="text-[10px] text-amber-400/80 leading-snug">{t('auth.spotifyHostPremiumNotice')}</p>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
              <span className="text-red-400 shrink-0 mt-0.5">⚠</span>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {registerSuccess && (
            <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2">
              <span className="text-green-400 shrink-0 mt-0.5">✓</span>
              <p className="text-green-400 text-sm">{registerSuccess}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (mode === 'register' && !acceptTerms)}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white disabled:opacity-50 transition"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2 justify-center">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {mode === 'login' ? t('auth.submitLoginLoading') : t('auth.submitRegisterLoading')}
              </span>
            ) : (
              mode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister')
            )}
          </button>
        </form>

        {/* ── Connexion sociale ─────────────────────────────────────────── */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#1e1e2f]" />
            <span className="text-[11px] text-gray-500 shrink-0">ou continuer avec</span>
            <div className="h-px flex-1 bg-[#1e1e2f]" />
          </div>

          {/* Google */}
          <button
            type="button"
            disabled={!oauthProviders.google}
            onClick={() => { window.location.href = '/api/auth/google'; }}
            title={oauthProviders.google ? 'Continuer avec Google' : 'Bientôt disponible'}
            className={[
              'w-full flex items-center gap-3 py-2.5 px-4 rounded-xl border text-sm font-medium transition',
              oauthProviders.google
                ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100 cursor-pointer'
                : 'bg-[#12121a] border-[#2a2a3a] text-gray-600 cursor-not-allowed opacity-60',
            ].join(' ')}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span className="flex-1 text-left">Continuer avec Google</span>
            {!oauthProviders.google && (
              <span className="text-[10px] text-gray-500 font-normal">Bientôt disponible</span>
            )}
          </button>

          {/* Facebook */}
          <button
            type="button"
            disabled={!oauthProviders.facebook}
            onClick={() => { window.location.href = '/api/auth/facebook'; }}
            title={oauthProviders.facebook ? 'Continuer avec Facebook' : 'Bientôt disponible'}
            className={[
              'w-full flex items-center gap-3 py-2.5 px-4 rounded-xl border text-sm font-medium transition',
              oauthProviders.facebook
                ? 'bg-[#1877F2] border-[#1877F2] text-white hover:bg-[#166FE5] active:bg-[#1565D8] cursor-pointer'
                : 'bg-[#12121a] border-[#2a2a3a] text-gray-600 cursor-not-allowed opacity-60',
            ].join(' ')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="shrink-0"
              fill={oauthProviders.facebook ? 'white' : '#4b5563'}
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span className="flex-1 text-left">Continuer avec Facebook</span>
            {!oauthProviders.facebook && (
              <span className="text-[10px] text-gray-500 font-normal">Bientôt disponible</span>
            )}
          </button>
        </div>

        <MsdevDualIpPanel onAutoLogin={handleAutoLogin} hasToken={Boolean(token)} />

        {import.meta.env.VITE_APP_ENV === 'msdev' && (
          <p className="mt-4 text-center text-[11px] text-gray-500 leading-relaxed">
            Compte démo msdev
            <br />
            <span className="text-gray-400 font-mono text-[10px]">listener@msdev.local</span>
            {' · '}
            <span className="text-gray-400 font-mono text-[10px]">msdev123</span>
          </p>
        )}

        {!(accessConfig?.registrationMode === 'closed' && mode === 'login') && (
        <button
          type="button"
          className="w-full mt-4 border border-purple-500/60 bg-purple-950/30 py-2.5 px-4 rounded-xl text-sm text-purple-300 font-medium hover:bg-purple-900/40 hover:border-purple-400 transition"
          onClick={() => {
            if (accessConfig?.registrationMode === 'closed') return;
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
            setRegisterSuccess('');
            setConfirmPassword('');
            setUsernameStatus('idle');
            setUsernameMessage('');
          }}
        >
          {mode === 'login'
            ? accessConfig?.registrationMode === 'closed'
              ? t('auth.registrationClosed')
              : t('auth.createAccount')
            : t('auth.alreadyRegistered')}
        </button>
        )}
      </div>
    </div>
  );
}
