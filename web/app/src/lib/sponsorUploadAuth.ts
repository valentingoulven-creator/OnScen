/** Admin sponsor uploads work with httpOnly cookie when in-memory token is null (web). */
export function canUploadSponsorAsset(sessionReady: boolean, uploading: boolean): boolean {
  return sessionReady && !uploading;
}
