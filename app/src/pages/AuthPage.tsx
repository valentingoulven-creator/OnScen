import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MsdevDualIpPanel } from '../components/MsdevDualIpPanel';
import { LegalDocumentView } from '../components/LegalDocumentView';
import { CURRENT_TERMS_VERSION, type LegalKey } from '../content/legal';
import { peekPendingSalonJoin } from '../lib/salonDeepLink';
import { api } from '../lib/api';
import type { PublicAccessConfig, User } from '../types';

type PasswordStrength = 'vide' | 'faible' | 'moyen' | 'fort';

function getPasswordStrength(pwd: string): PasswordStrength {
  if (!pwd) return 'vide';
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return 'faible';
  if (score <= 3) return 'moyen';
  return 'fort';
}

const STRENGTH_CONFIG: Record<PasswordStrength, { label: string; color: string; bars: number }> = {
  vide:   { label: '',       color: 'bg-gray-700',  bars: 0 },
  faible: { label: 'Faible', color: 'bg-red-500',   bars: 1 },
  moyen:  { label: 'Moyen',  color: 'bg-yellow-400', bars: 2 },
  fort:   { label: 'Fort',   color: 'bg-green-500', bars: 3 },
};

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const cfg = STRENGTH_CONFIG[strength];
  if (!password) return null;
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < cfg.bars ? cfg.color : 'bg-gray-700'}`}
          />
        ))}
      </div>
      {cfg.label && (
        <p className={`text-[11px] font-medium ${
          strength === 'faible' ? 'text-red-400' : strength === 'moyen' ? 'text-yellow-400' : 'text-green-400'
        }`}>
          Sécurité : {cfg.label}
        </p>
      )}
    </div>
  );
}

export function AuthPage() {
  const { login, register, setSession, token } = useAuth();
  const handleAutoLogin = useCallback(
    (t: string, u: User) => { setSession(t, u); },
    [setSession]
  );
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('listener@msdev.local');
  const [password, setPassword] = useState('msdev123');
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
  }, []);

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

  if (legalPreview) {
    return (
      <div className="min-h-dvh bg-[#0b0b0f]">
        <LegalDocumentView docKey={legalPreview} onBack={() => setLegalPreview(null)} />
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
            Soundly
          </h1>
          <p className="text-gray-400 text-sm mt-2">Salons musicaux · Lives · Géoloc</p>
        </div>

        {pendingSalonId && (
          <p className="mb-4 text-center text-xs text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-3">
            Connectez-vous pour rejoindre le salon partagé.
          </p>
        )}

        {accessConfig?.enabled && (
          <p className="mb-4 text-center text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            Accès Internet sécurisé — seuls les comptes autorisés peuvent se connecter.
            {accessConfig.adminApprovalRequired && ' Les nouvelles inscriptions nécessitent une validation administrateur.'}
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
                  placeholder="Pseudo"
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
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <div className="space-y-2">
            <input
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && <PasswordStrengthBar password={password} />}
          </div>

          {mode === 'register' && (
            <input
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
              type="password"
              placeholder="Confirmer le mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          )}

          {mode === 'register' && confirmPassword && password !== confirmPassword && (
            <p className="text-[11px] text-red-400">Les mots de passe ne correspondent pas</p>
          )}

          {mode === 'register' && accessConfig?.inviteRequired && (
            <input
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
              type="text"
              placeholder="Code d'invitation"
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
                Rester connecté
                <span className="block text-[10px] text-gray-500 mt-0.5">
                  Ne pas utiliser sur un appareil partagé
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
                J&apos;accepte les{' '}
                <button type="button" className="text-purple-400 underline" onClick={() => setLegalPreview('terms')}>
                  CGU
                </button>{' '}
                et la{' '}
                <button type="button" className="text-purple-400 underline" onClick={() => setLegalPreview('privacy')}>
                  Politique de confidentialité
                </button>{' '}
                (v.{CURRENT_TERMS_VERSION})
              </span>
            </label>
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
                {mode === 'login' ? 'Connexion…' : 'Création…'}
              </span>
            ) : (
              mode === 'login' ? 'Se connecter' : "S'inscrire"
            )}
          </button>
        </form>

        <MsdevDualIpPanel onAutoLogin={handleAutoLogin} hasToken={Boolean(token)} />

        {import.meta.env.VITE_APP_ENV === 'msdev' && (
          <p className="mt-4 text-center text-[11px] text-gray-500 leading-relaxed">
            Compte démo msdev
            <br />
            <span className="text-gray-400 font-mono text-[10px]">listener@msdev.local</span>
            {' · '}
            <span className="text-gray-400 font-mono text-[10px]">msdev123</span>
            <br />
            <span className="text-[10px] text-purple-400/80">
              Si le serveur est en HTTPS : ouvrez https://localhost:4080 (pas http://)
            </span>
          </p>
        )}

        {!(accessConfig?.registrationMode === 'closed' && mode === 'login') && (
        <button
          type="button"
          className="w-full mt-4 text-sm text-gray-400 hover:text-purple-400 transition"
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
              ? 'Inscriptions fermées'
              : 'Créer un compte'
            : 'Déjà inscrit ? Connexion'}
        </button>
        )}
      </div>
    </div>
  );
}
