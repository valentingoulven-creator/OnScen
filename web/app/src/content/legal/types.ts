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
  | 'cookies'
  | 'rgpd'
  | 'apiPlatforms'
  | 'licenses'
  | 'donations'
  | 'creatorMonetization'
  | 'communityGuidelines'
  | 'brandedContent'
  | 'advertisingPolicy'
  | 'moderationAppeals'
  | 'copyrightNotice';

export const LEGAL_SUPPORT_EMAIL = 'support@onscen.com';
export const LEGAL_CONTACT_EMAIL = LEGAL_SUPPORT_EMAIL;
export const LEGAL_PRIVACY_EMAIL = 'admin@onscen.com';
export const LEGAL_COPYRIGHT_EMAIL = 'admin@onscen.com';
/** Doit correspondre à backend/src/lib/legalConstants.ts */
export const CURRENT_TERMS_VERSION = '2026-08-03';
