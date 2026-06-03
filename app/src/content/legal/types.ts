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
