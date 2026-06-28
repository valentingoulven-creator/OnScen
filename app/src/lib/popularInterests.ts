/** Catégories de centres d'intérêt — puces rapides profil (style Hinge/Tinder). */

export interface InterestCategory {

  label: string;

  items: readonly string[];

}



export const INTEREST_CATEGORIES: readonly InterestCategory[] = [

  {

    label: 'Musique',

    items: [

      'Live local',

      'Sessions live',

      'YouTube',

      'Découvertes',

      'Écoute partagée',

      'Chill',

      'Club',

      'Indie',

      'Hip-hop',

      'Électro',

      'Concerts',

      'Festivals',

      'Vinyles',

      'Playlist',

      'DJ sets',

      'Karaoké',

      'Musique de film',

      'Podcasts musicaux',

      'Sessions live',

      'Open mic',

      'Techno',

      'House',

      'Jazz',

      'Pop',

      'Rock',

      'Metal',

      'Soul',

      'Reggae',

      'Musique classique',

      'Bandes son',

      'Mashups',

      'Afterparty',

    ],

  },

  {

    label: 'Lifestyle',

    items: [

      'Voyages',

      'Cuisine',

      'Fitness',

      'Yoga',

      'Randonnée',

      'Café',

      'Vin',

      'Mode',

      'Brunch',

      'Running',

      'Escalade',

      'Surf',

      'Vélo',

      'Gastronomie',

      'Food trucks',

      'Cocktails',

      'Thé',

      'Bien-être',

      'Natation',

      'Pilates',

    ],

  },

  {

    label: 'Sorties',

    items: [

      'Apéros',

      'Soirées',

      'Networking',

      'Bénévolat',

      'Rencontres',

      'Jeux de société',

      'Trivia',

      'Bowling',

      'Escape game',

      'Picnics',

      'Bar à jeux',

      'Danse',

      'Salsa',

      'Bachata',

      'Rooftops',

      'Afterworks',

      'Open air',

    ],

  },

  {

    label: 'Créatif',

    items: [

      'Photo',

      'Art',

      'Cinéma',

      'Gaming',

      'Lecture',

      'Peinture',

      'Dessin',

      'Écriture',

      'Création vidéo',

      'Podcasts',

      'Théâtre',

      'Design',

      'DIY',

      'Anime & manga',

    ],

  },

];



/** Liste plate dédupliquée — autocomplete profil. */

export const POPULAR_INTERESTS: string[] = [

  ...new Set(INTEREST_CATEGORIES.flatMap((c) => c.items)),

];


