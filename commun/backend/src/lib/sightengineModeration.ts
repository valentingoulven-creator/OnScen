import {
  getSightengineApiUrl,
  getSightengineCredentials,
  getSightengineEroticaThreshold,
  getSightengineExplicitThreshold,
  getSightengineMinorThreshold,
  getSightengineModels,
  getSightengineOffensiveThreshold,
  getSightengineVideoApiUrl,
  getSightengineVideoSyncMaxSec,
  getSightengineViolenceThreshold,
  isSightengineConfigured,
  shouldModerateRemoteImageUrls,
  sightengineFailOpenOnError,
} from './sightengineConfig';
import { recordApiCall } from './apiQuotaMonitor';
import { extensionForImageMime, isImageDataUrl, parseImageDataUrl } from './imageDataUrl';
import {
  extensionForVideoMime,
  isVideoDataUrl,
  parseVideoDataUrl,
} from './videoDataUrl';

export type SightengineRejectReason = 'explicit' | 'erotica' | 'offensive' | 'violent' | 'minor_risk';

export interface SightengineEvaluation {
  allowed: boolean;
  reason?: SightengineRejectReason;
  scores?: Record<string, number>;
}

export interface SightengineCheckResult {
  ok: true;
  evaluation: SightengineEvaluation;
  raw?: unknown;
}

export interface SightengineCheckError {
  ok: false;
  error: string;
  statusCode?: number;
}

export type SightengineApiResult = SightengineCheckResult | SightengineCheckError;

function numScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

/** Score max `faces[].attributes.age.minor` (0-1) — modèle Sightengine `face-age`. */
function extractMaxMinorScore(payload: unknown): number | null {
  if (payload == null || typeof payload !== 'object') return null;
  const faces = (payload as { faces?: unknown }).faces;
  if (!Array.isArray(faces)) return null;
  let max: number | null = null;
  for (const face of faces) {
    if (face == null || typeof face !== 'object') continue;
    const attrs = (face as { attributes?: { age?: { minor?: unknown } } }).attributes;
    const minor = numScore(attrs?.age?.minor);
    if (minor != null && (max == null || minor > max)) max = minor;
  }
  return max;
}

