/**
 * dpa.ts — Modèles d'Accords de Traitement des Données (DPA / Art. 28 RGPD)
 *
 * Ce fichier contient les modèles de clauses contractuelles à signer avec
 * chaque sous-traitant qui traite des données personnelles pour le compte de Soundy.
 *
 * Référence réglementaire : RGPD art. 28 — tout responsable de traitement doit
 * formaliser par contrat ses relations avec ses sous-traitants.
 *
 * TODO : Pour chaque sous-traitant listé ci-dessous :
 *   1. Vérifier que le DPA du sous-traitant est disponible et signé
 *   2. Documenter les garanties pour les transferts hors UE (CCT, décision d'adéquation)
 *   3. Conserver les DPA signés dans un dossier sécurisé
 *
 * Statut des DPA par sous-traitant :
 *   - Cloudflare : [À SIGNER] → https://www.cloudflare.com/cloudflare-customer-dpa/
 *   - Stripe     : [À SIGNER] → https://stripe.com/legal/dpa
 *   - Resend     : [À SIGNER] → https://resend.com/legal/dpa
 *   - Scaleway   : [À SIGNER] → disponible dans l'espace client
 */

import type { LegalDocument } from './types';

// ─── Registre des sous-traitants ────────────────────────────────────────────

export interface SubprocessorRecord {
  name: string;
  role: string;
  country: string;
  euTransfer: boolean;
  transferMechanism: string;
  dpaUrl: string;
  dpaStatus: 'signed' | 'pending' | 'not-required';
  dataCategories: string[];
  retentionNote: string;
}

/**
 * Registre des sous-traitants de Soundy au sens de l'art. 28 RGPD.
 * TODO : Mettre à jour le statut (dpaStatus) à chaque signature de DPA.
 */
export const SUBPROCESSORS: SubprocessorRecord[] = [
  {
    name: 'Scaleway SAS',
    role: 'Hébergement serveur, base de données, stockage fichiers',
    country: 'France (UE)',
    euTransfer: false,
    transferMechanism: 'Pas de transfert hors UE — données hébergées en France',
    dpaUrl: 'https://www.scaleway.com/fr/politique-de-confidentialite/',
    // TODO: Vérifier et signer le DPA Scaleway depuis l'espace client
    dpaStatus: 'pending',
    dataCategories: [
      'Données de compte (pseudonyme, e-mail hashé, profil)',
      'Données de géolocalisation (position brute, floutée)',
      'Données de messages (chat, MP)',
      'Logs techniques (IP, horodatages)',
      'Médias (avatars, photos de profil)',
    ],
    retentionNote: 'Durée du compte + délai de suppression (max. 90 j après clôture)',
  },
  {
    name: 'Cloudflare, Inc.',
    role: 'CDN, protection DDoS, reverse proxy, DNS',
    country: 'États-Unis (hors UE)',
    euTransfer: true,
    // TODO: Vérifier que les CCT sont bien en vigueur et documenter
    transferMechanism: 'Clauses Contractuelles Types (CCT) — décision d\'adéquation partielle',
    dpaUrl: 'https://www.cloudflare.com/cloudflare-customer-dpa/',
    // TODO: Accepter le DPA Cloudflare depuis le tableau de bord
    dpaStatus: 'pending',
    dataCategories: [
      'Adresses IP des utilisateurs (en transit)',
      'Métadonnées de requêtes HTTP (URL, headers)',
      'Note : Cloudflare ne stocke pas les corps de requêtes API par défaut',
    ],
    retentionNote: 'Logs Cloudflare : 7 jours par défaut (configurable)',
  },
  {
    name: 'Stripe, Inc. / Stripe Payments Europe, Ltd.',
    role: 'Traitement des paiements — pourboires live, abonnements créateurs, Soundy+',
    country: 'Irlande (UE) + États-Unis pour certains services',
    euTransfer: true,
    transferMechanism: 'Entité UE (Dublin) — CCT pour transferts vers les États-Unis',
    dpaUrl: 'https://stripe.com/legal/dpa',
    // TODO: Signer le DPA Stripe depuis le tableau de bord Stripe
    dpaStatus: 'pending',
    dataCategories: [
      'Données de paiement (numéro de carte tokenisé par Stripe)',
      'Données d\'identité partielle (e-mail, pays, IP)',
      'Historique des transactions',
      'Note : Soundy ne stocke jamais les numéros de carte — délégué à Stripe',
    ],
    retentionNote: 'Selon obligations légales Stripe (5 à 10 ans pour les données fiscales)',
  },
  {
    name: 'Resend, Inc.',
    role: 'Envoi d\'e-mails transactionnels (vérification e-mail, réinitialisation mot de passe, notifications)',
    country: 'États-Unis (hors UE)',
    euTransfer: true,
    // TODO: Vérifier les mécanismes de transfert exacts de Resend
    transferMechanism: '[À VÉRIFIER] Clauses Contractuelles Types (CCT)',
    dpaUrl: 'https://resend.com/legal/dpa',
    // TODO: Signer le DPA Resend
    dpaStatus: 'pending',
    dataCategories: [
      'Adresse e-mail du destinataire',
      'Contenu de l\'e-mail (variable selon le type)',
      'Métadonnées d\'envoi (horodatage, statut de livraison)',
    ],
    retentionNote: 'Logs d\'envoi : [À VÉRIFIER selon politique Resend]',
  },
  {
    name: 'Google LLC / YouTube',
    role: 'YouTube Data API v3 — liste des playlists hôte, métadonnées vidéo',
    country: 'États-Unis (hors UE)',
    euTransfer: true,
    transferMechanism: 'Décision d\'adéquation + CCT (Google Cloud)',
    dpaUrl: 'https://cloud.google.com/terms/data-processing-addendum',
    dpaStatus: 'not-required',
    dataCategories: [
      'Identifiant Google (si connexion OAuth)',
      'Jeton OAuth YouTube (scope readonly)',
      'Métadonnées vidéo YouTube (titres, miniatures — mises en cache ≤ 1 h)',
    ],
    retentionNote: 'Jetons révoqués à la déconnexion — Google gère ses propres données',
  },
];

