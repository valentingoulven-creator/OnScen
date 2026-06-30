/** Max raw audio file size for user compositions (~30 MiB). */
export const COMPOSITION_UPLOAD_MAX_FILE_BYTES = 30 * 1024 * 1024;

/** Max base64 data URL length for uploaded audio (+ prefix). */
export const MAX_COMPOSITION_AUDIO_DATA_CHARS =
  Math.ceil((COMPOSITION_UPLOAD_MAX_FILE_BYTES * 4) / 3) + 64;

/** express.json limit for POST /api/compositions (base64 payload + JSON metadata). */
export const COMPOSITION_UPLOAD_JSON_LIMIT_BYTES =
  Math.ceil(COMPOSITION_UPLOAD_MAX_FILE_BYTES * (4 / 3)) + 512 * 1024;

export const COMPOSITION_UPLOAD_JSON_BODY_LIMIT = `${Math.ceil(
  COMPOSITION_UPLOAD_JSON_LIMIT_BYTES / (1024 * 1024)
)}mb`;
