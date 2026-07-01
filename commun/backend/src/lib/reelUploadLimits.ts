/** TikTok mobile upload cap — 287 MiB (commonly cited for short-form video). */
export const REEL_UPLOAD_MAX_FILE_BYTES = 287 * 1024 * 1024;

/**
 * Durée max (s) d'un reel — alignée sur REEL_RECORD_MAX_SEC (frontend) et sur la
 * capacité de modération vidéo synchrone Sightengine (SIGHTENGINE_VIDEO_SYNC_MAX_SEC,
 * 60 s par défaut). 30 s était trop court comparé aux standards courts-métrages actuels
 * (TikTok : 10 min à l'enregistrement / 60 min à l'import ; Instagram Reels : 90 s à
 * 3 min recommandés) ; 60 s reste prudent côté stockage/modération tout en rapprochant
 * l'app des standards du marché.
 */
export const REEL_RECORD_MAX_SEC = 60;

/** Max base64 data URL length for imported/recorded reel video (+ prefix). */
export const MAX_RECORDED_REEL_VIDEO_DATA_CHARS =
  Math.ceil((REEL_UPLOAD_MAX_FILE_BYTES * 4) / 3) + 64;

/** express.json limit for POST /api/reels (base64 payload + poster + JSON metadata). */
export const REEL_UPLOAD_JSON_LIMIT_BYTES =
  Math.ceil(REEL_UPLOAD_MAX_FILE_BYTES * (4 / 3)) + 512 * 1024;

export const REEL_UPLOAD_JSON_BODY_LIMIT = `${Math.ceil(REEL_UPLOAD_JSON_LIMIT_BYTES / (1024 * 1024))}mb`;
