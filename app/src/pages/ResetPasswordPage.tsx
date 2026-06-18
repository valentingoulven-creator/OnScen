import { useEffect, useState } from 'react';
import { appLoginHref } from '../lib/forgotPasswordRoute';

function getToken(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') ?? '';
}

export function ResetPasswordPage() {
  const [token] = useState(getToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Lien invalide ou expiré. Refais une demande de réinitialisation.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? 'Erreur lors de la réinitialisation');
      }
      setDone(true);
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
            🔐
          </div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Nouveau mot de passe
          </h1>
        </div>

        <div className="space-y-4 bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-6">
          {done ? (
            <div className="text-center space-y-4">
              <p className="text-3xl">✅</p>
              <p className="text-sm font-semibold text-white">Mot de passe modifié !</p>
              <p className="text-sm text-gray-400">Tu peux maintenant te connecter avec ton nouveau mot de passe.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && !token ? (
                <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-3 text-center">{error}</p>
              ) : (
                <>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Choisis un nouveau mot de passe pour ton compte Soundy.
                  </p>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nouveau mot de passe (min. 8 caractères)"
                    required
                    autoComplete="new-password"
                    autoFocus
                    className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmer le mot de passe"
                    required
                    autoComplete="new-password"
                    className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-400">Les mots de passe ne correspondent pas</p>
                  )}
                  {error && (
                    <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !token}
                    className="block w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 font-bold text-white text-center transition"
                  >
                    {loading ? '…' : 'Réinitialiser le mot de passe'}
                  </button>
                </>
              )}
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
