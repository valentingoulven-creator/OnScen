/** Référentiel des grandes villes (seed PostgreSQL + repli mémoire msdev). */
export interface MajorCitySeed {
  id: string;
  name: string;
  countryCode: string;
  label: string;
  latitude: number;
  longitude: number;
  postalCode?: string;
  population?: number;
}

export const MAJOR_CITIES_SEED: MajorCitySeed[] = [
  // France — métropoles
  { id: 'paris', name: 'Paris', countryCode: 'FR', label: 'Paris, France', latitude: 48.8566, longitude: 2.3522, postalCode: '75001', population: 2161000 },
  { id: 'marseille', name: 'Marseille', countryCode: 'FR', label: 'Marseille, France', latitude: 43.2965, longitude: 5.3698, postalCode: '13001', population: 873000 },
  { id: 'lyon', name: 'Lyon', countryCode: 'FR', label: 'Lyon, France', latitude: 45.764, longitude: 4.8357, postalCode: '69001', population: 522000 },
  { id: 'toulouse', name: 'Toulouse', countryCode: 'FR', label: 'Toulouse, France', latitude: 43.6047, longitude: 1.4442, postalCode: '31000', population: 498000 },
  { id: 'nice', name: 'Nice', countryCode: 'FR', label: 'Nice, France', latitude: 43.7102, longitude: 7.262, postalCode: '06000', population: 348000 },
  { id: 'nantes', name: 'Nantes', countryCode: 'FR', label: 'Nantes, France', latitude: 47.2184, longitude: -1.5536, postalCode: '44000', population: 320000 },
  { id: 'montpellier', name: 'Montpellier', countryCode: 'FR', label: 'Montpellier, France', latitude: 43.6108, longitude: 3.8767, postalCode: '34000', population: 303000 },
  { id: 'strasbourg', name: 'Strasbourg', countryCode: 'FR', label: 'Strasbourg, France', latitude: 48.5734, longitude: 7.7521, postalCode: '67000', population: 287000 },
  { id: 'bordeaux', name: 'Bordeaux', countryCode: 'FR', label: 'Bordeaux, France', latitude: 44.8378, longitude: -0.5792, postalCode: '33000', population: 261000 },
  { id: 'lille', name: 'Lille', countryCode: 'FR', label: 'Lille, France', latitude: 50.6292, longitude: 3.0573, postalCode: '59000', population: 236000 },
  { id: 'rennes', name: 'Rennes', countryCode: 'FR', label: 'Rennes, France', latitude: 48.1173, longitude: -1.6778, postalCode: '35000', population: 225000 },
  { id: 'reims', name: 'Reims', countryCode: 'FR', label: 'Reims, France', latitude: 49.2583, longitude: 4.0317, postalCode: '51100', population: 182000 },
  { id: 'toulon', name: 'Toulon', countryCode: 'FR', label: 'Toulon, France', latitude: 43.1242, longitude: 5.928, postalCode: '83000', population: 178000 },
  { id: 'saint-etienne', name: 'Saint-Étienne', countryCode: 'FR', label: 'Saint-Étienne, France', latitude: 45.4397, longitude: 4.3872, postalCode: '42000', population: 172000 },
  { id: 'le-havre', name: 'Le Havre', countryCode: 'FR', label: 'Le Havre, France', latitude: 49.4944, longitude: 0.1079, postalCode: '76600', population: 170000 },
  { id: 'grenoble', name: 'Grenoble', countryCode: 'FR', label: 'Grenoble, France', latitude: 45.1885, longitude: 5.7245, postalCode: '38000', population: 158000 },
  { id: 'dijon', name: 'Dijon', countryCode: 'FR', label: 'Dijon, France', latitude: 47.322, longitude: 5.0415, postalCode: '21000', population: 157000 },
  { id: 'angers', name: 'Angers', countryCode: 'FR', label: 'Angers, France', latitude: 47.4784, longitude: -0.5632, postalCode: '49000', population: 155000 },
  { id: 'nimes', name: 'Nîmes', countryCode: 'FR', label: 'Nîmes, France', latitude: 43.8367, longitude: 4.3601, postalCode: '30000', population: 148000 },
  { id: 'clermont-ferrand', name: 'Clermont-Ferrand', countryCode: 'FR', label: 'Clermont-Ferrand, France', latitude: 45.7772, longitude: 3.087, postalCode: '63000', population: 147000 },
  { id: 'aix-en-provence', name: 'Aix-en-Provence', countryCode: 'FR', label: 'Aix-en-Provence, France', latitude: 43.5297, longitude: 5.4474, postalCode: '13100', population: 145000 },
  { id: 'brest', name: 'Brest', countryCode: 'FR', label: 'Brest, France', latitude: 48.3904, longitude: -4.4861, postalCode: '29200', population: 139000 },
  { id: 'limoges', name: 'Limoges', countryCode: 'FR', label: 'Limoges, France', latitude: 45.8354, longitude: 1.2645, postalCode: '87000', population: 131000 },
  { id: 'tours', name: 'Tours', countryCode: 'FR', label: 'Tours, France', latitude: 47.3941, longitude: 0.6848, postalCode: '37000', population: 137000 },
  { id: 'amiens', name: 'Amiens', countryCode: 'FR', label: 'Amiens, France', latitude: 49.8941, longitude: 2.2958, postalCode: '80000', population: 134000 },
  { id: 'perpignan', name: 'Perpignan', countryCode: 'FR', label: 'Perpignan, France', latitude: 42.6887, longitude: 2.8948, postalCode: '66000', population: 121000 },
  { id: 'metz', name: 'Metz', countryCode: 'FR', label: 'Metz, France', latitude: 49.1193, longitude: 6.1757, postalCode: '57000', population: 118000 },
  { id: 'besancon', name: 'Besançon', countryCode: 'FR', label: 'Besançon, France', latitude: 47.2378, longitude: 6.0241, postalCode: '25000', population: 117000 },
  { id: 'orleans', name: 'Orléans', countryCode: 'FR', label: 'Orléans, France', latitude: 47.9029, longitude: 1.9093, postalCode: '45000', population: 116000 },
  { id: 'rouen', name: 'Rouen', countryCode: 'FR', label: 'Rouen, France', latitude: 49.4431, longitude: 1.0993, postalCode: '76000', population: 114000 },
  { id: 'mulhouse', name: 'Mulhouse', countryCode: 'FR', label: 'Mulhouse, France', latitude: 47.7508, longitude: 7.3359, postalCode: '68100', population: 108000 },
  { id: 'caen', name: 'Caen', countryCode: 'FR', label: 'Caen, France', latitude: 49.1829, longitude: -0.3707, postalCode: '14000', population: 106000 },
  { id: 'nancy', name: 'Nancy', countryCode: 'FR', label: 'Nancy, France', latitude: 48.6921, longitude: 6.1844, postalCode: '54000', population: 104000 },
  { id: 'avignon', name: 'Avignon', countryCode: 'FR', label: 'Avignon, France', latitude: 43.9493, longitude: 4.8055, postalCode: '84000', population: 91000 },
  { id: 'poitiers', name: 'Poitiers', countryCode: 'FR', label: 'Poitiers, France', latitude: 46.5802, longitude: 0.3404, postalCode: '86000', population: 89000 },
  { id: 'pau', name: 'Pau', countryCode: 'FR', label: 'Pau, France', latitude: 43.2951, longitude: -0.3708, postalCode: '64000', population: 77000 },
  { id: 'la-rochelle', name: 'La Rochelle', countryCode: 'FR', label: 'La Rochelle, France', latitude: 46.1603, longitude: -1.1511, postalCode: '17000', population: 76000 },
  { id: 'dunkerque', name: 'Dunkerque', countryCode: 'FR', label: 'Dunkerque, France', latitude: 51.0343, longitude: 2.3768, postalCode: '59140', population: 86000 },
  { id: 'valence', name: 'Valence', countryCode: 'FR', label: 'Valence, France', latitude: 44.9334, longitude: 4.8924, postalCode: '26000', population: 64000 },
  { id: 'quimper', name: 'Quimper', countryCode: 'FR', label: 'Quimper, France', latitude: 47.9977, longitude: -4.0979, postalCode: '29000', population: 63000 },
  { id: 'annecy', name: 'Annecy', countryCode: 'FR', label: 'Annecy, France', latitude: 45.8992, longitude: 6.1294, postalCode: '74000', population: 128000 },
  { id: 'chambery', name: 'Chambéry', countryCode: 'FR', label: 'Chambéry, France', latitude: 45.5646, longitude: 5.9178, postalCode: '73000', population: 59000 },
  { id: 'bayonne', name: 'Bayonne', countryCode: 'FR', label: 'Bayonne, France', latitude: 43.4929, longitude: -1.4748, postalCode: '64100', population: 52000 },
  { id: 'ajaccio', name: 'Ajaccio', countryCode: 'FR', label: 'Ajaccio, France', latitude: 41.9192, longitude: 8.7386, postalCode: '20000', population: 72000 },
  { id: 'bastia', name: 'Bastia', countryCode: 'FR', label: 'Bastia, France', latitude: 42.6976, longitude: 9.4509, postalCode: '20200', population: 48000 },
  // International
  { id: 'london', name: 'London', countryCode: 'GB', label: 'London, UK', latitude: 51.5074, longitude: -0.1278, postalCode: 'SW1A', population: 9000000 },
  { id: 'berlin', name: 'Berlin', countryCode: 'DE', label: 'Berlin, Germany', latitude: 52.52, longitude: 13.405, postalCode: '10115', population: 3700000 },
  { id: 'madrid', name: 'Madrid', countryCode: 'ES', label: 'Madrid, Spain', latitude: 40.4168, longitude: -3.7038, postalCode: '28001', population: 3300000 },
  { id: 'rome', name: 'Rome', countryCode: 'IT', label: 'Rome, Italy', latitude: 41.9028, longitude: 12.4964, postalCode: '00100', population: 2800000 },
  { id: 'amsterdam', name: 'Amsterdam', countryCode: 'NL', label: 'Amsterdam, Netherlands', latitude: 52.3676, longitude: 4.9041, postalCode: '1012', population: 870000 },
  { id: 'brussels', name: 'Brussels', countryCode: 'BE', label: 'Brussels, Belgium', latitude: 50.8503, longitude: 4.3517, postalCode: '1000', population: 1200000 },
  { id: 'nyc', name: 'New York', countryCode: 'US', label: 'New York, USA', latitude: 40.7128, longitude: -74.006, postalCode: '10001', population: 8400000 },
  { id: 'la', name: 'Los Angeles', countryCode: 'US', label: 'Los Angeles, USA', latitude: 34.0522, longitude: -118.2437, postalCode: '90001', population: 3900000 },
  { id: 'montreal', name: 'Montréal', countryCode: 'CA', label: 'Montréal, Canada', latitude: 45.5017, longitude: -73.5673, postalCode: 'H2X', population: 1800000 },
  { id: 'tokyo', name: 'Tokyo', countryCode: 'JP', label: 'Tokyo, Japan', latitude: 35.6762, longitude: 139.6503, postalCode: '100-0001', population: 14000000 },
  { id: 'seoul', name: 'Seoul', countryCode: 'KR', label: 'Seoul, South Korea', latitude: 37.5665, longitude: 126.978, postalCode: '04524', population: 9700000 },
  { id: 'sydney', name: 'Sydney', countryCode: 'AU', label: 'Sydney, Australia', latitude: -33.8688, longitude: 151.2093, postalCode: '2000', population: 5300000 },
  { id: 'dubai', name: 'Dubai', countryCode: 'AE', label: 'Dubai, UAE', latitude: 25.2048, longitude: 55.2708, population: 3400000 },
  { id: 'mumbai', name: 'Mumbai', countryCode: 'IN', label: 'Mumbai, India', latitude: 19.076, longitude: 72.8777, postalCode: '400001', population: 20400000 },
  { id: 'sao-paulo', name: 'São Paulo', countryCode: 'BR', label: 'São Paulo, Brazil', latitude: -23.5505, longitude: -46.6333, postalCode: '01310', population: 12300000 },
];
