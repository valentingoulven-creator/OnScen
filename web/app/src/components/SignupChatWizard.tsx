import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OnScenLogo } from './OnScenLogo';
import { AuthPageShell } from './AuthSpaceBackground';
import { PasswordStrengthBar } from './PasswordStrengthBar';
import { CURRENT_TERMS_VERSION, type LegalKey } from '../content/legal';
import { api } from '../lib/api';
import { getPasswordStrengthAsync, preloadPasswordStrength } from '../lib/passwordStrength';
import type { PublicAccessConfig, User } from '../types';

type Step =
  | 'choose'
  | 'username'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'invite'
  | 'age'
  | 'terms'
  | 'done';

type SignupStyle = 'choosing' | 'guided' | 'classic';

type ChatLine = { id: string; role: 'bot' | 'user'; text: string };

export type SignupChatResult =
  | { kind: 'session'; token: string; user: User }
  | { kind: 'pending'; message: string }
  | { kind: 'emailVerification'; message: string };

export interface SignupChatWizardProps {
  accessConfig: PublicAccessConfig | null;
  onBack: () => void;
  onLegalPreview: (key: LegalKey) => void;
  onComplete: (result: SignupChatResult) => void;
}

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SignupChatWizard({
  accessConfig,
  onBack,
  onLegalPreview,
  onComplete,
}: SignupChatWizardProps) {
  const { t } = useTranslation();
  const [signupStyle, setSignupStyle] = useState<SignupStyle>('choosing');
  const [lines, setLines] = useState<ChatLine[]>(() => [
    {
      id: nextId(),
      role: 'bot',
      text: t('auth.signupChat.welcomeChoose', {
        defaultValue:
          'Salut ! 👋 Je suis OnScen. On va créer ton compte — tu préfères qu’on avance ensemble, pas à pas, ou tu remplis le formulaire tranquillement, sans moi ?',
      }),
    },
  ]);
  const [step, setStep] = useState<Step>('choose');
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [confirmAge, setConfirmAge] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void preloadPasswordStrength();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, step, error, signupStyle]);

  useEffect(() => {
    if (signupStyle === 'classic' || step === 'choose') return;
    inputRef.current?.focus();
  }, [step, signupStyle]);

  useEffect(() => {
    return () => {
      if (usernameTimer.current) clearTimeout(usernameTimer.current);
    };
  }, []);

  const checkUsernameLive = useCallback((value: string) => {
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (!value || value.trim().length < 2) {
      setUsernameStatus('idle');
      setUsernameMessage('');
      return;
    }
    setUsernameStatus('checking');
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await api.checkUsername(value.trim());
        if (res.available) {
          setUsernameStatus('available');
          setUsernameMessage(t('auth.signupChat.usernameAvailable', { defaultValue: 'Pseudo disponible' }));
        } else {
          setUsernameStatus('taken');
          setUsernameMessage(res.reason ?? t('auth.signupChat.usernameTaken', { defaultValue: 'Pseudo non disponible' }));
        }
      } catch {
        setUsernameStatus('idle');
        setUsernameMessage('');
      }
    }, 400);
  }, [t]);

  const pushBot = useCallback((text: string) => {
    setLines((prev) => [...prev, { id: nextId(), role: 'bot', text }]);
  }, []);

  const pushUser = useCallback((text: string) => {
    setLines((prev) => [...prev, { id: nextId(), role: 'user', text }]);
  }, []);

  const checkUsernameAvailable = async (value: string): Promise<string | null> => {
    try {
      const res = await api.checkUsername(value.trim());
      if (res.available) return null;
      return res.reason ?? 'Ce pseudo n’est pas disponible';
    } catch {
      return null;
    }
  };

  const submitUsername = async () => {
    const value = input.trim();
    if (value.length < 2) {
      setError('Le pseudo doit faire au moins 2 caractères');
      return;
    }
    setError('');
    setLoading(true);
    const reason = await checkUsernameAvailable(value);
    setLoading(false);
    if (reason) {
      setError(reason);
      return;
    }
    setUsername(value);
    pushUser(value);
    setInput('');
    pushBot(
      t('auth.signupChat.askEmail', {
        defaultValue: `Nickel, ${value} ! Quelle adresse e-mail tu utilises pour te connecter ?`,
        name: value,
      })
    );
    setStep('email');
  };

  const submitEmail = () => {
    const value = input.trim();
    if (!value.includes('@') || !value.includes('.')) {
      setError('Adresse e-mail invalide');
      return;
    }
    setError('');
    setEmail(value);
    pushUser(value);
    setInput('');
    pushBot(
      t('auth.signupChat.askPassword', {
        defaultValue: 'Parfait. Choisis un mot de passe (8 caractères minimum, idéalement lettres + chiffres).',
      })
    );
    setStep('password');
  };

  const submitPassword = async () => {
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if ((await getPasswordStrengthAsync(password)) === 'faible') {
      setError('Mot de passe trop faible. Ajoute des chiffres, majuscules ou symboles');
      return;
    }
    setError('');
    pushUser('••••••••');
    pushBot(
      t('auth.signupChat.askConfirmPassword', {
        defaultValue: 'Encore une fois le même mot de passe, pour être sûr qu’on ne se trompe pas 🙂',
      })
    );
    setStep('confirmPassword');
    setInput('');
  };

  const submitConfirmPassword = () => {
    if (input !== password) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setConfirmPassword(input);
    setError('');
    pushUser('••••••••');
    setInput('');
    if (accessConfig?.inviteRequired) {
      pushBot(
        t('auth.signupChat.askInvite', {
          defaultValue: 'Tu as un code d’invitation ? Colle-le ici (obligatoire pour s’inscrire).',
        })
      );
      setStep('invite');
    } else {
      pushBot(
        t('auth.signupChat.askAge', {
          defaultValue: 'Presque fini ! Confirme que tu as au moins 13 ans — c’est requis pour utiliser OnScen.',
        })
      );
      setStep('age');
    }
  };

  const submitInvite = () => {
    const value = input.trim();
    if (!value) {
      setError('Code d’invitation requis');
      return;
    }
    setError('');
    setInviteCode(value);
    pushUser(value);
    setInput('');
    pushBot(
      t('auth.signupChat.askAge', {
        defaultValue: 'Presque fini ! Confirme que tu as au moins 13 ans — c’est requis pour utiliser OnScen.',
      })
    );
    setStep('age');
  };

  const submitAge = () => {
    if (!confirmAge) {
      setError("Tu dois confirmer avoir au moins 13 ans");
      return;
    }
    setError('');
    pushUser(t('auth.ageConfirmCheckbox', { defaultValue: "J'ai au moins 13 ans" }));
    pushBot(
      t('auth.signupChat.askTerms', {
        defaultValue: 'Dernière étape : accepte nos conditions pour activer ton compte.',
      })
    );
    setStep('terms');
  };

  const chooseGuidedSignup = () => {
    setError('');
    setSignupStyle('guided');
    pushUser(t('auth.signupChat.withMe', { defaultValue: 'Avec toi' }));
    pushBot(
      t('auth.signupChat.welcomeGuided', {
        defaultValue: 'Super, on y va ! Commence par ton pseudo : comment veux-tu qu’on t’appelle sur l’app ?',
      })
    );
    setStep('username');
  };

  const chooseClassicSignup = () => {
    setError('');
    setSignupStyle('classic');
    setStep('done');
  };

  const registerWithApi = async (options: { chatFeedback: boolean }) => {
    if (accessConfig?.registrationClosed && accessConfig.registrationMode === 'closed') {
      setError('Les inscriptions sont fermées.');
      return;
    }
    setError('');
    setLoading(true);
    if (options.chatFeedback) {
      pushUser(
        t('auth.signupChat.userAcceptTerms', { defaultValue: "J'accepte les CGU et la politique de confidentialité" })
      );
      pushBot(t('auth.signupChat.creating', { defaultValue: 'Je crée ton compte… un instant ✨' }));
      setStep('done');
    }
    try {
      const r = await api.register(
        username.trim(),
        email,
        password,
        true,
        CURRENT_TERMS_VERSION,
        inviteCode.trim(),
        confirmAge
      );
      if (r.pending) {
        onComplete({
          kind: 'pending',
          message:
            r.message ||
            'Inscription enregistrée. Un administrateur doit valider ton compte avant la première connexion.',
        });
        return;
      }
      if (r.emailVerificationRequired) {
        onComplete({
          kind: 'emailVerification',
          message:
            r.message ||
            'Compte créé. Consulte tes e-mails pour activer ton compte avant de te connecter.',
        });
        return;
      }
      if (!r.token || !r.user) {
        throw new Error('Réponse d’inscription invalide');
      }
      if (options.chatFeedback) {
        pushBot(
          t('auth.signupChat.success', {
            defaultValue: 'C’est bon ! On personnalise ton profil ensemble maintenant 🎧',
          })
        );
      }
      onComplete({ kind: 'session', token: r.token, user: r.user });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      if (options.chatFeedback) {
        setStep('terms');
        pushBot(
          t('auth.signupChat.errorRetry', {
            defaultValue: 'Oups, quelque chose a bloqué. Corrige ci-dessous et réessaie.',
          })
        );
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    if (!acceptTerms || !confirmAge) {
      setError('Accepte les conditions et confirme ton âge pour continuer');
      return;
    }
    await registerWithApi({ chatFeedback: true });
  };

  const submitClassicForm = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if ((await getPasswordStrengthAsync(password)) === 'faible') {
      setError('Mot de passe trop faible. Ajoute des chiffres, majuscules ou symboles');
      return;
    }
    if (accessConfig?.inviteRequired && !inviteCode.trim()) {
      setError('Code d’invitation requis pour créer un compte.');
      return;
    }
    if (!confirmAge) {
      setError("Tu dois confirmer avoir au moins 13 ans");
      return;
    }
    if (!acceptTerms) {
      setError('Accepte les conditions pour continuer');
      return;
    }
    await registerWithApi({ chatFeedback: false });
  };

  const handleSend = () => {
    if (loading || step === 'done' || step === 'choose') return;
    switch (step) {
      case 'username':
        void submitUsername();
        break;
      case 'email':
        submitEmail();
        break;
      case 'password':
        void submitPassword();
        break;
      case 'confirmPassword':
        submitConfirmPassword();
        break;
      case 'invite':
        submitInvite();
        break;
      default:
        break;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && step !== 'age' && step !== 'terms') {
      e.preventDefault();
      handleSend();
    }
  };

  const showTextInput = signupStyle === 'guided' && ['username', 'email', 'invite'].includes(step);
  const showConfirmInput = signupStyle === 'guided' && step === 'confirmPassword';
  const showGuidedFooter =
    signupStyle === 'guided' && ['password', 'confirmPassword', 'username', 'email', 'invite', 'age', 'terms'].includes(step);

  return (
    <AuthPageShell className="flex flex-col">
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[#1e1e2f]/80 bg-[#0b0b0f]/45 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-white transition shrink-0"
        >
          ← {t('auth.signupChat.backLogin', { defaultValue: 'Connexion' })}
        </button>
        <OnScenLogo className="h-7 w-7 mx-auto opacity-90 sm:h-8 sm:w-8" />
        <span className="w-14 shrink-0" aria-hidden />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 max-w-md mx-auto w-full"
      >
        {signupStyle !== 'classic' ? (
          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.id}
                className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    line.role === 'bot'
                      ? 'bg-[#1a1a26] border border-[#2d2d3d] text-gray-100 rounded-bl-md'
                      : 'bg-purple-600/90 text-white rounded-br-md'
                  }`}
                >
                  {line.text}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form
            onSubmit={(e) => void submitClassicForm(e)}
            className="space-y-4 bg-[#12121a]/90 border border-[#1e1e2f] rounded-2xl p-5 backdrop-blur-sm"
          >
            <div>
              <p className="text-xs text-purple-300/90 font-medium text-center">
                {t('auth.signupChat.classicStep', { defaultValue: 'Étape 1 sur 2 — ton compte' })}
              </p>
              <h2 className="text-lg font-bold text-white text-center mt-1">
                {t('auth.signupChat.classicTitle', { defaultValue: 'Création de ton compte' })}
              </h2>
              <p className="text-sm text-gray-400 text-center mt-1">
                {t('auth.signupChat.classicSubtitle', {
                  defaultValue: 'Remplis les champs ci-dessous pour t’inscrire.',
                })}
              </p>
            </div>

            <div className="space-y-1">
              <div className="relative">
                <input
                  className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white pr-9"
                  placeholder={t('auth.username')}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    checkUsernameLive(e.target.value);
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
              {usernameMessage ? (
                <p className={`text-[11px] ${usernameStatus === 'available' ? 'text-green-400' : 'text-red-400'}`}>
                  {usernameMessage}
                </p>
              ) : null}
            </div>

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
                autoComplete="new-password"
              />
              <PasswordStrengthBar password={password} />
            </div>

            <input
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
              type="password"
              placeholder={t('auth.confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            {confirmPassword && password !== confirmPassword ? (
              <p className="text-[11px] text-red-400">{t('auth.passwordMismatch')}</p>
            ) : null}

            {accessConfig?.inviteRequired ? (
              <input
                className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white font-mono uppercase"
                placeholder={t('auth.inviteCode')}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                autoComplete="off"
              />
            ) : null}

            <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-300 leading-snug">
              <input
                type="checkbox"
                checked={confirmAge}
                onChange={(e) => setConfirmAge(e.target.checked)}
                className="onscen-checkbox mt-0.5 shrink-0"
                required
              />
              <span>{t('auth.ageConfirmCheckbox')}</span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-300 leading-snug">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="onscen-checkbox mt-0.5 shrink-0"
                required
              />
              <span>
                {t('auth.acceptTermsPrefix')}{' '}
                <button type="button" className="text-purple-400 underline" onClick={() => onLegalPreview('terms')}>
                  {t('auth.termsLink')}
                </button>{' '}
                {t('auth.acceptTermsAnd')}{' '}
                <button type="button" className="text-purple-400 underline" onClick={() => onLegalPreview('privacy')}>
                  {t('auth.privacyLink')}
                </button>{' '}
                (v.{CURRENT_TERMS_VERSION})
              </span>
            </label>
            <p className="text-[10px] text-gray-500">{t('auth.minAgeNotice')}</p>

            {error ? (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading || !acceptTerms || !confirmAge}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white disabled:opacity-50 transition"
            >
              {loading ? t('auth.submitRegisterLoading') : t('auth.submitRegister')}
            </button>

            <button
              type="button"
              className="w-full text-center text-xs text-gray-500 hover:text-purple-300 transition"
              onClick={() => {
                setSignupStyle('choosing');
                setStep('choose');
                setError('');
                setLines([
                  {
                    id: nextId(),
                    role: 'bot',
                    text: t('auth.signupChat.welcomeChoose', {
                      defaultValue:
                        'Salut ! 👋 Je suis OnScen. On va créer ton compte — tu préfères qu’on avance ensemble, pas à pas, ou tu remplis le formulaire tranquillement, sans moi ?',
                    }),
                  },
                ]);
              }}
            >
              {t('auth.signupChat.backToChoice', { defaultValue: '← Choisir le mode avec / sans assistant' })}
            </button>
          </form>
        )}
      </div>

      {signupStyle !== 'classic' ? (
      <div className="shrink-0 border-t border-[#1e1e2f]/80 bg-[#12121a]/85 backdrop-blur-md px-4 py-3 max-w-md mx-auto w-full pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && signupStyle !== 'choosing' ? (
          <p className="text-xs text-red-400 mb-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        ) : null}

        {signupStyle === 'choosing' ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={chooseGuidedSignup}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-white text-sm transition"
            >
              {t('auth.signupChat.withMe', { defaultValue: 'Avec toi' })}
            </button>
            <button
              type="button"
              onClick={chooseClassicSignup}
              className="w-full py-3 rounded-xl border border-[#2d2d3d] bg-[#1a1a26] hover:border-purple-500/50 font-semibold text-gray-200 text-sm transition"
            >
              {t('auth.signupChat.withoutMe', { defaultValue: 'Sans toi' })}
            </button>
          </div>
        ) : null}

        {showGuidedFooter && step === 'password' && (
          <div className="space-y-2 mb-3">
            <input
              ref={inputRef}
              type="password"
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
              placeholder={t('auth.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitPassword();
                }
              }}
            />
            <PasswordStrengthBar password={password} />
            <button
              type="button"
              disabled={loading || password.length < 8}
              onClick={() => void submitPassword()}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-white text-sm disabled:opacity-50 transition"
            >
              {t('auth.signupChat.send', { defaultValue: 'Continuer' })}
            </button>
          </div>
        )}

        {showConfirmInput && (
          <div className="flex gap-2 mb-1">
            <input
              ref={inputRef}
              type="password"
              className="flex-1 min-w-0 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
              placeholder={t('auth.confirmPassword')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="new-password"
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              disabled={loading || !input}
              onClick={handleSend}
              className="shrink-0 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-white text-sm disabled:opacity-50 transition"
            >
              →
            </button>
          </div>
        )}

        {showTextInput && (
          <div className="flex gap-2 mb-1">
            <input
              ref={inputRef}
              type={step === 'email' ? 'email' : 'text'}
              className="flex-1 min-w-0 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
              placeholder={
                step === 'username'
                  ? t('auth.username')
                  : step === 'email'
                    ? t('auth.email')
                    : t('auth.inviteCode')
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete={step === 'email' ? 'email' : step === 'username' ? 'username' : 'off'}
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              disabled={loading || !input.trim()}
              onClick={handleSend}
              className="shrink-0 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-white text-sm disabled:opacity-50 transition"
            >
              {loading ? '…' : '→'}
            </button>
          </div>
        )}

        {signupStyle === 'guided' && step === 'age' && (
          <div className="space-y-3">
            <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-300 leading-snug">
              <input
                type="checkbox"
                checked={confirmAge}
                onChange={(e) => setConfirmAge(e.target.checked)}
                className="onscen-checkbox mt-0.5 shrink-0"
              />
              <span>{t('auth.ageConfirmCheckbox')}</span>
            </label>
            <button
              type="button"
              disabled={!confirmAge}
              onClick={submitAge}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-white text-sm disabled:opacity-50 transition"
            >
              {t('auth.signupChat.send', { defaultValue: 'Continuer' })}
            </button>
          </div>
        )}

        {signupStyle === 'guided' && step === 'terms' && (
          <div className="space-y-3">
            <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-300 leading-snug">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="onscen-checkbox mt-0.5 shrink-0"
              />
              <span>
                {t('auth.acceptTermsPrefix')}{' '}
                <button type="button" className="text-purple-400 underline" onClick={() => onLegalPreview('terms')}>
                  {t('auth.termsLink')}
                </button>{' '}
                {t('auth.acceptTermsAnd')}{' '}
                <button type="button" className="text-purple-400 underline" onClick={() => onLegalPreview('privacy')}>
                  {t('auth.privacyLink')}
                </button>{' '}
                (v.{CURRENT_TERMS_VERSION})
              </span>
            </label>
            <p className="text-[10px] text-gray-500">{t('auth.minAgeNotice')}</p>
            <button
              type="button"
              disabled={loading || !acceptTerms || !confirmAge}
              onClick={() => void createAccount()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold text-white disabled:opacity-50 transition"
            >
              {loading
                ? t('auth.submitRegisterLoading')
                : t('auth.signupChat.createAccount', { defaultValue: 'Créer mon compte' })}
            </button>
          </div>
        )}
      </div>
      ) : null}
    </AuthPageShell>
  );
}
