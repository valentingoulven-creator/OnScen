import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('listener@msdev.local');
  const [password, setPassword] = useState('msdev123');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(username, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
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
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            MeloSong
          </h1>
          <p className="text-gray-400 text-sm mt-2">Salons musicaux · Lives · Géoloc</p>
        </div>

        <form onSubmit={submit} className="space-y-4 bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-6">
          {mode === 'register' && (
            <input
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
              placeholder="Pseudo"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}
          <input
            className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-3 text-white"
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white disabled:opacity-50"
          >
            {loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>

        <button
          type="button"
          className="w-full mt-4 text-sm text-gray-400 hover:text-purple-400"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Créer un compte' : 'Déjà inscrit ? Connexion'}
        </button>
      </div>
    </div>
  );
}
