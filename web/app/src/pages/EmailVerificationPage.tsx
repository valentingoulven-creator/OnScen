import { useEffect, useState } from 'react';
import { appLoginHref } from '../lib/forgotPasswordRoute';

type Status = 'loading' | 'success' | 'error' | 'no_token';

function getToken(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') ?? '';
}

export function EmailVerificationPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setStatus('no_token');
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({})) as { message?: string; error?: string };
        if (res.ok) {
          setMessage(data.message ?? 'Adresse e-mail vérifiée !');
          setStatus('success');
        } else {
          setMessage(data.error ?? 'Erreur de vérification');
          setStatus('error');
        }
      })
      .catch(() => {
        setMessage('Erreur réseau. Réessaie plus tard.');
        setStatus('error');
      });
  }, []);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[#0b0b0f]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 items-center justify-center text-2xl mb-4">
            ♪
          </div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Vérification e-mail
          </h1>
        </div>

        <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-6 text-center space-y-4">
          {status === 'loading' && (
            <>
              <span className="inline-block w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Vérification en cours…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <p className="text-4xl">✅</p>
              <p className="text-base font-bold text-white">E-mail vérifié !</p>
              <p className="text-sm text-gray-400">{message}</p>
            </>
          )}

          {(status === 'error' || status === 'no_token') && (
            <>
              <p className="text-4xl">❌</p>
              <p className="text-base font-bold text-white">Lien invalide</p>
              <p className="text-sm text-gray-400">
                {status === 'no_token'
                  ? 'Aucun token de vérification trouvé dans l\'URL.'
                  : message}
              </p>
            </>
          )}

          <a
            href={appLoginHref()}
            className="block w-full py-2.5 rounded-xl border border-purple-500/60 bg-purple-950/30 text-sm text-purple-300 font-medium text-center hover:bg-purple-900/40 hover:border-purple-400 transition mt-2"
          >
            ← Retour à la connexion
          </a>
        </div>
      </div>
    </div>
  );
}
