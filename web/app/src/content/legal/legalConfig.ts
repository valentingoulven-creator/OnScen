/**
 * legalConfig.ts — Configuration légale centralisée de Soundy
 *
 * Ce fichier est la référence documentaire pour la conformité LCEN et RGPD.
 * Les valeurs réelles sont lues depuis commun/msdev/legal-publisher.json (côté backend)
 * et injectées dans les modèles de documents via applyPublisherTemplate.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  AVANT MISE EN PRODUCTION — À COMPLÉTER OBLIGATOIREMENT         │
 * │                                                                 │
 * │  1. Remplir  commun/msdev/legal-publisher.json  (voir ci-dessous)      │
 * │  2. Relancer le serveur : npm run msdev                         │
 * │  3. Vérifier : Paramètres > Mentions légales                    │
 * └─────────────────────────────────────────────────────────────────┘
 */

import type { LegalPublisherConfig } from '../../types';

// ─── Métadonnées par champ ──────────────────────────────────────────────────

export interface LegalFieldMeta {
  key: keyof LegalPublisherConfig;
  label: string;
  /** Requis par la loi LCEN (art. 6) — infraction sanctionnable si absent */
  lcenRequired: boolean;
  /** Requis par le RGPD pour la conformité minimale */
  rgpdRequired: boolean;
  description: string;
  example: string;
}

