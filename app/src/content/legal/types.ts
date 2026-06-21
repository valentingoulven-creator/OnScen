export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDocument {
  title: string;
  updated: string;
  sections: LegalSection[];
}

export type LegalKey =
  | 'mentions'
  | 'terms'
  | 'privacy'
  | 'rgpd'
  | 'apiPlatforms'
  | 'licenses'
  | 'donations'
  | 'creatorMonetization';

export const LEGAL_CONTACT_EMAIL = 'contact@getsoundy.com';
export const LEGAL_PRIVACY_EMAIL = 'privacy@getsoundy.com';
/** Doit correspondre à backend/src/lib/legalConstants.ts */
export const CURRENT_TERMS_VERSION = '2026-06-03';