// ─── Modèle de clauses contractuelles internes ───────────────────────────────

export const dpaTemplate: LegalDocument = {
  title: 'DPA — Accords de Traitement (Art. 28 RGPD) [MODÈLE INTERNE]',
  updated: 'juin 2026',
  sections: [
    {
      heading: '1. Objet et périmètre',
      body: `Le présent Accord de Traitement des Données (« DPA ») est conclu entre :

Responsable du traitement :
{{publisherName}} — {{legalForm}}
{{address}}
SIREN : {{siren}}
(ci-après « le Responsable »)

et chaque sous-traitant listé au Registre des Sous-traitants (Annexe A).

Cet accord a pour objet de définir les conditions dans lesquelles chaque sous-traitant
est autorisé à traiter des données personnelles pour le compte du Responsable,
conformément à l'article 28 du RGPD.

Champ d'application : tous les traitements de données personnelles des utilisateurs
de Soundy (getsoundy.com) réalisés par un sous-traitant pour le compte du Responsable.`,
    },
    {
      heading: '2. Obligations du sous-traitant (art. 28 § 3 RGPD)',
      body: `Chaque sous-traitant s'engage à :

a) Ne traiter les données personnelles que sur instruction documentée du Responsable,
   y compris en ce qui concerne les transferts de données hors UE.

b) Garantir que les personnes autorisées à traiter les données s'engagent
   à respecter la confidentialité ou sont soumises à une obligation légale
   de confidentialité.

c) Prendre toutes les mesures requises en vertu de l'article 32 (sécurité du traitement).

d) Ne pas recruter un autre sous-traitant sans autorisation écrite préalable
   du Responsable. En cas de sous-traitance ultérieure autorisée, imposer
   au nouveau sous-traitant les mêmes obligations de protection des données.

e) Aider le Responsable à garantir le respect des droits des personnes concernées
   (accès, rectification, effacement, portabilité, opposition).

f) Mettre à la disposition du Responsable toutes les informations nécessaires
   pour démontrer le respect de ses obligations, et permettre les audits.

g) Notifier sans délai le Responsable de toute violation de données personnelles.

h) Supprimer ou restituer toutes les données personnelles au terme du service.`,
    },
    {
      heading: '3. Instructions de traitement',
      body: `Le Responsable autorise chaque sous-traitant à traiter les données personnelles
uniquement dans le cadre des finalités définies dans le Registre des Sous-traitants
(Annexe A) et pour la durée de la relation contractuelle.

Toute instruction hors périmètre défini doit faire l'objet d'un avenant écrit.

Finalités autorisées par sous-traitant :
• Scaleway SAS : Hébergement et stockage des données de l'application Soundy
• Cloudflare, Inc. : Acheminement et protection du trafic réseau vers les serveurs Soundy
• Stripe : Traitement des paiements initiés par les utilisateurs de Soundy
• Resend : Envoi des e-mails transactionnels déclenchés par les actions utilisateurs
• Google (YouTube) : Fourniture de l’API YouTube intégrée dans le service`,
    },
    {
      heading: '4. Transferts hors Union européenne',
      body: `Pour chaque sous-traitant dont le traitement implique un transfert de données
hors de l'Espace Économique Européen (EEE), le Responsable s'assure que :

• Des garanties appropriées au sens de l'art. 46 RGPD sont en place
  (Clauses Contractuelles Types, décision d'adéquation, règles d'entreprise contraignantes).

• Ces garanties sont documentées dans le Registre des Sous-traitants.

Transferts identifiés hors EEE :
• Cloudflare (États-Unis) : CCT — [À DOCUMENTER : référence du contrat]
• Resend (États-Unis) : CCT — [À DOCUMENTER]
• Google/YouTube (États-Unis) : CCT + politiques Google — [À VÉRIFIER]`,
    },
    {
      heading: '5. Sécurité des données (art. 32 RGPD)',
      body: `Chaque sous-traitant met en œuvre des mesures techniques et organisationnelles
appropriées pour garantir un niveau de sécurité adapté au risque, notamment :

• Chiffrement des données en transit (TLS/HTTPS) et au repos si applicable
• Contrôle d'accès et gestion des identifiants
• Plan de reprise d'activité et sauvegardes régulières
• Journalisation et détection des incidents
• Formation et sensibilisation des personnels

Mesures Soundy (côté Responsable) :
☑ Authentification JWT — sessions courtes
☑ Mots de passe bcrypt — jamais stockés en clair
☑ Floutage des coordonnées GPS côté serveur
☑ HTTPS obligatoire en production
☐ Chiffrement au repos des données sensibles — [À IMPLÉMENTER]
☐ Audit de sécurité externe — [À PLANIFIER]`,
    },
    {
      heading: '6. Gestion des violations de données',
      body: `En cas de violation de données personnelles impliquant les traitements couverts
par le présent accord :

Obligations du sous-traitant :
• Notifier le Responsable sans délai indu (et dans un délai maximal de 24 h
  à compter de la découverte, pour permettre au Responsable de respecter
  son délai de 72 h vis-à-vis de la CNIL).
• Fournir toutes les informations disponibles sur la nature de la violation,
  les catégories de données affectées et les mesures correctives prises.

Obligations du Responsable :
• Évaluer si la violation nécessite une notification à la CNIL (art. 33 RGPD).
• Si risque élevé pour les personnes, les informer directement (art. 34 RGPD).
• Documenter toutes les violations, y compris celles ne nécessitant pas notification.

Contact pour signalement : {{contactEmail}} / {{privacyEmail}}`,
    },
    {
      heading: '7. Durée et résiliation',
      body: `Le présent accord prend effet à la date de signature et reste en vigueur
pour la durée de la relation contractuelle avec chaque sous-traitant.

À la résiliation ou l'expiration du contrat avec un sous-traitant :
• Le sous-traitant restitue ou détruit toutes les données personnelles traitées
  pour le compte du Responsable, selon les instructions de ce dernier.
• Le sous-traitant confirme par écrit la destruction effective des données.

[À REMPLIR : délai de restitution/destruction convenu par sous-traitant]`,
    },
    {
      heading: '8. Annexe A — Registre des Sous-traitants',
      body: `Voir le fichier app/src/content/legal/dpa.ts → SUBPROCESSORS pour la liste
complète et à jour des sous-traitants avec leurs caractéristiques de traitement.

Résumé :
┌──────────────────────────────┬──────────┬───────────────┬─────────────┐
│ Sous-traitant                │ Pays     │ Transfert UE  │ DPA signé   │
├──────────────────────────────┼──────────┼───────────────┼─────────────┤
│ Scaleway SAS                 │ France   │ Non           │ À signer    │
│ Cloudflare, Inc.             │ USA      │ Oui (CCT)     │ À signer    │
│ Stripe Payments Europe, Ltd  │ Irlande  │ Partiel (CCT) │ À signer    │
│ Resend, Inc.                 │ USA      │ Oui (CCT)     │ À signer    │
│ Google LLC / YouTube         │ USA      │ Oui (CCT)     │ Non requis  │
└──────────────────────────────┴──────────┴───────────────┴─────────────┘

TODO : Mettre à jour le statut « DPA signé » au fur et à mesure des signatures.`,
    },
    {
      heading: '9. Signatures',
      body: `Pour le Responsable du traitement :

Nom : [À REMPLIR]
Fonction : [À REMPLIR]
Date : [À REMPLIR]
Signature : ___________________________


Note : Ce document est un modèle interne de référence.
Les DPA signés avec chaque sous-traitant sont les documents contractuellement
contraignants. Ce modèle doit être conservé avec les DPA signés dans le dossier
de conformité RGPD de Soundy.`,
    },
  ],
};
