import type { LegalDocument } from './types';

export const licences: LegalDocument = {
  title: 'Licences & crédits',
  updated: '3 juin 2026',
  sections: [
    {
      heading: 'Soundy',
      body: 'Application Soundy — projet social autour de la musique géolocalisée. Code source et documentation : voir le dépôt du projet (licence à préciser par l’éditeur).',
    },
    {
      heading: 'Cartographie',
      body: 'Tuiles carte : © CARTO, © OpenStreetMap contributors (ODbL). Attribution requise lors de l’affichage de la carte : https://www.openstreetmap.org/copyright',
    },
    {
      heading: 'Avatars (démo)',
      body: 'Avatars générés via DiceBear (styles adventurer, etc.) — voir https://www.dicebear.com/licenses',
    },
    {
      heading: 'Musique et médias',
      body: 'Pochettes et extraits : métadonnées et liens fournis par Spotify, YouTube ou les utilisateurs. Droits sur les enregistrements : titulaires respectifs.',
    },
    {
      heading: 'Bibliothèques open source',
      body: 'React, Vite, Tailwind CSS, Leaflet, Socket.io client, Express, bcryptjs, jsonwebtoken, TypeScript, et autres dépendances listées dans package.json — chaque composant est soumis à sa licence (MIT, Apache-2.0, BSD, etc.).',
    },
    {
      heading: 'Icônes et polices',
      body: 'Interface Soundy : polices système et ressources intégrées. Vérifier les licences de toute ressource graphique ajoutée ultérieurement.',
    },
  ],
};
