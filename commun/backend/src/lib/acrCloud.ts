import crypto from 'crypto';
import {
  getAcrCloudCredentials,
  getAcrCloudHost,
  getAcrCloudMatchScoreThreshold,
  getAcrCloudMaxSampleBytes,
  isAcrCloudConfigured,
  isAcrCloudFailOpen,
  isMsdevRuntime,
} from './acrCloudConfig';
import { recordApiCall } from './apiQuotaMonitor';

export interface AcrCloudMusicMatch {
  title: string;
  artist?: string;
  score: number;
  label?: string;
}

interface AcrCloudIdentifyResponse {
  status?: { code?: number; msg?: string };
  metadata?: {
    music?: Array<{
      title?: string;
      score?: number;
      label?: string;
      artists?: Array<{ name?: string }>;
    }>;
  };
}

function buildIdentifySignature(
  accessKey: string,
  accessSecret: string,
  timestamp: string
): string {
  const stringToSign = ['POST', '/v1/identify', accessKey, 'audio', '1', timestamp].join('\n');
  return crypto.createHmac('sha1', accessSecret).update(stringToSign).digest('base64');
}

function parseTopMatch(data: AcrCloudIdentifyResponse): AcrCloudMusicMatch | null {
  const code = data.status?.code;
  if (code !== 0) return null;
  const top = data.metadata?.music?.[0];
  if (!top?.title?.trim()) return null;
  const score = typeof top.score === 'number' ? top.score : 0;
  const artist = top.artists?.[0]?.name?.trim();
  return {
    title: top.title.trim(),
    ...(artist ? { artist } : {}),
    score,
    ...(top.label?.trim() ? { label: top.label.trim() } : {}),
  };
}

/**
 * Identifie un échantillon audio via ACRCloud (empreinte catalogue ~150M morceaux).
 * Retourne null si non configuré, pas de match, ou score sous le seuil.
 */
export async function identifyCommercialMusicMatch(
  audioBuffer: Buffer
): Promise<AcrCloudMusicMatch | null> {
  if (!isAcrCloudConfigured() || audioBuffer.length < 100) return null;

  const creds = getAcrCloudCredentials();
  if (!creds) return null;

  const sampleBytes = Math.min(audioBuffer.length, getAcrCloudMaxSampleBytes());
  const sample = audioBuffer.subarray(0, sampleBytes);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = buildIdentifySignature(creds.accessKey, creds.accessSecret, timestamp);
  const host = getAcrCloudHost().replace(/\/$/, '');
  const url = `${host}/v1/identify`;

  const form = new FormData();
  form.append('sample', new Blob([sample]), 'sample.mp3');
  form.append('access_key', creds.accessKey);
  form.append('sample_bytes', String(sample.length));
  form.append('timestamp', timestamp);
  form.append('signature', signature);
  form.append('data_type', 'audio');
  form.append('signature_version', '1');

  try {
    const res = await fetch(url, { method: 'POST', body: form });
    const text = await res.text();
    let data: AcrCloudIdentifyResponse;
    try {
      data = JSON.parse(text) as AcrCloudIdentifyResponse;
    } catch {
      console.warn('[acrcloud] réponse JSON invalide:', text.slice(0, 200));
      if (!isAcrCloudFailOpen()) {
        // Recorded once in the outer catch below (this re-throws into it).
        throw new Error('ACRCLOUD_API_ERROR');
      }
      recordApiCall('acrcloud', false);
      return null;
    }

    // status.code === 0 = success ; anything else (quota exceeded, invalid
    // signature, etc.) is a real API error worth counting for quota alerts.
    recordApiCall('acrcloud', data.status?.code === 0);

    const match = parseTopMatch(data);
    if (!match) return null;

    const threshold = getAcrCloudMatchScoreThreshold();
    if (match.score < threshold) return null;

    return match;
  } catch (err) {
    console.warn('[acrcloud] identify error:', err);
    recordApiCall('acrcloud', false);
    if (!isAcrCloudFailOpen()) {
      throw err;
    }
    return null;
  }
}

export function formatCopyrightBlockMessage(match: AcrCloudMusicMatch): string {
  const parts = [`« ${match.title} »`];
  if (match.artist) parts.push(match.artist);
  const detail = parts.join(' — ');
  return `Ce fichier semble correspondre à un morceau protégé (${detail}). Vous ne pouvez publier que vos créations originales ou des fichiers dont vous avez les droits.`;
}

/**
 * Vérifie un buffer audio avant publication. Retourne un message d'erreur utilisateur ou null si OK.
 */
export async function checkUploadedAudioCopyright(audioBuffer: Buffer): Promise<string | null> {
  if (!isAcrCloudConfigured()) {
    if (!isMsdevRuntime()) {
      console.warn('[acrcloud] non configuré — scan copyright ignoré (configurez ACRCLOUD_* en production)');
    }
    return null;
  }

  try {
    const match = await identifyCommercialMusicMatch(audioBuffer);
    if (!match) return null;
    return formatCopyrightBlockMessage(match);
  } catch {
    if (isAcrCloudFailOpen()) return null;
    return 'Vérification des droits musicaux temporairement indisponible. Réessayez plus tard.';
  }
}