/** Évalue la réponse JSON Sightengine (testable sans réseau). */
export function evaluateSightenginePayload(payload: unknown): SightengineEvaluation {
  const explicitThreshold = getSightengineExplicitThreshold();
  const eroticaThreshold = getSightengineEroticaThreshold();
  const offensiveThreshold = getSightengineOffensiveThreshold();
  const violenceThreshold = getSightengineViolenceThreshold();
  const minorThreshold = getSightengineMinorThreshold();

  const scores: Record<string, number> = {};
  const nudity =
    payload != null && typeof payload === 'object' && 'nudity' in payload
      ? (payload as { nudity?: Record<string, unknown> }).nudity
      : undefined;

  const sexualActivity = numScore(nudity?.sexual_activity);
  const sexualDisplay = numScore(nudity?.sexual_display);
  const erotica = numScore(nudity?.erotica);
  const verySuggestive = numScore(nudity?.very_suggestive);
  const suggestive = numScore(nudity?.suggestive);

  if (sexualActivity != null) scores.sexual_activity = sexualActivity;
  if (sexualDisplay != null) scores.sexual_display = sexualDisplay;
  if (erotica != null) scores.erotica = erotica;
  if (verySuggestive != null) scores.very_suggestive = verySuggestive;
  if (suggestive != null) scores.suggestive = suggestive;

  // Détection mineur (MOD-8) : évaluée avant les seuils adultes classiques — un signal
  // « mineur probable + nudité/suggestif même modéré » est toujours plus grave qu'une
  // nudité adulte isolée et doit être bloqué avec un seuil plus bas et une escalade dédiée.
  const minorScore = extractMaxMinorScore(payload);
  if (minorScore != null) scores.minor = minorScore;
  const nudityOrSuggestiveSignal = Math.max(
    sexualActivity ?? 0,
    sexualDisplay ?? 0,
    erotica ?? 0,
    verySuggestive ?? 0,
    suggestive ?? 0
  );
  if (minorScore != null && minorScore >= minorThreshold && nudityOrSuggestiveSignal >= 0.3) {
    return { allowed: false, reason: 'minor_risk', scores };
  }

  if (sexualActivity != null && sexualActivity >= explicitThreshold) {
    return { allowed: false, reason: 'explicit', scores };
  }
  if (sexualDisplay != null && sexualDisplay >= explicitThreshold) {
    return { allowed: false, reason: 'explicit', scores };
  }
  if (erotica != null && erotica >= eroticaThreshold) {
    return { allowed: false, reason: 'erotica', scores };
  }

  const offensive =
    payload != null && typeof payload === 'object' && 'offensive' in payload
      ? (payload as { offensive?: Record<string, unknown> }).offensive
      : undefined;
  const offensiveProb = numScore(offensive?.prob);
  if (offensiveProb != null) scores.offensive_prob = offensiveProb;
  if (offensiveProb != null && offensiveProb >= offensiveThreshold) {
    return { allowed: false, reason: 'offensive', scores };
  }

  // Gore / armes (MOD-1) — modèles `gore-2.0`/`weapon`, activés par défaut désormais.
  const gore =
    payload != null && typeof payload === 'object' && 'gore' in payload
      ? (payload as { gore?: Record<string, unknown> }).gore
      : undefined;
  const goreProb = numScore(gore?.prob);
  if (goreProb != null) scores.gore_prob = goreProb;
  if (goreProb != null && goreProb >= violenceThreshold) {
    return { allowed: false, reason: 'violent', scores };
  }

  const weapon =
    payload != null && typeof payload === 'object' && 'weapon' in payload
      ? (payload as { weapon?: { classes?: Record<string, unknown> } }).weapon
      : undefined;
  const weaponClasses = weapon?.classes;
  let weaponMax = 0;
  if (weaponClasses && typeof weaponClasses === 'object') {
    for (const value of Object.values(weaponClasses)) {
      const n = numScore(value);
      if (n != null && n > weaponMax) weaponMax = n;
    }
  }
  if (weaponMax > 0) scores.weapon_max = weaponMax;
  if (weaponMax >= violenceThreshold) {
    return { allowed: false, reason: 'violent', scores };
  }

  return { allowed: true, scores };
}

function collectVideoFrames(payload: unknown): unknown[] {
  if (payload == null || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const data = root.data;
  if (data != null && typeof data === 'object' && Array.isArray((data as { frames?: unknown }).frames)) {
    return (data as { frames: unknown[] }).frames;
  }
  if (Array.isArray(root.frames)) return root.frames;
  return [];
}

/** Évalue une réponse vidéo sync (frames + summary). */
export function evaluateVideoSightenginePayload(payload: unknown): SightengineEvaluation {
  if (payload != null && typeof payload === 'object') {
    const summary = (payload as { summary?: { action?: string } }).summary;
    if (summary?.action === 'reject') {
      return { allowed: false, reason: 'explicit' };
    }
  }

  const frames = collectVideoFrames(payload);
  if (frames.length > 0) {
    for (const frame of frames) {
      const evaluation = evaluateSightenginePayload(frame);
      if (!evaluation.allowed) return evaluation;
    }
    return { allowed: true };
  }

  return evaluateSightenginePayload(payload);
}

function parseSightengineResponse(body: unknown): SightengineApiResult {
  if (body == null || typeof body !== 'object') {
    return { ok: false, error: 'Réponse Sightengine invalide' };
  }
  const status = (body as { status?: string }).status;
  if (status === 'failure') {
    const err = (body as { error?: { message?: string } }).error?.message;
    return { ok: false, error: err || 'Sightengine a refusé la requête' };
  }
  const evaluation = evaluateSightenginePayload(body);
  return { ok: true, evaluation, raw: body };
}

async function postSightengineMultipart(buffer: Buffer, mime: string): Promise<SightengineApiResult> {
  const creds = getSightengineCredentials();
  if (!creds) return { ok: false, error: 'Sightengine non configuré' };

  const form = new FormData();
  const ext = extensionForImageMime(mime);
  form.append('media', new Blob([buffer], { type: mime }), `upload.${ext}`);
  form.append('models', getSightengineModels());
  form.append('api_user', creds.apiUser);
  form.append('api_secret', creds.apiSecret);

  const res = await fetch(getSightengineApiUrl(), { method: 'POST', body: form });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: 'Réponse Sightengine illisible', statusCode: res.status };
  }
  if (!res.ok) {
    const msg =
      body != null && typeof body === 'object' && 'error' in body
        ? String((body as { error?: { message?: string } }).error?.message ?? res.statusText)
        : res.statusText;
    return { ok: false, error: msg || `HTTP ${res.status}`, statusCode: res.status };
  }
  return parseSightengineResponse(body);
}