export const LEGAL_FIELD_DEFINITIONS: readonly LegalFieldMeta[] = [
  // ── Éditeur — LCEN art. 6 I (OBLIGATOIRE) ─────────────────────────────────
  {
    key: 'publisherName',
    label: 'Nom / raison sociale de l\'éditeur',
    lcenRequired: true,
    rgpdRequired: false,
    description:
      'Identité complète de l\'éditeur (personne physique ou morale). ' +
      'Obligatoire pour tout site/app accessible au public en France (LCEN art. 6 I).',
    // TODO: Remplacer par votre nom ou raison sociale exacte (tel qu'au Kbis ou INSEE)
    example: 'Valentin Goulven  —  ou —  Soundy SAS',
  },
  {
    key: 'legalForm',
    label: 'Forme juridique',
    lcenRequired: true,
    rgpdRequired: false,
    description: 'Statut juridique de l\'entité éditrice.',
    // TODO: Indiquer votre forme juridique exacte
    example: 'Entrepreneur individuel  —  ou —  SAS  —  ou —  SARL  —  ou —  Association loi 1901',
  },
  {
    key: 'address',
    label: 'Adresse postale complète',
    lcenRequired: true,
    rgpdRequired: false,
    description:
      'Adresse postale complète de l\'éditeur. ' +
      'Obligatoire LCEN. Doit être une adresse réelle où l\'éditeur peut recevoir du courrier.',
    // TODO: ⚠️ CHAMP CRITIQUE — remplacer par l'adresse postale réelle
    // Format : [numéro] [rue], [code postal] [ville], [pays]
    example: '12 rue de l\'Exemple, 75001 Paris, France',
  },
  {
    key: 'siren',
    label: 'Numéro SIREN / SIRET',
    lcenRequired: true,
    rgpdRequired: false,
    description:
      'Numéro SIREN (9 chiffres) ou SIRET (14 chiffres) ' +
      'délivré par l\'INSEE. Obligatoire pour toute activité commerciale en France.',
    // TODO: Vérifier que votre numéro SIREN/SIRET est exact et formaté correctement
    example: '123 456 789  —  ou —  123 456 789 00012',
  },
  {
    key: 'rcs',
    label: 'RCS (ville du greffe)',
    lcenRequired: false,
    rgpdRequired: false,
    description:
      'Numéro d\'immatriculation au Registre du Commerce et des Sociétés. ' +
      'Non applicable pour les entrepreneurs individuels.',
    // TODO: Laisser vide si entrepreneur individuel (EI)
    // Si société : "RCS Paris B 123 456 789"
    example: 'RCS Paris B 123 456 789  —  ou vide si EI',
  },
  {
    key: 'capital',
    label: 'Capital social',
    lcenRequired: false,
    rgpdRequired: false,
    description: 'Capital social de la société. Non applicable pour les EI.',
    // TODO: Laisser vide si entrepreneur individuel
    example: '1 000 €  —  ou vide si EI',
  },
  {
    key: 'publicationDirector',
    label: 'Directeur de la publication',
    lcenRequired: true,
    rgpdRequired: false,
    description:
      'Personne physique responsable de la publication au sens de la loi. ' +
      'Pour une personne morale : le représentant légal ; pour une personne physique : l\'éditeur lui-même.',
    // TODO: Nom et prénom du directeur de publication
    example: 'Valentin Goulven',
  },

  // ── Hébergeur — LCEN art. 6 III (OBLIGATOIRE) ─────────────────────────────
  {
    key: 'hostName',
    label: 'Raison sociale de l\'hébergeur',
    lcenRequired: true,
    rgpdRequired: false,
    description:
      'Raison sociale de l\'hébergeur du service en production. ' +
      'Obligatoire LCEN art. 6 III — l\'hébergeur doit conserver les données d\'identification des utilisateurs.',
    // TODO: Confirmer le nom exact de l'hébergeur (actuellement Scaleway SAS)
    example: 'Scaleway SAS',
  },
  {
    key: 'hostAddress',
    label: 'Adresse postale de l\'hébergeur',
    lcenRequired: true,
    rgpdRequired: false,
    description: 'Adresse postale complète de l\'hébergeur.',
    // TODO: Confirmer l'adresse exacte de l'hébergeur
    example: '8 rue de la Ville l\'Évêque, 75008 Paris, France',
  },
  {
    key: 'hostPhone',
    label: 'Téléphone de l\'hébergeur',
    lcenRequired: true,
    rgpdRequired: false,
    description:
      'Numéro de téléphone de l\'hébergeur (LCEN art. 6 III). ' +
      'Peut être le numéro de service client général de l\'hébergeur.',
    // TODO: Confirmer le numéro de téléphone de l'hébergeur
    example: '+33 1 84 13 00 00',
  },
  {
    key: 'hostCountry',
    label: 'Pays d\'hébergement',
    lcenRequired: false,
    rgpdRequired: true,
    description:
      'Pays où les données sont hébergées. ' +
      'Important pour le RGPD : si hors UE, des garanties supplémentaires sont requises (art. 46 RGPD).',
    // TODO: Confirmer le pays d'hébergement (recommandé : France ou UE)
    example: 'France',
  },

  // ── Contacts ───────────────────────────────────────────────────────────────
  {
    key: 'contactEmail',
    label: 'E-mail contact général (affiché publiquement)',
    lcenRequired: false,
    rgpdRequired: true,
    description:
      'Adresse e-mail de contact affichée dans l\'application. ' +
      'Doit être une boîte professionnelle lue régulièrement. ' +
      'ATTENTION : ne pas utiliser une adresse Gmail personnelle en production.',
    // TODO: ⚠️ Remplacer par une adresse professionnelle @getsoundy.com lue régulièrement
    example: 'admin@getsoundy.com',
  },
  {
    key: 'privacyEmail',
    label: 'E-mail données personnelles / RGPD',
    lcenRequired: false,
    rgpdRequired: true,
    description:
      'Adresse dédiée aux demandes RGPD (accès, effacement, portabilité, opposition…). ' +
      'Doit être distincte de la boîte contact si possible. ' +
      'ATTENTION : ne pas utiliser une adresse Gmail personnelle en production.',
    // TODO: ⚠️ Remplacer par une adresse professionnelle dédiée RGPD
    example: 'admin@getsoundy.com',
  },
  {
    key: 'dpoEmail',
    label: 'E-mail DPO (Délégué à la Protection des Données)',
    lcenRequired: false,
    rgpdRequired: false,
    description:
      'Obligatoire uniquement si la désignation d\'un DPO est requise (art. 37 RGPD). ' +
      'Requis notamment si traitement à grande échelle de données sensibles, ou autorité publique. ' +
      'Pour une plateforme B2C standard de taille modeste : facultatif mais recommandé.',
    // TODO: Laisser vide si non applicable — ou indiquer l'e-mail du DPO si désigné
    example: 'admin@getsoundy.com  —  ou laisser vide',
  },

  // ── Médiation consommation (recommandé B2C France) ─────────────────────────
  {
    key: 'mediatorName',
    label: 'Médiateur de la consommation',
    lcenRequired: false,
    rgpdRequired: false,
    description:
      'Nom du médiateur de la consommation (art. L.612-1 et suiv. Code de la consommation). ' +
      'Recommandé voire obligatoire pour tout professionnel B2C acceptant des paiements de consommateurs. ' +
      'À souscrire auprès d\'un médiateur référencé CECMC.',
    // TODO: À compléter avant activation des paiements en production
    // Médiateurs référencés : https://www.economie.gouv.fr/mediation-conso/mediateurs-references
    example: 'CM2C — Centre de Médiation de la Consommation de Conciliateurs de Justice',
  },
  {
    key: 'mediatorUrl',
    label: 'URL du médiateur de la consommation',
    lcenRequired: false,
    rgpdRequired: false,
    description: 'URL du site du médiateur. Si vide, le lien vers la plateforme européenne ODR est affiché.',
    // TODO: Renseigner l'URL du médiateur si applicable
    example: 'https://www.cm2c.net/',
  },

  // ── Domaine ────────────────────────────────────────────────────────────────
  {
    key: 'productionDomain',
    label: 'Domaine de production',
    lcenRequired: false,
    rgpdRequired: false,
    description: 'URL racine du service en production.',
    // TODO: Confirmer ou corriger le domaine de production
    example: 'https://getsoundy.com',
  },
] as const;

