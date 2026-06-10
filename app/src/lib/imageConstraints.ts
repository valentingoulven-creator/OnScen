// ─── Instagram-aligned image constraints ─────────────────────────────────────
// Single source of truth for format, size and quality limits used across
// story, profile photo, and feed post upload flows.

// ─── Generic limits (used by profileImageProcessing.ts) ─────────────────────

/** Taille max fichier source avant compression auto (Instagram accepte ~30 Mo). */
export const INSTAGRAM_MAX_INPUT_FILE_SIZE_MB = 30;
export const INSTAGRAM_MAX_INPUT_FILE_SIZE_BYTES = 30 * 1024 * 1024;

/** MIME types image acceptés (alignés Instagram + HEIC/HEIF iPhone). */
export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

/** Extensions fichier pour l'attribut `accept` (iOS HEIC souvent sans MIME fiable). */
export const ACCEPTED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
] as const;

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** Libellé affiché pour les formats supportés. */
export const SUPPORTED_IMAGE_FORMATS_LABEL = 'JPEG, JPG, PNG, WebP, HEIC/HEIF';

export const INSTAGRAM_IMAGE_LIMITS = {
  maxInputFileSizeMB: INSTAGRAM_MAX_INPUT_FILE_SIZE_MB,
  maxInputFileSizeBytes: INSTAGRAM_MAX_INPUT_FILE_SIZE_BYTES,
  /** @deprecated Alias entrée — utiliser maxInputFileSizeBytes */
  maxFileSizeMB: INSTAGRAM_MAX_INPUT_FILE_SIZE_MB,
  maxFileSizeBytes: INSTAGRAM_MAX_INPUT_FILE_SIZE_BYTES,
  minWidth: 320,
  maxWidth: 1080,
  acceptedFormats: ACCEPTED_IMAGE_MIME_TYPES,
  outputQuality: 0.85,
  outputFormat: 'image/jpeg' as const,
} as const;

export type InstagramAcceptedFormat =
  (typeof INSTAGRAM_IMAGE_LIMITS.acceptedFormats)[number];

// ─── Spec-specific limits ─────────────────────────────────────────────────────

export const INSTAGRAM_POST_LIMITS = {
  maxFileSizeBytes: INSTAGRAM_MAX_INPUT_FILE_SIZE_BYTES,
  maxWidth: 1080,
  minWidth: 320,
  outputQuality: 0.85,
  outputFormat: 'image/jpeg' as const,
  acceptedFormats: [...ACCEPTED_IMAGE_MIME_TYPES],
  allowedRatios: [
    { label: 'Carré 1:1', w: 1, h: 1 },
    { label: 'Portrait 4:5', w: 4, h: 5 },
    { label: 'Paysage 1.91:1', w: 191, h: 100 },
  ],
};

export const INSTAGRAM_STORY_LIMITS = {
  photo: {
    /** Max fichier source avant compression auto (même seuil que le fil). */
    maxFileSizeBytes: INSTAGRAM_MAX_INPUT_FILE_SIZE_BYTES,
    targetWidth: 1080,
    targetHeight: 1920,
    aspectRatio: 9 / 16,
    outputQuality: 0.85,
    outputFormat: 'image/jpeg' as const,
    acceptedFormats: [...ACCEPTED_IMAGE_MIME_TYPES],
    /** px réservés en haut et en bas pour les éléments d'interface */
    safeZoneTopBottom: 250,
  },
  video: {
    maxFileSizeBytes: 100 * 1024 * 1024,
    maxDurationSeconds: 15,
    acceptedFormats: ['video/mp4', 'video/quicktime'],
    targetAspectRatio: 9 / 16,
  },
};

export const INSTAGRAM_PROFILE_PHOTO_LIMITS = {
  /** Max fichier source avant compression auto (Instagram ~30 Mo). */
  maxFileSizeBytes: INSTAGRAM_MAX_INPUT_FILE_SIZE_BYTES,
  /** Dimension minimale acceptée : 320 px (standard Instagram) */
  minDimension: 320,
  /** Dimension de sortie cible : 1080 × 1080 px (standard Instagram max) */
  targetDimension: 1080,
  maxDimension: 1080,
  outputQuality: 0.85,
  outputFormat: 'image/jpeg' as const,
  acceptedFormats: [...ACCEPTED_IMAGE_MIME_TYPES],
  /** Ratio 1:1 — carré, comme Instagram */
  aspectRatio: 1,
};

/** Limites publication vidéo fil d'accueil (msdev : data URL base64). */
export const FEED_VIDEO_LIMITS = {
  maxFileSizeBytes: 12 * 1024 * 1024,
  maxDurationSeconds: 30,
  acceptedFormats: ['video/mp4', 'video/webm', 'video/quicktime'] as const,
  /** Taille max data URL envoyée au serveur (marge sous express.json 15 Mo). */
  maxDataUrlChars: 12_000_000,
} as const;

/** Chaîne pour l'attribut `accept` des `<input type="file">` image. */
export const ACCEPTED_IMAGE_FORMATS = [
  ...ACCEPTED_IMAGE_MIME_TYPES,
  ...ACCEPTED_IMAGE_EXTENSIONS,
].join(',');

/** MIME effectif d'un fichier image (type navigateur ou extension). */
export function getImageFileMimeType(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TO_MIME[ext] ?? '';
}