async function getSightengineByUrl(imageUrl: string): Promise<SightengineApiResult> {
  const creds = getSightengineCredentials();
  if (!creds) return { ok: false, error: 'Sightengine non configuré' };

  const url = new URL(getSightengineApiUrl());
  url.searchParams.set('url', imageUrl);
  url.searchParams.set('models', getSightengineModels());
  url.searchParams.set('api_user', creds.apiUser);
  url.searchParams.set('api_secret', creds.apiSecret);

  const res = await fetch(url.toString(), { method: 'GET' });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: 'Réponse Sightengine illisible', statusCode: res.status };
  }
  if (!res.ok) {
    const msg =
      body != null && typeof body === 'object' && 'error' in body
        ? String((body as { error?: { message?: string } }).error?.message ?? res.statusText)
        : res.statusText;
    return { ok: false, error: msg || `HTTP ${res.status}`, statusCode: res.status };
  }
  return parseSightengineResponse(body);
}

export function shouldScanImageSource(source: string): boolean {
  const trimmed = source.trim();
  if (!trimmed) return false;
  if (isImageDataUrl(trimmed)) return true;
  if (shouldModerateRemoteImageUrls() && /^https:\/\//i.test(trimmed)) return true;
  return false;
}

export async function checkImageWithSightengine(source: string): Promise<SightengineApiResult> {
  if (!isSightengineConfigured()) {
    return { ok: false, error: 'Sightengine non configuré' };
  }

  const trimmed = source.trim();
  if (isImageDataUrl(trimmed)) {
    const parsed = parseImageDataUrl(trimmed);
    if (!parsed) return { ok: false, error: 'Data URL image invalide' };
    let result: SightengineApiResult;
    try {
      result = await postSightengineMultipart(parsed.buffer, parsed.mime);
    } catch (err) {
      recordApiCall('sightengine', false);
      throw err;
    }
    recordApiCall('sightengine', result.ok);
    return result;
  }

  if (/^https:\/\//i.test(trimmed)) {
    let result: SightengineApiResult;
    try {
      result = await getSightengineByUrl(trimmed);
    } catch (err) {
      recordApiCall('sightengine', false);
      throw err;
    }
    recordApiCall('sightengine', result.ok);
    return result;
  }

  return { ok: false, error: 'Source image non prise en charge pour la modération' };
}

function parseVideoSightengineResponse(body: unknown): SightengineApiResult {
  if (body == null || typeof body !== 'object') {
    return { ok: false, error: 'Réponse Sightengine vidéo invalide' };
  }
  const status = (body as { status?: string }).status;
  if (status === 'failure') {
    const err = (body as { error?: { message?: string } }).error?.message;
    return { ok: false, error: err || 'Sightengine a refusé la requête vidéo' };
  }
  const evaluation = evaluateVideoSightenginePayload(body);
  return { ok: true, evaluation, raw: body };
}

async function postSightengineVideoMultipart(buffer: Buffer, mime: string): Promise<SightengineApiResult> {
  const creds = getSightengineCredentials();
  if (!creds) return { ok: false, error: 'Sightengine non configuré' };

  const form = new FormData();
  const ext = extensionForVideoMime(mime);
  form.append('media', new Blob([buffer], { type: mime }), `upload.${ext}`);
  form.append('models', getSightengineModels());
  form.append('api_user', creds.apiUser);
  form.append('api_secret', creds.apiSecret);

  const res = await fetch(getSightengineVideoApiUrl(), { method: 'POST', body: form });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: 'Réponse Sightengine vidéo illisible', statusCode: res.status };
  }
  if (!res.ok) {
    const msg =
      body != null && typeof body === 'object' && 'error' in body
        ? String((body as { error?: { message?: string } }).error?.message ?? res.statusText)
        : res.statusText;
    return { ok: false, error: msg || `HTTP ${res.status}`, statusCode: res.status };
  }
  return parseVideoSightengineResponse(body);
}

