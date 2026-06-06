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
  | 'licenses';

export const LEGAL_CONTACT_EMAIL = 'contact@melosong.app';
export const LEGAL_PRIVACY_EMAIL = 'privacy@melosong.app';
/** Doit correspondre à backend/src/lib/legalConstants.ts */
export const CURRENT_TERMS_VERSION = '2026-06-03';