/** Vérifie format image via MIME ou extension (HEIC iPhone). */
export function isAcceptedImageFormat(
  file: File,
  acceptedFormats: readonly string[] = ACCEPTED_IMAGE_MIME_TYPES
): boolean {
  const mime = getImageFileMimeType(file);
  if (mime && (acceptedFormats as readonly string[]).includes(mime)) return true;
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
  return (ACCEPTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

export function isHeicImageFile(file: File): boolean {
  const mime = getImageFileMimeType(file);
  if (mime === 'image/heic' || mime === 'image/heif') return true;
  return /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);
}

/** Chaîne pour l'attribut `accept` des `<input type="file">` vidéo (fil). */
export const ACCEPTED_FEED_VIDEO_FORMATS = FEED_VIDEO_LIMITS.acceptedFormats.join(',');

// ─── Validation ───────────────────────────────────────────────────────────────

/** Valide le format (et un plafond source très haut) avant compression automatique. */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!isAcceptedImageFormat(file, INSTAGRAM_IMAGE_LIMITS.acceptedFormats)) {
    return {
      valid: false,
      error: `Format non supporté (${SUPPORTED_IMAGE_FORMATS_LABEL} uniquement)`,
    };
  }
  if (file.size > INSTAGRAM_IMAGE_LIMITS.maxInputFileSizeBytes) {
    return {
      valid: false,
      error: `Photo trop volumineuse (max ${INSTAGRAM_IMAGE_LIMITS.maxInputFileSizeMB} Mo).`,
    };
  }
  return { valid: true };
}

/** Valide une photo de story : format + plafond source (compression auto ensuite). */
export function validateStoryPhoto(file: File): { valid: boolean; error?: string } {
  const { maxFileSizeBytes, acceptedFormats } = INSTAGRAM_STORY_LIMITS.photo;
  if (!isAcceptedImageFormat(file, acceptedFormats)) {
    return {
      valid: false,
      error: `Format non supporté. Utilisez ${SUPPORTED_IMAGE_FORMATS_LABEL}.`,
    };
  }
  if (file.size > maxFileSizeBytes) {
    const maxMb = maxFileSizeBytes / (1024 * 1024);
    return { valid: false, error: `Photo trop volumineuse (max ${maxMb} Mo).` };
  }
  return { valid: true };
}

/** Valide une photo de profil : format + plafond source (compression auto ensuite). */
export function validateProfilePhoto(file: File): { valid: boolean; error?: string } {
  const { maxFileSizeBytes, acceptedFormats } = INSTAGRAM_PROFILE_PHOTO_LIMITS;
  if (!isAcceptedImageFormat(file, acceptedFormats)) {
    return {
      valid: false,
      error: `Format non supporté. Utilisez ${SUPPORTED_IMAGE_FORMATS_LABEL}.`,
    };
  }
  if (file.size > maxFileSizeBytes) {
    const maxMb = maxFileSizeBytes / (1024 * 1024);
    return { valid: false, error: `Photo trop volumineuse (max ${maxMb} Mo).` };
  }
  return { valid: true };
}

// ─── Utilitaires de redimensionnement ────────────────────────────────────────

/**
 * Redimensionne une image aux specs Instagram génériques :
 * largeur max 1080 px, sortie JPEG 0.85.
 */
export function resizeToInstagramSpecs(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width < INSTAGRAM_IMAGE_LIMITS.minWidth) {
        reject(new Error('Image trop petite (minimum 320 px de large)'));
        return;
      }
      if (width > INSTAGRAM_IMAGE_LIMITS.maxWidth) {
        height = Math.round(height * (INSTAGRAM_IMAGE_LIMITS.maxWidth / width));
        width = INSTAGRAM_IMAGE_LIMITS.maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas non disponible'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Conversion canvas échouée'));
        },
        INSTAGRAM_IMAGE_LIMITS.outputFormat,
        INSTAGRAM_IMAGE_LIMITS.outputQuality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de charger cette image'));
    };
    img.src = url;
  });
}

/**
 * Redimensionne une image story au format 1080 × 1920 avec letterbox noir.
 * L'image est centrée ; des barres noires comblent si le ratio diffère de 9:16.
 */
export async function resizeToStorySpecs(file: File): Promise<Blob> {
  const { targetWidth: W, targetHeight: H, outputQuality, outputFormat } =
    INSTAGRAM_STORY_LIMITS.photo;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Impossible d'initialiser le canvas"));
        return;
      }
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      const scale = Math.min(W / img.width, H / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Impossible de générer la story'));
        },
        outputFormat,
        outputQuality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image invalide'));
    };
    img.src = url;
  });
}

/**
 * Recadre l'image en carré centré et la redimensionne à 400 × 400 px.
 * Conforme aux specs Instagram pour les photos de profil.
 */
export async function resizeToProfilePhotoSpecs(file: File): Promise<Blob> {
  const { targetDimension, outputQuality, outputFormat } = INSTAGRAM_PROFILE_PHOTO_LIMITS;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = targetDimension;
      canvas.height = targetDimension;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Impossible d'initialiser le canvas"));
        return;
      }
      ctx.drawImage(img, sx, sy, size, size, 0, 0, targetDimension, targetDimension);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Impossible de générer la photo de profil'));
        },
        outputFormat,
        outputQuality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image invalide'));
    };
    img.src = url;
  });
}
