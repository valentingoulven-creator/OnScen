import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from '../paths';
import { parseImageDataUrl } from './imageDataUrl';
import { parseVideoDataUrl } from './videoDataUrl';
import { isDeployedEnv } from './jwtSecret';

export type CsamHashSource = 'local' | 'photodna';

export interface CsamHashCheck {
  blocked: boolean;
  sha256?: string;
  source?: CsamHashSource;
  /** PhotoDNA requis mais absent ou en erreur — l'appelant doit refuser l'upload. */
  unavailable?: boolean;
}

interface BlocklistFile {
  version: 1;
  hashes: Record<string, { reason: string; at: number }>;
}

const memory = new Map<string, { reason: string; at: number }>();
let loaded = false;
let persistDisabled = false;

function blocklistPath(): string {
  return path.join(getDataDir(), 'csam-blocklist.json');
}

function loadBlocklist(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = fs.readFileSync(blocklistPath(), 'utf8');
    const parsed = JSON.parse(raw) as BlocklistFile;
    if (parsed?.version === 1 && parsed.hashes) {
      for (const [hash, meta] of Object.entries(parsed.hashes)) {
        if (/^[a-f0-9]{64}$/.test(hash)) memory.set(hash, meta);
      }
    }
  } catch {
    /* first run or unreadable — start empty */
  }
}

function persistBlocklist(): void {
  const hashes: BlocklistFile['hashes'] = {};
  for (const [hash, meta] of memory) hashes[hash] = meta;
  const file = blocklistPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, hashes } satisfies BlocklistFile), 'utf8');
  fs.renameSync(tmp, file);
}

export function sha256Buffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function extractMediaBuffer(source: string): Buffer | null {
  return parseImageDataUrl(source)?.buffer ?? parseVideoDataUrl(source)?.buffer ?? null;
}

export function rememberBlockedHash(sha256: string, reason: string): void {
  loadBlocklist();
  const hash = sha256.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) return;
  memory.set(hash, { reason, at: Date.now() });
  if (persistDisabled) return;
  try {
    persistBlocklist();
  } catch (err) {
    console.error('[csam-hash] persist failed:', err);
  }
}

export function isLocalHashBlocked(sha256: string): boolean {
  loadBlocklist();
  return memory.has(sha256.trim().toLowerCase());
}

export function resetCsamHashMatchForTests(): void {
  memory.clear();
  loaded = true;
  persistDisabled = true;
}

export function isPhotoDnaConfigured(): boolean {
  return Boolean(process.env.PHOTODNA_SUBSCRIPTION_KEY?.trim());
}

/**
 * Hash-matching CSAM obligatoire sauf opt-out explicite.
 * Env déployé (prod/préprod) : défaut true si PHOTODNA_REQUIRED est absent.
 * PHOTODNA_REQUIRED=0/false/off désactive le refus (msdev / dérogation écrite).
 */
export function isPhotoDnaRequired(): boolean {
  const raw = process.env.PHOTODNA_REQUIRED?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
  return isDeployedEnv();
}

/** Uploads + lives caméra gelés : requis et pas de clé Microsoft. */
export function isPhotoDnaBlockingLive(): boolean {
  return isPhotoDnaRequired() && !isPhotoDnaConfigured();
}

export function photoDnaUnavailableLiveResponse(): { error: string; code: string } {
  return {
    error:
      'Les lives caméra sont suspendus tant que la vérification PhotoDNA n’est pas configurée.',
    code: 'PHOTODNA_UNAVAILABLE',
  };
}

function photoDnaMatchStatus(payload: unknown): 'match' | 'nomatch' | 'error' {
  if (payload == null || typeof payload !== 'object') return 'error';
  const status = Number((payload as { Status?: unknown; status?: unknown }).Status
    ?? (payload as { status?: unknown }).status);
  if (status === 3000) return 'match';
  if (status === 3001) return 'nomatch';
  return 'error';
}

async function checkPhotoDna(buffer: Buffer): Promise<'match' | 'nomatch' | 'skip' | 'error'> {
  const key = process.env.PHOTODNA_SUBSCRIPTION_KEY?.trim();
  if (!key) return 'skip';
  const url =
    process.env.PHOTODNA_MATCH_URL?.trim() ||
    'https://api.microsoftmoderator.com/photodna/v1.0/Match';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': key,
      },
      body: JSON.stringify({
        DataRepresentation: 'Buffer',
        Value: buffer.toString('base64'),
      }),
    });
    if (!res.ok) return 'error';
    return photoDnaMatchStatus(await res.json());
  } catch {
    return 'error';
  }
}

export async function checkCsamHash(source: string): Promise<CsamHashCheck> {
  const buffer = extractMediaBuffer(source);
  if (!buffer) return { blocked: false };

  const sha256 = sha256Buffer(buffer);
  if (isLocalHashBlocked(sha256)) {
    return { blocked: true, sha256, source: 'local' };
  }

  if (isPhotoDnaConfigured()) {
    const photo = await checkPhotoDna(buffer);
    if (photo === 'match') {
      rememberBlockedHash(sha256, 'photodna');
      return { blocked: true, sha256, source: 'photodna' };
    }
    if (photo === 'error' && isDeployedEnv()) {
      return { blocked: true, sha256, source: 'photodna', unavailable: true };
    }
    return { blocked: false, sha256 };
  }

  if (isPhotoDnaRequired()) {
    return { blocked: true, sha256, source: 'photodna', unavailable: true };
  }

  return { blocked: false, sha256 };
}

export function rememberBlockedSource(source: string, reason: string): void {
  const buffer = extractMediaBuffer(source);
  if (!buffer) return;
  rememberBlockedHash(sha256Buffer(buffer), reason);
}
