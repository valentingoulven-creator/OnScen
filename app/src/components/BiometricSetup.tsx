/**
 * BiometricSetup — gestion de l'authentification biométrique (Face ID / passkeys).
 * À placer dans l'écran Paramètres > Sécurité.
 *
 * Flow :
 *  1. Vérifie la dispo WebAuthn du navigateur/appareil.
 *  2. Charge les credentials déjà enregistrés via l'API.
 *  3. Bouton "Activer" → appelle startRegistration() puis /register/verify.
 *  4. Bouton "Désactiver" → DELETE /credential/:id pour chaque credential.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startRegistration } from '@simplewebauthn/browser';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface StoredCredential {
  id: string;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
}

function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  );
}

export function BiometricSetup() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [supported, setSupported]     = useState<boolean | null>(null);
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [loading, setLoading]         = useState(false);
  const [removing, setRemoving]       = useState<string | null>(null);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  // Vérifie la disponibilité de la biométrie sur la plateforme
  useEffect(() => {
    if (!isWebAuthnSupported()) {
      setSupported(false);
      return;
    }
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(setSupported)
      .catch(() => setSupported(false));
  }, []);

  // Charge les credentials existants
  const loadCredentials = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.webauthnGetCredentials(token);
      setCredentials(res.credentials);
    } catch {
      setCredentials([]);
    }
  }, [token]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const handleEnable = async () => {
    if (!token) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      // 1. Obtenir les options du serveur
      const options = await api.webauthnRegisterOptions(token);
      // 2. Déclencher la biométrie sur l'appareil
      const regResponse = await startRegistration({ optionsJSON: options });
      // 3. Vérifier côté serveur et stocker
      const result = await api.webauthnRegisterVerify(token, regResponse);
      if (result.verified) {
        setSuccess(t('settings.biometricEnabled'));
        await loadCredentials();
      } else {
        setError(t('settings.biometricSetupError'));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError(t('settings.biometricSetupError') + ' (annulé)');
      } else {
        setError(err instanceof Error ? err.message : t('settings.biometricSetupError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (credentialId: string) => {
    if (!token) return;
    setError('');
    setSuccess('');
    setRemoving(credentialId);
    try {
      await api.webauthnDeleteCredential(token, credentialId);
      await loadCredentials();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.biometricRemoveError'));
    } finally {
      setRemoving(null);
    }
  };

  // Navigateur sans support WebAuthn
  if (supported === false) {
    return (
      <div className="rounded-xl bg-[#12121a] border border-[#1e1e2f] p-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl" aria-hidden>🔒</span>
          <div>
            <p className="text-sm font-semibold text-white">{t('settings.biometricTitle')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('settings.biometricNotSupportedSettings')}</p>
          </div>
        </div>
      </div>
    );
  }

  const isEnabled = credentials.length > 0;

  return (
    <div className="rounded-xl bg-[#12121a] border border-[#1e1e2f] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>🔒</span>
          <div>
            <p className="text-sm font-semibold text-white">{t('settings.biometricTitle')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('settings.biometricSubtitle')}</p>
          </div>
        </div>
        {/* Badge actif */}
        {isEnabled && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
            ON
          </span>
        )}
      </div>

      {/* Credentials existants */}
      {isEnabled && (
        <div className="space-y-2">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="flex items-center justify-between bg-[#1a1a26] rounded-lg px-3 py-2"
            >
              <div>
                <p className="text-xs text-gray-300 font-medium">
                  {cred.deviceType === 'multiDevice' ? '☁️ Passkey' : '📱 Cet appareil'}
                  {cred.backedUp && (
                    <span className="ml-1.5 text-[10px] text-blue-400">sauvegardé</span>
                  )}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {t('settings.biometricRegisteredOn')}{' '}
                  {new Date(cred.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                disabled={removing === cred.id}
                onClick={() => void handleRemove(cred.id)}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition font-medium"
              >
                {removing === cred.id ? t('settings.biometricDisabling') : t('settings.biometricDisable')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Feedback */}
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-400 bg-green-500/10 rounded-lg px-3 py-2">✓ {success}</p>
      )}

      {/* CTA : Activer */}
      {supported !== null && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleEnable()}
          className={`w-full py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-50 ${
            isEnabled
              ? 'bg-[#1a1a26] border border-[#2d2d3d] text-gray-300 hover:bg-[#222230]'
              : 'bg-purple-600 hover:bg-purple-500 text-white'
          }`}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('settings.biometricEnabling')}
            </span>
          ) : isEnabled ? (
            `+ ${t('settings.biometricEnable')}`
          ) : (
            t('settings.biometricEnable')
          )}
        </button>
      )}
    </div>
  );
}
