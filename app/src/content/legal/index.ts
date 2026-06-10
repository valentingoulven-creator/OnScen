import type { LegalDocument, LegalKey } from './types';
import { mentionsLegales } from './mentions';
import { cgu } from './terms';
import { politiqueConfidentialite } from './privacy';
import { conformiteRgpd } from './rgpd';
import { conditionsApiPlateformes } from './apiPlatforms';
import { licences } from './licenses';
import { conditionsCreatorMonetization } from './creatorMonetization';

export type { LegalDocument, LegalKey, LegalSection } from './types';
export { LEGAL_CONTACT_EMAIL, LEGAL_PRIVACY_EMAIL, CURRENT_TERMS_VERSION } from './types';

export const LEGAL: Record<LegalKey, LegalDocument> = {
  mentions: mentionsLegales,
  terms: cgu,
  privacy: politiqueConfidentialite,
  rgpd: conformiteRgpd,
  apiPlatforms: conditionsApiPlateformes,
  licenses: licences,
  donations: conditionsCreatorMonetization,
  creatorMonetization: conditionsCreatorMonetization,
};

/** @deprecated Import depuis ../content/legal — conservé pour compatibilité */
export default LEGAL;
