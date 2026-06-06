// ─── Instagram-aligned image constraints ─────────────────────────────────────
// Single source of truth for format, size and quality limits used across
// story, profile photo, and feed post upload flows.

// ─── Generic limits (used by profileImageProcessing.ts) ─────────────────────

export const INSTAGRAM_IMAGE_LIMITS = {
  maxFileSizeMB: 8,
  maxFileSizeBytes: 8 * 1024 * 1024,
  minWidth: 320,
  maxWidth: 1080,
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'] as const,
  outputQuality: 0.85,
  outputFormat: 'image/jpeg' as const,
} as const;

export type InstagramAcceptedFormat =
  (typeof INSTAGRAM_IMAGE_LIMITS.acceptedFormats)[number];

// ─── Spec-specific limits ─────────────────────────────────────────────────────

export const INSTAGRAM_POST_LIMITS = {
  maxFileSizeBytes: 8 * 1024 * 1024,
  maxWidth: 1080,
  minWidth: 320,
  outputQuality: 0.85,
  outputFormat: 'image/jpeg' as const,
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  allowedRatios: [
    { label: 'Carré 1:1', w: 1, h: 1 },
    { label: 'Portrait 4:5', w: 4, h: 5 },
    { label: 'Paysage 1.91:1', w: 191, h: 100 },
  ],
};

export const INSTAGRAM_STORY_LIMITS = {
  photo: {
    /** Max 4 Mo par photo de story */
    maxFileSizeBytes: 4 * 1024 * 1024,
    targetWidth: 1080,
    targetHeight: 1920,
    aspectRatio: 9 / 16,
    outputQuality: 0.85,
    outputFormat: 'image/jpeg' as const,
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
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
  /** Max 5 Mo pour une photo de profil */
  maxFileSizeBytes: 5 * 1024 * 1024,
  minDimension: 180,
  /** Dimension de sortie cible : 400 × 400 px */
  targetDimension: 400,
  maxDimension: 1080,
  outputQuality: 0.85,
  outputFormat: 'image/jpeg' as const,
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  aspectRatio: 1,
};

/** Chaîne pour l'attribut `accept` des `<input type="file">` image. */
export const ACCEPTED_IMAGE_FORMATS = INSTAGRAM_IMAGE_LIMITS.acceptedFormats.join(',');

// ─── Validation ───────────────────────────────────────────────────────────────

/** Valide le format et la taille d'un fichier image avant traitement (règles génériques). */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const accepted = INSTAGRAM_IMAGE_LIMITS.acceptedFormats as readonly string[];
  if (!accepted.includes(file.type)) {
    return { valid: false, error: 'Format non supporté (JPEG, PNG ou WebP uniquement)' };
  }
  if (file.size > INSTAGRAM_IMAGE_LIMITS.maxFileSizeBytes) {
    return { valid: false, error: 'Image trop volumineuse (max 8 Mo)' };
  }
  return { valid: true };
}

/** Valide une photo de story : format + max 4 Mo. */
export function validateStoryPhoto(file: File): { valid: boolean; error?: string } {
  const { maxFileSizeBytes, acceptedFormats } = INSTAGRAM_STORY_LIMITS.photo;
  if (!(acceptedFormats as string[]).includes(file.type)) {
    return { valid: false, error: 'Format non supporté. Utilisez JPG, PNG ou WebP.' };
  }
  if (file.size > maxFileSizeBytes) {
    const maxMb = maxFileSizeBytes / (1024 * 1024);
    return { valid: false, error: `Photo trop volumineuse (max ${maxMb} Mo).` };
  }
  return { valid: true };
}

/** Valide une photo de profil : format + max 5 Mo. */
export function validateProfilePhoto(file: File): { valid: boolean; error?: string } {
  const { maxFileSizeBytes, acceptedFormats } = INSTAGRAM_PROFILE_PHOTO_LIMITS;
  if (!(acceptedFormats as string[]).includes(file.type)) {
    return { valid: false, error: 'Format non supporté. Utilisez JPG, PNG ou WebP.' };
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