async function getSightengineVideoByUrl(videoUrl: string): Promise<SightengineApiResult> {
  const creds = getSightengineCredentials();
  if (!creds) return { ok: false, error: 'Sightengine non configuré' };

  const url = new URL(getSightengineVideoApiUrl());
  url.searchParams.set('url', videoUrl);
  url.searchParams.set('models', getSightengineModels());
  url.searchParams.set('api_user', creds.apiUser);
  url.searchParams.set('api_secret', creds.apiSecret);

  const res = await fetch(url.toString(), { method: 'GET' });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: 'Réponse Sightengine vidéo illisible', statusCode: res.status };
  }
  if (!res.ok) {
    const msg =
      body != null && typeof body === 'object' && 'error' in body
        ? String((body as { error?: { message?: string } }).error?.message ?? res.statusText)
        : res.statusText;
    return { ok: false, error: msg || `HTTP ${res.status}`, statusCode: res.status };
  }
  return parseVideoSightengineResponse(body);
}

export function shouldScanVideoSource(source: string, durationSec?: number): boolean {
  const trimmed = source.trim();
  if (!trimmed) return false;
  const maxSec = getSightengineVideoSyncMaxSec();
  if (durationSec != null && durationSec > maxSec) return false;
  if (isVideoDataUrl(trimmed)) return true;
  if (shouldModerateRemoteImageUrls() && /^https:\/\//i.test(trimmed)) return true;
  return false;
}

export async function checkVideoWithSightengine(
  source: string,
  durationSec?: number,
): Promise<SightengineApiResult> {
  if (!isSightengineConfigured()) {
    return { ok: false, error: 'Sightengine non configuré' };
  }

  const trimmed = source.trim();
  if (!shouldScanVideoSource(trimmed, durationSec)) {
    return { ok: false, error: 'Vidéo non éligible à la modération sync' };
  }

  if (isVideoDataUrl(trimmed)) {
    const parsed = parseVideoDataUrl(trimmed);
    if (!parsed) return { ok: false, error: 'Data URL vidéo invalide' };
    let result: SightengineApiResult;
    try {
      result = await postSightengineVideoMultipart(parsed.buffer, parsed.mime);
    } catch (err) {
      recordApiCall('sightengine', false);
      throw err;
    }
    recordApiCall('sightengine', result.ok);
    return result;
  }

  if (/^https:\/\//i.test(trimmed)) {
    let result: SightengineApiResult;
    try {
      result = await getSightengineVideoByUrl(trimmed);
    } catch (err) {
      recordApiCall('sightengine', false);
      throw err;
    }
    recordApiCall('sightengine', result.ok);
    return result;
  }

  return { ok: false, error: 'Source vidéo non prise en charge pour la modération' };
}

export function userFacingModerationMessage(reason?: SightengineRejectReason): string {
  switch (reason) {
    case 'offensive':
      return 'Contenu visuel refusé : symboles ou contenus choquants détectés.';
    case 'erotica':
      return 'Contenu visuel refusé : contenu suggestif non autorisé.';
    case 'violent':
      return 'Contenu visuel refusé : violence, arme ou contenu choquant détecté.';
    case 'minor_risk':
      return 'Contenu visuel refusé : ce contenu ne respecte pas nos règles de protection des mineurs.';
    case 'explicit':
    default:
      return 'Contenu visuel refusé : nudité ou contenu sexuel explicite détecté.';
  }
}

export function resolveSightengineApiFailure(error: string): { allowed: boolean; skipped?: boolean } {
  if (sightengineFailOpenOnError()) {
    console.warn('[sightengine] API error (fail-open):', error);
    return { allowed: true, skipped: true };
  }
  console.error('[sightengine] API error (fail-closed):', error);
  return { allowed: false };
}