// ─── Champs critiques ────────────────────────────────────────────────────────

/** Champs LCEN obligatoires — leur absence constitue une infraction sanctionnable */
export const LCEN_REQUIRED_FIELDS: ReadonlyArray<keyof LegalPublisherConfig> = [
  'publisherName',
  'legalForm',
  'address',
  'siren',
  'publicationDirector',
  'hostName',
  'hostAddress',
  'hostPhone',
] as const;

/** Champs requis pour la conformité RGPD minimale */
export const RGPD_REQUIRED_FIELDS: ReadonlyArray<keyof LegalPublisherConfig> = [
  'contactEmail',
  'privacyEmail',
] as const;

/**
 * Patterns qui indiquent une valeur non remplie.
 * Détecte les valeurs issues du fichier exemple (legal-publisher.example.json)
 * ou du fichier acompleter.txt qui n'ont pas été remplacées.
 */
const EMPTY_PATTERNS = [
  'à renseigner',
  'acompleter',
  'à compléter',
  '[à compléter',
  'compléter',
];

/**
 * Retourne true si une valeur de config est vide ou contient un placeholder non rempli.
 * Gère les cas : chaîne vide, valeur issue du fichier exemple non remplacée.
 */
export function isConfigValueEmpty(value: string | undefined): boolean {
  if (!value || !value.trim()) return true;
  const lower = value.toLowerCase();
  return EMPTY_PATTERNS.some((p) => lower.includes(p));
}

/** Retourne la liste des champs LCEN manquants dans une configuration donnée */
export function getMissingLcenFields(
  config: LegalPublisherConfig
): (keyof LegalPublisherConfig)[] {
  return LCEN_REQUIRED_FIELDS.filter((k) => isConfigValueEmpty(config[k]));
}

/** Retourne la liste des champs RGPD manquants dans une configuration donnée */
export function getMissingRgpdFields(
  config: LegalPublisherConfig
): (keyof LegalPublisherConfig)[] {
  return RGPD_REQUIRED_FIELDS.filter((k) => isConfigValueEmpty(config[k]));
}

/** Retourne le label lisible d'un champ de configuration */
export function getLegalFieldLabel(key: keyof LegalPublisherConfig): string {
  return LEGAL_FIELD_DEFINITIONS.find((f) => f.key === key)?.label ?? String(key);
}

/**
 * Indique si la configuration est complète au sens LCEN minimal.
 * Cette vérification est plus stricte que le backend car elle détecte
 * les valeurs placeholder (ex. "adresse à renseigner").
 */
export function isLcenCompliant(config: LegalPublisherConfig): boolean {
  return getMissingLcenFields(config).length === 0;
}
