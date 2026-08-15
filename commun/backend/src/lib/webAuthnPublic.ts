import type { Request, Response } from 'express';
import { isNativeClient } from './clientPlatform';
import { isProductionEnv } from './jwtSecret';

/** WebAuthn / Face ID : coupé sur le web en prod ; reste ouvert en natif et hors prod. */
export function isWebAuthnEnabledForRequest(req: Request): boolean {
  if (!isProductionEnv()) return true;
  return isNativeClient(req);
}

export function rejectIfWebAuthnDisabledOnWeb(req: Request, res: Response): boolean {
  if (isWebAuthnEnabledForRequest(req)) return false;
  res.status(403).json({
    error: 'La connexion Face ID / empreinte n’est pas disponible sur le web.',
    code: 'WEBAUTHN_WEB_DISABLED',
  });
  return true;
}
