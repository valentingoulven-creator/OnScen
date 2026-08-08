import { api, ApiRequestError } from './api';
import type { InternalLinkTarget } from './linkifyText';

export type InternalLinkCheckResult =
  | { ok: true }
  | { ok: false; message: string };

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

function unavailableMessage(target: InternalLinkTarget, t: TranslateFn): string {
  switch (target.kind) {
    case 'salon':
      return t('dm.linkUnavailableSalon');
    case 'profile':
      return t('dm.linkUnavailableProfile');
    case 'post':
      return t('dm.linkUnavailablePost');
  }
}

/** Vérifie qu'une cible OnScen (salon, profil, post) existe encore avant navigation in-app. */
export async function verifyInternalLink(
  token: string,
  target: InternalLinkTarget,
  t: TranslateFn,
): Promise<InternalLinkCheckResult> {
  try {
    switch (target.kind) {
      case 'salon':
        await api.getSalon(token, target.salonId);
        break;
      case 'profile':
        await api.getUserProfile(token, target.userId);
        break;
      case 'post':
        await api.getFeedPostComments(token, target.postId);
        break;
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 404) {
      return { ok: false, message: unavailableMessage(target, t) };
    }
    // Salon privé / accès refusé : la ressource existe — laisser la page cible gérer.
    if (e instanceof ApiRequestError && (e.status === 403 || e.status === 401)) {
      return { ok: true };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : t('errors.generic'),
    };
  }
}
