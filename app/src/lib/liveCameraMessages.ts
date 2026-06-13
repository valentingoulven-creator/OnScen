/** Note affichée aux spectateurs quand la caméra est active mais le flux WebRTC n’est pas encore reçu. */
export const LIVE_CAMERA_VIEWER_NOTE =
  'Le host diffuse en caméra. Connexion au flux vidéo en cours…';

/** Spectateur : le host n’a pas activé sa caméra côté serveur. */
export const LIVE_CAMERA_VIEWER_NO_HOST_CAMERA =
  'Le host n’a pas activé sa caméra pour ce live.';

/** Spectateur : échec WebRTC après plusieurs tentatives. */
export const LIVE_CAMERA_VIEWER_UNAVAILABLE =
  'Flux vidéo indisponible. Vérifiez votre connexion ou réessayez plus tard.';

/** Spectateur : délai dépassé en attente du flux. */
export const LIVE_CAMERA_VIEWER_TIMEOUT =
  'Connexion au flux vidéo expirée. Rafraîchissez la page ou réessayez dans quelques instants.';

/** Spectateur : échec ICE / NAT. */
export const LIVE_CAMERA_VIEWER_ICE_FAILED =
  'Connexion réseau au flux vidéo impossible (pare-feu ou NAT).';

/** Fichier vidéo local hôte — non relayé via WebRTC. */
export const LIVE_CAMERA_VIEWER_FILE_NOTE =
  'Le host diffuse une vidéo locale (aperçu non relayé aux spectateurs).';

/** Contexte iframe : la caméra est souvent bloquée sans permission `allow="camera"`. */
export const LIVE_CAMERA_IFRAME_NOTE =
  'Si Soundy est intégré dans une autre page (iframe), la caméra peut être bloquée. Ouvrez l’app dans un onglet dédié ou demandez l’attribut allow="camera; microphone".';

/** PWA / écran d’accueil iOS : parfois permissions limitées au premier lancement. */
export const LIVE_CAMERA_PWA_NOTE =
  'En application installée (PWA), autorisez caméra et micro dans Réglages → Safari (ou l’app) si la demande n’apparaît pas.';

export const LIVE_CAMERA_HTTPS_REQUIRED =
  'La caméra nécessite une connexion sécurisée (HTTPS). Sur le PC : https://localhost:4080 ; sur le téléphone : npm run msdev:https puis l’URL https://192.168.x.x:4080.';

export const LIVE_CAMERA_HTTPS_HTTP_LAN =
  'Caméra bloquée en http:// sur le réseau local (192.168.x). Sur le PC : npm run msdev:https, puis ouvrez https://192.168.x.x:4080 et acceptez le certificat.';

export const LIVE_CAMERA_HTTP_LAN_MSDEV_HINT =
  'En http:// sur le LAN, le navigateur peut bloquer la caméra. Pour le téléphone : npm run msdev:https → https://192.168.x.x:4080 (certificat auto-signé). Sur le PC, http://localhost:4080 fonctionne souvent.';

export const LIVE_CAMERA_PERMISSION_DENIED =
  'Accès caméra refusé. Autorisez la caméra et le micro dans le navigateur (icône cadenas ou barre d’adresse).';

export const LIVE_CAMERA_PERMISSION_DENIED_WINDOWS =
  'Accès caméra refusé. Autorisez la caméra dans le navigateur (icône cadenas). Sous Windows : Paramètres → Confidentialité et sécurité → Caméra → activez « Accès à la caméra » et autorisez votre navigateur (Chrome, Edge, Opera, etc.).';

export const LIVE_CAMERA_UNSUPPORTED_BROWSER =
  'Votre navigateur ne prend pas en charge l’accès caméra (getUserMedia). Mettez à jour Chrome, Edge, Opera ou Safari, ou utilisez « Choisir une vidéo ».';

export const LIVE_CAMERA_IFRAME_BLOCKED =
  'Caméra indisponible dans cette fenêtre intégrée (iframe). Ouvrez Soundy dans un onglet complet.';

export const LIVE_CAMERA_INVALID_FILE =
  'Choisissez un fichier vidéo (MP4, WebM, etc.).';

export const LIVE_CAMERA_FILE_LOAD_ERROR =
  'Impossible de lire cette vidéo. Essayez un autre format (MP4 recommandé).';

/** Spectateur : le navigateur a bloqué la lecture audio automatique. */
export const LIVE_CAMERA_VIEWER_AUDIO_BLOCKED =
  'Le son du live est coupé. Appuyez sur « Activer le son » pour entendre le host.';

/** Spectateur : flux WebRTC connecté mais piste vidéo pas encore reçue. */
export const LIVE_CAMERA_VIEWER_VIDEO_PENDING =
  'Connexion à la vidéo en cours… Le host diffuse peut-être encore sans image.';

/** Hôte : changement de micro en cours. */
export const LIVE_CAMERA_MIC_SWITCHING = 'Changement de micro…';
