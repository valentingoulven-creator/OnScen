import { useState } from 'react';
import { appLoginHref } from '../lib/forgotPasswordRoute';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Saisis ton adresse e-mail');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Erreur lors de la demande');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[#0b0b0f]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 items-center justify-center text-2xl mb-4">
            ♪
          </div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Mot de passe oublié
          </h1>
        </div>

        <div className="space-y-4 bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-6">
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-3xl">📬</p>
              <p className="text-sm font-semibold text-white">E-mail envoyé !</p>
              <p className="text-sm text-gray-400 leading-relaxed">
                Si un compte existe pour <strong className="text-white">{email}</strong>, tu recevras un lien
                de réinitialisation valable 1 heure.
              </p>
              <p className="text-xs text-gray-500">Pense à vérifier ton dossier spam.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-sm text-gray-400 leading-relaxed">
                Saisis l'adresse e-mail associée à ton compte. Tu recevras un lien pour réinitialiser ton mot de passe.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                autoComplete="email"
                autoFocus
                className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
              />
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="block w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 font-bold text-white text-center transition"
              >
                {loading ? '…' : 'Envoyer le lien'}
              </button>
            </form>
          )}

          <a
            href={appLoginHref()}
            className="block w-full py-2.5 rounded-xl border border-purple-500/60 bg-purple-950/30 text-sm text-purple-300 font-medium text-center hover:bg-purple-900/40 hover:border-purple-400 transition"
          >
            ← Retour à la connexion
          </a>
        </div>
      </div>
    </div>
  );
}
