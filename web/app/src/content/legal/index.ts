import type { LegalDocument, LegalKey } from './types';
import { mentionsLegales } from './mentions';
import { cgu } from './terms';
import { politiqueConfidentialite } from './privacy';
import { conformiteRgpd } from './rgpd';
import { conditionsApiPlateformes } from './apiPlatforms';
import { licences } from './licenses';
import { politiqueCookies } from './cookies';
import { conditionsCreatorMonetization } from './creatorMonetization';
import { reglesCommunaute } from './communityGuidelines';
import { contenusSponsorisesPartenariats } from './brandedContent';
import { politiquePublicitaire } from './advertisingPolicy';
import { moderationEtRecours } from './moderationAppeals';
import { politiqueDroitsAuteur } from './copyrightNotice';

export type { LegalDocument, LegalKey, LegalSection } from './types';
export {
  LEGAL_SUPPORT_EMAIL,
  LEGAL_CONTACT_EMAIL,
  LEGAL_PRIVACY_EMAIL,
  LEGAL_COPYRIGHT_EMAIL,
  CURRENT_TERMS_VERSION,
} from './types';

export const LEGAL: Record<LegalKey, LegalDocument> = {
  mentions: mentionsLegales,
  terms: cgu,
  privacy: politiqueConfidentialite,
  cookies: politiqueCookies,
  rgpd: conformiteRgpd,
  apiPlatforms: conditionsApiPlateformes,
  licenses: licences,
  donations: conditionsCreatorMonetization,
  creatorMonetization: conditionsCreatorMonetization,
  communityGuidelines: reglesCommunaute,
  brandedContent: contenusSponsorisesPartenariats,
  advertisingPolicy: politiquePublicitaire,
  moderationAppeals: moderationEtRecours,
  copyrightNotice: politiqueDroitsAuteur,
};

/** @deprecated Import depuis ../content/legal — conservé pour compatibilité */
export default LEGAL;
